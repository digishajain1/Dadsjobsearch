import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { buildDashboardPayload, classifyOpportunity, dedupeAndRank, summarizeText } from './opportunity-utils.mjs';

const DATA_PATH = new URL('../site/data/opportunities.json', import.meta.url);

async function fetchJson(url, label) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'dadsjobsearch-dashboard/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`${label} returned ${response.status}`);
  }

  return response.json();
}

function normalizeCommon(fields) {
  const classification = classifyOpportunity(fields);
  return {
    ...fields,
    ...classification,
    description: summarizeText(fields.description),
    locationBucket: classification.locationBucket,
    tags: [...new Set([...(fields.tags || []), ...classification.tags])].slice(0, 10)
  };
}

async function fetchRemotive() {
  const data = await fetchJson('https://remotive.com/api/remote-jobs', 'Remotive');
  return (data.jobs || []).map((job) =>
    normalizeCommon({
      title: job.title,
      company: job.company_name,
      location: job.candidate_required_location || 'Remote',
      url: job.url,
      source: 'Remotive',
      publishedAt: job.publication_date,
      description: job.description,
      tags: [job.category, ...(job.tags || [])].filter(Boolean)
    })
  );
}

async function fetchArbeitnow() {
  const pages = [1, 2];
  const results = [];
  for (const page of pages) {
    const data = await fetchJson(`https://www.arbeitnow.com/api/job-board-api?page=${page}`, `Arbeitnow page ${page}`);
    results.push(
      ...(data.data || []).map((job) =>
        normalizeCommon({
          title: job.title,
          company: job.company_name,
          location: job.location || (job.remote ? 'Remote' : 'Unspecified'),
          url: job.url,
          source: 'Arbeitnow',
          publishedAt: job.created_at,
          description: job.description,
          tags: [job.job_types, ...(job.tags || [])].flat().filter(Boolean)
        })
      )
    );
  }

  return results;
}

async function fetchHimalayas() {
  const urls = [
    'https://himalayas.app/jobs/api/search?country=India',
    'https://himalayas.app/jobs/api/search?seniority=Executive',
    'https://himalayas.app/jobs/api/search?worldwide=true'
  ];

  const payloads = await Promise.all(urls.map((url) => fetchJson(url, 'Himalayas')));
  return payloads.flatMap((payload) => {
    const jobs = payload.jobs || payload.results || payload.data || (Array.isArray(payload) ? payload : []);
    return jobs.map((job) =>
      normalizeCommon({
        title: job.title,
        company: job.companyName || job.company?.name || job.company,
        location: job.location || job.candidateLocation || job.country || 'Unspecified',
        url: job.url || job.applyUrl || job.jobUrl,
        source: 'Himalayas',
        publishedAt: job.publishedAt || job.createdAt,
        description: job.description || job.summary,
        tags: [job.category, ...(job.tags || []), job.seniority].flat().filter(Boolean)
      })
    );
  });
}

async function loadPreviousState() {
  try {
    const raw = await readFile(DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const items = [...(parsed.opportunities?.executive || []), ...(parsed.opportunities?.board || [])];
    return {
      map: new Map(items.map((item) => [item.id, item])),
      items
    };
  } catch {
    return {
      map: new Map(),
      items: []
    };
  }
}

async function main() {
  const previousState = await loadPreviousState();
  const errors = [];
  const sourceResults = [];

  for (const [name, fetcher] of [['Remotive', fetchRemotive], ['Arbeitnow', fetchArbeitnow], ['Himalayas', fetchHimalayas]]) {
    try {
      sourceResults.push(...(await fetcher()));
    } catch (error) {
      errors.push(`${name}: ${error.message || 'live refresh failed'}`);
    }
  }

  const relevant = sourceResults.filter((item) => item.isRelevant);
  const fallbackItems = !relevant.length && previousState.items.length
    ? previousState.items.map((item) => ({ ...item, lastSeenAt: item.lastSeenAt || new Date().toISOString() }))
    : [];
  const opportunities = relevant.length
    ? dedupeAndRank(relevant, previousState.map)
    : fallbackItems;

  if (!relevant.length && previousState.items.length) {
    errors.push('Using the last cached opportunity snapshot because the live sources did not return fresh matches.');
  }

  const payload = buildDashboardPayload(opportunities, errors);

  await mkdir(new URL('../site/data', import.meta.url), { recursive: true });
  await writeFile(DATA_PATH, JSON.stringify(payload, null, 2) + '\n');

  console.log(`Saved ${payload.stats.total} opportunities with ${errors.length} fetch warnings.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
