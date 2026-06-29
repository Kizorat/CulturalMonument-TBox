const monumentInput = document.getElementById("monument-input");
const monumentSuggestions = document.getElementById("monument-suggestions");
const panel = document.getElementById("monument-panel");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxClose = document.getElementById("lightbox-close");
const galleryDetails = document.getElementById("gallery-details");
const graphDetails = document.getElementById("graph-details");

// ── Search bar riutilizzabile con autocomplete ──────────────────────
// Usata sia da "Seleziona Monumento" sia da "Ulteriori informazioni":
// filtra gli elementi {id, name} il cui nome contiene il testo digitato,
// evidenzia la porzione che combacia e mostra i suggerimenti allineati sotto
// l'input. onSelect(item) scatta alla scelta (click, Invio o selezione
// programmatica via selectById).
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function createSearchBar({ input, suggestionsEl, getItems, onSelect, emptyText = "Nessun risultato." }) {
  let activeIndex = -1;

  function hide() {
    suggestionsEl.classList.add("hidden");
    suggestionsEl.innerHTML = "";
    activeIndex = -1;
    input.setAttribute("aria-expanded", "false");
  }

  function render() {
    const query = input.value.trim().toLowerCase();
    if (!query) { hide(); return; }
    const matches = getItems()
      .filter((it) => it.name.toLowerCase().includes(query))
      .slice(0, 8);

    suggestionsEl.innerHTML = "";
    activeIndex = -1;
    if (matches.length === 0) {
      suggestionsEl.innerHTML = `<li class="suggestions-empty">${emptyText}</li>`;
    } else {
      for (const it of matches) {
        const idx = it.name.toLowerCase().indexOf(query);
        const li = document.createElement("li");
        li.setAttribute("role", "option");
        li.dataset.id = it.id;
        li.innerHTML = escapeHtml(it.name.slice(0, idx)) +
          '<span class="match">' + escapeHtml(it.name.slice(idx, idx + query.length)) + "</span>" +
          escapeHtml(it.name.slice(idx + query.length));
        // mousedown (non click): scatta prima del blur dell'input
        li.addEventListener("mousedown", (e) => { e.preventDefault(); choose(it); });
        suggestionsEl.appendChild(li);
      }
    }
    suggestionsEl.classList.remove("hidden");
    input.setAttribute("aria-expanded", "true");
  }

  function setActive(items) {
    items.forEach((li, i) => li.classList.toggle("active", i === activeIndex));
    if (activeIndex >= 0) items[activeIndex].scrollIntoView({ block: "nearest" });
  }

  function choose(item) {
    input.value = item.name;
    hide();
    onSelect(item);
  }

  input.addEventListener("input", render);
  input.addEventListener("focus", () => { if (input.value.trim()) render(); });
  input.addEventListener("keydown", (e) => {
    const items = [...suggestionsEl.querySelectorAll("li[role='option']")];
    if (e.key === "ArrowDown" && items.length) {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      setActive(items);
    } else if (e.key === "ArrowUp" && items.length) {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      setActive(items);
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault();
        const it = getItems().find((x) => String(x.id) === items[activeIndex].dataset.id);
        if (it) choose(it);
      }
    } else if (e.key === "Escape") {
      hide();
    }
  });
  // ritardo: lascia completare l'eventuale mousedown su un suggerimento
  input.addEventListener("blur", () => setTimeout(hide, 120));

  return {
    // selezione programmatica per id (link "vicini", apertura scheda, ecc.)
    selectById(id) {
      const it = getItems().find((x) => String(x.id) === String(id));
      if (it) choose(it);
    },
  };
}

let monumentItems = []; // {id, name} dalla KB, per la search bar dei monumenti

async function loadMonumentList() {
  const res = await fetch("/api/monuments");
  monumentItems = await res.json();
}

const monumentSearch = createSearchBar({
  input: monumentInput,
  suggestionsEl: monumentSuggestions,
  getItems: () => monumentItems,
  onSelect: (it) => onMonumentSelected(it.id),
  emptyText: "Nessun monumento trovato.",
});

