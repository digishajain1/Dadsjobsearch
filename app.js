const DATA_URL = "./data/opportunities.json";
const TRACKER_KEY = "dadsjobsearch_tracker_v1";
const SAVES_KEY = "dadsjobsearch_saves_v1";
const ITEMS_PER_PAGE = 10;

const searchInput = document.getElementById("search");
const sourceFilter = document.getElementById("sourceFilter");
const locationFilter = document.getElementById("locationFilter");
const salaryFilter = document.getElementById("salaryFilter");
const statusFilter = document.getElementById("statusFilter");
const executiveList = document.getElementById("executiveList");
const boardList = document.getElementById("boardList");
const executiveCount = document.getElementById("executiveCount");
const boardCount = document.getElementById("boardCount");
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

function readSaves() {
  try {
    return JSON.parse(localStorage.getItem(SAVES_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeSaves(data) {
  localStorage.setItem(SAVES_KEY, JSON.stringify(data));
}

function getCombinedText(opportunity) {
  return [
    opportunity.title,
    opportunity.company,
    opportunity.location,
    opportunity.sector,
    opportunity.source,
    opportunity.description,
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

function sourceMatches(filter, source) {
  if (filter === "all") return true;
  return (source || "").toLowerCase().includes(filter.toLowerCase());
}

function salaryMatches(filter, opportunity) {
  if (filter === "all") return true;
  const floor = parseInt(filter, 10);
  const salaryMin = opportunity.salaryMin || opportunity.salaryLpa || 0;
  const salaryMax = opportunity.salaryMax || opportunity.salaryLpa || 0;
  return salaryMax >= floor || salaryMin >= floor;
}

function formatSalary(opportunity) {
  const min = opportunity.salaryMin || opportunity.salaryLpa;
  const max = opportunity.salaryMax || opportunity.salaryLpa;
  if (!min && !max) return "Board Role";
  if (min === max || !max) return `₹${min}L`;
  return `₹${min}L – ₹${max}L`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.round((now - d) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "1d ago";
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 60) return "1mo ago";
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function formatNumber(n) {
  if (!n) return "0";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function buildCard(opportunity) {
  const tracker = readTracker();
  const saves = readSaves();
  const state = tracker[opportunity.id] || { status: "", notes: "" };
  const isSaved = !!saves[opportunity.id];

  const node = template.content.firstElementChild.cloneNode(true);

  // Status colour stripe
  if (state.status) node.dataset.status = state.status;

  // Logo
  const logoImg = node.querySelector(".company-logo");
  const logoFallback = node.querySelector(".company-logo-fallback");
  if (opportunity.companyLogo) {
    logoImg.src = opportunity.companyLogo;
    logoImg.alt = opportunity.company || "";
    logoImg.onerror = () => {
      logoImg.style.display = "none";
      logoFallback.style.display = "flex";
    };
  } else {
    logoImg.style.display = "none";
  }

  // Header info
  node.querySelector(".company-name").textContent = opportunity.company || "";
  node.querySelector(".location-text").textContent = opportunity.location || "";
  node.querySelector(".source-text").textContent = `Via: ${opportunity.source || "Unknown"}`;
  node.querySelector(".posted-text").textContent = formatDate(opportunity.postedDate);

  // Body
  node.querySelector(".job-title").textContent = opportunity.title || "";
  node.querySelector(".job-type-badge").textContent = opportunity.jobType || opportunity.type || "";
  node.querySelector(".sector-badge").textContent = opportunity.sector || "";
  node.querySelector(".job-description").textContent = opportunity.description || "";

  // Salary & relevance
  node.querySelector(".salary-text").textContent = formatSalary(opportunity);
  node.querySelector(".relevance-text").textContent = opportunity.relevanceScore ?? "N/A";

  // Engagement
  node.querySelector(".views-text").textContent = formatNumber(opportunity.viewCount);
  node.querySelector(".applicants-text").textContent = formatNumber(opportunity.applicantCount);

  // Save button
  const saveBtn = node.querySelector(".btn-save");
  if (isSaved) {
    saveBtn.classList.add("saved");
    saveBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Saved';
  }
  saveBtn.addEventListener("click", () => {
    const currentSaves = readSaves();
    if (currentSaves[opportunity.id]) {
      delete currentSaves[opportunity.id];
      saveBtn.classList.remove("saved");
      saveBtn.innerHTML = '<i class="fa-regular fa-bookmark"></i> Save';
    } else {
      currentSaves[opportunity.id] = { savedAt: new Date().toISOString() };
      saveBtn.classList.add("saved");
      saveBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Saved';
    }
    writeSaves(currentSaves);
  });

  // Apply button
  const applyBtn = node.querySelector(".btn-apply");
  applyBtn.href = opportunity.url || "#";

  // Share button
  const shareBtn = node.querySelector(".btn-share");
  shareBtn.addEventListener("click", () => {
    const text = `${opportunity.title} at ${opportunity.company} — ${opportunity.url || window.location.href}`;
    if (navigator.share) {
      navigator.share({ title: opportunity.title, text, url: opportunity.url || window.location.href }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        shareBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => { shareBtn.innerHTML = '<i class="fa-solid fa-share-nodes"></i>'; }, 1500);
      });
    }
  });

  // Tracker
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
    node.dataset.status = statusEl.value;
  };

  statusEl.addEventListener("change", save);
  notesEl.addEventListener("blur", save);

  return node;
}

function applyFilters(list) {
  const q = searchInput.value.trim().toLowerCase();
  const tracker = readTracker();
  const salaryVal = salaryFilter.value;
  return list.filter((item) => {
    const status = tracker[item.id]?.status || "";
    const queryMatches = !q || getCombinedText(item).includes(q);
    return (
      queryMatches &&
      sourceMatches(sourceFilter.value, item.source) &&
      locationMatches(locationFilter.value, item.location) &&
      salaryMatches(salaryVal, item) &&
      statusMatches(statusFilter.value, status)
    );
  });
}

function paginate(items, page) {
  const start = (page - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  return items.slice(start, end);
}

function createPaginationControls(totalItems, page, type) {
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  if (totalPages <= 1) return null;

  const controls = document.createElement("div");
  controls.className = "pagination";

  const prevBtn = document.createElement("button");
  prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i> Previous';
  prevBtn.disabled = page === 1;
  prevBtn.addEventListener("click", () => {
    if (currentPage[type] > 1) {
      currentPage[type]--;
      render();
      document.querySelector(`.jobs-section:has(#${type}List)`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  const pageInfo = document.createElement("span");
  pageInfo.className = "page-info";
  pageInfo.textContent = `${page} / ${totalPages}`;

  const nextBtn = document.createElement("button");
  nextBtn.innerHTML = 'Next <i class="fa-solid fa-chevron-right"></i>';
  nextBtn.disabled = page === totalPages;
  nextBtn.addEventListener("click", () => {
    if (currentPage[type] < totalPages) {
      currentPage[type]++;
      render();
      document.querySelector(`.jobs-section:has(#${type}List)`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  controls.appendChild(prevBtn);
  controls.appendChild(pageInfo);
  controls.appendChild(nextBtn);
  return controls;
}

function renderList(container, items, emptyText, type, countEl) {
  container.innerHTML = "";

  if (countEl) countEl.textContent = items.length;

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<i class="fa-solid fa-inbox"></i><p>${emptyText}</p>`;
    container.appendChild(empty);
    return;
  }

  const paginatedItems = paginate(items, currentPage[type]);
  const fragment = document.createDocumentFragment();
  paginatedItems.forEach((item) => fragment.appendChild(buildCard(item)));
  container.appendChild(fragment);

  const pagination = createPaginationControls(items.length, currentPage[type], type);
  if (pagination) container.appendChild(pagination);
}

function render() {
  const executive = applyFilters(dataset.executiveRoles || []);
  const board = applyFilters(dataset.boardRoles || []);

  renderList(executiveList, executive, "No executive opportunities match current filters.", "executive", executiveCount);
  renderList(boardList, board, "No board signals match current filters.", "board", boardCount);
}

async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to load data: ${response.status}`);
    dataset = await response.json();
    const genDate = dataset.generatedAt ? new Date(dataset.generatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "Unknown";
    meta.textContent = `Updated: ${genDate} IST · ${(dataset.executiveRoles || []).length} executive · ${(dataset.boardRoles || []).length} board`;
  } catch (error) {
    meta.textContent = `Unable to load data. ${error.message}`;
  }

  [searchInput, sourceFilter, locationFilter, salaryFilter, statusFilter].forEach((input) =>
    input.addEventListener("input", () => {
      currentPage = { executive: 1, board: 1 };
      render();
    })
  );

  render();
}

init();
