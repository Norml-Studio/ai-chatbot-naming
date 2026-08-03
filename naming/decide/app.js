const storageKey = "naming-decision-lab:v1";
const coreSize = 20;
const bufferSize = 10;
const cycleSize = coreSize + bufferSize;
const $ = id => document.getElementById(id);
const elements = {
  bridgeStatus: $("bridge-status"), activeDecisionTitle: $("active-decision-title"), decisionCount: $("decision-count"), decisionsToggle: $("decisions-toggle"), decisionDialog: $("decision-dialog"), closeDecisions: $("close-decisions"), decisionList: $("decision-list"), newDecisionForm: $("new-decision-form"), newDecisionTitle: $("new-decision-title"), newDecisionBrief: $("new-decision-brief"), createDecision: $("create-decision"), newDecisionMessage: $("new-decision-message"), decisionKind: $("decision-kind"), decisionHeading: $("decision-heading"), decisionBrief: $("decision-brief"), resultsCount: $("results-count"), batchNumber: $("batch-number"), progressText: $("progress-text"), progressBar: $("progress-bar"), undo: $("undo"), prefetchStatus: $("prefetch-status"), prefetchTitle: $("prefetch-title"), prefetchDetail: $("prefetch-detail"), prefetchRetry: $("prefetch-retry"), deck: $("deck"), card: $("card"), swipeIntent: $("swipe-intent"), cardTerritory: $("card-territory"), cardName: $("card-name"), cardDescription: $("card-description"), cardSource: $("card-source"), scoreControls: $("score-controls"), gestureNote: $("gesture-note"), batchThoughts: $("batch-thoughts"), batchComplete: $("batch-complete"), waitTitle: $("wait-title"), waitDetail: $("wait-detail"), reflection: $("reflection"), dictate: $("dictate"), dictateLabel: $("dictate-label"), dictationMessage: $("dictation-message"), generate: $("generate"), continueSeed: $("continue-seed"), generating: $("generating"), generationMessage: $("generation-message"), analysis: $("analysis"), analysisText: $("analysis-text"), analysisTags: $("analysis-tags"), stats: $("stats"), historyList: $("history-list"), reset: $("reset")
};

const now = () => new Date().toISOString();
const newId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const emptyPrefetch = () => ({ status: "idle" });

function normalizePrefetch(value) {
  if (!value || !["idle", "generating", "ready", "error"].includes(value.status)) return emptyPrefetch();
  return value;
}

function freshDecision(input = {}) {
  const isNaming = input.kind === "naming" || input.id === "chatbot-naming";
  const candidates = Array.isArray(input.candidates) ? input.candidates : (isNaming ? [...window.SWIPE_SEED] : []);
  const suppliedActiveIds = Array.isArray(input.activeIds) ? input.activeIds.filter(id => candidates.some(item => item.id === id)) : [];
  const activeIds = suppliedActiveIds.length ? suppliedActiveIds : candidates.slice(0, cycleSize).map(item => item.id);
  return {
    ...input,
    id: input.id || newId("decision"),
    title: input.title || "Untitled decision",
    brief: input.brief || "",
    kind: input.kind || "decision",
    createdAt: input.createdAt || now(),
    candidates,
    ratings: Array.isArray(input.ratings) ? input.ratings : [],
    batches: Array.isArray(input.batches) ? input.batches : [],
    batch: Number(input.batch) || 1,
    activeIds,
    nextSeed: Number.isFinite(input.nextSeed) ? input.nextSeed : activeIds.length,
    latestAnalysis: input.latestAnalysis || null,
    draftReflection: typeof input.draftReflection === "string" ? input.draftReflection : "",
    prefetch: normalizePrefetch(input.prefetch)
  };
}

function freshWorkspace() {
  return {
    version: 2,
    activeId: "chatbot-naming",
    decisions: [freshDecision({
      id: "chatbot-naming",
      title: "AI assistant naming",
      brief: "Find a clear, distinctive product name for a WordPress-first AI assistant for website visitors.",
      kind: "naming"
    })]
  };
}