function renderContacts(contacts) {
  const container = document.getElementById("m-contacts");
  container.innerHTML = "";

  const groups = [
    { label: "Siti web", items: contacts.websites, render: (v) => `<a href="${v.split(" - ")[0]}" target="_blank" rel="noopener">${v}</a>` },
    { label: "Email", items: contacts.emails, render: (v) => `<a href="mailto:${v.split(" - ")[0]}">${v}</a>` },
    { label: "Telefono", items: contacts.phones, render: (v) => `<a href="tel:${v}">${v}</a>` },
  ];

  const hasAny = groups.some((g) => g.items.length > 0);
  if (!hasAny) {
    container.innerHTML = '<p class="contact-empty">Nessun contatto disponibile.</p>';
    return;
  }

  for (const group of groups) {
    if (group.items.length === 0) continue;
    const heading = document.createElement("strong");
    heading.textContent = group.label;
    container.appendChild(heading);

    const ul = document.createElement("ul");
    ul.className = "contact-list";
    for (const item of group.items) {
      const li = document.createElement("li");
      li.innerHTML = group.render(item);
      ul.appendChild(li);
    }
    container.appendChild(ul);
  }
}

function renderAccess(data) {
  const container = document.getElementById("m-access");
  container.innerHTML = "";

  if (data.accessCondition) {
    const badge = document.createElement("span");
    badge.className = "access-badge";
    badge.textContent = data.accessCondition.label;
    container.appendChild(badge);
    if (data.accessCondition.description) {
      const p = document.createElement("p");
      p.textContent = data.accessCondition.description;
      container.appendChild(p);
    }
  }

  if (data.accessibilityNote) {
    const p = document.createElement("p");
    p.textContent = data.accessibilityNote;
    container.appendChild(p);
  }

  if (!data.accessCondition && !data.accessibilityNote) {
    container.innerHTML = '<p class="contact-empty">Nessuna informazione di accessibilità disponibile.</p>';
  }
}

function renderMap(data) {
  const frame = document.getElementById("m-map");
  if (data.lat != null && data.lon != null) {
    frame.src = `https://maps.google.com/maps?q=${data.lat},${data.lon}&z=17&output=embed`;
    frame.classList.remove("hidden");
  } else {
    frame.classList.add("hidden");
  }
}

async function renderGallery(monumentId) {
  const gallery = document.getElementById("m-gallery");
  gallery.innerHTML = '<p class="hint">Caricamento immagini…</p>';

  const res = await fetch(`/api/monuments/${monumentId}/photos`);
  const data = await res.json();
  lastGalleryMonumentId = monumentId;

  gallery.innerHTML = "";
  if (!data.photos || data.photos.length === 0) {
    gallery.innerHTML = '<p class="gallery-empty">Nessuna immagine trovata su Wikimedia Commons.</p>';
    return;
  }

  for (const photo of data.photos) {
    const img = document.createElement("img");
    img.src = photo.thumb;
    img.alt = data.name;
    img.addEventListener("click", () => openLightbox(photo.full || photo.thumb));
    gallery.appendChild(img);
  }
}

async function renderNearby(monumentId) {
  const list = document.getElementById("m-nearby");
  list.innerHTML = '<li class="hint">Caricamento…</li>';

  let data;
  try {
    const res = await fetch(`/api/monuments/${monumentId}/nearby`);
    data = await res.json();
  } catch {
    list.innerHTML = '<li class="contact-empty">Impossibile calcolare i monumenti vicini.</li>';
    return;
  }

  list.innerHTML = "";
  if (!data.nearby || data.nearby.length === 0) {
    list.innerHTML = '<li class="contact-empty">Nessun monumento vicino disponibile (coordinate mancanti).</li>';
    return;
  }

  for (const m of data.nearby) {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = "#";
    link.className = "nearby-link";
    link.textContent = m.name;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      // naviga alla scheda del monumento vicino riusando la search bar
      monumentSearch.selectById(m.id);
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const dist = document.createElement("span");
    dist.className = "nearby-distance";
    dist.textContent = `${m.distanceKm.toFixed(2)} km`;

    li.append(link, dist);
    list.appendChild(li);
  }
}

function openLightbox(src) {
  lightboxImg.src = src;
  lightbox.showModal();
}

lightboxClose.addEventListener("click", () => lightbox.close());
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) lightbox.close();
});

let currentMonumentId = null;
let lastGalleryMonumentId = null;
let lastGraphMonumentId = null;

