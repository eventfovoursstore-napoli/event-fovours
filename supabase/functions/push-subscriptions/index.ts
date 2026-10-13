import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
function validEndpoint(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase();
    const pushHost = host === "fcm.googleapis.com"
      || host === "updates.push.services.mozilla.com"
      || host.endsWith(".push.apple.com")
      || host.endsWith(".notify.windows.com")
      || host.endsWith(".push.services.mozilla.com");
    return u.protocol === "https:" && !u.username && !u.password && !u.port && pushHost;
  } catch { return false; }
}
function validKey(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,256}$/.test(value);
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return response({ ok: true }, 200, origin);
  if (!allowedOrigins.has(origin)) return response({ error: "Origin non consentita." }, 403, origin);

  const apiKey = req.headers.get("apikey") ?? "";
  const publicKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
  const acceptedKeys = [publicKeys.default, Deno.env.get("SUPABASE_ANON_KEY")].filter(Boolean);
  if (!acceptedKeys.includes(apiKey)) return response({ error: "Chiave pubblica non valida." }, 401, origin);

  if (req.method === "GET") {
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    return response({ enabled: Boolean(publicKey), publicKey: publicKey || null }, 200, origin);
  }
  if (req.method !== "POST" && req.method !== "DELETE") {
    return response({ error: "Metodo non supportato." }, 405, origin);
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!serviceKey || !supabaseUrl) return response({ error: "Servizio non configurato." }, 503, origin);
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return response({ error: "Richiesta non valida." }, 400, origin); }
  if (req.method === "POST") {
    const subscription = body.subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined;
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;
    if (!validEndpoint(endpoint) || !validKey(p256dh) || !validKey(auth)) {
      return response({ error: "Iscrizione notifiche non valida." }, 400, origin);
    }
    const { error } = await admin.from("push_subscriptions").upsert(
      { endpoint, p256dh, auth, updated_at: new Date().toISOString() },
      { onConflict: "endpoint" },
    );
    if (error) return response({ error: "Non è stato possibile salvare l’iscrizione." }, 500, origin);
    return response({ ok: true }, 200, origin);
  }

  const endpoint = body.endpoint;
  if (!validEndpoint(endpoint)) return response({ error: "Iscrizione non valida." }, 400, origin);
  const { error } = await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return response({ error: "Non è stato possibile rimuovere l’iscrizione." }, 500, origin);
  return response({ ok: true }, 200, origin);
});