function normalizeWorkspace(raw) {
  let workspace;
  if (raw?.version === 2 && Array.isArray(raw.decisions)) workspace = raw;
  else if (raw?.candidates?.length) workspace = { version: 2, activeId: "chatbot-naming", decisions: [freshDecision({ ...raw, id: "chatbot-naming", title: "AI assistant naming", brief: "Find a clear, distinctive product name for a WordPress-first AI assistant for website visitors.", kind: "naming" })] };
  else workspace = freshWorkspace();
  workspace.version = 2;
  workspace.decisions = workspace.decisions.map(freshDecision);
  const imports = window.DECINDER_IMPORTS || [];
  imports.forEach(item => {
    if (!workspace.decisions.some(decision => decision.id === item.id)) workspace.decisions.push(freshDecision(item));
  });
  if (!workspace.decisions.some(decision => decision.id === workspace.activeId)) workspace.activeId = workspace.decisions[0]?.id || null;
  return workspace;
}

function load() {
  try { return normalizeWorkspace(JSON.parse(localStorage.getItem(storageKey))); }
  catch { return normalizeWorkspace(null); }
}

let workspace = load();
let state = activeDecision();
let bridgeAvailable = false;
let drag = null;
let isTransitioning = false;
let recognition = null;
let isDictating = false;
let scoreFilter = null;
let saveQueue = Promise.resolve();
let reflectionSaveTimer = null;
let prefetchPollInFlight = false;
let lastPrefetchPoll = 0;
const prefetchRequests = new Map();

function activeDecision() { return workspace.decisions.find(item => item.id === workspace.activeId) || workspace.decisions[0]; }
function syncActive() { state = activeDecision(); scoreFilter = null; }
function bridgeHost() { return location.port === "4310"; }

function save() {
  localStorage.setItem(storageKey, JSON.stringify(workspace));
  if (!bridgeAvailable) return;
  const payload = JSON.stringify({ state: workspace });
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    const response = await fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: payload });
    if (!response.ok) throw new Error("State save failed");
  }).catch(() => {
    bridgeAvailable = false;
    elements.bridgeStatus.textContent = "Bridge connection lost — saved in this browser";
    renderPrefetchStatus();
  });
}

function candidateFor(decision, id) { return decision.candidates.find(item => item.id === id); }
function candidate(id) { return candidateFor(state, id); }
function currentBatchRatingsFor(decision) { const ids = new Set(decision.activeIds); return decision.ratings.filter(item => ids.has(item.id)); }
function currentBatchRatings() { return currentBatchRatingsFor(state); }
function currentCandidate() { const rated = new Set(currentBatchRatings().map(item => item.id)); return state.activeIds.map(candidate).find(item => item && !rated.has(item.id)); }
function prefetchTrigger(decision) { return Math.min(coreSize, decision.activeIds.length); }
function isCycleComplete(decision) { return decision.activeIds.length > 0 && currentBatchRatingsFor(decision).length >= decision.activeIds.length; }

function scoreForVector(dx, dy) {
  const right = dx >= 0;
  const bottom = dy >= 0;
  return bottom ? (right ? 5 : 2) : (right ? 4 : 3);
}

function decisionLabel() { return state.kind === "naming" ? "Naming direction" : "Decision"; }

function renderDecisionHeading() {
  const lineBreak = document.createElement("br");
  if (state.kind === "naming") elements.decisionHeading.replaceChildren("Rate the pull,", lineBreak, "not just the name.");
  else elements.decisionHeading.replaceChildren("Rate the pull on", lineBreak, `${state.title}.`);
}

function renderDecisionList() {
  elements.decisionCount.textContent = workspace.decisions.length;
  elements.decisionList.replaceChildren(...workspace.decisions.map(item => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = item.id === state.id ? "is-active" : "";
    const count = document.createElement("span");
    count.textContent = `${item.ratings.length} rated`;
    const title = document.createElement("strong");
    title.textContent = item.title;
    const brief = document.createElement("small");
    brief.textContent = item.brief || "No brief added";
    button.append(title, count, brief);
    button.addEventListener("click", () => {
      workspace.activeId = item.id;
      syncActive();
      save();
      render();
      maybeStartPrefetch();
      elements.decisionDialog.close();
    });
    return button;
  }));
}

