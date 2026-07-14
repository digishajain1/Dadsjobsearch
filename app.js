const DATA_URL = "./data/opportunities.json";
const TRACKER_KEY = "dadsjobsearch_tracker_v1";
const ITEMS_PER_PAGE = 10;

const searchInput = document.getElementById("search");
const locationFilter = document.getElementById("locationFilter");
const statusFilter = document.getElementById("statusFilter");
const ageFilter = document.getElementById("ageFilter");
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
    ...(opportunity.ageReasons || []),
  ]
    .join(" ")
    .toLowerCase();
}

function ageFilterMatches(filter, opportunity) {
  if (filter === "all") return true;
  if (filter === "friendly") return opportunity.ageAgeFriendly === true;
  if (filter === "flagged") return opportunity.ageAgeFriendly !== true;
  return true;
}

function getAgePriority(opportunity) {
  return opportunity.ageAgeFriendly === true ? 1 : 0;
}

function getAgeCounts() {
  const all = [...(dataset.executiveRoles || []), ...(dataset.boardRoles || [])];
  return all.reduce(
    (acc, item) => {
      if (item.ageAgeFriendly === true) acc.friendly += 1;
      else acc.flagged += 1;
      return acc;
    },
    { friendly: 0, flagged: 0 }
  );
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

function buildCard(opportunity) {
  const tracker = readTracker();
  const state = tracker[opportunity.id] || { status: "", notes: "" };
  const node = template.content.firstElementChild.cloneNode(true);

  node.querySelector(".title").textContent = opportunity.title;
  node.querySelector(".company").textContent = `${opportunity.company} · ${opportunity.location}`;
  node.querySelector(".details").textContent = `${opportunity.type} · Sector: ${opportunity.sector} · Posted: ${opportunity.postedDate || "N/A"}`;
  node.querySelector(".source").textContent = `Source: ${opportunity.source}`;
  node.querySelector(".score").textContent = `Relevance: ${opportunity.relevanceScore ?? "N/A"}${opportunity.salaryLpa ? ` · Salary: ₹${opportunity.salaryLpa}L` : ""}`;
  const ageBadge = node.querySelector(".age-badge");
  const ageReasons = node.querySelector(".age-reasons");
  if (opportunity.ageAgeFriendly === true) {
    ageBadge.textContent = "✓ Age-Friendly 60+";
    ageBadge.className = "age-badge age-friendly";
  } else {
    ageBadge.textContent = "⚠️ May have age limits";
    ageBadge.className = "age-badge age-flagged";
  }
  const reasons = (opportunity.ageReasons || []).join(", ");
  ageReasons.textContent = reasons ? `Why: ${reasons}` : "";

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
  return list.filter((item) => {
    const status = tracker[item.id]?.status || "";
    const queryMatches = !q || getCombinedText(item).includes(q);
    return (
      queryMatches &&
      locationMatches(locationFilter.value, item.location) &&
      statusMatches(statusFilter.value, status) &&
      ageFilterMatches(ageFilter.value, item)
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
  const executive = applyFilters(dataset.executiveRoles || []).sort(
    (a, b) => getAgePriority(b) - getAgePriority(a) || (b.relevanceScore || 0) - (a.relevanceScore || 0)
  );
  const board = applyFilters(dataset.boardRoles || []).sort(
    (a, b) => getAgePriority(b) - getAgePriority(a) || (b.relevanceScore || 0) - (a.relevanceScore || 0)
  );
  const ageCounts = getAgeCounts();
  meta.textContent = `Data generated: ${new Date(dataset.generatedAt).toLocaleString()} (${(dataset.executiveRoles || []).length} executive, ${(dataset.boardRoles || []).length} board) · ${ageCounts.friendly} age-friendly opportunities · ${ageCounts.flagged} flagged opportunities`;

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

  [searchInput, locationFilter, statusFilter, ageFilter].forEach((input) =>
    input.addEventListener("input", () => {
      currentPage = { executive: 1, board: 1 };
      render();
    })
  );

  render();
}

init();
