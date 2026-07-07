# PrintOS-UI

Frontend for **PrintOS** — a print-shop job flow. Customers scan a shop QR, upload a
document, pay, and get a claim code; the shop releases the held job by that code.

Built with [Vite](https://vite.dev/) + React + React Router. This is the UI only; it
talks to the PrintOS cloud backend over three endpoints (see `src/api.js`).

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL. Routes:

- `/s/:shopId` — customer app (the QR encodes `shopId`)
- `/shop/:shopId/release` — shop release screen

## Configuration

The backend URL lives in a single place: `VITE_API_BASE_URL`.

1. Copy `.env.example` to `.env`.
2. Set `VITE_API_BASE_URL` (defaults to `http://localhost:8080`). Point it at the real
   cloud backend for production.

Vite exposes env vars prefixed `VITE_` via `import.meta.env`. `.env` is gitignored;
`.env.example` is committed as the template.

## Structure

```
src/
├── pages/         CustomerApp.jsx, ShopRelease.jsx (shells for now)
├── components/    shared UI (added later)
├── api.js         the 3 backend calls
├── App.jsx        routing
└── main.jsx       entry
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build
- `npm run lint` — run oxlint
