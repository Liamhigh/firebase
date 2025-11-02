# Verum Omnis V2 — Web + APK

Production-ready single-page web chat + evidence pipeline. This repo serves the `/web` app via Firebase Hosting and ships APK/AAB separately. The root `index.html` now **redirects cleanly to** `/web/index.html` (no AI Studio CDN importmaps).

---

<p align="center">
  <a href="https://aistudio.google.com/" target="_blank">
    <img src="https://img.shields.io/badge/Open%20in-Google%20AI%20Studio-4285F4?logo=google&logoColor=white&labelColor=1a73e8&style=for-the-badge" alt="Open in Google AI Studio"/>
  </a>
</p>

> **Tip:** If you have a specific AI Studio *App* or *Prompt* link, replace the URL above with your share URL, e.g.:
> - `https://aistudio.google.com/app/your-app-id`
> - `https://aistudio.google.com/prompts/new_chat?pli=1`

---

## Quick Start (Local)

```bash
# Node 20+ recommended
npm i
npm run dev
# open http://localhost:5173 or whatever Vite prints
