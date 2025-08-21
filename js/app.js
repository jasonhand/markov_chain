/* Markov Chain Visualizer - vanilla JS
 * p_{t+1} = p_t P (row-stochastic)
 * - Edit states and transition matrix
 * - Run simulation and plot distributions
 * - Compute stationary distribution via power method
 * - Detect absorbing states
 * - Draw a simple SVG state graph (nodes on a circle, edge width ∝ probability)
 */

const state = {
  labels: ["Sunny","Rainy"],
  P: [
    [0.8, 0.2],
    [0.4, 0.6]
  ],
  p0: [1, 0],
  running: false,
  timer: null,
  stepIdx: 0,
  chart: null
};

// ---------- Helpers
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

function ones(n){ return Array(n).fill(1); }
function normalizeRow(row) {
  const s = row.reduce((a,b)=>a+b,0);
  if (s <= 0) return row.map(()=>0);
  return row.map(x => x/s);
}
function normalizeVector(v){
  const s = v.reduce((a,b)=>a+b,0);
  if (s <= 0) return v.map(()=>0);
  return v.map(x => x/s);
}
function multRowVecMat(p, P){
  const n = P.length;
  const r = Array(n).fill(0);
  for (let j = 0; j < n; j++){
    let sum = 0;
    for (let k = 0; k < n; k++) sum += p[k]*P[k][j];
    r[j] = sum;
  }
  return r;
}
function l1(a,b){
  let s = 0;
  for (let i=0;i<a.length;i++) s += Math.abs(a[i]-b[i]);
  return s;
}
function isRowStochastic(P, tol=1e-9){
  for (const row of P){
    if (row.some(x => x < -1e-12)) return false;
    const s = row.reduce((a,b)=>a+b,0);
    if (Math.abs(s-1) > tol) return false;
  }
  return true;
}
function absorbingStates(P, tol=1e-12){
  const n = P.length;
  const idx = [];
  for (let i=0;i<n;i++){
    let isAbs = true;
    for (let j=0;j<n;j++){
      const expected = (i===j) ? 1 : 0;
      if (Math.abs(P[i][j] - expected) > tol) { isAbs = false; break; }
    }
    if (isAbs) idx.push(i);
  }
  return idx;
}

// ---------- UI building
function buildStatesInputs(){
  const container = $("#statesContainer");
  container.innerHTML = "";
  state.labels.forEach((name, i) => {
    const input = document.createElement("input");
    input.type = "text";
    input.value = name;
    input.placeholder = `State ${i+1}`;
    input.addEventListener("input", () => {
      state.labels[i] = input.value || `State ${i+1}`;
      updateMatrixHeaders();
      updateGraph();
      rebuildChart();
    });
    container.appendChild(input);
  });
}

function updateMatrixHeaders(){
  const table = $("#matrixTable");
  const init = $("#initTable");
  const n = state.labels.length;
  // Headers
  const header = document.createElement("tr");
  header.innerHTML = `<th>from \\ to</th>` + state.labels.map(l=>`<th>${escapeHtml(l)}</th>`).join("");
  table.innerHTML = "";
  table.appendChild(header);
  // Rows with inputs
  for (let i=0;i<n;i++){
    const tr = document.createElement("tr");
    tr.innerHTML = `<th>${escapeHtml(state.labels[i])}</th>` + state.P[i].map((val,j)=>{
      return `<td><input type="number" step="0.001" min="0" value="${val.toFixed(3)}" data-i="${i}" data-j="${j}" class="cell"></td>`;
    }).join("");
    table.appendChild(tr);
  }
  // Initial distribution table
  const h2 = document.createElement("tr");
  h2.innerHTML = state.labels.map(l=>`<th>${escapeHtml(l)}</th>`).join("");
  init.innerHTML = "";
  init.appendChild(h2);
  const r = document.createElement("tr");
  r.innerHTML = state.p0.map((v,j)=>`<td><input type="number" step="0.001" min="0" value="${v.toFixed(3)}" data-j="${j}" class="init"></td>`).join("");
  init.appendChild(r);

  // Wire listeners
  $$(".cell").forEach(inp => {
    inp.addEventListener("change", onMatrixChange);
    inp.addEventListener("blur", onMatrixChange);
  });
  $$(".init").forEach(inp => {
    inp.addEventListener("change", onInitChange);
    inp.addEventListener("blur", onInitChange);
  });
}

