import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../data");

const EXECUTIVE_COMPANIES = [
  "Equinix",
  "NTT Global Data Centers",
  "STT GDC India",
  "AdaniConneX",
  "CtrlS",
  "Digital Realty",
  "Web Werks (Iron Mountain)",
  "Yotta Data Services",
  "Princeton Digital Group",
  "Sify Technologies",
  "Nxtra by Airtel",
  "Tata Communications",
  "CapitaLand (Ascendas)",
  "Colt DCS",
  "Reliance Jio"
];

const BOARD_SOURCES = [
  "NSE/BSE corporate filings",
  "Egon Zehnder",
  "Korn Ferry",
  "Spencer Stuart",
  "Heidrick & Struggles",
  "Russell Reynolds",
  "Gladwin International",
  "IICA Independent Director's Databank",
  "Prime Database"
];

const LIVE_EXECUTIVE_SOURCES = ["RemoteOK", "Jobicy", "Arbeitnow"];
const SALARY_FLOOR = 60;
const RECENT_WINDOW_DAYS = 7;
const ACTIVE_WINDOW_DAYS = 45;
const USER_AGENT = "DadsjobsearchDashboard/1.0";
const EXECUTIVE_TITLE_PATTERN =
  /\b(chief|cto|ceo|cfo|coo|cio|cmo|president|vice president|vp|svp|director|head|gm|general manager|advisor|advisory|principal|country manager)\b/i;

function scoreOpportunity(item, type) {
  const text = `${item.title} ${item.company} ${item.sector} ${(item.keywords || []).join(" ")}`.toLowerCase();
  const scoringKeywords = ["telecom", "data center", "connectivity", "board", "independent director", "advisor", "chief", "vp", "svp"];
  const keywordHits = scoringKeywords.reduce((acc, key) => acc + (text.includes(key) ? 1 : 0), 0);
  const locationBoost = /mumbai|remote/.test((item.location || "").toLowerCase()) ? 10 : 0;
  const salaryBoost = type === "executive" ? Math.min(20, Math.max(0, (item.salaryLpa || 0) - SALARY_FLOOR)) : 0;
  return Math.min(100, 50 + keywordHits * 5 + locationBoost + salaryBoost);
}

function sanitizeLpa(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 500) return null;
  return Math.round(numeric);
}

function averageSalaryLpa(min, max) {
  if (min && max) return Math.round((min + max) / 2);
  return min || max || null;
}

function normalizeDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function daysSince(dateString) {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 86_400_000));
}

function detectSector(item) {
  const text = `${item.title || ""} ${item.company || ""} ${item.sector || ""} ${(item.keywords || []).join(" ")}`.toLowerCase();
  if (/telecom|fiber|wireless|network|carrier|connect/.test(text)) return "Connectivity";
  if (/data center|datacenter|colo|cloud|infrastructure|server/.test(text)) return "Digital Infrastructure";
  if (/board|independent director|advisory|governance/.test(text)) return "Board Services";
  return item.type === "Board" ? "Board Services" : "Executive";
}

function ensureKeywords(...values) {
  const terms = values
    .flatMap((value) => {
      if (Array.isArray(value)) return value;
      if (typeof value === "string") return value.split(/[,\s/|]+/);
      return [];
    })
    .map((value) => `${value}`.trim())
    .filter(Boolean);

  return [...new Set(terms)];
}

