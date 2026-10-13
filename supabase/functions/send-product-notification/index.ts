import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Vary": "Origin",
};
const allowedOrigins = new Set([
  "https://eventfovoursstore-napoli.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);
function response(body: unknown, status = 200, origin = "") {
  const headers = new Headers(corsHeaders);
  if (allowedOrigins.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return new Response(JSON.stringify(body), { status, headers });
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return response({ ok: true }, 200, origin);
  if (!allowedOrigins.has(origin)) return response({ error: "Origin non consentita." }, 403, origin);
  if (req.method !== "POST") return response({ error: "Metodo non supportato." }, 405, origin);

  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return response({ error: "Accesso richiesto." }, 401, origin);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return response({ error: "Servizio non configurato." }, 503, origin);
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return response({ error: "Sessione non valida." }, 401, origin);
  const { data: membership, error: membershipError } = await admin
    .from("admin_users").select("user_id").eq("user_id", authData.user.id).maybeSingle();
  if (membershipError || !membership) return response({ error: "Solo un amministratore può inviare notifiche." }, 403, origin);

  let body: { productId?: unknown };
  try { body = await req.json(); } catch { return response({ error: "Richiesta non valida." }, 400, origin); }
  const productId = String(body.productId ?? "");
  if (!/^\d{1,18}$/.test(productId)) return response({ error: "Prodotto non valido." }, 400, origin);

  const { data: product, error: productError } = await admin
    .from("products").select("id,name,description,image_url,active").eq("id", productId).maybeSingle();
  if (productError || !product) return response({ error: "Prodotto non trovato." }, 404, origin);
  if (!product.active) return response({ error: "Il prodotto è nascosto e non può essere annunciato." }, 400, origin);

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "";
  if (!publicKey || !privateKey || !subject) {
    return response({ error: "Notifiche non configurate: completa le chiavi push negli Edge Function Secrets." }, 503, origin);
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("push_subscriptions").select("id,endpoint,p256dh,auth").limit(500);
  if (subscriptionsError) return response({ error: "Non riesco a leggere le iscrizioni." }, 500, origin);

  const payload = JSON.stringify({
    title: "Nuova creazione · EVENT FAVOURS",
    body: `${product.name} è appena arrivato nello shop. Scoprilo ora!`,
    url: "https://eventfovoursstore-napoli.github.io/event-fovours/#catalogo",
    icon: "https://eventfovoursstore-napoli.github.io/event-fovours/assets/app-icon-192.png",
    badge: "https://eventfovoursstore-napoli.github.io/event-fovours/assets/app-icon-192.png",
    image: product.image_url || undefined,
    tag: `event-favours-product-${product.id}`,
  });
  let sent = 0;
  let failed = 0;
  let removed = 0;
  await Promise.all((subscriptions ?? []).map(async (row) => {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        payload,
        { TTL: 3600, urgency: "normal" },
      );
      sent++;
    } catch (error) {
      failed++;
      const status = Number((error as { statusCode?: number }).statusCode ?? 0);
      if (status === 404 || status === 410) {
        const { error: deleteError } = await admin.from("push_subscriptions").delete().eq("id", row.id);
        if (!deleteError) removed++;
      }
    }
  }));
  return response({ ok: true, sent, failed, removed }, 200, origin);
});