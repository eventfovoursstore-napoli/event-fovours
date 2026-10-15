import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const allowedOrigins = new Set([
  "https://eventfovoursstore-napoli.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);
function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    ...(allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders(req), "Content-Type": "application/json" },
});

function apiKeyFromEnv(modernName: string, legacyName: string): string {
  const raw = Deno.env.get(modernName);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string") return parsed;
      if (parsed && typeof parsed.default === "string") return parsed.default;
      if (parsed && typeof parsed === "object") {
        const first = Object.values(parsed).find((value) => typeof value === "string");
        if (typeof first === "string") return first;
      }
    } catch {
      // Fall back to the legacy environment variable below.
    }
  }
  return Deno.env.get(legacyName) || "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Metodo non consentito." }, 405);

  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const url = Deno.env.get("SUPABASE_URL") || "";
    const publishable = apiKeyFromEnv("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
    if (!token || !url || !publishable) return json(req, { error: "Accedi di nuovo come amministratore." }, 401);

    const userClient = createClient(url, publishable, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json(req, { error: "Accedi di nuovo come amministratore." }, 401);

    const secretKey = apiKeyFromEnv("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
    if (!secretKey) return json(req, { error: "Configurazione server Supabase incompleta." }, 503);
    const service = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: admin, error: adminError } = await service.from("admin_users").select("user_id").eq("user_id", authData.user.id).maybeSingle();
    if (adminError || !admin) return json(req, { error: "Questa funzione è riservata all’amministratore." }, 403);

    const apiKey = Deno.env.get("BREVO_API_KEY") || "";
    if (!apiKey) return json(req, { error: "Per attivare gli invii, aggiungi la chiave API Brevo ai secret Supabase." }, 503);
    const senderEmail = (Deno.env.get("BREVO_SENDER_EMAIL") || "eventfovours.store@gmail.com").trim();
    const senderName = (Deno.env.get("BREVO_SENDER_NAME") || "EVENT FAVOURS").trim();
    const configuredListId = Number(Deno.env.get("BREVO_LIST_ID") || 0);
    if (!senderEmail || !senderEmail.includes("@") || (configuredListId && (!Number.isSafeInteger(configuredListId) || configuredListId < 1))) {
      return json(req, { error: "Controlla mittente e lista Brevo nelle impostazioni." }, 503);
    }

    const input = await req.json();
    const subject = String(input.subject || "").trim();
    const message = String(input.message || "").trim();
    if (subject.length < 3 || subject.length > 140 || message.length < 10 || message.length > 10000) {
      return json(req, { error: "Inserisci un oggetto e un messaggio validi." }, 400);
    }

    const { data: subscribers, error: subscriberError } = await service.from("newsletter_subscribers")
      .select("email").order("created_at", { ascending: true }).limit(10000);
    if (subscriberError) return json(req, { error: "Non riesco a leggere gli iscritti consenzienti." }, 502);
    const activeEmails = new Set((subscribers || []).map((s) => String(s.email || "").trim().toLowerCase()).filter(Boolean));
    if (!activeEmails.size) return json(req, { error: "Non ci sono iscritti che hanno dato il consenso." }, 409);

    const listId = configuredListId || await getOrCreateNewsletterList(apiKey);
    const existingContacts = new Map<string, Record<string, unknown>>();
    let offset = 0;
    while (offset < 100000) {
      const response = await brevo(apiKey, `contacts/lists/${listId}/contacts?limit=500&offset=${offset}`);
      if (!response.ok) return json(req, { error: "Brevo non riesce a leggere la lista. Controlla l’accesso API." }, 502);
      const page = await response.json();
      const contacts = Array.isArray(page.contacts) ? page.contacts : [];
      for (const contact of contacts) existingContacts.set(String(contact.email || "").toLowerCase(), contact);
      offset += contacts.length;
      if (!contacts.length || offset >= Number(page.count || 0)) break;
    }

    const remove = [...existingContacts.values()].filter((contact) => {
      const email = String(contact.email || "").toLowerCase();
      const unsubscribed = Array.isArray(contact.listUnsubscribed) && contact.listUnsubscribed.includes(listId);
      return !activeEmails.has(email) || contact.emailBlacklisted === true || unsubscribed;
    }).map((contact) => String(contact.email || ""));
    for (let i = 0; i < remove.length; i += 500) {
      const response = await brevo(apiKey, `contacts/lists/${listId}/contacts/remove`, "POST", { emails: remove.slice(i, i + 500) });
      if (!response.ok) return json(req, { error: "Brevo non riesce ad aggiornare i contatti disiscritti." }, 502);
    }

    const suppressed = new Set(remove.map((email) => email.toLowerCase()));
    const add = [...activeEmails].filter((email) => !existingContacts.has(email) && !suppressed.has(email));
    for (const email of add) {
      const known = await brevo(apiKey, `contacts/${encodeURIComponent(email)}`);
      if (known.ok) {
        const contact = await known.json();
        const optedOut = contact.emailBlacklisted === true || (Array.isArray(contact.listUnsubscribed) && contact.listUnsubscribed.includes(listId));
        if (optedOut) continue;
        const response = await brevo(apiKey, `contacts/lists/${listId}/contacts/add`, "POST", { emails: [email] });
        if (!response.ok) return json(req, { error: "Brevo non riesce a sincronizzare gli iscritti." }, 502);
      } else if (known.status === 404) {
        const response = await brevo(apiKey, "contacts", "POST", { email, listIds: [listId] });
        if (!response.ok && response.status !== 400) return json(req, { error: "Brevo non riesce a creare un contatto." }, 502);
      } else return json(req, { error: "Brevo non è al momento raggiungibile." }, 502);
    }

    const deliverableCount = [...activeEmails].filter((email) => !suppressed.has(email)).length;
    if (!deliverableCount) return json(req, { error: "Tutti gli iscritti risultano disiscritti su Brevo." }, 409);

    const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#382719;line-height:1.65"><div style="text-align:center;padding:18px"><strong style="color:#a77a22;font-size:22px">EVENT FAVOURS</strong></div><div style="white-space:pre-wrap">${escapeHtml(message)}</div><p style="margin-top:28px">A presto,<br>EVENT FAVOURS</p></div>`;
    const campaignName = `EVENT FAVOURS · ${subject} · ${new Date().toISOString().slice(0, 10)}`.slice(0, 120);
    const created = await brevo(apiKey, "emailCampaigns", "POST", {
      name: campaignName,
      sender: { name: senderName, email: senderEmail },
      subject,
      previewText: subject.slice(0, 100),
      htmlContent: html,
      footer: "[DEFAULT_FOOTER]",
      recipients: { listIds: [listId] },
      tag: "event-favours-newsletter",
    });
    if (!created.ok) return json(req, { error: "Brevo non ha accettato la campagna. Verifica che mittente e footer siano configurati." }, 502);
    const campaign = await created.json();
    const sent = await brevo(apiKey, `emailCampaigns/${campaign.id}/sendNow`, "POST", {});
    if (!sent.ok) return json(req, { error: "Brevo ha salvato la campagna ma non l’ha inviata. Verifica lo stato in Brevo.", campaign_id: campaign.id }, 502);
    return json(req, { ok: true, campaign_id: campaign.id, recipients: deliverableCount });
  } catch {
    return json(req, { error: "Errore durante l’invio. Riprova o controlla la configurazione Brevo." }, 500);
  }
});