function normalizeUrl(url, baseUrl) {
  if (!url) return baseUrl;
  if (/^https?:\/\//i.test(url)) return url;
  return `${baseUrl}${url}`;
}

function classifyOpportunity(item, type) {
  const postedAgeDays = daysSince(item.postedDate);
  const isRecent = postedAgeDays !== null && postedAgeDays <= RECENT_WINDOW_DAYS;
  const isActive = postedAgeDays === null || postedAgeDays <= ACTIVE_WINDOW_DAYS;
  const recencyLabel = postedAgeDays === null ? "Date unavailable" : isRecent ? "Latest" : postedAgeDays <= ACTIVE_WINDOW_DAYS ? "Recent" : "Older";
  const activityStatus = isActive ? "active" : "stale";

  if (typeof item.ageFriendly === "boolean" && item.ageReason) {
    return {
      postedAgeDays,
      isRecent,
      recencyLabel,
      isActive,
      activityStatus
    };
  }

  const boardOrAdvisory = type === "board" || /\b(board|advisor|advisory|independent director)\b/i.test(`${item.title} ${item.type}`);
  const ageFriendly = boardOrAdvisory;
  const ageReason = boardOrAdvisory
    ? "Board and advisory roles typically value senior leadership experience."
    : "Executive operating roles may need direct age-policy verification before applying.";

  return {
    ageFriendly,
    ageReason,
    postedAgeDays,
    isRecent,
    recencyLabel,
    isActive,
    activityStatus
  };
}

function buildId(prefix, company, title, fallbackId) {
  if (fallbackId) return fallbackId;
  const slug = `${company}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${prefix}-${slug}`;
}

function normalizeExecutive(item = {}) {
  const title = `${item.title || item.position || item.jobTitle || ""}`.trim();
  const company = `${item.company || item.companyName || item.company_name || "Remote Company"}`.trim();
  if (!title || !EXECUTIVE_TITLE_PATTERN.test(title)) return null;

  const salaryMin = sanitizeLpa(item.salaryMin);
  const salaryMax = sanitizeLpa(item.salaryMax);
  const salaryLpa = sanitizeLpa(item.salaryLpa) || averageSalaryLpa(salaryMin, salaryMax) || SALARY_FLOOR + 5;
  const location = `${item.location || item.candidate_required_location || item.jobGeo || (item.remote ? "Remote" : "Remote / Global")}`.trim();
  const normalized = {
    ...item,
    id: buildId("exec", company, title, item.id),
    title,
    company,
    location,
    type: item.type || "Executive",
    sector: item.sector || detectSector(item),
    salaryMin: salaryMin || undefined,
    salaryMax: salaryMax || undefined,
    salaryLpa,
    source: item.source || "Live source",
    url: item.url || item.jobUrl || "https://example.com",
    postedDate: normalizeDate(item.postedDate || item.pubDate || item.created_at || item.date),
    keywords: ensureKeywords(item.keywords, item.tags, item.jobType),
    relevanceScore:
      item.relevanceScore ??
      scoreOpportunity(
        {
          ...item,
          title,
          company,
          location,
          salaryLpa,
          sector: item.sector || detectSector(item),
          keywords: ensureKeywords(item.keywords, item.tags, item.jobType)
        },
        "executive"
      )
  };

  return salaryLpa >= SALARY_FLOOR ? { ...normalized, ...classifyOpportunity(normalized, "executive") } : null;
}

function normalizeBoard(item = {}) {
  const title = `${item.title || ""}`.trim();
  const company = `${item.company || "Board Signal"}`.trim();
  if (!title) return null;

  const normalized = {
    ...item,
    id: buildId("board", company, title, item.id),
    title,
    company,
    location: `${item.location || "Remote / India"}`.trim(),
    type: item.type || "Board",
    sector: item.sector || detectSector({ ...item, type: "Board" }),
    source: item.source || "Board source",
    url: item.url || "https://example.com",
    postedDate: normalizeDate(item.postedDate),
    keywords: ensureKeywords(item.keywords),
    relevanceScore:
      item.relevanceScore ??
      scoreOpportunity(
        {
          ...item,
          title,
          company,
          sector: item.sector || detectSector({ ...item, type: "Board" }),
          keywords: ensureKeywords(item.keywords)
        },
        "board"
      )
  };

  return { ...normalized, ...classifyOpportunity(normalized, "board") };
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function fetchJson(url, sourceName) {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/json"
    },
    signal: AbortSignal.timeout(15_000)
  });

  if (!response.ok) {
    throw new Error(`${sourceName} API failed: ${response.status}`);
  }

  return response.json();
}

async function fetchRemoteOk() {
  const payload = await fetchJson("https://remoteok.com/api", "RemoteOK");
  return (Array.isArray(payload) ? payload : [])
    .filter((entry) => entry?.position && EXECUTIVE_TITLE_PATTERN.test(entry.position))
    .slice(0, 12)
    .map((entry, index) => ({
      id: `remoteok-${entry.id || index}`,
      title: entry.position,
      company: entry.company || "Remote Company",
      location: "Remote",
      type: "Executive",
      sector: /telecom|network|connect|data/i.test(`${entry.tags || ""}`) ? "Connectivity" : "Digital Infrastructure",
      source: "RemoteOK",
      url: normalizeUrl(entry.url, "https://remoteok.com"),
      postedDate: entry.date,
      keywords: entry.tags || []
    }));
}

