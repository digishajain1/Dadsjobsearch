const DATA_URL = './data/opportunities.json';
const TRACKER_KEY = 'dadsjobsearch-tracker-v1';

const el = (selector) => document.querySelector(selector);
const template = el('#opportunity-template');

function loadTracker() {
  try {
    return JSON.parse(localStorage.getItem(TRACKER_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveTracker(value) {
  localStorage.setItem(TRACKER_KEY, JSON.stringify(value));
}

function formatDate(value) {
  if (!value) return 'Date not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function renderStats(data) {
  const cards = [
    ['Executive roles', data.stats.executive],
    ['Board roles', data.stats.board],
    ['Sources', data.stats.sources],
    ['Total tracked', data.stats.total]
  ];

  el('#stats').innerHTML = cards
    .map(
      ([label, value]) => `
        <article class="card metric-card">
          <p>${label}</p>
          <h3>${value}</h3>
        </article>`
    )
    .join('');
}

function renderAlerts(alerts) {
  const container = el('#alerts');
  if (!alerts.length) {
    container.innerHTML = '<div class="badge">All live sources refreshed cleanly.</div>';
    return;
  }

  container.innerHTML = alerts.map((message) => `<div class="alert">${message}</div>`).join('');
}

function renderLinks(groupId, links) {
  el(groupId).innerHTML = links
    .map((item) => `<li><a href="${item.url}" target="_blank" rel="noreferrer">${item.label}</a></li>`)
    .join('');
}

function renderTrackerSummary(tracker) {
  const entries = Object.values(tracker).filter((item) => item.status || item.notes);
  if (!entries.length) {
    el('#tracker-summary').innerHTML = '<div class="empty">Saved statuses and notes will appear here.</div>';
    return;
  }

  const counts = entries.reduce((acc, item) => {
    acc[item.status || 'notes only'] = (acc[item.status || 'notes only'] || 0) + 1;
    return acc;
  }, {});

  el('#tracker-summary').innerHTML = Object.entries(counts)
    .map(
      ([label, value]) => `
      <article class="card metric-card">
        <p>${label}</p>
        <h3>${value}</h3>
      </article>`
    )
    .join('');
}

function bindTrackerControls(card, opportunity, tracker, onUpdate) {
  const select = card.querySelector('select');
  const textarea = card.querySelector('textarea');
  const saved = tracker[opportunity.id] || {};

  select.value = saved.status || '';
  textarea.value = saved.notes || '';

  const persist = () => {
    const nextValue = {
      status: select.value,
      notes: textarea.value.trim(),
      title: opportunity.title,
      company: opportunity.company,
      url: opportunity.url
    };

    if (!nextValue.status && !nextValue.notes) {
      delete tracker[opportunity.id];
    } else {
      tracker[opportunity.id] = nextValue;
    }

    saveTracker(tracker);
    onUpdate();
  };

  select.addEventListener('change', persist);
  textarea.addEventListener('change', persist);
}

function renderOpportunities(containerId, items, tracker, onUpdate) {
  const container = el(containerId);
  if (!items.length) {
    container.innerHTML = '<div class="empty">No cached matches yet. Use the live search links until the next refresh completes.</div>';
    return;
  }

  container.innerHTML = '';

  items.forEach((opportunity) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector('h3').textContent = opportunity.title;
    node.querySelector('.source-line').textContent = opportunity.source;
    node.querySelector('.company-line').textContent = opportunity.company || 'Company not listed';
    node.querySelector('.meta').textContent = `${opportunity.locationBucket || opportunity.location} · ${formatDate(opportunity.publishedAt || opportunity.firstSeenAt)}`;
    node.querySelector('.summary').textContent = opportunity.description || 'Open the role to review full details.';
    node.querySelector('.score-badge').textContent = `Match ${opportunity.score}`;
    node.querySelector('.button.primary').href = opportunity.url;
    node.querySelector('.tag-list').innerHTML = (opportunity.tags || [])
      .slice(0, 6)
      .map((tag) => `<span class="tag">${tag}</span>`)
      .join('');

    bindTrackerControls(node, opportunity, tracker, onUpdate);
    container.appendChild(node);
  });
}

async function init() {
  const response = await fetch(DATA_URL, { cache: 'no-store' });
  const data = await response.json();
  const tracker = loadTracker();
  const rerenderSummary = () => renderTrackerSummary(tracker);

  renderStats(data);
  renderAlerts(data.alerts || []);
  renderLinks('#executive-links', data.searchLinks.executive || []);
  renderLinks('#board-links', data.searchLinks.board || []);
  renderOpportunities('#executive-opportunities', data.opportunities.executive || [], tracker, rerenderSummary);
  renderOpportunities('#board-opportunities', data.opportunities.board || [], tracker, rerenderSummary);
  renderTrackerSummary(tracker);
  el('#generated-at').textContent = `Last refresh: ${formatDate(data.generatedAt)}`;
  el('#clear-tracker').addEventListener('click', () => {
    localStorage.removeItem(TRACKER_KEY);
    location.reload();
  });
}

init().catch((error) => {
  console.error(error);
  document.body.insertAdjacentHTML(
    'beforeend',
    `<main class="hero"><div class="alert">Unable to load the dashboard data. ${error.message}</div></main>`
  );
});
