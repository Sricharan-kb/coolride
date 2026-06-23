# coolride Backend

Supabase backend for coolride - PostgreSQL + PostGIS + RLS + Edge Functions.

## Prerequisites

1. A Supabase project at [supabase.com](https://supabase.com) (Mumbai `ap-south-1` region)
2. [Supabase CLI](https://supabase.com/docs/reference/cli) installed (optional, for local dev / edge function deploy)
3. A free [WeatherAPI.com](https://www.weatherapi.com) key

## Setup

### 1. Database Schema

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Open `supabase/migrations/001_schema.sql`
4. Copy and paste the entire file content into the SQL Editor
5. Click **Run**

This creates:
- `rides`, `ride_points`, `ride_feedback` tables
- PostGIS extension
- All indexes
- Row Level Security policies
- `update_ride_route` RPC function

### 2. Edge Function: Weather Proxy

#### Set the API key secret

1. In Supabase Dashboard, go to **Settings → Edge Functions → Secrets**
2. Add a new secret:
   - **Name:** `WEATHERAPI_KEY`
   - **Value:** your WeatherAPI.com API key

#### Deploy the function

Using Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy weather
```

Or deploy manually from the Supabase Dashboard:

1. Go to **Edge Functions**
2. Click **Create a new function** → name it `weather`
3. Copy the contents of `supabase/functions/weather/index.ts`
4. Click **Deploy**

### 3. Auth Configuration

1. In Supabase Dashboard → **Authentication → Providers**:
   - Enable **Email** provider
2. In **Authentication → Settings**:
   - Set **Site URL** to `http://localhost:5173`
3. (Optional for dev) Under **Email → Confirm email**: disable

### 4. Verify

Test the weather function (**POST-only**, JSON body):
```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/weather" \
  -H "Content-Type: application/json" \
  -d '{"lat":13.0827,"lon":80.2707}'
```

Expected response:
```json
{
  "temperature": 34.2,
  "humidity": 62,
  "feels_like": 37.8,
  "description": "partly cloudy",
  "icon": "https://cdn.weatherapi.com/weather/64x64/day/116.png"
}
```
