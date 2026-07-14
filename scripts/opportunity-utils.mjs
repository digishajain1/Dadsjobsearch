export const TARGET_PROFILE = {
  name: "Dad's Next-Innings Opportunity Radar",
  focus: [
    "Senior telecom leadership",
    "Data center and digital infrastructure",
    "Executive advisory roles",
    "Board and independent director seats"
  ],
  preferredLocations: ["Mumbai", "India", "Remote"]
};

export const CORE_KEYWORDS = [
  "telecom",
  "telecommunications",
  "network",
  "wireless",
  "broadband",
  "fiber",
  "fibre",
  "5g",
  "4g",
  "data center",
  "datacenter",
  "colo",
  "colocation",
  "infrastructure",
  "edge",
  "cloud",
  "connectivity",
  "carrier",
  "tower"
];

export const EXECUTIVE_KEYWORDS = [
  "executive",
  "director",
  "vp",
  "vice president",
  "chief",
  "head",
  "president",
  "general manager",
  "gm",
  "leader",
  "leadership",
  "advis",
  "consult",
  "strategy"
];

export const BOARD_KEYWORDS = [
  "board",
  "advisor",
  "advisory",
  "independent director",
  "non executive director",
  "non-executive director",
  "board member",
  "trustee",
  "governor"
];

export const LOCATION_KEYWORDS = {
  mumbai: ["mumbai", "navi mumbai", "thane"],
  india: ["india", "hybrid - india", "remote - india"],
  remote: ["remote", "worldwide", "work from home", "distributed"]
};

export const SEARCH_LINKS = {
  executive: [
    {
      label: "Naukri: telecom executive roles in Mumbai",
      url: "https://www.naukri.com/telecom-executive-jobs-in-mumbai"
    },
    {
      label: "Naukri: data center leadership roles in Mumbai",
      url: "https://www.naukri.com/data-center-jobs-in-mumbai"
    },
    {
      label: "Bayt: data center jobs in Mumbai",
      url: "https://www.bayt.com/en/india/jobs/data-center-jobs-in-mumbai/"
    },
    {
      label: "Jobsora: telecom jobs in Mumbai",
      url: "https://in.jobsora.com/jobs-telecom-mumbai"
    }
  ],
  board: [
    {
      label: "Naukri: board and advisory searches in Mumbai",
      url: "https://www.naukri.com/board-member-jobs-in-mumbai"
    },
    {
      label: "LinkedIn: telecom advisory roles in India",
      url: "https://www.linkedin.com/jobs/search/?keywords=telecom%20advisor%20india"
    },
    {
      label: "LinkedIn: board member roles in India",
      url: "https://www.linkedin.com/jobs/search/?keywords=board%20member%20india"
    }
  ]
};

const slugify = (value) =>
  (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const includesAny = (haystack, needles) => needles.some((needle) => haystack.includes(needle));

export function normalizeText(...parts) {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function summarizeText(html = "") {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

export function inferLocationBucket(location = "") {
  const text = normalizeText(location);
  if (includesAny(text, LOCATION_KEYWORDS.mumbai)) return "Mumbai";
  if (includesAny(text, LOCATION_KEYWORDS.remote)) return "Remote";
  if (includesAny(text, LOCATION_KEYWORDS.india)) return "India";
  return location || "Unspecified";
}

export function classifyOpportunity(opportunity) {
  const searchableText = normalizeText(
    opportunity.title,
    opportunity.company,
    opportunity.location,
    opportunity.description,
    ...(opportunity.tags || [])
  );

  const matchesCore = CORE_KEYWORDS.filter((keyword) => searchableText.includes(keyword));
  const matchesExecutive = EXECUTIVE_KEYWORDS.filter((keyword) => searchableText.includes(keyword));
  const matchesBoard = BOARD_KEYWORDS.filter((keyword) => searchableText.includes(keyword));
  const locationBucket = inferLocationBucket(opportunity.location);

  let score = 0;
  score += matchesCore.length * 5;
  score += matchesExecutive.length * 4;
  score += matchesBoard.length * 6;
  score += locationBucket === "Mumbai" ? 6 : locationBucket === "Remote" ? 4 : locationBucket === "India" ? 3 : 0;

  const searchType = matchesBoard.length > 0 ? "board" : "executive";
  const isRelevant =
    matchesBoard.length > 0 ||
    (matchesCore.length > 0 && matchesExecutive.length > 0) ||
    (matchesCore.length >= 2 && /director|head|vp|vice president|chief|advisor|advisory/.test(searchableText));

  return {
    isRelevant,
    searchType,
    score,
    locationBucket,
    tags: [...new Set([...matchesCore, ...matchesExecutive, ...matchesBoard])].slice(0, 8)
  };
}

export function dedupeAndRank(opportunities, previousMap = new Map()) {
  const now = new Date().toISOString();
  const unique = new Map();

  for (const item of opportunities) {
    if (!item?.title || !item?.url) continue;
    const key = `${slugify(item.title)}::${slugify(item.company)}::${slugify(item.url)}`;
    const existing = unique.get(key);
    const history = previousMap.get(key);
    const next = {
      ...item,
      id: key,
      firstSeenAt: history?.firstSeenAt || item.firstSeenAt || now,
      lastSeenAt: now
    };

    if (!existing || (next.score || 0) > (existing.score || 0)) {
      unique.set(key, next);
    }
  }

  return [...unique.values()].sort((a, b) => {
    const publishedA = Date.parse(a.publishedAt || a.firstSeenAt || 0);
    const publishedB = Date.parse(b.publishedAt || b.firstSeenAt || 0);
    if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
    return publishedB - publishedA;
  });
}

export function buildDashboardPayload(opportunities, fetchErrors = []) {
  const executive = opportunities.filter((item) => item.searchType === "executive").slice(0, 40);
  const board = opportunities.filter((item) => item.searchType === "board").slice(0, 25);

  return {
    generatedAt: new Date().toISOString(),
    profile: TARGET_PROFILE,
    stats: {
      total: opportunities.length,
      executive: executive.length,
      board: board.length,
      sources: [...new Set(opportunities.map((item) => item.source))].length
    },
    alerts: fetchErrors,
    searchLinks: SEARCH_LINKS,
    opportunities: {
      executive,
      board
    }
  };
}
