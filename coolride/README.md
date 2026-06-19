# coolride

Heat-aware cycling tracker for Chennai. Record GPS rides, view real-time weather and sensor data, submit post-ride comfort feedback.

---

## Architecture

```
┌─────────────────┐          ┌──────────────────────────┐
│   Vercel (CDN)  │          │   Supabase Cloud (BaaS)  │
│                 │          │                          │
│  React SPA      │◄────────►│  Auth (email/password)   │
│  Leaflet maps   │  REST    │  PostgreSQL + PostGIS    │
│  TailwindCSS    │          │  Edge Functions (Deno)   │
│                 │          │  Row Level Security      │
└─────────────────┘          └──────────────────────────┘
                                     │
                                     ▼
                              ┌──────────────────┐
                              │  WeatherAPI.com  │
                              │  (proxied via    │
                              │   Edge Function) │
                              └──────────────────┘
```

No Node server, no FastAPI — Supabase is the entire backend. The React app talks directly to Supabase via its JS client. RLS policies enforce per-user data isolation.

---

## Quick start

### 1. Supabase (backend)

1. Create a project at [supabase.com](https://supabase.com) — pick **Mumbai (ap-south-1)**
2. Go to **SQL Editor** → paste all of `backend/supabase/migrations/001_schema.sql` → click Run
3. Go to **Settings → Edge Functions → Secrets** → add:
   ```
   WEATHERAPI_KEY = your_key_from_weatherapi.com
   ```
4. Deploy the weather function:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase functions deploy weather
   ```
5. Go to **Authentication → Settings** → set Site URL to `http://localhost:5173`
6. From **Settings → API**, copy the Project URL and anon key

### 2. Frontend (local)

```bash
cd frontend
cp .env.example .env          # paste Supabase URL and anon key
npm install
npm run dev                   # http://localhost:5173
```

### 3. Verify

```
curl "https://<project-ref>.supabase.co/functions/v1/weather?lat=13.0827&lon=80.2707"
```

---

## Environment variables

| Variable | Where | Source |
|----------|-------|--------|
| `VITE_SUPABASE_URL` | `frontend/.env` | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | `frontend/.env` | Supabase → Settings → API → anon/public |
| `WEATHERAPI_KEY` | Supabase secret manager | [weatherapi.com](https://www.weatherapi.com) free tier |

`VITE_*` keys are public — shipped to the browser (safe because RLS restricts data access). `WEATHERAPI_KEY` is private — stored in Supabase's cloud secret manager, never reaches the browser.

---

## Deploy

### Frontend — Vercel

1. Push this repo to GitHub
2. Import in [Vercel](https://vercel.com) → set **Root Directory** to `frontend`
3. Add environment variables:

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | your anon key |

4. Deploy → Vercel auto-detects Vite and builds `dist/`

### Backend — already live

Supabase is cloud-hosted. Once the schema is run, the edge function is deployed, and the secret is set, it's done. Set the Site URL in Auth settings to your Vercel domain so email login works.

---

## Project structure

```
coolride/
├── frontend/                     # React 18 + Vite + TypeScript + TailwindCSS
│   ├── src/
│   │   ├── App.tsx               # Auth gating, tabs, ride state machine, dark mode
│   │   ├── components/
│   │   │   ├── Auth/             # LoginForm, RegisterForm
│   │   │   ├── Map/              # RideMap (Leaflet + OSM tiles)
│   │   │   ├── Ride/             # RideControls, LiveStats, RideFeedbackModal, RideTimeline
│   │   │   ├── Weather/          # WeatherWidget (floating, live updates)
│   │   │   └── Profile/          # RideHistory (list + detail view)
│   │   ├── hooks/                # useGeolocation, useSensors, useWeather
│   │   ├── lib/                  # supabase.ts, geo.ts
│   │   └── types/                # Ride, RidePoint, RideFeedback, WeatherData
│   └── .env.example
├── backend/
│   └── supabase/
│       ├── migrations/
│       │   └── 001_schema.sql    # rides, ride_points, ride_feedback + RLS + PostGIS
│       └── functions/
│           └── weather/          # WeatherAPI.com proxy (Deno/TypeScript)
├── SPEC.md                       # Full specification
├── frontend.md                   # Frontend coding instructions
├── backend.md                    # Backend coding instructions
├── review.md                     # Review checklist
└── review_report.md              # Latest review findings
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, TailwindCSS 3 |
| Maps | Leaflet + OpenStreetMap (free, no API key) |
| Backend | Supabase (PostgreSQL 15, PostGIS, Auth) |
| Serverless | Supabase Edge Functions (TypeScript/Deno) |
| Weather | WeatherAPI.com (proxied, no key sent to browser) |
| Sensors | Browser APIs: Geolocation, AmbientLightSensor, DeviceMotion |
| Hosting | Vercel (frontend CDN), Supabase Cloud (backend) |

---

## Scripts

```bash
cd frontend
npm run dev        # Start dev server
npm run build      # TypeScript check + production build
npm run preview    # Preview production build
npm run lint       # ESLint
```
