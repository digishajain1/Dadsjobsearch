const DATA_URL = "./data/opportunities.json";
const TRACKER_KEY = "dadsjobsearch_tracker_v1";
const ITEMS_PER_PAGE = 10;

const searchInput = document.getElementById("search");
const locationFilter = document.getElementById("locationFilter");
const statusFilter = document.getElementById("statusFilter");
const activeFilter = document.getElementById("activeFilter");
const refreshBtn = document.getElementById("refreshBtn");
const refreshStatus = document.getElementById("refreshStatus");
const executiveList = document.getElementById("executiveList");
const boardList = document.getElementById("boardList");
const template = document.getElementById("opportunityTemplate");
const meta = document.getElementById("meta");

let dataset = { executiveRoles: [], boardRoles: [], generatedAt: null };
let currentPage = { executive: 1, board: 1 };

// ── Platform detection ────────────────────────────────────────────────────────

const PLATFORM_CONFIG = {
  linkedin: {
    label: "LinkedIn",
    color: "#0a66c2",
    searchUrl: (title, company) =>
      `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(title + " " + company)}`,
  },
  naukri: {
    label: "Naukri",
    color: "#ff7555",
    searchUrl: (title, company) =>
      `https://www.naukri.com/jobs-search?k=${encodeURIComponent(title + " " + company)}`,
  },
  indeed: {
    label: "Indeed",
    color: "#003a9b",
    searchUrl: (title, company) =>
      `https://in.indeed.com/jobs?q=${encodeURIComponent(title + " " + company)}`,
  },
  glassdoor: {
    label: "Glassdoor",
    color: "#0caa41",
    searchUrl: (title, company) =>
      `https://www.glassdoor.co.in/Job/jobs.htm?sc.keyword=${encodeURIComponent(title + " " + company)}`,
  },
  angellist: {
    label: "AngelList",
    color: "#000000",
    searchUrl: (title, company) =>
      `https://wellfound.com/jobs?q=${encodeURIComponent(title + " " + company)}`,
  },
  michaelpage: {
    label: "Michael Page",
    color: "#e31837",
    searchUrl: (title, company) =>
      `https://www.michaelpage.co.in/jobs/${encodeURIComponent(title)}?keyword=${encodeURIComponent(company)}`,
  },
  other: {
    label: "Web",
    color: "#4d607f",
    searchUrl: null,
  },
};

function detectPlatform(source) {
  const s = (source || "").toLowerCase();
  if (s.includes("linkedin")) return "linkedin";
  if (s.includes("naukri")) return "naukri";
  if (s.includes("indeed")) return "indeed";
  if (s.includes("glassdoor")) return "glassdoor";
  if (s.includes("angel")) return "angellist";
  if (s.includes("michael page")) return "michaelpage";
  return "other";
}

function buildMultiPlatformLinks(opportunity) {
  const { title, company } = opportunity;
  const primaryKey = detectPlatform(opportunity.source);
  // Always show LinkedIn + Naukri + Indeed as alternate search links
  const alternates = ["linkedin", "naukri", "indeed"].filter((k) => k !== primaryKey);

  const wrapper = document.createDocumentFragment();

  alternates.forEach((key) => {
    const cfg = PLATFORM_CONFIG[key];
    const a = document.createElement("a");
    a.href = cfg.searchUrl(title, company);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "platform-link";
    a.style.setProperty("--platform-color", cfg.color);
    a.textContent = `Search on ${cfg.label}`;
    wrapper.appendChild(a);
  });

  return wrapper;
}

// ── Tracker helpers ───────────────────────────────────────────────────────────

