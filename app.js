const IMAGE_BASE = "https://www.unionarena-tcg.com/jp/images/cardlist/card/";
const PLACEHOLDER_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420">
  <rect width="300" height="420" rx="18" fill="#f3f4f6"/>
  <text x="150" y="205" text-anchor="middle" font-family="Arial" font-size="18" fill="#6b7280">No image</text>
</svg>`)}`;

const COLOR_LETTER_MAP = {
  B: "Blue",
  R: "Red",
  Y: "Yellow",
  G: "Green",
  P: "Purple"
};

const IP_CODE_LABEL_MAP = {
  MST: "無職轉生～到了異世界就拿出真本事～"
};

const FIXED_FILTER_OPTIONS = {
  trigger: [
    "",
    "get",
    "draw",
    "active",
    "raid",
    "color",
    "final",
    "special"
  ],
  type: [
    "Character",
    "Event",
    "Field",
    "AP",
    "BP"
  ],
  color: [
    "Red",
    "Blue",
    "Yellow",
    "Green",
    "Purple"
  ]
};

const FILTER_LABEL_MAP = {
  trigger: {
    "": "無觸發",
    get: "獲得",
    draw: "抽牌",
    active: "激活",
    raid: "突襲",
    color: "COLOR",
    final: "FINAL",
    special: "SPECIAL"
  },
  type: {
    Character: "角色",
    Event: "事件",
    Field: "場地",
    AP: "AP",
    BP: "BP"
  },
  color: {
    Red: "紅",
    Blue: "藍",
    Yellow: "黃",
    Green: "綠",
    Purple: "紫"
  }
};

function filterValueLabel(key, value) {
  if (key === "ip_code") {
    return IP_CODE_LABEL_MAP[value] || value;
  }

  if (key === "energy_has_plus") {
    return value === "true" ? "Has +" : "No +";
  }

  return FILTER_LABEL_MAP[key]?.[value] ?? value;
}

function normalizeTrigger(value) {
  const s = String(value ?? "").trim().toLowerCase();

  if (!s) return "";

  if (s.startsWith("color_")) {
    return "color";
  }

  return s;
}

function normalizeColor(value) {
  const s = String(value ?? "").trim();
  return COLOR_LETTER_MAP[s.toUpperCase()] || s;
}

const state = {
  allCards: [],
  filteredCards: [],
  selectedId: null,
  q: "",
  sort: "code_asc",
  filters: {
    ip_code: new Set(),
    series: new Set(),
    rarity: new Set(),
    color: new Set(),
    type: new Set(),
    trigger: new Set(),
    energy_colors: new Set(),
    energy_has_plus: new Set(),
  },
  ranges: {
    energy_required: { min: "", max: "" },
    ap: { min: "", max: "" },
    bp: { min: "", max: "" },
    energy_count: { min: "", max: "" },
  },
  collapsed: new Set()
};

const filterGroups = [
  { key: "ip_code", label: "IP Code" },
  { key: "series", label: "Series" },
  { key: "rarity", label: "Rarity" },
  { key: "color", label: "Color" },
  { key: "type", label: "Type" },
  { key: "trigger", label: "觸發" },
  { key: "energy_colors", label: "Generated Energy Color" },
  { key: "energy_has_plus", label: "Energy +" },
];

const rangeGroups = [
  { key: "energy_required", label: "Energy Required" },
  { key: "ap", label: "AP" },
  { key: "bp", label: "BP" },
  { key: "energy_count", label: "Generated Energy Count" },
];

const tile = { width: 184, height: 286, gap: 10, overscanRows: 3 };
let layout = { cols: 1, rows: 0, visibleStart: 0, visibleEnd: 0 };
let searchTimer = null;

let el;

function getElements() {
  return {
    search: document.getElementById("searchInput"),
    sort: document.getElementById("sortSelect"),
    count: document.getElementById("resultCount"),
    filterRoot: document.getElementById("filterRoot"),
    chips: document.getElementById("activeChips"),
    clear: document.getElementById("clearFiltersBtn"),
    scroller: document.getElementById("gridScroller"),
    grid: document.getElementById("gridInner"),
    details: document.getElementById("detailsRoot"),
  };
}