function onMatrixChange(e){
  const i = +e.target.dataset.i, j = +e.target.dataset.j;
  const v = parseFloat(e.target.value);
  if (!Number.isFinite(v) || v < 0){ e.target.value = "0.000"; return; }
  state.P[i][j] = v;
  updateGraph();
}
function onInitChange(e){
  const j = +e.target.dataset.j;
  const v = parseFloat(e.target.value);
  if (!Number.isFinite(v) || v < 0){ e.target.value = "0.000"; return; }
  state.p0[j] = v;
}

function addState(){
  const n = state.labels.length;
  state.labels.push(`State ${n+1}`);
  state.P.forEach(row => row.push(0));
  state.P.push( Array(n+1).fill(0) );
  state.P[n][n] = 1;
  state.p0.push(0);
  buildStatesInputs();
  updateMatrixHeaders();
  updateGraph();
  rebuildChart();
}
function removeState(){
  if (state.labels.length <= 1) return;
  state.labels.pop();
  state.P.pop();
  state.P.forEach(r=>r.pop());
  state.p0.pop();
  buildStatesInputs();
  updateMatrixHeaders();
  updateGraph();
  rebuildChart();
}

function randomizeMatrix(){
  const n = state.P.length;
  for (let i=0;i<n;i++){
    let row = [];
    for (let j=0;j<n;j++){ row.push(Math.random()); }
    state.P[i] = normalizeRow(row);
  }
  updateMatrixHeaders();
  updateGraph();
}

function normalizeRows(){
  state.P = state.P.map(normalizeRow);
  updateMatrixHeaders();
  updateGraph();
}

function setUniformInit(){
  const n = state.labels.length;
  state.p0 = Array(n).fill(1/n);
  updateMatrixHeaders();
}
function normalizeInit(){
  state.p0 = normalizeVector(state.p0);
  updateMatrixHeaders();
}

// ---------- Presets
function loadPreset(which){
  if (which === "weather"){
    state.labels = ["Sunny","Rainy"];
    state.P = [
      [0.8, 0.2],
      [0.4, 0.6]
    ];
    state.p0 = [1, 0];
  } else if (which === "web"){
    state.labels = ["Home","Product","Checkout"];
    state.P = [
      [0.70, 0.25, 0.05],
      [0.10, 0.75, 0.15],
      [0.05, 0.10, 0.85]
    ];
    state.p0 = [1, 0, 0];
  } else if (which === "absorbing"){
    state.labels = ["Play","Win","Lose"];
    state.P = [
      [0.85, 0.10, 0.05],
      [0.00, 1.00, 0.00],
      [0.00, 0.00, 1.00]
    ];
    state.p0 = [1, 0, 0];
  } else if (which === "custom"){
    state.labels = ["State 1","State 2","State 3"];
    state.P = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
    state.p0 = [1, 0, 0];
  }
  buildStatesInputs();
  updateMatrixHeaders();
  resetSim();
  updateGraph();
  rebuildChart();
}

// ---------- Simulation & chart
function resetSim(){
  state.stepIdx = 0;
  state.p = normalizeVector(state.p0.slice());
  $("#analysis").textContent = "";
  if (state.chart){
    state.chart.data.labels = [0];
    for (const ds of state.chart.data.datasets){
      ds.data = [state.p[ds._idx] || 0];
    }
    state.chart.update();
  }
  updateGraph();
}

function stepOnce(){
  syncFromInputs();
  if (!isRowStochastic(state.P)){
    toast("Matrix rows must each sum to 1. Try Normalize Rows.", "warn");
    return;
  }
  state.stepIdx += 1;
  state.p = multRowVecMat(state.p, state.P);
  if (state.chart){
    state.chart.data.labels.push(state.stepIdx);
    for (const ds of state.chart.data.datasets){
      ds.data.push(state.p[ds._idx] || 0);
    }
    state.chart.update();
  }
  updateGraph();
}

function run(){
  if (state.running) return;
  state.running = true;
  $("#run").disabled = true;
  $("#pause").disabled = false;
  let maxSteps = Math.max(1, Math.min(2000, +$("#maxSteps").value || 200));
  function tick(){
    if (!state.running){ return; }
    stepOnce();
    if (state.stepIdx >= maxSteps){ pause(); return; }
    const speedNow = +$("#speed").value;
    state.timer = setTimeout(tick, speedNow);
  }
  tick();
}

function pause(){
  state.running = false;
  $("#run").disabled = false;
  $("#pause").disabled = true;
  if (state.timer){ clearTimeout(state.timer); state.timer = null; }
}

// ---------- Stationary distribution (power method)
function stationaryDistribution(P, tol=1e-10, maxIter=20000){
  const n = P.length;
  let pi = Array(n).fill(1/n);
  for (let iter=0; iter<maxIter; iter++){
    const next = multRowVecMat(pi, P);
    if (l1(next, pi) < tol){
      return next;
    }
    pi = next;
  }
  return pi;
}

