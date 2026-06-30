# Veritas Ventures — Parent-Company Site

Public site for **Veritas Ventures Group**, the parent holding company, at
**veritasgrouptx.com**. Static HTML/CSS/vanilla JS served by a small Express
server (`server.js`) that also powers the **AI intake chatbot**. No build step.

See [`README.md`](README.md) for the plain-English editing guide. Quick
orientation below.

## Stack & layout
- No framework, no bundler. Edit a file, push to GitHub, it auto-deploys.
- `index.html` — Ventures home; `builders.html` — Builders sub-page (if present).
- `styles.css` — ALL colors/fonts/spacing. CSS vars live in the top `:root` block:
  `--vv-*` = Veritas Ventures palette (accent burnt orange `#F05510`),
  `--vb-*` = Veritas Builders palette (accent electric blue `#0066FF`).
- `main.js` — nav/scroll. `map.js` — service-area map. `chat.js` — chat widget.
  `server.js` — Express host + AI chat + lead email.
- `images/` — logos and site images.

## Run
- `npm start` → `node server.js` (listens on `$PORT`, default 3000). Node >= 18.

## Chatbot / env vars (set in Railway → Variables)
Same intake chatbot as the Builders site: `ANTHROPIC_API_KEY`,
`ANTHROPIC_MODEL` (default `claude-haiku-4-5`), `GMAIL_USER`,
`GMAIL_APP_PASSWORD`, `LEAD_TO`, and `BUILDERS_APP_URL` + `WEBSITE_INTAKE_TOKEN`
(forwards leads to the ops app). Degrades gracefully when AI/email creds are
unset — the site never breaks.

## Sister projects (separate repos, same parent folder)
- `../veritas-builders-site` — Builders marketing site (veritasbuilderstx.com).
- `../app` — Veritas Builders ops app (internal tool, veritasbuilders.app).