function formatElapsed(startedAt) {
  const milliseconds = Math.max(0, Date.now() - Date.parse(startedAt || now()));
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function renderPrefetchStatus() {
  if (!state) return;
  const done = currentBatchRatings().length;
  const total = state.activeIds.length;
  const trigger = prefetchTrigger(state);
  const bufferRemaining = Math.max(0, total - done);
  const prefetch = state.prefetch || emptyPrefetch();
  elements.prefetchStatus.dataset.status = prefetch.status;
  elements.prefetchRetry.hidden = prefetch.status !== "error";

  if (done < trigger) {
    elements.prefetchStatus.dataset.status = "idle";
    elements.prefetchTitle.textContent = total > coreSize ? `Next 20 + 10 starts after ${trigger - done} more ${trigger - done === 1 ? "card" : "cards"}` : "The 20 + 10 loop starts after this legacy set";
    elements.prefetchDetail.textContent = total > coreSize ? "The final 10 cards are your buffer while Codex works in the background." : "This saved set has 20 cards; following sets will have 20 core cards plus a 10-card buffer.";
    return;
  }

  if (prefetch.status === "generating") {
    elements.prefetchTitle.textContent = "Next 20 + 10 is generating";
    elements.prefetchDetail.textContent = bufferRemaining > 0 ? `${bufferRemaining} buffer ${bufferRemaining === 1 ? "card" : "cards"} left · working ${formatElapsed(prefetch.startedAt)}` : `Buffer complete · working ${formatElapsed(prefetch.startedAt)}`;
    return;
  }

  if (prefetch.status === "ready") {
    elements.prefetchTitle.textContent = "Next 20 + 10 is ready";
    elements.prefetchDetail.textContent = bufferRemaining > 0 ? `${bufferRemaining} buffer ${bufferRemaining === 1 ? "card" : "cards"} left · no pause ahead` : "Opening the next set now";
    return;
  }

  if (prefetch.status === "error") {
    elements.prefetchTitle.textContent = "Next 20 + 10 needs attention";
    elements.prefetchDetail.textContent = prefetch.error || "Generation stopped. Your ratings are saved.";
    return;
  }

  elements.prefetchTitle.textContent = "Starting the next 20 + 10";
  elements.prefetchDetail.textContent = "Your ratings are saved while generation starts.";
}

function renderWaitState() {
  const prefetch = state.prefetch || emptyPrefetch();
  const seedAvailable = state.kind === "naming" && state.candidates.some(item => item.source === "seed") && state.nextSeed < state.candidates.filter(item => item.source === "seed").length;
  elements.continueSeed.hidden = !seedAvailable;
  elements.generate.hidden = prefetch.status === "generating";
  elements.generating.hidden = prefetch.status !== "generating";

  if (prefetch.status === "generating") {
    elements.waitTitle.textContent = "Your next 20 + 10 is still being made.";
    elements.waitDetail.textContent = `Working ${formatElapsed(prefetch.startedAt)}. Every rating is already saved, so you can leave this screen open.`;
    elements.generationMessage.textContent = "The elapsed timer shows the current run time; Decinder will continue automatically when the cards arrive.";
  } else if (prefetch.status === "error") {
    elements.waitTitle.textContent = "Generation paused.";
    elements.waitDetail.textContent = prefetch.error || "Your ratings are safe. Retry when the local bridge is available.";
    elements.generate.textContent = "Retry next 20 + 10";
  } else {
    elements.waitTitle.textContent = "Preparing your next 20 + 10.";
    elements.waitDetail.textContent = "Your ratings are saved. Start generation again if it did not begin automatically.";
    elements.generate.textContent = "Generate next 20 + 10";
  }
}

function render() {
  if (!state) return;
  const done = currentBatchRatings().length;
  const total = state.activeIds.length;
  const item = currentCandidate();
  const complete = total > 0 && done >= total;
  elements.resultsCount.textContent = state.ratings.length;
  elements.activeDecisionTitle.firstChild.textContent = `${state.title} `;
  elements.decisionKind.textContent = `${decisionLabel()} · Set ${String(state.batch).padStart(2, "0")} · 20 + 10`;
  renderDecisionHeading();
  elements.decisionBrief.textContent = state.brief || "Swipe diagonally, or tap a score. After 20 ratings, Decinder starts the next 20 + 10 in the background.";
  elements.batchNumber.textContent = String(state.batch).padStart(2, "0");
  elements.progressText.textContent = complete ? `${total} of ${total}` : `${Math.min(done + 1, total)} of ${total}`;
  elements.progressBar.style.width = `${total ? (done / total) * 100 : 0}%`;
  elements.undo.disabled = currentBatchRatings().length === 0;
  elements.batchComplete.hidden = !complete;
  elements.deck.hidden = complete;
  elements.scoreControls.hidden = complete;
  elements.gestureNote.hidden = complete;
  elements.batchThoughts.hidden = complete;
  if (document.activeElement !== elements.reflection) elements.reflection.value = state.draftReflection || "";

  if (item) {
    elements.cardTerritory.textContent = item.territory;
    elements.cardName.textContent = item.name;
    elements.cardDescription.textContent = item.description;
    elements.cardSource.textContent = item.source === "seed" ? "Initial decision field" : "Generated for this decision";
    elements.card.setAttribute("aria-label", `${item.name}. ${item.description}`);
    resetDragVisual(false);
  }

  renderPrefetchStatus();
  if (complete) renderWaitState();
  renderDecisionList();
  renderHistory();
  renderAnalysis();
}

function renderHistory() {
  const counts = [2, 3, 4, 5].map(score => state.ratings.filter(item => item.score === score).length);
  elements.stats.replaceChildren(...counts.map((count, index) => {
    const score = index + 2;
    const tag = document.createElement("button");
    tag.type = "button";
    tag.className = scoreFilter === score ? "is-active" : "";
    tag.setAttribute("aria-pressed", String(scoreFilter === score));
    tag.textContent = `${score}: ${count}`;
    tag.addEventListener("click", () => { scoreFilter = scoreFilter === score ? null : score; renderHistory(); });
    return tag;
  }));
  elements.historyList.replaceChildren();
  [...state.ratings].reverse().filter(rating => scoreFilter === null || rating.score === scoreFilter).forEach(rating => {
    const item = candidate(rating.id);
    if (!item) return;
    const node = document.getElementById("history-row").content.cloneNode(true);
    node.querySelector(".history-score").textContent = rating.score;
    node.querySelector("h3").textContent = item.name;
    node.querySelector("p").textContent = item.description;
    node.querySelector("small").textContent = item.territory;
    const actions = node.querySelector(".history-actions");
    [2, 3, 4, 5].forEach(score => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = rating.score === score ? "is-current" : "";
      button.setAttribute("aria-label", `Change ${item.name} to score ${score}`);
      button.setAttribute("aria-pressed", String(rating.score === score));
      button.textContent = score;
      button.addEventListener("click", () => changeScore(rating, score));
      actions.appendChild(button);
    });
    elements.historyList.appendChild(node);
  });
}