async function onMonumentSelected(monumentId) {
  if (!monumentId) {
    panel.classList.add("hidden");
    currentMonumentId = null;
    return;
  }

  const res = await fetch(`/api/monuments/${monumentId}`);
  if (!res.ok) return;
  const data = await res.json();

  currentMonumentId = monumentId;

  document.getElementById("m-name").textContent = data.name;
  document.getElementById("m-description").textContent = data.description || "Nessuna descrizione disponibile.";
  document.getElementById("m-address").textContent = data.address || "Indirizzo non disponibile.";

  renderContacts(data.contacts);
  renderAccess(data);
  renderMap(data);
  renderNearby(monumentId);
  panel.classList.remove("hidden");

  // Galleria e grafo sono pesanti (fetch di rete / canvas WebGL): si caricano
  // solo se la card pieghevole corrispondente è già aperta. Se l'utente la
  // apre più avanti, i listener "toggle" qui sotto se ne occupano.
  if (galleryDetails.open) renderGallery(monumentId);
  if (graphDetails.open) renderMonumentGraph(monumentId);
}

galleryDetails.addEventListener("toggle", () => {
  if (galleryDetails.open && currentMonumentId && lastGalleryMonumentId !== currentMonumentId) {
    renderGallery(currentMonumentId);
  }
});

graphDetails.addEventListener("toggle", () => {
  if (graphDetails.open && currentMonumentId && lastGraphMonumentId !== currentMonumentId) {
    renderMonumentGraph(currentMonumentId);
  } else if (!graphDetails.open) {
    monumentGraphState?.physics.stop();
  }
});


// ── Grafo (sigma v3) ────────────────────────────────────────────────
const EdgeArrowProgram = Sigma.rendering.EdgeArrowProgram;
const EdgeCurveProgram = Sigma.rendering.EdgeCurveProgram;
const EdgeDoubleArrowProgram = Sigma.rendering.EdgeDoubleArrowProgram;
const ForceLayout = graphologyLibrary.ForceLayout;
const forceAtlas2 = graphologyLibrary.layoutForceAtlas2;

// Colori per tipo di individuo (usati nel grafo del monumento).
const KIND_COLORS = {
  Monument: "#7a3b1d",
  Address: "#2e7d32",
  Geometria: "#1565c0",
  AccessCondition: "#c98a3a",
  WebSite: "#6a1b9a",
  Email: "#ad1457",
  Telephone: "#00838f",
  Class: "#7a3b1d",
  // arricchimento via web (sezione DESCRIBE)
  DBpedia: "#1565c0",
  SchemaType: "#c98a3a",
  Wikipedia: "#37474f",
  Website: "#2e7d32",
  Image: "#ad1457",
  Category: "#00838f",
};

// Assegna una curvatura agli archi paralleli (stessa coppia di nodi, in una
// qualsiasi direzione) così che ognuno formi un arco distinto e le etichette
// non si accavallino. Gli archi unici restano dritti.
function assignCurvatures(graph) {
  const groups = {};
  graph.forEachEdge((edge, _attr, source, target) => {
    const key = source < target ? `${source} ${target}` : `${target} ${source}`;
    (groups[key] = groups[key] || []).push(edge);
  });
  for (const key in groups) {
    const list = groups[key];
    const n = list.length;
    if (n === 1) {
      graph.setEdgeAttribute(list[0], "type", graph.getEdgeAttribute(list[0], "baseType"));
      continue;
    }
    // Distribuzione simmetrica e distinta: es. n=2 -> [-s/2,+s/2]; n=3 -> [-s,0,+s].
    // Il valore 0 resta un arco dritto, distinto dai due curvi -> niente sovrapposizioni.
    const step = 0.7;
    list.forEach((edge, i) => {
      const curvature = (i - (n - 1) / 2) * step;
      graph.setEdgeAttribute(edge, "type", "curved");
      graph.setEdgeAttribute(edge, "curvature", curvature);
    });
  }
}

