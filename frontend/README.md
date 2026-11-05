# Frontend

## Local development

Install dependencies and start the Vite development server:

```sh
npm install
npm run dev
```

By default, Vite proxies `/api` requests to `http://localhost:3000`. To use a
different backend locally, copy `.env.example` to `.env.local` and set
`VITE_API_URL` to the backend origin (without a trailing slash or `/api`).

## Deploying to Vercel

Create a Vercel project for this repository and set its **Root Directory** to
`frontend`. Vercel uses `npm run build` and `dist` as the output directory.

In the Vercel project's Environment Variables, set:

```text
VITE_API_URL=https://your-backend.onrender.com
```

Use the public origin of the Render web service, without a trailing slash or
`/api`. Vite embeds `VITE_` variables into browser code at build time, so
redeploy after changing this value. Do not put secrets in frontend variables.

The backend must be deployed and reachable at that URL. It currently allows
cross-origin API requests; authentication is sent using bearer tokens.