function renderAnalysis() {
  const data = state.latestAnalysis;
  elements.analysis.hidden = !data;
  if (!data) return;
  elements.analysisText.textContent = data.analysis;
  elements.analysisTags.replaceChildren(...[...(data.likes || []), ...(data.avoids || []).map(item => `Avoid: ${item}`)].map(value => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = value;
    return tag;
  }));
}

function scoreExit(score) {
  const horizontal = Math.max(window.innerWidth * 0.82, elements.deck.clientWidth * 0.9);
  const vertical = Math.min(window.innerHeight * 0.22, 220);
  return ({ 2: [-horizontal, vertical, -10], 3: [-horizontal, -vertical, -10], 4: [horizontal, -vertical, 10], 5: [horizontal, vertical, 10] })[score];
}

function setScoreControls(disabled) { document.querySelectorAll("[data-score]").forEach(button => { button.disabled = disabled; }); }

function activatePrefetch(decision) {
  const pending = decision.prefetch;
  if (pending?.status !== "ready" || !Array.isArray(pending.candidates) || pending.candidates.length !== cycleSize) return false;
  const existingIds = new Set(decision.candidates.map(item => item.id));
  const generated = pending.candidates.filter(item => !existingIds.has(item.id));
  decision.candidates.push(...generated);
  decision.batches.push({ batch: decision.batch, reflection: pending.reflection || "", source: "codex", analysis: pending.analysis?.analysis || "", count: cycleSize, format: "20+10" });
  decision.latestAnalysis = pending.analysis || decision.latestAnalysis;
  decision.batch += 1;
  decision.activeIds = pending.candidates.map(item => item.id);
  decision.prefetch = emptyPrefetch();
  return true;
}