// Costruisce un grafo sigma in `container` a partire da {nodes, edges}.
// Ritorna { renderer, layout } per poterli distruggere al re-render.
function buildGraphView(container, data, { byKind = false } = {}) {
  const graph = new graphology.MultiGraph();
  const total = data.nodes.length || 1;
  const radius = 10;

  data.nodes.forEach((node, i) => {
    const angle = (i / total) * 2 * Math.PI;
    graph.addNode(node.id, {
      label: node.label,
      x: radius * Math.cos(angle) + (Math.random() - 0.5),
      y: radius * Math.sin(angle) + (Math.random() - 0.5),
      size: node.kind === "Monument" ? 14 : 10,
      color: byKind ? (KIND_COLORS[node.kind] || "#777") : "#7a3b1d",
    });
  });

  for (const edge of data.edges) {
    if (!graph.hasNode(edge.from) || !graph.hasNode(edge.to)) continue;
    graph.addEdge(edge.from, edge.to, {
      label: edge.label,
      size: edge.dashes ? 1.5 : 2.5,
      color: edge.dashes ? "#c98a3a" : "#b08968",
      // le coppie inverse arrivano già fuse dal backend (bidirectional) -> doppia freccia
      baseType: edge.bidirectional ? "double" : "straight",
    });
  }

  assignCurvatures(graph);

  // Spread iniziale con ForceAtlas2 (sincrono) per partire da un layout sensato.
  if (graph.order > 2) {
    const settings = forceAtlas2.inferSettings(graph);
    forceAtlas2.assign(graph, { iterations: 120, settings });
  }

  const renderer = new Sigma(graph, container, {
    renderEdgeLabels: true,
    allowInvalidContainer: true,
    defaultEdgeType: "straight",
    edgeProgramClasses: { straight: EdgeArrowProgram, curved: EdgeCurveProgram, double: EdgeDoubleArrowProgram },
    labelFont: "Segoe UI, sans-serif",
    labelSize: 13,
    labelColor: { color: "#2c2c2c" },
    edgeLabelFont: "Segoe UI, sans-serif",
    edgeLabelSize: 11,
    edgeLabelColor: { color: "#7a3b1d" },
    labelRenderedSizeThreshold: 0,
  });

  // Physics: layout a molla. Il nodo trascinato è "fisso" (highlighted) quindi
  // resta sotto al cursore mentre i vicini reagiscono. Per evitare deriva e
  // consumo CPU, il layout si ferma a riposo e riparte durante l'interazione.
  const layout = new ForceLayout(graph, {
    isNodeFixed: (_, attr) => attr.highlighted,
    settings: { attraction: 0.0003, repulsion: 1.0, gravity: 0.01, inertia: 0.6, maxMove: 200 },
  });

  const physics = makePhysicsController(layout);
  physics.run(3500);  // settle iniziale poi stop

  enableNodeDragging(renderer, graph, physics);
  return { renderer, layout, physics };
}

// Avvia il layout e lo ferma dopo `ms`; chiamate ripetute estendono la corsa.
function makePhysicsController(layout) {
  let stopTimer = null;
  let running = false;
  const clearTimer = () => { if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; } };
  return {
    run(ms = 1500) {
      if (!running) { layout.start(); running = true; }
      clearTimer();
      stopTimer = setTimeout(() => { layout.stop(); running = false; }, ms);
    },
    hold() {
      clearTimer();
      if (!running) { layout.start(); running = true; }
    },
    stop() {
      clearTimer();
      if (running) { layout.stop(); running = false; }
    },
    dispose() {
      clearTimer();
      if (running) { layout.stop(); running = false; }
    },
  };
}

function enableNodeDragging(renderer, graph, physics) {
  let draggedNode = null;
  let isDragging = false;

  renderer.on("downNode", (e) => {
    isDragging = true;
    draggedNode = e.node;
    graph.setNodeAttribute(draggedNode, "highlighted", true);
    physics.hold();  // physics attiva durante il trascinamento
  });

  renderer.on("moveBody", ({ event }) => {
    if (!isDragging || !draggedNode) return;
    const pos = renderer.viewportToGraph(event);
    graph.setNodeAttribute(draggedNode, "x", pos.x);
    graph.setNodeAttribute(draggedNode, "y", pos.y);
    event.preventSigmaDefault();
    event.original.preventDefault();
    event.original.stopPropagation();
  });

  const handleUp = () => {
    if (draggedNode) graph.removeNodeAttribute(draggedNode, "highlighted");
    isDragging = false;
    draggedNode = null;
    physics.run(1500);  // lascia rilassare poi ferma
  };
  renderer.on("upNode", handleUp);
  renderer.on("upStage", handleUp);
  window.addEventListener("mouseup", handleUp);
}

let ontoGraphState = null;