function readTracker() {
  try {
    return JSON.parse(localStorage.getItem(TRACKER_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeTracker(data) {
  localStorage.setItem(TRACKER_KEY, JSON.stringify(data));
}

// ── Filter helpers ────────────────────────────────────────────────────────────

function getCombinedText(opportunity) {
  return [
    opportunity.title,
    opportunity.company,
    opportunity.location,
    opportunity.sector,
    opportunity.source,
  ]
    .join(" ")
    .toLowerCase();
}

function statusMatches(selected, storedStatus) {
  if (selected === "all") return true;
  if (selected === "untracked") return !storedStatus;
  return storedStatus === selected;
}

function locationMatches(filter, locationText) {
  if (filter === "all") return true;
  const lower = (locationText || "").toLowerCase();
  return lower.includes(filter);
}

function activeMatches(filterValue, storedStatus) {
  if (filterValue === "all") return true;
  // "active" = not tracker-archived
  return storedStatus !== "archived";
}

// ── Card builder ──────────────────────────────────────────────────────────────

function buildCard(opportunity) {
  const tracker = readTracker();
  const state = tracker[opportunity.id] || { status: "", notes: "" };
  const node = template.content.firstElementChild.cloneNode(true);
  const isArchived = state.status === "archived";

  node.querySelector(".title").textContent = opportunity.title;
  node.querySelector(".company").textContent = `${opportunity.company} · ${opportunity.location}`;
  node.querySelector(".details").textContent = `${opportunity.type} · Sector: ${opportunity.sector} · Posted: ${opportunity.postedDate || "N/A"}`;
  node.querySelector(".source").textContent = `Source: ${opportunity.source}`;
  node.querySelector(".score").textContent = `Relevance: ${opportunity.relevanceScore ?? "N/A"}${opportunity.salaryMin ? ` · Salary: ₹${opportunity.salaryMin}–${opportunity.salaryMax}L` : ""}`;

  // Active / Archived badge
  const activeBadge = node.querySelector(".badge-active");
  if (isArchived) {
    activeBadge.textContent = "Archived";
    activeBadge.classList.add("badge-archived");
  } else {
    activeBadge.textContent = "Active";
  }

  // Platform badge
  const platformKey = detectPlatform(opportunity.source);
  const platformCfg = PLATFORM_CONFIG[platformKey];
  const platformBadge = node.querySelector(".badge-platform");
  platformBadge.textContent = platformCfg.label;
  platformBadge.style.setProperty("--platform-color", platformCfg.color);
  platformBadge.classList.add("badge-platform-colored");

  // Primary source link
  const link = node.querySelector(".link");
  link.href = opportunity.url;
  link.textContent = `View on ${platformCfg.label}`;

  // Multi-platform alternate search links
  const platformLinksContainer = node.querySelector(".platform-links");
  platformLinksContainer.appendChild(buildMultiPlatformLinks(opportunity));

  const statusEl = node.querySelector(".tracker-status");
  const notesEl = node.querySelector(".tracker-notes");
  statusEl.value = state.status || "";
  notesEl.value = state.notes || "";

  const save = () => {
    const next = readTracker();
    next[opportunity.id] = {
      status: statusEl.value,
      notes: notesEl.value.trim(),
      updatedAt: new Date().toISOString(),
    };
    writeTracker(next);
    render();
  };

  statusEl.addEventListener("change", save);
  notesEl.addEventListener("blur", save);

  return node;
}

// ── Filtering & pagination ────────────────────────────────────────────────────

function applyFilters(list) {
  const q = searchInput.value.trim().toLowerCase();
  const tracker = readTracker();
  const activeVal = activeFilter.value;

  return list.filter((item) => {
    const status = tracker[item.id]?.status || "";
    const queryMatches = !q || getCombinedText(item).includes(q);
    return (
      queryMatches &&
      locationMatches(locationFilter.value, item.location) &&
      statusMatches(statusFilter.value, status) &&
      activeMatches(activeVal, status)
    );
  });
}

function paginate(items, page) {
  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  return items.slice(start, end);
}

function createPaginationControls(totalItems, currentPageNum, type) {
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  if (totalPages <= 1) return null;

  const controls = document.createElement("div");
  controls.className = "pagination";

  const prevBtn = document.createElement("button");
  prevBtn.textContent = "← Previous";
  prevBtn.disabled = currentPageNum === 1;
  prevBtn.addEventListener("click", () => {
    if (currentPage[type] > 1) {
      currentPage[type] -= 1;
      render();
    }
  });

  const pageInfo = document.createElement("span");
  pageInfo.className = "page-info";
  pageInfo.textContent = `Page ${currentPageNum} of ${totalPages}`;

  const nextBtn = document.createElement("button");
  nextBtn.textContent = "Next →";
  nextBtn.disabled = currentPageNum === totalPages;
  nextBtn.addEventListener("click", () => {
    if (currentPage[type] < totalPages) {
      currentPage[type] += 1;
      render();
    }
  });

  controls.appendChild(prevBtn);
  controls.appendChild(pageInfo);
  controls.appendChild(nextBtn);
  return controls;
}

function renderList(container, items, emptyText, type) {
  container.innerHTML = "";
  if (!items.length) {
    container.textContent = emptyText;
    return;
  }

  const paginatedItems = paginate(items, currentPage[type]);
  const fragment = document.createDocumentFragment();
  paginatedItems.forEach((item) => fragment.appendChild(buildCard(item)));
  container.appendChild(fragment);

  const pagination = createPaginationControls(items.length, currentPage[type], type);
  if (pagination) {
    container.appendChild(pagination);
  }
}

function updateMeta() {
  const tracker = readTracker();
  const allExec = dataset.executiveRoles || [];
  const allBoard = dataset.boardRoles || [];
  const totalAll = allExec.length + allBoard.length;
  const activeCount = [...allExec, ...allBoard].filter(
    (item) => (tracker[item.id]?.status || "") !== "archived"
  ).length;
  const generatedStr = dataset.generatedAt
    ? new Date(dataset.generatedAt).toLocaleString()
    : "unknown";
  meta.textContent = `Last updated: ${generatedStr} · ${activeCount} active / ${totalAll} total opportunities`;
}

function render() {
  const executive = applyFilters(dataset.executiveRoles || []);
  const board = applyFilters(dataset.boardRoles || []);

  renderList(executiveList, executive, "No executive opportunities match current filters.", "executive");
  renderList(boardList, board, "No board signals match current filters.", "board");

  updateMeta();
}

// ── Data loading & refresh ────────────────────────────────────────────────────

async function loadData() {
  const response = await fetch(DATA_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load data: ${response.status}`);
  return response.json();
}

async function handleRefresh() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "⏳ Refreshing…";
  refreshStatus.textContent = "";
  refreshStatus.className = "refresh-status";

  try {
    dataset = await loadData();
    currentPage = { executive: 1, board: 1 };
    render();
    refreshStatus.textContent = `✅ Data refreshed at ${new Date().toLocaleTimeString()}`;
    refreshStatus.classList.add("refresh-success");
  } catch (error) {
    refreshStatus.textContent = `❌ Refresh failed: ${error.message}`;
    refreshStatus.classList.add("refresh-error");
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = "🔄 Refresh Now";
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  try {
    dataset = await loadData();
  } catch (error) {
    meta.textContent = `Unable to load data file. ${error.message}`;
  }

  [searchInput, locationFilter, statusFilter, activeFilter].forEach((input) =>
    input.addEventListener("input", () => {
      currentPage = { executive: 1, board: 1 };
      render();
    })
  );

  refreshBtn.addEventListener("click", handleRefresh);

  render();
}

init();