function rate(score) {
  const decision = state;
  const item = currentCandidate();
  if (!item || isTransitioning) return;
  isTransitioning = true;
  setScoreControls(true);
  clearSwipeIntent();
  const [x, y, rotate] = scoreExit(score);
  elements.card.classList.remove("is-dragging");
  elements.card.classList.add("is-leaving");
  elements.card.style.transform = `translate(${x}px, ${y}px) rotate(${rotate}deg)`;
  window.setTimeout(() => {
    decision.ratings.push({ id: item.id, score, at: now(), batch: decision.batch });
    if (isCycleComplete(decision) && decision.prefetch?.status === "ready") activatePrefetch(decision);
    elements.card.classList.add("is-resetting");
    elements.card.classList.remove("is-leaving");
    save();
    if (decision === state) render();
    elements.card.classList.add("is-entering");
    void elements.card.offsetWidth;
    elements.card.classList.remove("is-resetting");
    requestAnimationFrame(() => elements.card.classList.remove("is-entering"));
    isTransitioning = false;
    setScoreControls(false);
    maybeStartPrefetch({ decision });
  }, 180);
}

function changeScore(rating, score) {
  if (rating.score === score) return;
  const stored = state.ratings.find(item => item.id === rating.id && item.at === rating.at);
  if (!stored) return;
  stored.score = score;
  stored.changedAt = now();
  save();
  render();
}

function undo() {
  const ids = new Set(state.activeIds);
  let index = -1;
  for (let cursor = state.ratings.length - 1; cursor >= 0; cursor -= 1) {
    if (ids.has(state.ratings[cursor].id)) { index = cursor; break; }
  }
  if (index < 0) return;
  state.ratings.splice(index, 1);
  save();
  render();
}

function nextSeedBatch() {
  const seed = state.candidates.filter(item => item.source === "seed");
  const ids = seed.slice(state.nextSeed, state.nextSeed + cycleSize).map(item => item.id);
  if (!ids.length) {
    state.prefetch = { status: "error", error: "The initial field is complete. Retry generation through the local bridge." };
    save();
    render();
    return;
  }
  const pendingReflection = state.prefetch?.reflection || state.draftReflection || "";
  state.batches.push({ batch: state.batch, reflection: pendingReflection, source: "seed", count: ids.length, format: ids.length > coreSize ? "20+10" : "legacy" });
  state.batch += 1;
  state.activeIds = ids;
  state.nextSeed += ids.length;
  state.prefetch = emptyPrefetch();
  state.draftReflection = "";
  save();
  render();
}

function generationRatings(decision) {
  return decision.ratings.map(rating => {
    const item = candidateFor(decision, rating.id);
    return item ? { name: item.name, territory: item.territory, description: item.description, score: rating.score, batch: rating.batch } : null;
  }).filter(Boolean);
}