async function renderOntoGraph() {
  const container = document.getElementById("onto-graph");
  const res = await fetch("/api/graph");
  const data = await res.json();
  ontoGraphState = buildGraphView(container, data, { byKind: false });
}

let monumentGraphState = null;

async function renderMonumentGraph(monumentId) {
  const container = document.getElementById("m-graph");
  // distruggi l'eventuale grafo precedente
  if (monumentGraphState) {
    monumentGraphState.physics.dispose();
    monumentGraphState.layout.kill();
    monumentGraphState.renderer.kill();
    monumentGraphState = null;
  }
  container.innerHTML = "";

  const res = await fetch(`/api/monuments/${monumentId}/graph`);
  if (!res.ok) return;
  const data = await res.json();
  monumentGraphState = buildGraphView(container, data, { byKind: true });
  renderGraphLegend(container, data);
  lastGraphMonumentId = monumentId;
}

function renderGraphLegend(container, data) {
  const existing = container.parentElement.querySelector(".graph-legend");
  if (existing) existing.remove();
  const kinds = [...new Set(data.nodes.map((n) => n.kind).filter(Boolean))];
  const legend = document.createElement("div");
  legend.className = "graph-legend";
  const LABELS = {
    Monument: "Monumento", Address: "Indirizzo", Geometria: "Coordinate",
    AccessCondition: "Accessibilità", WebSite: "Sito web", Email: "Email", Telephone: "Telefono",
    DBpedia: "Risorsa DBpedia", SchemaType: "Tipo schema.org",
    Wikipedia: "Wikipedia", Website: "Sito ufficiale", Image: "Immagine", Category: "Categoria",
  };
  for (const kind of kinds) {
    const item = document.createElement("span");
    item.className = "legend-item";
    item.innerHTML = `<span class="legend-dot" style="background:${KIND_COLORS[kind] || "#777"}"></span>${LABELS[kind] || kind}`;
    legend.appendChild(item);
  }
  container.parentElement.appendChild(legend);
}

// ── Statistiche di accessibilità (query SPARQL GROUP BY + COUNT) ──────
// Colori coerenti col significato della condizione (verde=accessibile …).
const STATS_COLORS = {
  "Totalmente accessibile": "#2e7d32",
  "Parzialmente accessibile": "#c98a3a",
  "Non accessibile": "#a23b2d",
  "Nessuna informazione": "#8a8a8a",
};

async function renderStats() {
  const container = document.getElementById("stats-chart");
  container.innerHTML = '<p class="hint">Caricamento…</p>';

  const res = await fetch("/api/stats");
  const data = await res.json();

  container.innerHTML = "";
  if (!data.stats || data.stats.length === 0) {
    container.innerHTML = '<p class="contact-empty">Nessun dato disponibile.</p>';
    return;
  }

  // barre proporzionali al valore massimo (leggibilità); percentuale sul totale
  const max = Math.max(...data.stats.map((s) => s.count));
  for (const s of data.stats) {
    const pct = data.total ? Math.round((s.count / data.total) * 100) : 0;
    const row = document.createElement("div");
    row.className = "stat-row";

    const label = document.createElement("span");
    label.className = "stat-label";
    label.textContent = s.label;

    const track = document.createElement("span");
    track.className = "stat-bar-track";
    const bar = document.createElement("span");
    bar.className = "stat-bar";
    bar.style.width = `${(s.count / max) * 100}%`;
    bar.style.background = STATS_COLORS[s.label] || "#7a3b1d";
    track.appendChild(bar);

    const value = document.createElement("span");
    value.className = "stat-value";
    value.innerHTML = `${s.count} <small>(${pct}%)</small>`;

    row.append(label, track, value);
    container.appendChild(row);
  }

  const total = document.createElement("p");
  total.className = "stats-total";
  total.textContent = `Totale monumenti: ${data.total}`;
  container.appendChild(total);
}

const tabButtons = document.querySelectorAll(".tab-button");
const views = {
  monuments: document.getElementById("view-monuments"),
  graph: document.getElementById("view-graph"),
  stats: document.getElementById("view-stats"),
  access: document.getElementById("view-access"),
  nearby: document.getElementById("view-nearby"),
  completeness: document.getElementById("view-completeness"),
  describe: document.getElementById("view-describe"),
};

