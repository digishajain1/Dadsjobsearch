# Dad's Executive + Board Opportunity Dashboard

Static dashboard for tracking Mumbai and remote senior opportunities in telecom/data center sectors, with separate streams for executive/advisory roles and board/independent director signals.

## What this includes

- Split dashboard sections:
  - Executive/Advisory roles (telecom, data center, connectivity)
  - Board/Independent Director positions
- Built-in tracker per opportunity:
  - `shortlist`, `applied`, `networking`, `interview`, `archived`
  - freeform notes
  - saved in browser `localStorage`
- Search + filters (location, tracker status, latest/all position toggle, and age profile)
- Data aggregation script with normalization and relevance scoring
- Active/latest metadata on generated opportunities, with latest postings prioritized first
- Age-friendliness guidance for 60+ applicants
- Direct company career-page links when a role-specific company URL is known
- Fallback data so UI always works even if live data sources are unavailable
- Scheduled GitHub Actions refresh at **6:00 AM and 6:00 PM IST** (`00:30` and `12:30` UTC)
- GitHub Pages deploy workflow

## Files

- `/home/runner/work/Dadsjobsearch/Dadsjobsearch/index.html` — dashboard UI
- `/home/runner/work/Dadsjobsearch/Dadsjobsearch/styles.css` — styles
- `/home/runner/work/Dadsjobsearch/Dadsjobsearch/app.js` — client logic, filters, and tracker persistence
- `/home/runner/work/Dadsjobsearch/Dadsjobsearch/data/fallback-opportunities.json` — curated fallback records
- `/home/runner/work/Dadsjobsearch/Dadsjobsearch/data/opportunities.json` — generated normalized feed for UI
- `/home/runner/work/Dadsjobsearch/Dadsjobsearch/scripts/fetch-opportunities.mjs` — refresh script
- `/home/runner/work/Dadsjobsearch/Dadsjobsearch/.github/workflows/refresh-opportunities.yml` — scheduled data refresh
- `/home/runner/work/Dadsjobsearch/Dadsjobsearch/.github/workflows/deploy-pages.yml` — GitHub Pages deployment

## Local usage

1. Refresh data:
   ```bash
   npm run refresh-data
   ```
2. Serve locally (example):
   ```bash
   python -m http.server 8080
   ```
3. Open `http://localhost:8080`.

## Deploy on GitHub Pages

1. In repo settings, enable **GitHub Pages** and choose **GitHub Actions** as source.
2. Push to `main`.
3. The `Deploy dashboard` workflow publishes the static site.
4. Use the Pages URL as the persistent shareable link.

## Data source coverage

Executive company coverage includes: Equinix, NTT Global Data Centers, STT GDC India, AdaniConneX, CtrlS, Digital Realty, Web Werks (Iron Mountain), Yotta Data Services, Princeton Digital Group, Sify Technologies, Nxtra by Airtel, Tata Communications, CapitaLand (Ascendas), Colt DCS, Reliance Jio.

Board signal coverage includes NSE/BSE filings, executive search firm signals (Egon Zehnder, Korn Ferry, Spencer Stuart, Heidrick & Struggles, Russell Reynolds, Gladwin International), IICA Independent Director's Databank, and Prime Database.

> Executive roles are filtered to salary floor of **₹60L+**.
