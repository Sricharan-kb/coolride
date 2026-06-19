// Shared CORS headers for all edge functions.
// Spread these into every Response (including the OPTIONS preflight branch)
// so the browser never blocks a cross-origin request before our code runs.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, apikey, x-client-info, x-client-info-2",
  "Access-Control-Max-Age": "86400",
};

// Build a JSON response with CORS headers attached. DRYs up the repeated
// `new Response(JSON.stringify(...), { headers: { ...corsHeaders, ... } })`.
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
