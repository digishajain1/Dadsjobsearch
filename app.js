const DATA_URL = "./data/opportunities.json";
const TRACKER_KEY = "dadsjobsearch_tracker_v1";

const searchInput = document.getElementById("search");
const locationFilter = document.getElementById("locationFilter");
const statusFilter = document.getElementById("statusFilter");
const executiveList = document.getElementById("executiveList");
const boardList = document.getElementById("boardList");
const template = document.getElementById("opportunityTemplate");
const meta = document.getElementById("meta");

let dataset = { executiveRoles: [], boardRoles: [], generatedAt: null };

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

function buildCard(opportunity) {
  const tracker = readTracker();
  const state = tracker[opportunity.id] || { status: "", notes: "" };
  const node = template.content.firstElementChild.cloneNode(true);

  node.querySelector(".title").textContent = opportunity.title;
  node.querySelector(".company").textContent = `${opportunity.company} · ${opportunity.location}`;
  node.querySelector(".details").textContent = `${opportunity.type} · Sector: ${opportunity.sector} · Posted: ${opportunity.postedDate || "N/A"}`;
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
  return list.filter((item) => {
    const status = tracker[item.id]?.status || "";
    const queryMatches = !q || getCombinedText(item).includes(q);
    return (
      queryMatches &&
      locationMatches(locationFilter.value, item.location) &&
      statusMatches(statusFilter.value, status)
    );
  });
}

function renderList(container, items, emptyText) {
  container.innerHTML = "";
  if (!items.length) {
    container.textContent = emptyText;
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((item) => fragment.appendChild(buildCard(item)));
  container.appendChild(fragment);
}

function render() {
  const executive = applyFilters(dataset.executiveRoles || []);
  const board = applyFilters(dataset.boardRoles || []);

  renderList(executiveList, executive, "No executive opportunities match current filters.");
  renderList(boardList, board, "No board signals match current filters.");
}

async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to load data: ${response.status}`);
    dataset = await response.json();
    meta.textContent = `Data generated: ${new Date(dataset.generatedAt).toLocaleString()} (${(dataset.executiveRoles || []).length} executive, ${(dataset.boardRoles || []).length} board)`;
  } catch (error) {
    meta.textContent = `Unable to load data file. ${error.message}`;
  }

  [searchInput, locationFilter, statusFilter].forEach((input) =>
    input.addEventListener("input", render)
  );

  render();
}

init();
