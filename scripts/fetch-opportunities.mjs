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

const SALARY_FLOOR = 60;
const AGE_DEFAULT_LIMIT = 60;

const AGE_FRIENDLY_COMPANIES = new Set([
  "korn ferry",
  "egon zehnder",
  "spencer stuart",
  "russell reynolds",
  "heidrick & struggles",
  "iica independent director's databank",
  "iica independent directors databank",
  "iica databank",
  "prime database",
  "gladwin international",
  "nse/bse filing - large telecom infra co."
]);

const AGE_NEEDS_INVESTIGATION = new Set([
  "reliance jio",
  "equinix",
  "tata communications",
  "ntt global data centers",
  "stt gdc india",
  "adaniconnex",
  "digital realty",
  "ctrls datacenters",
  "airtel (nxtra)",
  "nxtra by airtel"
]);

function normalizeCompanyName(name = "") {
  return name.toLowerCase().replace(/[^a-z0-9&/()' -]/g, "").replace(/\s+/g, " ").trim();
}

function getAgeProfile(item) {
  const company = normalizeCompanyName(item.company);
  const combined = `${item.title || ""} ${item.type || ""} ${(item.keywords || []).join(" ")}`.toLowerCase();
  const isBoardLike = /board|independent director/.test(combined);
  const isExecutiveSearch = /executive search/.test((item.source || "").toLowerCase());
  const isAgeFriendly = isBoardLike || isExecutiveSearch || AGE_FRIENDLY_COMPANIES.has(company);

  if (isAgeFriendly) {
    return {
      ageLimit: null,
      ageAgeFriendly: true,
      ageReasons: isBoardLike
        ? ["Board roles", "Experience valued", "Independent director norms in India"]
        : ["Executive search focus", "Seasoned leadership profiles", "Experience valued"],
      ageSources: isBoardLike
        ? ["Board appointment norms", "Independent director databases", "Known practices"]
        : ["Known practices", "Public commitment", "Search firm specialization"]
    };
  }

  if (AGE_NEEDS_INVESTIGATION.has(company)) {
    return {
      ageLimit: AGE_DEFAULT_LIMIT,
      ageAgeFriendly: false,
      ageReasons: ["Operating company role", "Age policy not clearly public", "Verify before applying"],
      ageSources: ["Company HR policies", "LinkedIn/Glassdoor signals", "Known practices in telecom/DC sector"]
    };
  }

  return {
    ageLimit: AGE_DEFAULT_LIMIT,
    ageAgeFriendly: false,
    ageReasons: ["Policy unknown", "Verify before applying"],
    ageSources: ["Company HR policies", "Public statements on age diversity"]
  };
}

function scoreOpportunity(item, type) {
  const text = `${item.title} ${item.company} ${item.sector} ${(item.keywords || []).join(" ")}`.toLowerCase();
  const scoringKeywords = ["telecom", "data center", "connectivity", "board", "independent director", "advisor", "chief", "vp", "svp"];
  const keywordHits = scoringKeywords.reduce((acc, key) => acc + (text.includes(key) ? 1 : 0), 0);
  const locationBoost = /mumbai|remote/.test((item.location || "").toLowerCase()) ? 10 : 0;
  const salaryBoost = type === "executive" ? Math.min(20, Math.max(0, (item.salaryLpa || 0) - SALARY_FLOOR)) : 0;
  const ageBoost = item.ageAgeFriendly ? 8 : -2;
  return Math.min(100, 50 + keywordHits * 5 + locationBoost + salaryBoost + ageBoost);
}

function normalizeExecutive(item) {
  const ageProfile = getAgeProfile(item);
  const normalized = {
    ...item,
    type: item.type || "Executive",
    ...ageProfile,
    relevanceScore: scoreOpportunity({ ...item, ...ageProfile }, "executive")
  };
  return normalized.salaryLpa >= SALARY_FLOOR ? normalized : null;
}

function normalizeBoard(item) {
  const ageProfile = getAgeProfile(item);
  return {
    ...item,
    type: item.type || "Board",
    ...ageProfile,
    relevanceScore: scoreOpportunity({ ...item, ...ageProfile }, "board")
  };
}

async function tryFetchRemoteSignals() {
  try {
    const response = await fetch("https://remoteok.com/api", {
      headers: { "user-agent": "DadsjobsearchDashboard/1.0" }
    });
    if (!response.ok) throw new Error(`Remote API failed: ${response.status}`);
    const payload = await response.json();
    const items = (Array.isArray(payload) ? payload : [])
      .filter((entry) => entry?.position && /vp|chief|director|head/i.test(entry.position))
      .slice(0, 6)
      .map((entry, index) => ({
        id: `remoteok-${entry.id || index}`,
        title: entry.position,
        company: entry.company || "Remote Company",
        location: "Remote",
        type: "Executive",
        sector: /telecom|network|connect|data/i.test(`${entry.tags || ""}`) ? "Connectivity" : "Digital Infrastructure",
        salaryLpa: 65,
        source: "RemoteOK",
        url: entry.url ? `https://remoteok.com${entry.url}` : "https://remoteok.com",
        postedDate: entry.date || new Date().toISOString().slice(0, 10),
        keywords: entry.tags || []
      }))
      .map(normalizeExecutive)
      .filter(Boolean);

    return items;
  } catch (error) {
    console.warn(`Live fetch unavailable, using fallback only: ${error.message}`);
    return [];
  }
}

async function main() {
  const fallbackPath = path.join(dataDir, "fallback-opportunities.json");
  const outputPath = path.join(dataDir, "opportunities.json");

  const fallback = JSON.parse(await fs.readFile(fallbackPath, "utf8"));
  const liveExecutive = await tryFetchRemoteSignals();

  const executiveRoles = (fallback.executiveRoles || [])
    .map(normalizeExecutive)
    .filter(Boolean)
    .concat(liveExecutive)
    .sort((a, b) => Number(b.ageAgeFriendly) - Number(a.ageAgeFriendly) || (b.relevanceScore || 0) - (a.relevanceScore || 0));

  const boardRoles = (fallback.boardRoles || [])
    .map(normalizeBoard)
    .sort((a, b) => Number(b.ageAgeFriendly) - Number(a.ageAgeFriendly) || (b.relevanceScore || 0) - (a.relevanceScore || 0));

  const allRoles = executiveRoles.concat(boardRoles);
  const ageFriendlyCount = allRoles.filter((item) => item.ageAgeFriendly).length;
  const flaggedAgeCount = allRoles.length - ageFriendlyCount;

  const output = {
    generatedAt: new Date().toISOString(),
    metadata: {
      salaryFloorLpa: SALARY_FLOOR,
      ageDefaultLimit: AGE_DEFAULT_LIMIT,
      executiveCompaniesCovered: EXECUTIVE_COMPANIES,
      boardSignalSourcesCovered: BOARD_SOURCES,
      ageFriendlyCount,
      flaggedAgeCount,
      notes: "Includes fallback records and live remote signals when available. Age-friendliness scored from known practices, board norms, and company policy signals."
    },
    executiveRoles,
    boardRoles
  };

  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${executiveRoles.length} executive and ${boardRoles.length} board opportunities.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