function assertElementsExist(elements) {
  const missing = Object.entries(elements)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Missing required DOM elements: ${missing.join(", ")}`);
  }
}



if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

async function init() {
  el = getElements();
  assertElementsExist(el);
  bindEvents();
  try {
    const res = await fetch("cards.json");

    if (!res.ok) {
      throw new Error(`Failed to load cards.json: ${res.status} ${res.statusText}`);
    }

    const raw = await res.json();

    if (!Array.isArray(raw)) {
      throw new Error("cards.json must contain an array of cards");
    }

    state.allCards = raw.map(normalizeCard);
  } catch (err) {
    console.error(err);
    state.allCards = [];
    el.details.textContent = `Could not load cards.json: ${err.message}`;
  }
  state.selectedId = state.allCards[0]?.id ?? null;
  applyAndRender();
}

function bindEvents() {
  el.search.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.q = e.target.value.trim().toLowerCase();
      applyAndRender();
    }, 180);
  });

  el.sort.addEventListener("change", (e) => {
    state.sort = e.target.value;
    applyAndRender();
  });

  el.clear.addEventListener("click", () => {
    state.q = "";
    el.search.value = "";
    for (const set of Object.values(state.filters)) set.clear();
    for (const range of Object.values(state.ranges)) {
      range.min = "";
      range.max = "";
    }
    applyAndRender();
  });

  el.scroller.addEventListener("scroll", renderGrid);
  window.addEventListener("resize", renderGrid);
}

function normalizeCard(c) {
  const id = c.id || `${c.series}_${c.card_number}`;
  const energyRaw = c.energy_generated_raw ?? c.energy_generated ?? "";
  const parsed = parseEnergy(energyRaw, c.energy_colors);
  const trigger = normalizeTrigger(c.trigger);
  const color = normalizeColor(c.color);
  return {
    ...c,
    id,
    color,
    trigger,
    trigger_raw: c.trigger ?? "",
    image_url: c.image_url || `${IMAGE_BASE}${id}.png`,
    energy_generated_raw: energyRaw,
    energy_colors: parsed.colors,
    energy_count: Number.isFinite(Number(c.energy_count)) ? Number(c.energy_count) : parsed.count,
    energy_has_plus: typeof c.energy_has_plus === "boolean" ? c.energy_has_plus : parsed.hasPlus,
    energy_signature: parsed.signature,
    search_text: [
    id, c.ip_code, c.series, c.card_number,
    c.card_name_jp, c.card_name_cn,
    c.rarity, color, c.type, trigger, c.trigger,
    c.effect_jp, c.effect_cn,
    energyRaw
    ].filter(Boolean).join(" ").toLowerCase()
  };
}

function parseEnergy(raw, existingColors) {
  const s = String(raw || "").trim().toUpperCase();
  const hasPlus = s.includes("+");
  const letters = [...s.replace(/\+/g, "")].filter(ch => /[A-Z]/.test(ch));

  const parsedColors = [...new Set(
    letters.map(ch => COLOR_LETTER_MAP[ch] || ch)
  )];

  const colors = Array.isArray(existingColors) && existingColors.length
    ? existingColors
    : parsedColors;

  return {
    colors,
    count: letters.length,
    hasPlus,
    signature: [...letters].sort().join("") + (hasPlus ? "+" : "")
  };
}

function applyAndRender({ resetScroll = true, rebuildFilters = true } = {}) {
  state.filteredCards = state.allCards.filter(cardMatches);
  sortCards(state.filteredCards);

  if (!state.filteredCards.some(c => c.id === state.selectedId)) {
    state.selectedId = state.filteredCards[0]?.id ?? null;
  }

  if (resetScroll) {
    el.scroller.scrollTop = 0;
  }

  el.count.textContent = state.filteredCards.length;

  if (rebuildFilters) {
    renderFilters();
  }

  renderChips();
  renderGrid();
  renderDetails();
}

function cardMatches(c) {
  if (state.q && !c.search_text.includes(state.q)) return false;

  for (const [key, selected] of Object.entries(state.filters)) {
    if (!selected.size) continue;
    if (key === "energy_colors") {
      if (!c.energy_colors?.some(x => selected.has(x))) return false;
    } else if (key === "energy_has_plus") {
      if (!selected.has(String(Boolean(c.energy_has_plus)))) return false;
    } else {
      const v = c[key];
      if (!selected.has(String(v ?? ""))) return false;
    }
  }

  for (const [key, range] of Object.entries(state.ranges)) {
    const v = Number(c[key]);
    if (range.min !== "" && !(Number.isFinite(v) && v >= Number(range.min))) return false;
    if (range.max !== "" && !(Number.isFinite(v) && v <= Number(range.max))) return false;
  }
  return true;
}

function sortCards(cards) {
  const byStr = (a, b, key) => String(a[key] ?? "").localeCompare(String(b[key] ?? ""), undefined, { numeric: true });
  const byNumAsc = (a, b, key) => {
  const av = Number(a[key]);
  const bv = Number(b[key]);

  return (Number.isFinite(av) ? av : Infinity) -
    (Number.isFinite(bv) ? bv : Infinity);
  };

  const byNumDesc = (a, b, key) => {
    const av = Number(a[key]);
    const bv = Number(b[key]);

    return (Number.isFinite(bv) ? bv : -Infinity) -
      (Number.isFinite(av) ? av : -Infinity);
  };
  cards.sort((a, b) => {
    switch (state.sort) {
      case "code_desc": return -byStr(a, b, "id");
      case "bp_desc": return byNumDesc(a, b, "bp") || byStr(a, b, "id");
      case "bp_asc": return byNumAsc(a, b, "bp") || byStr(a, b, "id");
      case "cost_desc": return byNumDesc(a, b, "energy_required") || byStr(a, b, "id");
      case "cost_asc": return byNumAsc(a, b, "energy_required") || byStr(a, b, "id");
      default: return byStr(a, b, "id");
    }
  });
}

function renderFilters() {
  const html = [];
  for (const group of filterGroups) {
    const options = getOptions(group.key);
    const collapsed = state.collapsed.has(group.key);
    html.push(`
      <section class="filter-section">
        <button class="filter-heading" data-collapse="${group.key}" aria-expanded="${!collapsed}">
          <span>${escapeHtml(group.label)}</span>
          <span class="filter-count">${options.length} ${collapsed ? "+" : "−"}</span>
        </button>
        <div class="checkbox-list" ${collapsed ? "hidden" : ""}>
          ${options.map(o => renderCheckbox(group.key, o)).join("")}
        </div>
      </section>
    `);
  }
  for (const group of rangeGroups) {
    const r = state.ranges[group.key];
    html.push(`
      <section class="filter-section">
        <div class="filter-label">${escapeHtml(group.label)}</div>
        <div class="range-row">
          <input class="number-input" data-range-min="${group.key}" type="number" placeholder="Min" value="${escapeHtml(r.min)}" />
          <input class="number-input" data-range-max="${group.key}" type="number" placeholder="Max" value="${escapeHtml(r.max)}" />
        </div>
      </section>
    `);
  }
  el.filterRoot.innerHTML = html.join("");

  el.filterRoot.querySelectorAll("[data-filter]").forEach(input => {
    input.addEventListener("change", (e) => {
      const key = e.target.dataset.filter;
      const value = e.target.value;
      e.target.checked ? state.filters[key].add(value) : state.filters[key].delete(value);
      applyAndRender();
    });
  });
  el.filterRoot.querySelectorAll("[data-range-min]").forEach(input => {
    input.addEventListener("input", (e) => {
      state.ranges[e.target.dataset.rangeMin].min = e.target.value;
      applyAndRender({ rebuildFilters: false });
    });
  });
  el.filterRoot.querySelectorAll("[data-range-max]").forEach(input => {
    input.addEventListener("input", (e) => {
      state.ranges[e.target.dataset.rangeMax].max = e.target.value;
      applyAndRender({ rebuildFilters: false });
    });
  });
  el.filterRoot.querySelectorAll("[data-collapse]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const key = e.currentTarget.dataset.collapse;
      state.collapsed.has(key) ? state.collapsed.delete(key) : state.collapsed.add(key);
      renderFilters();
    });
  });
}

function getOptions(key) {
  const counts = new Map();

  for (const c of state.allCards) {
    const values =
      key === "energy_colors"
        ? (c.energy_colors || [])
        : key === "energy_has_plus"
          ? [String(Boolean(c.energy_has_plus))]
          : [String(c[key] ?? "")];

    for (const value of values) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }

  if (FIXED_FILTER_OPTIONS[key]) {
    return FIXED_FILTER_OPTIONS[key].map(value => ({
      value,
      count: counts.get(value) || 0
    }));
  }

  return [...counts.entries()]
    .filter(([value]) => value)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) =>
      a.value.localeCompare(b.value, undefined, { numeric: true })
    );
}

function renderCheckbox(key, option) {
  const checked = state.filters[key].has(option.value) ? "checked" : "";
  const label =
  key === "energy_has_plus"
    ? (option.value === "true" ? "Has +" : "No +")
    : FILTER_LABEL_MAP[key]?.[option.value] ?? option.value;
  return `
    <label class="checkbox-row" title="${escapeHtml(label)}">
      <input type="checkbox" data-filter="${key}" value="${escapeHtml(option.value)}" ${checked} />
      <span class="option-name">${escapeHtml(label)}</span>
      <span class="option-count">${option.count}</span>
    </label>
  `;
}

function renderChips() {
  const chips = [];
  if (state.q) chips.push({ label: `Search: ${state.q}`, action: "search" });
  for (const [key, set] of Object.entries(state.filters)) {
    for (const value of set) {
      chips.push({
        label: `${key}: ${filterValueLabel(key, value)}`,
        key,
        value
      });
    }
  }
  for (const [key, r] of Object.entries(state.ranges)) {
    if (r.min !== "") chips.push({ label: `${key} ≥ ${r.min}`, range: key, bound: "min" });
    if (r.max !== "") chips.push({ label: `${key} ≤ ${r.max}`, range: key, bound: "max" });
  }
  el.chips.innerHTML = chips.map((c, i) => `<span class="chip">${escapeHtml(c.label)} <button data-chip="${i}">×</button></span>`).join("");
  el.chips.querySelectorAll("[data-chip]").forEach(btn => {
    btn.addEventListener("click", () => {
      const c = chips[Number(btn.dataset.chip)];
      if (c.action === "search") { state.q = ""; el.search.value = ""; }
      if (c.key) state.filters[c.key].delete(c.value);
      if (c.range) state.ranges[c.range][c.bound] = "";
      applyAndRender();
    });
  });
}

function renderGrid() {
  if (state.filteredCards.length === 0) {
    el.grid.style.height = "100%";
    el.grid.innerHTML = `
      <div class="empty-grid-message">
        No cards found. Check whether cards.json loaded correctly.
      </div>
    `;
    return;
  }

  const width = Math.max(0, el.scroller.clientWidth);
  const height = el.scroller.clientHeight;
  const fullW = tile.width + tile.gap;
  const fullH = tile.height + tile.gap;
  const cols = Math.max(1, Math.floor(width / fullW));
  const rows = Math.ceil(state.filteredCards.length / cols);
  const scrollTop = el.scroller.scrollTop;
  const startRow = Math.max(0, Math.floor(scrollTop / fullH) - tile.overscanRows);
  const endRow = Math.min(rows, Math.ceil((scrollTop + height) / fullH) + tile.overscanRows);
  const start = startRow * cols;
  const end = Math.min(state.filteredCards.length, endRow * cols);
  layout = { cols, rows, visibleStart: start, visibleEnd: end };
  el.grid.style.height = `${rows * fullH}px`;

  const pieces = [];
  for (let i = start; i < end; i++) {
    const c = state.filteredCards[i];
    const row = Math.floor(i / cols);
    const col = i % cols;
    pieces.push(`
      <div class="card-tile" style="left:${col * fullW}px; top:${row * fullH}px; width:${tile.width}px; height:${tile.height}px;">
        <button class="card-button ${c.id === state.selectedId ? "selected" : ""}" data-card-id="${escapeHtml(c.id)}" title="${escapeHtml(c.id)}">
          <div class="card-img-wrap">
          <img class="card-img" src="${escapeHtml(c.image_url)}" alt="${escapeHtml(c.id)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" />          </div>
          <div class="card-meta">
            <div class="card-code">${escapeHtml(c.id)}</div>
            <div class="card-name">${escapeHtml(c.card_name_cn || c.card_name_jp || "Untitled")}</div>
          </div>
        </button>
      </div>
    `);
  }
  el.grid.innerHTML = pieces.join("");
  attachImageFallbacks(el.grid);
  el.grid.querySelectorAll("[data-card-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.selectedId = btn.dataset.cardId;
      renderGrid();
      renderDetails();
    });
  });
}

function formatEffectText(value) {
  return escapeHtml(
    String(value || "—")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/&lt;br\s*\/?&gt;/gi, "\n")
  ).replace(/\n/g, "<br>");
}

function renderDetails() {
  const c = state.allCards.find(x => x.id === state.selectedId);
  if (!c) {
    el.details.className = "details-empty";
    el.details.textContent = "Select a card to view details.";
    return;
  }
  el.details.className = "";
  el.details.innerHTML = `
    <img class="detail-image" src="${escapeHtml(c.image_url)}" alt="${escapeHtml(c.id)}" referrerpolicy="no-referrer" />    <div class="detail-title">${escapeHtml(c.card_name_cn || c.card_name_jp || c.id)}</div>
    <div class="detail-subtitle">${escapeHtml(c.card_name_jp || "")} · ${escapeHtml(c.id)}</div>

    <div class="pills">
      ${pill(c.rarity)} ${pill(c.color, c.color)} ${pill(c.type)} ${pill(c.trigger)}
    </div>

    <div class="stat-grid">
      ${stat("Energy Required", c.energy_required)}
      ${stat("AP", c.ap)}
      ${stat("BP", c.bp)}
      ${stat("Generated", c.energy_generated_raw || c.energy_colors?.join("/"))}
      ${stat("Energy Count", c.energy_count)}
      ${stat("Has +", c.energy_has_plus ? "Yes" : "No")}
      ${stat("BP±", c.bp_pm)}
      ${stat("Affinity", c.affinity)}
    </div>

    <div class="detail-section">
      <h3>Generated energy colors</h3>
      <div class="pills">${(c.energy_colors || []).map(x => pill(x, x)).join("") || `<span class="muted">None</span>`}</div>
    </div>

    <div class="detail-section">
      <h3>Effect · Chinese</h3>
      <div class="effect-text">${formatEffectText(c.effect_cn)}</div>
    </div>

    <div class="detail-section">
      <h3>Effect · Japanese</h3>
      <div class="effect-text">${formatEffectText(c.effect_jp)}</div>
    </div>
  `;
  attachImageFallbacks(el.details);
}

function stat(label, value) {
  return `<div class="stat-box"><div class="stat-label">${escapeHtml(label)}</div><div class="stat-value">${escapeHtml(value ?? "—")}</div></div>`;
}

function pill(text, colorClass = "") {
  if (text == null || text === "") return "";
  const safeClass = String(colorClass).replace(/[^a-zA-Z0-9_-]/g, "");
  return `<span class="pill ${safeClass}">${escapeHtml(text)}</span>`;
}

function attachImageFallbacks(root) {
  root.querySelectorAll("img.card-img, img.detail-image").forEach(img => {
    img.addEventListener("error", () => {
      img.src = PLACEHOLDER_SVG;
    }, { once: true });
  });
}
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
