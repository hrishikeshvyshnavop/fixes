# Fixes: website feedback widget

A Ruttl-style tool. Drop one script tag on any site. Reviewers click anywhere on the live page to pin a comment, with a screenshot and browser details attached automatically. Your team triages everything from a dashboard.

## Run it

```bash
npm install
npm run dev          # builds public/widget.js, then starts Next.js
```

- Dashboard: http://localhost:3000
- Demo site with the widget installed: http://localhost:3000/demo.html (project key `pk_demo`)

No database setup is needed for local dev. It uses **PGlite** (Postgres compiled to WASM), stored in `./.pglite`. Delete that folder to reset.

If you change files in `widget/`, run `npm run widget:watch` in a second terminal.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Neon, Supabase, RDS…). When set, it's used instead of PGlite. Tables are created on first start. |
| `PGLITE_DIR` | Where PGlite stores data (default `./.pglite`). |
| `APP_URL` | Public HTTPS address of this Fixes deployment, e.g. `https://fixes.yourcompany.com`. Install snippets use it. Without it they use whatever address the dashboard was opened on, which only works on your machine when that's localhost. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Turns on **Continue with Google**. Create a Web OAuth client in Google Cloud and add the redirect URI `<APP_URL>/api/auth/google/callback` (locally: `http://localhost:3001/api/auth/google/callback`). Workspace → Settings shows the exact URI. |

## Accounts & team access

- The dashboard requires an account (email + password, hashed with scrypt). Sign up at `/signup`.
- **The first account created on an install becomes owner of every project that has no members yet**, including projects created before accounts existed.
- Each project has **Owners** (settings, members, invites, delete) and **Members** (triage feedback: reply, resolve, delete comments). A project always keeps at least one owner.
- To invite someone, go to **Project → Settings → Members** and create an invite for their email. You get a link to send them. It's single-use, expires in 7 days, and can only be accepted by someone signed in as that email. Only a hash of the token is stored, so the link is shown once; invite the same email again to get a new one.
- People leaving feedback through the widget never need an account.

There's no email sending or password reset yet. Sessions last 30 days, in an httpOnly cookie.

## Install on a site

```html
<script src="https://YOUR_HOST/widget.js" data-key="pk_xxx" async></script>
```

Copy the exact snippet from the project page in the dashboard. Set **Allowed origins** on the project to stop other sites from posting with your key.

## How it works

```
widget/            Vanilla TS, Shadow DOM UI, bundled by esbuild to public/widget.js (~26 KB)
  index.ts         pick mode, pins, composer/thread cards, screenshot capture (html-to-image)
  selector.ts      stable CSS selector for the clicked element (id / data-testid / nth-of-type path)
src/db/            Drizzle schema + driver switch (PGlite ↔ node-postgres) + bootstrap SQL
src/app/api/widget Public CORS API: list/create comments, reply, resolve
src/app/           Dashboard (server components + server actions)
src/lib/auth.ts    Accounts, sessions, project access checks
src/middleware.ts  Redirects signed-out visitors to /login (widget API stays public)
```

Each pin is stored as **element selector + relative offset inside that element**, plus an absolute page position as a fallback. Pins stay attached to their element when the layout reflows or the viewport changes. Comments are grouped per page by `origin + pathname`, so query strings and hashes don't split them. SPA route changes are picked up automatically.

## Known MVP limits / next steps

- Screenshots are stored inline in Postgres as JPEG data URLs (about 40–150 KB each). Move them to S3/R2 before heavy use.
- Widget reviewers are identified only by a name saved in localStorage.
- No email delivery (invites are copy-paste links), password reset, or login rate limiting yet.
- Not built yet: proxy mode for commenting without installing a script, live CSS/text editing, email/Slack/Jira notifications, video feedback.