async function requestPrefetch(decision, runId) {
  if (prefetchRequests.has(decision.id)) return prefetchRequests.get(decision.id);
  const request = (async () => {
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId: decision.id, runId, ratings: generationRatings(decision), reflection: decision.prefetch.reflection || "", count: cycleSize, decision: { title: decision.title, brief: decision.brief } })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Generation failed");
      if (!Array.isArray(result.names) || result.names.length !== cycleSize) throw new Error(`Codex returned ${result.names?.length || 0} cards instead of ${cycleSize}. Retry this set.`);
      if (decision.prefetch?.runId !== runId) return;
      const stamp = Date.now();
      const generated = Array.isArray(result.candidates) && result.candidates.length === cycleSize ? result.candidates : result.names.map((item, index) => ({ id: `${decision.id}-generated-${stamp}-${index + 1}`, ...item, source: "generated" }));
      decision.prefetch = { ...decision.prefetch, status: "ready", candidates: generated, analysis: result, readyAt: now() };
      if (decision === state && isCycleComplete(decision)) activatePrefetch(decision);
      save();
      if (decision === state) render();
    } catch (error) {
      if (decision.prefetch?.runId !== runId) return;
      decision.prefetch = { ...decision.prefetch, status: "error", error: error instanceof Error ? error.message : "Generation failed" };
      save();
      if (decision === state) render();
    }
  })();
  prefetchRequests.set(decision.id, request);
  request.finally(() => { if (prefetchRequests.get(decision.id) === request) prefetchRequests.delete(decision.id); });
  return request;
}

function maybeStartPrefetch(options = {}) {
  const decision = options.decision || state;
  const force = Boolean(options.force);
  if (!decision || currentBatchRatingsFor(decision).length < prefetchTrigger(decision)) return;
  if (decision.prefetch?.status === "ready") {
    if (isCycleComplete(decision) && activatePrefetch(decision)) { save(); if (decision === state) render(); }
    return;
  }
  if (decision.prefetch?.status === "generating") {
    if (bridgeAvailable && !prefetchRequests.has(decision.id)) {
      if (!decision.prefetch.runId) decision.prefetch.runId = newId("run");
      requestPrefetch(decision, decision.prefetch.runId);
    }
    return;
  }
  if (decision.prefetch?.status === "error" && !force) return;
  if (!bridgeAvailable) {
    decision.prefetch = { status: "error", error: "Open Decinder through the local bridge to generate the next 20 + 10. Your ratings are saved." };
    save();
    if (decision === state) render();
    return;
  }
  stopDictation();
  const runId = newId("run");
  const reflection = [decision.prefetch?.reflection, decision.draftReflection.trim()].filter(Boolean).join("\n\n");
  decision.draftReflection = "";
  decision.prefetch = { status: "generating", startedAt: now(), reflection, runId };
  if (decision === state) elements.reflection.value = "";
  save();
  if (decision === state) { renderPrefetchStatus(); if (isCycleComplete(decision)) renderWaitState(); }
  requestPrefetch(decision, runId);
}

async function checkBridge() {
  if (!bridgeHost()) {
    bridgeAvailable = false;
    elements.bridgeStatus.textContent = "Local generation is available at localhost";
    return;
  }
  try {
    const [health, stored] = await Promise.all([fetch("/api/health", { cache: "no-store" }), fetch("/api/state", { cache: "no-store" })]);
    if (!health.ok || !stored.ok) throw new Error();
    bridgeAvailable = true;
    const remote = await stored.json();
    if (remote.state) { workspace = normalizeWorkspace(remote.state); syncActive(); }
    save();
    elements.bridgeStatus.textContent = "Local Codex + shared SQLite ready";
  } catch {
    bridgeAvailable = false;
    elements.bridgeStatus.textContent = "Bridge unavailable";
  }
}

