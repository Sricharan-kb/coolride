import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const WEATHERAPI_KEY = Deno.env.get("WEATHERAPI_KEY");
const WEATHERAPI_BASE = "https://api.weatherapi.com/v1/current.json";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  let body: { lat?: number; lon?: number } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { lat, lon } = body;

  if (lat == null || lon == null) {
    return new Response(JSON.stringify({ error: "lat and lon are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiUrl = `${WEATHERAPI_BASE}?key=${WEATHERAPI_KEY}&q=${lat},${lon}&aqi=no`;

  let response: Response;
  let data: Record<string, unknown>;

  try {
    response = await fetch(apiUrl);
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: "Failed to fetch weather data" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!response.ok) {
    const msg =
      typeof data?.error === "object" && data.error !== null && "message" in data.error
        ? String((data.error as Record<string, unknown>).message)
        : "Weather fetch failed";
    return new Response(JSON.stringify({ error: msg }), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const current = data?.current as Record<string, unknown> | undefined;
  if (!current) {
    return new Response(JSON.stringify({ error: "Unexpected weather API response" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = {
    temperature: current.temp_c,
    humidity: current.humidity,
    feels_like: current.feelslike_c,
    description: (current.condition as Record<string, unknown>)?.text,
    icon: "https:" + String(((current.condition as Record<string, unknown>)?.icon) || ""),
  };

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
