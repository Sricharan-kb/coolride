// WeatherAPI.com proxy. POST-only — the SPA sends { lat, lon } as JSON.
// The WeatherAPI key is kept server-side via Supabase Edge Function secrets.
//
// CORS is inlined (not in _shared/) because this is deployed via the Supabase
// Dashboard editor, which is single-file and can't resolve a sibling import.

const WEATHERAPI_KEY = Deno.env.get("WEATHERAPI_KEY");
const WEATHERAPI_BASE = "https://api.weatherapi.com/v1/current.json";
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "https://coolride.vercel.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, apikey, x-client-info, x-client-info-2",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isJwtExpired(token: string): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload) return true;
    const decoded = JSON.parse(atob(payload));
    const now = Math.floor(Date.now() / 1000);
    return typeof decoded.exp === "number" && decoded.exp < now;
  } catch {
    return true;
  }
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // JWT verification — block unauthenticated requests to protect WeatherAPI quota
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }
  const token = authHeader.slice(7);
  if (isJwtExpired(token)) {
    return json({ error: "Token expired" }, 401);
  }

  let body: { lat?: number; lon?: number } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const lat = body.lat;
  const lon = body.lon;

  if (lat == null || lon == null) {
    return json({ error: "lat and lon are required" }, 400);
  }

  const apiUrl = `${WEATHERAPI_BASE}?key=${WEATHERAPI_KEY}&q=${lat},${lon}&aqi=no`;

  let response: Response;
  let data: Record<string, unknown>;

  try {
    response = await fetch(apiUrl);
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Failed to fetch weather data" }, 502);
  }

  if (!response.ok) {
    const msg =
      typeof data?.error === "object" && data.error !== null && "message" in data.error
        ? String((data.error as Record<string, unknown>).message)
        : "Weather fetch failed";
    return json({ error: msg }, response.status);
  }

  const current = data?.current as Record<string, unknown> | undefined;
  if (!current) {
    return json({ error: "Unexpected weather API response" }, 502);
  }

  const result = {
    temperature: current.temp_c,
    humidity: current.humidity,
    feels_like: current.feelslike_c,
    description: (current.condition as Record<string, unknown>)?.text,
    icon: "https:" + String(((current.condition as Record<string, unknown>)?.icon) || ""),
  };

  return json(result);
});