function showView(name) {
  for (const [key, el] of Object.entries(views)) {
    el.classList.toggle("hidden", key !== name);
  }
  tabButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.view === name));

  // Physics dei grafi: attiva solo quella della view effettivamente visibile,
  // altrimenti girerebbe a vuoto su un container a larghezza 0.
  if (name === "graph") {
    if (!ontoGraphState) {
      renderOntoGraph();
    } else {
      ontoGraphState.renderer.refresh();
      ontoGraphState.physics.run(2500);
    }
  } else {
    ontoGraphState?.physics.stop();
  }

  // ricalcolata ad ogni apertura: è leggera e così riflette eventuali
  // condizioni di accesso assegnate nel frattempo dalla sezione
  // "Modifica Accessibilità".
  if (name === "stats") renderStats();

  // la lista dei monumenti senza condizione di accesso va ricaricata ad ogni
  // apertura: si accorcia man mano che si assegnano le condizioni.
  if (name === "access") loadMissingAccessList();

  // la tendina della sezione DESCRIBE riusa la stessa lista monumenti; la si
  // popola alla prima apertura (riflette anche eventuali monumenti aggiunti).
  if (name === "describe") {
    loadDescribeList();
    if (describeGraphState) {
      describeGraphState.renderer.refresh();
      describeGraphState.physics.run(2000);
    }
  } else {
    describeGraphState?.physics.stop();
  }

  if (name === "monuments" && monumentGraphState && graphDetails.open) {
    monumentGraphState.renderer.refresh();
    monumentGraphState.physics.run(2000);
  } else {
    monumentGraphState?.physics.stop();
  }

}

tabButtons.forEach((btn) => btn.addEventListener("click", () => showView(btn.dataset.view)));

// ── Sezione "Modifica Accessibilità" ────────────────────────────────
// Mostra i monumenti che NON hanno una condizione di accesso (query backend
// con FILTER NOT EXISTS) in una search bar con autocomplete, e permette di
// assegnarne una: il backend esegue una SPARQL CONSTRUCT che aggiunge al grafo
// la tripla mancante ac:hasAccessCondition.
const editAccessForm = document.getElementById("edit-access-form");
const eaMonumentInput = document.getElementById("ea-monument");
const eaMonumentSuggestions = document.getElementById("ea-monument-suggestions");
const eaAccessSelect = document.getElementById("ea-access");
const eaCount = document.getElementById("ea-count");
const eaFeedback = document.getElementById("ea-feedback");

// {id, name} dei monumenti senza accesso (per la search) e mappa nome -> id
// (per risolvere la scelta al submit).
let missingAccessItems = [];
let missingAccessByName = new Map();

async function loadMissingAccessList() {
  const res = await fetch("/api/monuments/missing-access");
  const monuments = await res.json();

  missingAccessItems = monuments;
  missingAccessByName = new Map(monuments.map((m) => [m.name, m.id]));

  eaCount.textContent = monuments.length
    ? `${monuments.length} monumenti senza condizione di accesso.`
    : "Tutti i monumenti hanno già una condizione di accesso.";
}

// La scelta riempie solo l'input (l'azione vera è il submit del form, dopo aver
// scelto anche la condizione di accesso): onSelect non deve fare altro.
createSearchBar({
  input: eaMonumentInput,
  suggestionsEl: eaMonumentSuggestions,
  getItems: () => missingAccessItems,
  onSelect: () => {},
  emptyText: "Nessun monumento senza condizione di accesso.",
});

editAccessForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const submitBtn = editAccessForm.querySelector(".btn-primary");
  eaFeedback.className = "form-feedback hidden";

  const monumentName = eaMonumentInput.value.trim();
  const monumentId = missingAccessByName.get(monumentName);
  const accessCondition = eaAccessSelect.value;

  if (!monumentId) {
    eaFeedback.textContent = "Seleziona un monumento valido dall'elenco dei suggerimenti.";
    eaFeedback.className = "form-feedback error";
    return;
  }
  if (!accessCondition) {
    eaFeedback.textContent = "Seleziona una condizione di accesso.";
    eaFeedback.className = "form-feedback error";
    return;
  }

  submitBtn.disabled = true;
  try {
    const res = await fetch(`/api/monuments/${monumentId}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessCondition }),
    });
    const data = await res.json();

    if (!res.ok) {
      const messages = Object.values(data.errors || { _: "Si è verificato un errore." });
      eaFeedback.textContent = messages.join(" ");
      eaFeedback.className = "form-feedback error";
      return;
    }

    eaFeedback.textContent = `Condizione "${data.accessCondition}" assegnata a "${monumentName}". Apertura della sua pagina…`;
    eaFeedback.className = "form-feedback success";
    editAccessForm.reset();

    await loadMissingAccessList(); // il monumento appena modificato sparisce dai suggerimenti
    await loadMonumentList();
    monumentSearch.selectById(monumentId);
    showView("monuments");
  } catch {
    eaFeedback.textContent = "Impossibile contattare il server. Riprova.";
    eaFeedback.className = "form-feedback error";
  } finally {
    submitBtn.disabled = false;
  }
});

// ── Sezione "Vicinanze" (query SPARQL CONSTRUCT) ────────────────────
// Esegue la CONSTRUCT lato backend con la soglia scelta e mostra sia le coppie
// di monumenti vicini (cliccabili) sia le triple afi:vicinoA generate in Turtle.
const nearbyForm = document.getElementById("nearby-form");
const nbThreshold = document.getElementById("nb-threshold");
const nbSummary = document.getElementById("nb-summary");
const nbPairs = document.getElementById("nb-pairs");
const nbTurtle = document.getElementById("nb-turtle");

function openMonument(monumentId) {
  // riusa la search bar principale per aprire la scheda del monumento
  monumentSearch.selectById(monumentId);
  showView("monuments");
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

nearbyForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = nearbyForm.querySelector(".btn-primary");
  submitBtn.disabled = true;
  nbSummary.textContent = "Esecuzione della query CONSTRUCT…";
  nbPairs.innerHTML = "";
  nbTurtle.textContent = "";

  try {
    const res = await fetch(`/api/nearby-construct?threshold=${encodeURIComponent(nbThreshold.value)}`);
    const data = await res.json();
    if (!res.ok) {
      nbSummary.textContent = data.error || "Errore nell'esecuzione della query.";
      return;
    }

    nbSummary.textContent = `${data.count} coppie di monumenti entro ${data.threshold} km.`;
    nbTurtle.textContent = data.turtle.trim() || "# nessuna tripla generata";

    if (data.pairs.length === 0) {
      nbPairs.innerHTML = '<li class="contact-empty">Nessuna coppia entro questa soglia.</li>';
      return;
    }
    for (const pair of data.pairs) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "#"; a.className = "nearby-link"; a.textContent = pair.a.name;
      a.addEventListener("click", (ev) => { ev.preventDefault(); openMonument(pair.a.id); });
      const b = document.createElement("a");
      b.href = "#"; b.className = "nearby-link"; b.textContent = pair.b.name;
      b.addEventListener("click", (ev) => { ev.preventDefault(); openMonument(pair.b.id); });
      const sep = document.createElement("span");
      sep.className = "nearby-distance"; sep.textContent = "↔";
      li.append(a, sep, b);
      nbPairs.appendChild(li);
    }
  } catch {
    nbSummary.textContent = "Impossibile contattare il server. Riprova.";
  } finally {
    submitBtn.disabled = false;
  }
});

// ── Sezione "Completezza" (query SPARQL ASK) ────────────────────────
// La ASK risponde true/false a "esiste un monumento privo della proprietà?".
const completenessForm = document.getElementById("completeness-form");
const cpProperty = document.getElementById("cp-property");
const cpResult = document.getElementById("cp-result");

completenessForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  cpResult.className = "ask-result hidden";

  try {
    const res = await fetch(`/api/ask-completeness?property=${encodeURIComponent(cpProperty.value)}`);
    const data = await res.json();
    if (!res.ok) {
      cpResult.className = "ask-result error";
      cpResult.textContent = data.error || "Errore nell'esecuzione della query.";
      return;
    }

    // existsMissing = risposta grezza della ASK; complete = sua interpretazione
    const askWord = data.existsMissing ? "VERO" : "FALSO";
    const verdict = data.complete
      ? `Tutti i monumenti hanno ${data.description}.`
      : `Almeno un monumento è privo di ${data.description}.`;
    cpResult.className = `ask-result ${data.complete ? "ok" : "warn"}`;
    cpResult.innerHTML =
      `<span class="ask-badge">ASK → ${askWord}</span>` +
      `<p>Esiste un monumento privo di ${data.description}? <strong>${askWord}</strong>.</p>` +
      `<p>${data.complete ? "✓" : "✗"} ${verdict}</p>`;
  } catch {
    cpResult.className = "ask-result error";
    cpResult.textContent = "Impossibile contattare il server. Riprova.";
  }
});

// ── Sezione "Scheda RDF" (query SPARQL DESCRIBE) ────────────────────
const describeInput = document.getElementById("describe-input");
const describeSuggestions = document.getElementById("describe-suggestions");
const dscStatus = document.getElementById("dsc-status");
const dscResult = document.getElementById("dsc-result");
const dscResource = document.getElementById("dsc-resource");
const dscTypes = document.getElementById("dsc-types");
const dscTurtle = document.getElementById("dsc-turtle");
let describeListLoaded = false;
let describeGraphState = null;
let describeItems = []; // {id, name} dalla KB, per la search bar di questa sezione
let lastDescribeId = null;

async function loadDescribeList() {
  if (describeListLoaded) return;
  const res = await fetch("/api/monuments");
  describeItems = await res.json();
  describeListLoaded = true;
}

createSearchBar({
  input: describeInput,
  suggestionsEl: describeSuggestions,
  getItems: () => describeItems,
  onSelect: (it) => runDescribe(it.id),
  emptyText: "Nessun monumento trovato.",
});

async function runDescribe(id) {
  if (!id || id === lastDescribeId) return; // niente o già mostrato
  lastDescribeId = id;

  dscResult.classList.add("hidden");
  describeGraphState?.physics.stop();
  dscStatus.textContent = "Ricerca su DBpedia ed esecuzione della DESCRIBE remota…";

  let data;
  try {
    const res = await fetch(`/api/monuments/${id}/describe`);
    data = await res.json();
  } catch {
    dscStatus.textContent = "Impossibile contattare il server. Riprova.";
    return;
  }

  if (!data.found) {
    dscStatus.textContent =
      data.error ||
      `Nessuna risorsa corrispondente trovata su DBpedia per "${data.name}".`;
    return;
  }

  dscStatus.textContent = `${data.tripleCount} triple generate per "${data.name}".`;

  dscResource.textContent = data.resourceLabel;
  dscResource.href = data.resource;

  // badge dei tipi schema.org
  dscTypes.innerHTML = "";
  for (const t of data.schemaTypes) {
    const badge = document.createElement("span");
    badge.className = "schema-badge";
    badge.textContent = t;
    dscTypes.appendChild(badge);
  }
  document.getElementById("dsc-types-wrap").classList.toggle("hidden", data.schemaTypes.length === 0);

  dscTurtle.textContent = data.turtle.trim();
  dscResult.classList.remove("hidden");

  // grafo visuale delle risorse collegate (sigma/graphology), come l'ontologia
  renderDescribeGraph(data.graph);
}

function renderDescribeGraph(graphData) {
  const container = document.getElementById("dsc-graph");
  if (describeGraphState) {
    describeGraphState.physics.dispose();
    describeGraphState.layout.kill();
    describeGraphState.renderer.kill();
    describeGraphState = null;
  }
  container.innerHTML = "";
  describeGraphState = buildGraphView(container, graphData, { byKind: true });
  renderGraphLegend(container, graphData);
}

loadMonumentList();
initBackgroundSlideshow();

// ── Sfondo dinamico (foto dei monumenti più iconici in dissolvenza) ───
async function initBackgroundSlideshow() {
  const container = document.getElementById("bg-slideshow");
  if (!container) return;

  let photos = [];
  try {
    const res = await fetch("/api/background-photos");
    const data = await res.json();
    photos = data.photos || [];
  } catch {
    return; // niente sfondo se la chiamata fallisce: la pagina resta comunque usabile
  }
  if (photos.length === 0) return;

  const imgs = photos.map((p, i) => {
    const img = document.createElement("img");
    img.src = p.full || p.thumb;
    img.alt = "";
    if (i === 0) img.classList.add("is-active");
    container.appendChild(img);
    return img;
  });

  if (imgs.length < 2) return; // una sola foto: niente da alternare

  let current = 0;
  setInterval(() => {
    const next = (current + 1) % imgs.length;
    imgs[current].classList.remove("is-active");
    imgs[next].classList.add("is-active");
    current = next;
  }, 7000);
}