// ---------- Absorbing states check
function checkAbsorbing(){
  const idx = absorbingStates(state.P);
  const names = idx.map(i => state.labels[i]);
  const msg = (idx.length === 0)
    ? "No absorbing states detected."
    : `Absorbing states: ${names.join(", ")}`;
  logAnalysis(msg);
}

// ---------- Graph drawing
function updateGraph(){
  const svg = $("#graph");
  const w = svg.viewBox.baseVal.width, h = svg.viewBox.baseVal.height;
  const n = state.labels.length;
  const cx = w/2, cy = h/2;
  const R = Math.min(w, h) * 0.36;
  const nodes = [];
  for (let i=0;i<n;i++){
    const ang = (i/n) * 2*Math.PI - Math.PI/2;
    nodes.push({
      i,
      x: cx + R * Math.cos(ang),
      y: cy + R * Math.sin(ang),
      label: state.labels[i],
      prob: (state.p ? state.p[i] : state.p0[i] || 0)
    });
  }
  svg.innerHTML = "";
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `
    <marker id="arrow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="var(--accent)"></polygon>
    </marker>`;
  svg.appendChild(defs);

  for (let i=0;i<n;i++){
    for (let j=0;j<n;j++){
      const p = state.P[i][j];
      if (p <= 0) continue;
      const a = nodes[i], b = nodes[j];
      const path = document.createElementNS("http://www.w3.org/2000/svg","path");
      const thickness = 1 + 6 * p;
      const isLoop = (i===j);
      let d;
      if (isLoop){
        const r = 22;
        d = `M ${a.x+r} ${a.y} a ${r} ${r} 0 1 1 -0.1 0`;
      } else {
        const mx = (a.x + b.x)/2, my = (a.y + b.y)/2;
        const dx = b.x - a.x, dy = b.y - a.y;
        const nx = -dy, ny = dx;
        const off = 12 + 24 * Math.abs(i-j)/n;
        const cxp = mx + (nx / Math.hypot(nx,ny)) * off;
        const cyp = my + (ny / Math.hypot(nx,ny)) * off;
        d = `M ${a.x} ${a.y} Q ${cxp} ${cyp} ${b.x} ${b.y}`;
      }
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "var(--accent)");
      path.setAttribute("stroke-width", thickness.toString());
      path.setAttribute("marker-end", "url(#arrow)");
      path.setAttribute("opacity", String(clamp(0.25 + 0.9*p, 0.2, 1)));
      svg.appendChild(path);

      if (p >= 0.02) {
        const t = document.createElementNS("http://www.w3.org/2000/svg","text");
        const ratio = isLoop ? 0.65 : 0.55;
        const tx = isLoop ? (a.x + 28) : (a.x*(1-ratio) + b.x*ratio);
        const ty = isLoop ? (a.y - 18) : (a.y*(1-ratio) + b.y*ratio);
        t.setAttribute("x", tx); t.setAttribute("y", ty);
        t.setAttribute("fill", "#9fb9ff");
        t.setAttribute("font-size", "11");
        t.textContent = p.toFixed(2);
        svg.appendChild(t);
      }
    }
  }
  for (const nd of nodes){
    const g = document.createElementNS("http://www.w3.org/2000/svg","g");
    const circle = document.createElementNS("http://www.w3.org/2000/svg","circle");
    const r = 20 + 18 * clamp(nd.prob, 0, 1);
    const fill = `rgba(46,160,67, ${clamp(0.15 + 0.85*nd.prob, 0.15, 1)})`;
    circle.setAttribute("cx", nd.x); circle.setAttribute("cy", nd.y);
    circle.setAttribute("r", r.toString());
    circle.setAttribute("fill", fill);
    circle.setAttribute("stroke", "#e6edf3");
    circle.setAttribute("stroke-width", "2");
    g.appendChild(circle);
    const label = document.createElementNS("http://www.w3.org/2000/svg","text");
    label.setAttribute("x", nd.x);
    label.setAttribute("y", nd.y + 4);
    label.setAttribute("text-anchor","middle");
    label.setAttribute("fill","#e6edf3");
    label.setAttribute("font-weight","700");
    label.textContent = nd.label;
    g.appendChild(label);

    const prob = document.createElementNS("http://www.w3.org/2000/svg","text");
    prob.setAttribute("x", nd.x);
    prob.setAttribute("y", nd.y + 36);
    prob.setAttribute("text-anchor","middle");
    prob.setAttribute("fill","#9fb9ff");
    prob.setAttribute("font-size","12");
    prob.textContent = (nd.prob).toFixed(3);
    g.appendChild(prob);

    svg.appendChild(g);
  }
}