async function pollPersistedPrefetch() {
  const localPrefetch = state?.prefetch;
  if (!bridgeAvailable || prefetchPollInFlight || !localPrefetch?.runId || !["generating", "error"].includes(localPrefetch.status)) return;
  prefetchPollInFlight = true;
  lastPrefetchPoll = Date.now();
  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) return;
    const remote = await response.json();
    const remoteDecision = remote.state?.decisions?.find(item => item.id === state.id);
    const remotePrefetch = remoteDecision?.prefetch;
    if (remotePrefetch?.runId !== localPrefetch.runId || !["ready", "error"].includes(remotePrefetch.status)) return;
    if (remotePrefetch.status === localPrefetch.status && remotePrefetch.error === localPrefetch.error) return;
    state.prefetch = remotePrefetch;
    if (isCycleComplete(state) && state.prefetch.status === "ready") activatePrefetch(state);
    save();
    render();
  } catch {
    // The local state remains authoritative until the bridge is reachable again.
  } finally {
    prefetchPollInFlight = false;
  }
}

function speechRecognition() { return window.SpeechRecognition || window.webkitSpeechRecognition; }
function stopDictation() { if (recognition) recognition.stop(); }
function storeReflection() {
  state.draftReflection = elements.reflection.value;
  localStorage.setItem(storageKey, JSON.stringify(workspace));
  window.clearTimeout(reflectionSaveTimer);
  reflectionSaveTimer = window.setTimeout(save, 350);
}

function setupDictation() {
  const Recognition = speechRecognition();
  if (!Recognition) {
    elements.dictate.disabled = true;
    elements.dictationMessage.textContent = "Dictation is not available in this browser. You can still type your thoughts.";
    return;
  }
  elements.dictate.addEventListener("click", () => {
    if (isDictating) return stopDictation();
    const initial = elements.reflection.value.trim();
    let finalText = "";
    let interimText = "";
    recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.onstart = () => {
      isDictating = true;
      elements.dictate.setAttribute("aria-pressed", "true");
      elements.dictateLabel.textContent = "Listening…";
      elements.dictationMessage.textContent = "Listening. Tap again when you are done.";
    };
    recognition.onresult = event => {
      interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const text = event.results[index][0].transcript.trim();
        if (event.results[index].isFinal) finalText += `${finalText ? " " : ""}${text}`;
        else interimText = text;
      }
      elements.reflection.value = [initial, finalText, interimText].filter(Boolean).join(" ");
      storeReflection();
    };
    recognition.onerror = event => { elements.dictationMessage.textContent = event.error === "not-allowed" ? "Microphone permission was not granted." : "Dictation stopped. You can type instead."; };
    recognition.onend = () => {
      isDictating = false;
      elements.dictate.setAttribute("aria-pressed", "false");
      elements.dictateLabel.textContent = "Dictate";
      recognition = null;
    };
    recognition.start();
  });
}

async function createDecision(event) {
  event.preventDefault();
  if (!bridgeAvailable) {
    elements.newDecisionMessage.textContent = "Open Decinder through the local bridge to create a separate decision.";
    return;
  }
  const title = elements.newDecisionTitle.value.trim();
  const brief = elements.newDecisionBrief.value.trim();
  if (!title || !brief) return;
  elements.createDecision.disabled = true;
  elements.createDecision.textContent = "Creating cards…";
  elements.newDecisionMessage.textContent = "Codex is preparing 20 core cards plus a 10-card buffer.";
  try {
    const response = await fetch("/api/decisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, brief, count: cycleSize }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not create decision");
    workspace = normalizeWorkspace(result.workspace);
    workspace.activeId = result.decision.id;
    syncActive();
    localStorage.setItem(storageKey, JSON.stringify(workspace));
    elements.newDecisionForm.reset();
    render();
    elements.decisionDialog.close();
  } catch (error) {
    elements.newDecisionMessage.textContent = error instanceof Error ? error.message : "Could not create decision";
  } finally {
    elements.createDecision.disabled = false;
    elements.createDecision.textContent = "Create 20 + 10 cards";
  }
}

function clearSwipeIntent() {
  elements.swipeIntent.hidden = true;
  elements.deck.removeAttribute("data-intent");
}

