# Project Dashboard

Minimal freelancer project dashboard with milestone-based progress tracking.

## Run locally

```bash
pnpm install
pnpm --filter @workspace/studio dev
```

Then open `http://localhost:5173`.

## Deploy and share

This app stores data in each person's browser using `localStorage`, so every friend gets their own separate dashboard automatically.

### Vercel

1. Push this folder to GitHub.
2. Create a new Vercel project from the repo.
3. Vercel will use `vercel.json` automatically.
4. Share the generated URL.

### Netlify

1. Push this folder to GitHub.
2. Create a new Netlify site from the repo.
3. Netlify will use `netlify.toml` automatically.
4. Share the generated URL.

## Notes

- No backend is required.
- No login is required.
- Each browser keeps its own projects locally.