async function fetchJobicy() {
  const payload = await fetchJson("https://jobicy.com/api/v2/remote-jobs?count=50", "Jobicy");
  const items = Array.isArray(payload?.jobs) ? payload.jobs : Array.isArray(payload?.data) ? payload.data : [];

  return items
    .filter((entry) => EXECUTIVE_TITLE_PATTERN.test(`${entry?.jobTitle || entry?.title || ""}`))
    .slice(0, 12)
    .map((entry, index) => ({
      id: `jobicy-${entry.id || index}`,
      title: entry.jobTitle || entry.title,
      company: entry.companyName || entry.company || "Remote Company",
      location: entry.jobGeo || entry.location || "Remote",
      type: "Executive",
      sector: detectSector({ ...entry, title: entry.jobTitle || entry.title }),
      source: "Jobicy",
      url: entry.url || entry.jobUrl,
      postedDate: entry.pubDate || entry.date,
      keywords: ensureKeywords(entry.tags, entry.jobLevel, entry.jobType)
    }));
}

async function fetchArbeitnow() {
  const payload = await fetchJson("https://www.arbeitnow.com/api/job-board-api", "Arbeitnow");
  const items = Array.isArray(payload?.data) ? payload.data : [];

  return items
    .filter((entry) => EXECUTIVE_TITLE_PATTERN.test(`${entry?.title || ""}`))
    .slice(0, 12)
    .map((entry, index) => ({
      id: `arbeitnow-${entry.slug || index}`,
      title: entry.title,
      company: entry.company_name || "Remote Company",
      location: entry.remote ? "Remote" : (entry.location_tags || []).join(" / ") || "Remote / Global",
      type: "Executive",
      sector: detectSector({ ...entry, company: entry.company_name }),
      source: "Arbeitnow",
      url: entry.url || (entry.slug ? `https://www.arbeitnow.com/jobs/${entry.slug}` : "https://www.arbeitnow.com"),
      postedDate: entry.created_at,
      keywords: ensureKeywords(entry.tags, entry.job_types)
    }));
}

async function fetchLiveExecutiveSignals() {
  const sources = [
    { name: "RemoteOK", fetcher: fetchRemoteOk },
    { name: "Jobicy", fetcher: fetchJobicy },
    { name: "Arbeitnow", fetcher: fetchArbeitnow }
  ];

  const settled = await Promise.allSettled(sources.map(async ({ fetcher }) => fetcher()));
  const items = [];
  const sourceStatus = settled.map((result, index) => {
    const source = sources[index];

    if (result.status === "fulfilled") {
      items.push(...result.value);
      return { source: source.name, status: "ok", fetched: result.value.length };
    }

    return { source: source.name, status: "error", fetched: 0, error: result.reason.message };
  });

  return { items, sourceStatus };
}

function dedupeOpportunities(items, normalizer) {
  const map = new Map();

  items.forEach((item) => {
    const normalized = normalizer(item);
    if (!normalized) return;

    const key = normalized.id || normalized.url || `${normalized.company}:${normalized.title}`.toLowerCase();
    if (!map.has(key)) {
      map.set(key, normalized);
    }
  });

  return [...map.values()];
}

async function main() {
  const fallbackPath = path.join(dataDir, "fallback-opportunities.json");
  const outputPath = path.join(dataDir, "opportunities.json");

  const fallback = (await readJsonIfExists(fallbackPath)) || {};
  const lastKnown = (await readJsonIfExists(outputPath)) || {};
  const liveExecutive = await fetchLiveExecutiveSignals();

  const executiveRoles = dedupeOpportunities(
    [...liveExecutive.items, ...(lastKnown.executiveRoles || []), ...(fallback.executiveRoles || [])],
    normalizeExecutive
  );

  const boardRoles = dedupeOpportunities([...(lastKnown.boardRoles || []), ...(fallback.boardRoles || [])], normalizeBoard);

  const output = {
    generatedAt: new Date().toISOString(),
    metadata: {
      salaryFloorLpa: SALARY_FLOOR,
      executiveCompaniesCovered: EXECUTIVE_COMPANIES,
      boardSignalSourcesCovered: BOARD_SOURCES,
      liveExecutiveSourcesCovered: LIVE_EXECUTIVE_SOURCES,
      liveRefresh: {
        attemptedAt: new Date().toISOString(),
        sources: liveExecutive.sourceStatus
      },
      notes: "Includes curated fallback data, last-known dashboard data, and live signals when available."
    },
    executiveRoles,
    boardRoles
  };

  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${executiveRoles.length} executive and ${boardRoles.length} board opportunities.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
