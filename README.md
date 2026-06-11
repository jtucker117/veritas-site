# The Veritas Companies — Website

A clean, fast, static two-page site. No build step, no frameworks — just HTML, CSS, and a tiny bit of JavaScript. Edit a file, push to GitHub, and it deploys automatically.

```
veritas-site/
├── index.html      ← Veritas Ventures (home page)
├── builders.html   ← Veritas Builders (sub-page)
├── styles.css      ← ALL colors, fonts, spacing + styles
├── main.js         ← nav menu, scroll effects (rarely needs editing)
├── images/         ← logos live here
└── README.md       ← this file
```

---

## ✏️ How to edit the things you asked about

### 1. Change COLORS
Open `styles.css`. Everything is at the very top in the `:root { ... }` block.

- **Veritas Ventures** colors start with `--vv-` (e.g. `--vv-accent: #F05510;` is the burnt orange).
- **Veritas Builders** colors start with `--vb-` (e.g. `--vb-accent: #0066FF;` is the electric blue).

Change the hex code once and it updates across the whole site. You don't need to touch anything else.

### 2. Change HEADERS / text
Open `index.html` (Ventures) or `builders.html` (Builders). Each section has a clear comment, e.g. `<!-- ================= HERO ================= -->`. Find the section, edit the text between the tags. That's it.

- The big headline is inside `<h1>...</h1>` in the HERO section.
- The orange/blue highlighted words use `<span class="accent">word</span>`.

### 3. Swap the LOGO
The logos are images in the `images/` folder:

| File | Used on | When to use |
|------|---------|-------------|
| `veritas-ventures-logo-dark.png` | Ventures (dark pages) | white text version — what's live now |
| `veritas-ventures-logo.png` | (spare) | original dark-on-transparent, for light backgrounds |
| `veritas-builders-logo-dark.png` | Builders (dark pages) | white text version — what's live now |
| `veritas-builders-logo.png` | (spare) | original dark-on-transparent, for light backgrounds |

**To replace a logo:** drop your new file into `images/` and either (a) give it the same filename as above, or (b) update the `src="images/..."` in the `<img>` tag inside the `.logo` link in the HTML. Logo height is set inline (e.g. `style="height:40px"`) — adjust that number to resize.

### 4. Change FONTS
- Ventures uses **Montserrat**, Builders uses **Poppins** (matching your brand kit).
- They're loaded in the `<head>` of each HTML file and set in `styles.css` under `--font-ventures` / `--font-builders`.

---

## 🚀 Deploy (GitHub → Netlify → your Railway domain)

1. **Push to GitHub** — create a repo and push this folder.
2. **Netlify** — "Add new site" → "Import from Git" → pick the repo.
   - Build command: *(leave blank)*
   - Publish directory: `.` (the root)
   - Deploys automatically on every `git push`.
3. **Custom domain** — Netlify → Domain settings → "Add custom domain" → enter your domain. Netlify shows you DNS records.
4. **Railway DNS** — open your domain's DNS settings in Railway and add the records Netlify gave you (an A/ALIAS record + a `www` CNAME). HTTPS turns on automatically once DNS propagates.

---

## 🚂 Going live on Railway (your domain is already there)

This project includes a tiny `server.js` (Express) so Railway can host it.

1. **Push to GitHub** (see commands below).
2. In **Railway** → New Project → **Deploy from GitHub repo** → pick this repo.
   - Railway auto-detects Node, runs `npm install`, then `npm start`.
   - No build command needed; it serves the static files.
3. **Custom domain:** Railway project → your service → **Settings → Networking → Custom Domain** → add your domain. Since the domain was bought through Railway, it links automatically (Railway manages the DNS + HTTPS).
4. Every `git push` redeploys automatically.

### First-time GitHub push
```bash
# from the veritas-site folder
git remote add origin https://github.com/<your-username>/<your-repo>.git
git branch -M main
git push -u origin main
```

## Adding custom / stock images later
1. Drop the image file into the `images/` folder.
2. Reference it in the HTML, e.g. `<img src="images/my-photo.jpg" alt="...">`, or set a CSS `background-image: url('images/my-photo.jpg')`.
3. `git add . && git commit -m "add image" && git push` — Railway redeploys automatically.

## Notes
- Both pages share `styles.css`, so a color/spacing tweak applies everywhere consistently.
- The site is fully responsive (mobile menu included) and supports reduced-motion preferences.
- Want a contact form, more company pages, or a real logo file swap? Easy to extend.
