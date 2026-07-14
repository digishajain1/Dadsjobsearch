# Dad's Job Search Dashboard

A deployment-ready static dashboard for senior telecom, data center, advisory, and board opportunities.

## What it does

- refreshes relevant job opportunities twice a day via GitHub Actions
- keeps executive/advisory and board roles in separate sections
- lets your dad track shortlist, applications, interviews, and notes in his browser
- deploys as a simple GitHub Pages site he can open from any device

## Local usage

```bash
npm ci
npm run refresh-data
npm test
npm run serve
```

Then open `http://localhost:4173` in a browser.

## Deployment link

Once GitHub Pages is enabled for Actions, the dashboard will be available at:

https://digishajain1.github.io/Dadsjobsearch/

## Automation

- `.github/workflows/refresh-opportunities.yml` refreshes the cached data at 00:00 and 12:00 UTC
- `.github/workflows/deploy-pages.yml` deploys the `site/` folder to GitHub Pages

## Notes

- live data is sourced from public job APIs where available and falls back to cached results when a source is unavailable
- tracker notes are stored in the browser with `localStorage`, so each user keeps their own private tracking state