async function getOrCreateNewsletterList(apiKey: string): Promise<number> {
  const folderName = "EVENT FAVOURS";
  const listName = "EVENT FAVOURS Newsletter";
  const folderResponse = await brevo(apiKey, "contacts/folders?limit=50&offset=0");
  if (!folderResponse.ok) throw new Error("Brevo folders unavailable");
  const folderPage = await folderResponse.json();
  let folder: Record<string, unknown> | undefined = (Array.isArray(folderPage.folders) ? folderPage.folders : []).find((item: Record<string, unknown>) =>
    String(item.name || "").toLocaleLowerCase() === folderName.toLocaleLowerCase()
  );

  if (!folder) {
    const createdFolder = await brevo(apiKey, "contacts/folders", "POST", { name: folderName });
    if (!createdFolder.ok) throw new Error("Brevo folder creation failed");
    folder = await createdFolder.json();
  }

  const folderId = Number(folder.id);
  if (!Number.isSafeInteger(folderId) || folderId < 1) throw new Error("Brevo folder id invalid");
  const listsResponse = await brevo(apiKey, `contacts/folders/${folderId}/lists?limit=50&offset=0`);
  if (!listsResponse.ok) throw new Error("Brevo lists unavailable");
  const listPage = await listsResponse.json();
  const existing = (Array.isArray(listPage.lists) ? listPage.lists : []).find((item: Record<string, unknown>) =>
    String(item.name || "").toLocaleLowerCase() === listName.toLocaleLowerCase()
  );
  if (existing) {
    const id = Number(existing.id);
    if (Number.isSafeInteger(id) && id > 0) return id;
  }

  const createdList = await brevo(apiKey, "contacts/lists", "POST", { folderId, name: listName });
  if (!createdList.ok) throw new Error("Brevo list creation failed");
  const list = await createdList.json();
  const id = Number(list.id);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("Brevo list id invalid");
  return id;
}

async function brevo(apiKey: string, path: string, method = "GET", body?: unknown): Promise<Response> {
  return await fetch(`https://api.brevo.com/v3/${path}`, {
    method,
    headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
