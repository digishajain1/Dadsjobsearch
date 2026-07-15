const DATA_URL = "./data/opportunities.json";
const TRACKER_KEY = "dadsjobsearch_tracker_v1";
const ITEMS_PER_PAGE = 10;

const searchInput = document.getElementById("search");
const locationFilter = document.getElementById("locationFilter");
const statusFilter = document.getElementById("statusFilter");
const recencyFilter = document.getElementById("recencyFilter");
const executiveList = document.getElementById("executiveList");
const boardList = document.getElementById("boardList");
const template = document.getElementById("opportunityTemplate");
const meta = document.getElementById("meta");

let dataset = { executiveRoles: [], boardRoles: [], generatedAt: null };
let currentPage = { executive: 1, board: 1 };

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

function formatPostedDate(opportunity) {
  if (!opportunity.postedAt && !opportunity.postedDate) return "N/A";
  const parsed = new Date(opportunity.postedAt || opportunity.postedDate);
  return Number.isNaN(parsed.getTime()) ? opportunity.postedDate : parsed.toLocaleDateString();
}

function getPostedTime(opportunity) {
  const parsed = new Date(opportunity.postedAt || opportunity.postedDate || 0);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function isOpportunityActive(opportunity, trackerStatus = "") {
  const listingStatus = `${opportunity.listingStatus || ""}`.toLowerCase();
  if (trackerStatus === "archived") return false;
  if (listingStatus === "archived" || listingStatus === "closed") return false;
  return opportunity.isActive !== false;
}

function isLatestOpportunity(opportunity) {
  if (typeof opportunity.isLatest === "boolean") return opportunity.isLatest;
  const latestWindowDays = dataset.metadata?.latestWindowDays || 7;
  const postedAt = opportunity.postedAt || opportunity.postedDate;
  const generatedDate = new Date(dataset.generatedAt || Date.now());
  const postedDate = new Date(postedAt || 0);
  if (Number.isNaN(generatedDate.getTime()) || Number.isNaN(postedDate.getTime())) return false;
  const generatedDay = new Date(generatedDate.toISOString().slice(0, 10)).getTime();
  const postedDay = new Date(postedDate.toISOString().slice(0, 10)).getTime();
  const ageMs = generatedDay - postedDay;
  return ageMs >= 0 && ageMs <= latestWindowDays * 24 * 60 * 60 * 1000;
}

function sortOpportunities(items) {
  return [...items].sort((a, b) => {
    const postedDiff = getPostedTime(b) - getPostedTime(a);
    return postedDiff || (b.relevanceScore || 0) - (a.relevanceScore || 0);
  });
}

function getActiveOpportunities(list) {
  const tracker = readTracker();
  return sortOpportunities(
    list.filter((item) => {
      const status = tracker[item.id]?.status || "";
      return isOpportunityActive(item, status);
    })
  );
}

function buildCard(opportunity) {
  const tracker = readTracker();
  const state = tracker[opportunity.id] || { status: "", notes: "" };
  const node = template.content.firstElementChild.cloneNode(true);

  node.querySelector(".title").textContent = opportunity.title;
  const latestBadge = node.querySelector(".latest-badge");
  latestBadge.hidden = !isLatestOpportunity(opportunity);
  node.querySelector(".company").textContent = `${opportunity.company} · ${opportunity.location}`;
  node.querySelector(".details").textContent = `${opportunity.type} · Sector: ${opportunity.sector} · Posted: ${formatPostedDate(opportunity)}`;
  node.querySelector(".source").textContent = `Source: ${opportunity.source}`;
  node.querySelector(".score").textContent = `Relevance: ${opportunity.relevanceScore ?? "N/A"}${opportunity.salaryLpa ? ` · Salary: ₹${opportunity.salaryLpa}L` : ""}`;

  const link = node.querySelector(".link");
  link.href = opportunity.url;

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

function applyFilters(list) {
  const q = searchInput.value.trim().toLowerCase();
  const tracker = readTracker();
  return getActiveOpportunities(list).filter((item) => {
    const status = tracker[item.id]?.status || "";
    const queryMatches = !q || getCombinedText(item).includes(q);
    return (
      queryMatches &&
      (recencyFilter.value !== "latest" || isLatestOpportunity(item)) &&
      locationMatches(locationFilter.value, item.location) &&
      statusMatches(statusFilter.value, status)
    );
  });
}

function paginate(items, page) {
  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  return items.slice(start, end);
}

function createPaginationControls(totalItems, currentPage, type) {
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  if (totalPages <= 1) return null;

  const controls = document.createElement("div");
  controls.className = "pagination";

  const prevBtn = document.createElement("button");
  prevBtn.textContent = "← Previous";
  prevBtn.disabled = currentPage === 1;
  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage[type] = currentPage - 1;
      render();
    }
  });

  const pageInfo = document.createElement("span");
  pageInfo.className = "page-info";
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

  const nextBtn = document.createElement("button");
  nextBtn.textContent = "Next →";
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.addEventListener("click", () => {
    if (currentPage < totalPages) {
      currentPage[type] = currentPage + 1;
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

function render() {
  const activeExecutive = getActiveOpportunities(dataset.executiveRoles || []);
  const activeBoard = getActiveOpportunities(dataset.boardRoles || []);
  const executive = applyFilters(dataset.executiveRoles || []);
  const board = applyFilters(dataset.boardRoles || []);
  const latestExecutiveCount = activeExecutive.filter(isLatestOpportunity).length;
  const latestBoardCount = activeBoard.filter(isLatestOpportunity).length;

  if (dataset.generatedAt) {
    meta.textContent = `Data generated: ${new Date(dataset.generatedAt).toLocaleString()} · Executive: ${activeExecutive.length} active (${latestExecutiveCount} latest) · Board: ${activeBoard.length} active (${latestBoardCount} latest) · Showing ${recencyFilter.value === "latest" ? "latest active positions" : "all active positions"}`;
  }

  renderList(executiveList, executive, "No executive opportunities match current filters.", "executive");
  renderList(boardList, board, "No board signals match current filters.", "board");
}

async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to load data: ${response.status}`);
    dataset = await response.json();
  } catch (error) {
    meta.textContent = `Unable to load data file. ${error.message}`;
  }

  [searchInput, locationFilter, statusFilter, recencyFilter].forEach((input) =>
    input.addEventListener("input", () => {
      currentPage = { executive: 1, board: 1 };
      render();
    })
  );

  render();
}

init();
