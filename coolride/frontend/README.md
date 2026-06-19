# coolride — Frontend

Mobile-first PWA for Chennai cyclists. Record GPS rides, track weather and sensors, submit post-ride feedback.

**Stack:** React 18 + Vite + TypeScript + TailwindCSS + Leaflet + Supabase

## Quick start

```bash
cd frontend
cp .env.example .env        # fill in Supabase URL and anon key
npm install
npm run dev                 # http://localhost:5173
```

## Environment variables

Copy `.env.example` to `.env` and fill:

| Variable | Source |
|----------|--------|
| `VITE_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon/public |

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | ESLint check |

## Deploy

Build output goes to `dist/`. Deploy to any static host:

```bash
npm run build
# deploy dist/ to Vercel, Netlify, Cloudflare Pages, etc.
```

Set the same env vars on the hosting platform.
