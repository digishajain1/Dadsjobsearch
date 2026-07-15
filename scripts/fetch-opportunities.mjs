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
const LATEST_WINDOW_DAYS = 7;

function normalizeListingStatus(status) {
  const normalized = `${status || "active"}`.trim().toLowerCase();
  return normalized === "archived" || normalized === "closed" ? normalized : "active";
}

function getPostedDate(item) {
  const raw = item.postedDate || item.postedAt || null;
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function isLatestPosting(postedAt, referenceDate) {
  if (!postedAt) return false;
  const postedDay = new Date(new Date(postedAt).toISOString().slice(0, 10));
  const referenceDay = new Date(referenceDate.toISOString().slice(0, 10));
  const ageMs = referenceDay.getTime() - postedDay.getTime();
  return ageMs >= 0 && ageMs <= LATEST_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

function scoreOpportunity(item, type) {
  const text = `${item.title} ${item.company} ${item.sector} ${(item.keywords || []).join(" ")}`.toLowerCase();
  const scoringKeywords = ["telecom", "data center", "connectivity", "board", "independent director", "advisor", "chief", "vp", "svp"];
  const keywordHits = scoringKeywords.reduce((acc, key) => acc + (text.includes(key) ? 1 : 0), 0);
  const locationBoost = /mumbai|remote/.test((item.location || "").toLowerCase()) ? 10 : 0;
  const salaryBoost = type === "executive" ? Math.min(20, Math.max(0, (item.salaryLpa || 0) - SALARY_FLOOR)) : 0;
  return Math.min(100, 50 + keywordHits * 5 + locationBoost + salaryBoost);
}

function normalizeExecutive(item) {
  const postedAt = getPostedDate(item);
  const listingStatus = normalizeListingStatus(item.listingStatus || item.status);
  const normalized = {
    ...item,
    type: item.type || "Executive",
    postedAt,
    postedDate: postedAt ? postedAt.slice(0, 10) : item.postedDate || null,
    listingStatus,
    isActive: listingStatus === "active",
    relevanceScore: scoreOpportunity(item, "executive")
  };
  return normalized.salaryLpa >= SALARY_FLOOR ? normalized : null;
}

function normalizeBoard(item) {
  const postedAt = getPostedDate(item);
  const listingStatus = normalizeListingStatus(item.listingStatus || item.status);
  return {
    ...item,
    type: item.type || "Board",
    postedAt,
    postedDate: postedAt ? postedAt.slice(0, 10) : item.postedDate || null,
    listingStatus,
    isActive: listingStatus === "active",
    relevanceScore: scoreOpportunity(item, "board")
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
  const generatedAt = new Date();

  const executiveRoles = (fallback.executiveRoles || [])
    .map(normalizeExecutive)
    .filter(Boolean)
    .concat(liveExecutive)
    .map((item) => ({
      ...item,
      isLatest: isLatestPosting(item.postedAt, generatedAt)
    }))
    .sort((a, b) => {
      const postedDiff = new Date(b.postedAt || 0).getTime() - new Date(a.postedAt || 0).getTime();
      return postedDiff || (b.relevanceScore || 0) - (a.relevanceScore || 0);
    });

  const boardRoles = (fallback.boardRoles || [])
    .map(normalizeBoard)
    .map((item) => ({
      ...item,
      isLatest: isLatestPosting(item.postedAt, generatedAt)
    }))
    .sort((a, b) => {
      const postedDiff = new Date(b.postedAt || 0).getTime() - new Date(a.postedAt || 0).getTime();
      return postedDiff || (b.relevanceScore || 0) - (a.relevanceScore || 0);
    });

  const activeExecutiveCount = executiveRoles.filter((item) => item.isActive).length;
  const latestExecutiveCount = executiveRoles.filter((item) => item.isActive && item.isLatest).length;
  const activeBoardCount = boardRoles.filter((item) => item.isActive).length;
  const latestBoardCount = boardRoles.filter((item) => item.isActive && item.isLatest).length;

  const output = {
    generatedAt: generatedAt.toISOString(),
    metadata: {
      salaryFloorLpa: SALARY_FLOOR,
      latestWindowDays: LATEST_WINDOW_DAYS,
      executiveCompaniesCovered: EXECUTIVE_COMPANIES,
      boardSignalSourcesCovered: BOARD_SOURCES,
      counts: {
        executive: { active: activeExecutiveCount, latest: latestExecutiveCount },
        board: { active: activeBoardCount, latest: latestBoardCount }
      },
      notes: "Includes only active positions in dashboard counts and marks postings from the last 7 days as latest."
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
