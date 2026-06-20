const data = [
  { id:"1872425-91-6", title:"Pentaphenyl triazine", formula:"C33H25N3", similarity:99, components:1 },
  { id:"83820-00-2", title:"Tetraphenyl triazine", formula:"C30H20N3", similarity:96, components:1 },
  { id:"1872425-97-2", title:"Tetrakis… triazine", formula:"C63H41N9", similarity:92, components:1 },
];

const state = {
  q: "",
  similarityTiers: new Set(),
  components: new Set(),
  sort: "relevance",
};

const SIM_OPTIONS = [">=99","95-98","90-94","85-89"];
const COMP_OPTIONS = [1,2,3,4];

function matchesQuery(r, q) {
  if (!q) return true;
  q = q.toLowerCase();
  return (r.id + " " + r.title + " " + r.formula).toLowerCase().includes(q);
}

function matchesSimilarity(r, tiers) {
  if (tiers.size === 0) return true;
  for (const t of tiers) {
    if (t === ">=99" && r.similarity >= 99) return true;
    if (t === "95-98" && r.similarity >= 95 && r.similarity <= 98) return true;
    if (t === "90-94" && r.similarity >= 90 && r.similarity <= 94) return true;
    if (t === "85-89" && r.similarity >= 85 && r.similarity <= 89) return true;
  }
  return false;
}

function matchesComponents(r, comps) {
  if (comps.size === 0) return true;
  return comps.has(r.components);
}

function applyFilters(rows) {
  let out = rows
    .filter(r => matchesQuery(r, state.q))
    .filter(r => matchesSimilarity(r, state.similarityTiers))
    .filter(r => matchesComponents(r, state.components));

  if (state.sort === "similarity_desc") out.sort((a,b) => b.similarity - a.similarity);
  return out;
}

function render() {
  const filtered = applyFilters([...data]);

  document.getElementById("count").textContent = `${filtered.length} results`;

  // chips (active filters)
  const chips = [];
  if (state.q) chips.push(`q: "${state.q}"`);
  for (const s of state.similarityTiers) chips.push(`Similarity ${s}`);
  for (const c of state.components) chips.push(`Components ${c}`);
  document.getElementById("chips").innerHTML = chips.map(x => `<span class="chip">${x}</span>`).join("");

  // cards
  document.getElementById("cards").innerHTML = filtered.map(r => `
    <div class="card">
      <div class="muted">${r.id}</div>
      <div class="title">${r.title}</div>
      <div class="muted">${r.formula} • similarity ${r.similarity}</div>
    </div>
  `).join("");
}

function renderFilters() {
  // Similarity
  const simDiv = document.getElementById("similarity-filters");
  simDiv.innerHTML = SIM_OPTIONS.map(opt => {
    const checked = state.similarityTiers.has(opt) ? "checked" : "";
    return `<label><input type="checkbox" data-sim="${opt}" ${checked}/> ${opt}</label><br>`;
  }).join("");

  // Components
  const compDiv = document.getElementById("component-filters");
  compDiv.innerHTML = COMP_OPTIONS.map(n => {
    const checked = state.components.has(n) ? "checked" : "";
    return `<label><input type="checkbox" data-comp="${n}" ${checked}/> ${n}</label><br>`;
  }).join("");
}

document.addEventListener("change", (e) => {
  if (e.target.matches("[data-sim]")) {
    const opt = e.target.dataset.sim;
    e.target.checked ? state.similarityTiers.add(opt) : state.similarityTiers.delete(opt);
    render();
  }
  if (e.target.matches("[data-comp]")) {
    const n = Number(e.target.dataset.comp);
    e.target.checked ? state.components.add(n) : state.components.delete(n);
    render();
  }
  if (e.target.id === "sort") {
    state.sort = e.target.value;
    render();
  }
});

document.getElementById("q").addEventListener("input", (e) => {
  state.q = e.target.value.trim();
  render();
});

document.getElementById("clear").addEventListener("click", () => {
  state.q = "";
  state.similarityTiers.clear();
  state.components.clear();
  state.sort = "relevance";
  document.getElementById("q").value = "";
  document.getElementById("sort").value = "relevance";
  renderFilters();
  render();
});

renderFilters();
render();
