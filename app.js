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
let isRefreshing = false;

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

function isJobActive(opportunity) {
  // Consider archived jobs as inactive
  const tracker = readTracker();
  const state = tracker[opportunity.id];
  if (state?.status === "archived") return false;
  return true;
}

function getPlatformBadge(source) {
  const badges = {
    "LinkedIn": "🔵 LinkedIn",
    "Indeed": "📋 Indeed",
    "AngelList": "🚀 AngelList",
    "Glassdoor": "💼 Glassdoor",
    "RemoteOK": "🌍 RemoteOK",
    "Jobicy": "💼 Jobicy",
    "Arbeitnow": "🌐 Arbeitnow",
    "Korn Ferry": "🎯 Korn Ferry",
    "Spencer Stuart": "⭐ Spencer Stuart",
  };
  return badges[source] || `📌 ${source}`;
}

function getPlatformLink(opportunity) {
  // If there's a direct career page URL, use it
  if (opportunity.careerPageUrl) {
    return opportunity.careerPageUrl;
  }
  // Otherwise use the job board link
  return opportunity.url || "#";
}

function getPlatformLabel(opportunity) {
  if (opportunity.careerPageUrl) {
    return "🏢 Apply on Company Career Site";
  }
  return `🔗 View on ${opportunity.source || "Job Board"}`;
}

function buildCard(opportunity) {
  const tracker = readTracker();
  const state = tracker[opportunity.id] || { status: "", notes: "" };
  const node = template.content.firstElementChild.cloneNode(true);

  node.querySelector(".title").textContent = opportunity.title;
  node.querySelector(".company").textContent = `${opportunity.company} · ${opportunity.location}`;
  node.querySelector(".details").textContent = `${opportunity.type} · Sector: ${opportunity.sector} · Posted: ${opportunity.postedDate || "N/A"}`;
  
  const sourceBadge = node.querySelector(".source-badge");
  sourceBadge.textContent = getPlatformBadge(opportunity.source);
  sourceBadge.className = "source-badge";
  
  node.querySelector(".score").textContent = `Relevance: ${opportunity.relevanceScore ?? "N/A"}${opportunity.salaryLpa ? ` · Salary: ₹${opportunity.salaryLpa}L` : ""}`;

  const link = node.querySelector(".link");
  link.href = getPlatformLink(opportunity);
  link.textContent = getPlatformLabel(opportunity);
  if (opportunity.careerPageUrl) {
    link.classList.add("link--direct");
  }

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
  const showOnlyActive = activeFilter.value === "active";

  return list.filter((item) => {
    const status = tracker[item.id]?.status || "";
    const queryMatches = !q || getCombinedText(item).includes(q);
    const isActive = !showOnlyActive || isJobActive(item);
    
    return (
      queryMatches &&
      locationMatches(locationFilter.value, item.location) &&
      statusMatches(statusFilter.value, status) &&
      isActive
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
  const executive = applyFilters(dataset.executiveRoles || []);
  const board = applyFilters(dataset.boardRoles || []);

  renderList(executiveList, executive, "No executive opportunities match current filters.", "executive");
  renderList(boardList, board, "No board signals match current filters.", "board");

  // Update meta info
  const totalExec = dataset.executiveRoles?.length || 0;
  const totalBoard = dataset.boardRoles?.length || 0;
  const lastUpdate = dataset.generatedAt ? new Date(dataset.generatedAt).toLocaleString() : "N/A";
  meta.textContent = `Last updated: ${lastUpdate} · ${totalExec} executive + ${totalBoard} board opportunities`;
}

async function refreshData() {
  if (isRefreshing) return;
  
  isRefreshing = true;
  refreshBtn.disabled = true;
  refreshBtn.classList.add("refreshing");
  refreshStatus.textContent = "🔄 Refreshing data...";
  refreshStatus.className = "refresh-status loading";

  try {
    const response = await fetch(DATA_URL, { 
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const newData = await response.json();
    
    // Preserve tracker data
    const tracker = readTracker();
    
    dataset = newData;
    
    // Restore tracker data
    writeTracker(tracker);
    
    render();
    
    refreshStatus.textContent = "✅ Data refreshed successfully!";
    refreshStatus.className = "refresh-status success";
    
    setTimeout(() => {
      refreshStatus.textContent = "";
      refreshStatus.className = "refresh-status";
    }, 3000);
  } catch (error) {
    console.error("Refresh error:", error);
    refreshStatus.textContent = `❌ Refresh failed: ${error.message}`;
    refreshStatus.className = "refresh-status error";
    
    setTimeout(() => {
      refreshStatus.textContent = "";
      refreshStatus.className = "refresh-status";
    }, 3000);
  } finally {
    isRefreshing = false;
    refreshBtn.disabled = false;
    refreshBtn.classList.remove("refreshing");
  }
}

async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to load data: ${response.status}`);
    dataset = await response.json();
  } catch (error) {
    meta.textContent = `Unable to load data file. ${error.message}`;
    return;
  }

  [searchInput, locationFilter, statusFilter, activeFilter].forEach((input) =>
    input.addEventListener("input", () => {
      currentPage = { executive: 1, board: 1 };
      render();
    })
  );

  refreshBtn.addEventListener("click", refreshData);

  render();
}

init();