function showSwipeIntent(score) {
  const labels = { 2: "Strong no", 3: "No", 4: "Yes", 5: "Strong yes" };
  elements.swipeIntent.querySelector("b").textContent = score;
  elements.swipeIntent.querySelector("span").textContent = labels[score];
  elements.swipeIntent.hidden = false;
  elements.deck.dataset.intent = String(score);
}

function resetDragVisual(animate = true) {
  drag = null;
  elements.card.classList.remove("is-dragging");
  if (animate) elements.card.classList.add("is-snapping");
  elements.card.style.transform = "translate(0, 0) rotate(0)";
  clearSwipeIntent();
  if (animate) window.setTimeout(() => elements.card.classList.remove("is-snapping"), 190);
}

function startDrag(event) {
  if (isTransitioning || !currentCandidate()) return;
  drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  elements.card.classList.remove("is-snapping");
  elements.card.classList.add("is-dragging");
  elements.card.setPointerCapture(event.pointerId);
}

function moveDrag(event) {
  if (!drag || drag.pointerId !== event.pointerId || isTransitioning) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  const rotation = Math.max(-9, Math.min(9, dx / 24));
  elements.card.style.transform = `translate(${dx}px, ${dy}px) rotate(${rotation}deg)`;
  if (Math.hypot(dx, dy) >= 22) showSwipeIntent(scoreForVector(dx, dy));
  else clearSwipeIntent();
}

function endDrag(event) {
  if (!drag || drag.pointerId !== event.pointerId || isTransitioning) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  const distance = Math.hypot(dx, dy);
  const threshold = Math.max(44, Math.min(68, elements.card.clientWidth * 0.12));
  drag = null;
  elements.card.classList.remove("is-dragging");
  if (distance < threshold) { resetDragVisual(); return; }
  rate(scoreForVector(dx, dy));
}

document.querySelectorAll("[data-score]").forEach(button => button.addEventListener("click", () => rate(Number(button.dataset.score))));
elements.undo.addEventListener("click", undo);
elements.continueSeed.addEventListener("click", nextSeedBatch);
elements.generate.addEventListener("click", () => maybeStartPrefetch({ force: true }));
elements.prefetchRetry.addEventListener("click", () => maybeStartPrefetch({ force: true }));
elements.decisionsToggle.addEventListener("click", () => elements.decisionDialog.showModal());
elements.closeDecisions.addEventListener("click", () => elements.decisionDialog.close());
elements.newDecisionForm.addEventListener("submit", createDecision);
elements.reflection.addEventListener("input", storeReflection);
elements.reset.addEventListener("click", () => {
  if (!confirm(`Clear ratings for ${state.title}?`)) return;
  state.ratings = [];
  state.batches = [];
  state.batch = 1;
  state.activeIds = state.candidates.slice(0, cycleSize).map(item => item.id);
  state.nextSeed = state.activeIds.length;
  state.latestAnalysis = null;
  state.draftReflection = "";
  state.prefetch = { status: "idle", runId: newId("cancelled") };
  save();
  render();
});

elements.card.addEventListener("pointerdown", startDrag);
elements.card.addEventListener("pointermove", moveDrag);
elements.card.addEventListener("pointerup", endDrag);
elements.card.addEventListener("pointercancel", () => { if (drag) resetDragVisual(); });
elements.card.addEventListener("lostpointercapture", () => { if (drag && !isTransitioning) resetDragVisual(); });
window.addEventListener("keydown", event => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (["2", "3", "4", "5"].includes(event.key) && currentCandidate()) rate(Number(event.key));
  if (event.key.toLowerCase() === "z" && (event.metaKey || event.ctrlKey)) undo();
});

setupDictation();
window.setInterval(() => {
  if (!state) return;
  if (state.prefetch?.status === "generating") {
    renderPrefetchStatus();
    if (isCycleComplete(state)) renderWaitState();
  }
  if (Date.now() - lastPrefetchPoll >= 3000) pollPersistedPrefetch();
}, 1000);
checkBridge().finally(() => {
  syncActive();
  render();
  maybeStartPrefetch();
});