// ---------- Chart
function rebuildChart(){
  const ctx = $("#distChart").getContext("2d");
  if (state.chart){ state.chart.destroy(); }
  const baseColors = [
    "#58a6ff","#2ea043","#ff7b72","#d29922","#8e7af3","#39c5cf","#ffa657","#7ee787"
  ];
  const datasets = state.labels.map((label, i) => ({
    label,
    data: [state.p ? state.p[i] : state.p0[i] || 0],
    borderColor: baseColors[i % baseColors.length],
    backgroundColor: baseColors[i % baseColors.length] + "33",
    borderWidth: 2,
    tension: 0.25,
    fill: false,
    _idx: i
  }));
  state.chart = new Chart(ctx, {
    type: "line",
    data: { labels: [0], datasets },
    options: {
      responsive: true,
      animation: false,
      scales: {
        y: { min: 0, max: 1, ticks: { stepSize: 0.2 } },
        x: { title: { display: true, text: "Step (t)" } }
      },
      plugins: {
        legend: { position: "bottom" },
        tooltip: { mode: "index", intersect: false }
      },
      elements: { point: { radius: 0 } }
    }
  });
}

// ---------- Analysis output
function logAnalysis(text){
  const box = $("#analysis");
  box.textContent = (box.textContent ? box.textContent + "\n" : "") + text;
}
function toast(msg, kind="info"){
  logAnalysis((kind==="warn" ? "⚠️ " : kind==="error" ? "❌ " : "ℹ️ ") + msg);
}

// ---------- Input sync/validation
function syncFromInputs(){
  $$("#matrixTable .cell").forEach(inp => {
    const i = +inp.dataset.i, j = +inp.dataset.j;
    inp.setAttribute("min", "0");
    inp.setAttribute("step", "0.001");
    let v = parseFloat(inp.value);
    if (!Number.isFinite(v) || v < 0){ v = 0; inp.value = "0.000"; }
    state.P[i][j] = v;
  });
  $$("#initTable .init").forEach(inp => {
    const j = +inp.dataset.j;
    inp.setAttribute("min", "0");
    inp.setAttribute("step", "0.001");
    let v = parseFloat(inp.value);
    if (!Number.isFinite(v) || v < 0){ v = 0; inp.value = "0.000"; }
    state.p0[j] = v;
  });
  $$("#statesContainer input[type='text']").forEach((inp, i) => {
    state.labels[i] = inp.value || `State ${i+1}`;
  });
}

function escapeHtml(str){
  return (str??"").toString().replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[s]));
}

// ---------- Stationary button handler
function onComputeStationary(){
  syncFromInputs();
  if (!isRowStochastic(state.P)){
    toast("Matrix rows must each sum to 1. Try Normalize Rows.", "warn");
    return;
  }
  const pi = stationaryDistribution(state.P);
  const err = l1(multRowVecMat(pi, state.P), pi);
  const msg = `Stationary distribution (power method): [${pi.map(x=>x.toFixed(6)).join(", ")}]
L1 error ||πP - π||₁ ≈ ${err.toExponential(2)}`;
  logAnalysis(msg);
}

// ---------- Absorbing button handler
function onCheckAbsorbing(){
  syncFromInputs();
  checkAbsorbing();
}

// ---------- Wire up
function main(){
  buildStatesInputs();
  updateMatrixHeaders();
  rebuildChart();
  resetSim();
  updateGraph();

  $("#addState").addEventListener("click", addState);
  $("#removeState").addEventListener("click", removeState);
  $("#randomize").addEventListener("click", randomizeMatrix);
  $("#normalizeRows").addEventListener("click", normalizeRows);
  $("#uniformInit").addEventListener("click", setUniformInit);
  $("#normalizeInit").addEventListener("click", normalizeInit);
  $("#loadPreset").addEventListener("click", () => loadPreset($("#preset").value));
  $("#step").addEventListener("click", stepOnce);
  $("#run").addEventListener("click", run);
  $("#pause").addEventListener("click", pause);
  $("#reset").addEventListener("click", () => { resetSim(); updateGraph(); });
  $("#computeStationary").addEventListener("click", onComputeStationary);
  $("#checkAbsorbing").addEventListener("click", onCheckAbsorbing);
  $("#speed").addEventListener("input", e => $("#speedValue").textContent = `${e.target.value} ms`);
}
document.addEventListener("DOMContentLoaded", main);

// Pause simulation when the tab becomes hidden to avoid runaway timers
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.running) {
    pause();
  }
});
