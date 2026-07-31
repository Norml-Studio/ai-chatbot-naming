const storageKey = "naming-decision-lab:v1";
const batchSize = 20;
const $ = id => document.getElementById(id);
const elements = {
  bridgeStatus: $("bridge-status"), batchNumber: $("batch-number"), progressText: $("progress-text"), progressBar: $("progress-bar"), undo: $("undo"), deck: $("deck"), card: $("card"), cardTerritory: $("card-territory"), cardName: $("card-name"), cardDescription: $("card-description"), cardSource: $("card-source"), batchComplete: $("batch-complete"), reflection: $("reflection"), generate: $("generate"), continueSeed: $("continue-seed"), generationMessage: $("generation-message"), analysis: $("analysis"), analysisText: $("analysis-text"), analysisTags: $("analysis-tags"), stats: $("stats"), historyList: $("history-list"), reset: $("reset")
};
const freshState = () => ({ candidates: [...window.SWIPE_SEED], ratings: [], batches: [], batch: 1, activeIds: window.SWIPE_SEED.slice(0, batchSize).map(x => x.id), nextSeed: batchSize, latestAnalysis: null });
let state = load(); let bridgeAvailable = false; let drag = null;
function load() { try { const parsed = JSON.parse(localStorage.getItem(storageKey)); return parsed?.candidates?.length ? parsed : freshState(); } catch { return freshState(); } }
function save() { localStorage.setItem(storageKey, JSON.stringify(state)); }
function candidate(id) { return state.candidates.find(item => item.id === id); }
function currentBatchRatings() { const ids = new Set(state.activeIds); return state.ratings.filter(item => ids.has(item.id)); }
function currentCandidate() { const rated = new Set(currentBatchRatings().map(item => item.id)); return state.activeIds.map(candidate).find(item => item && !rated.has(item.id)); }
function scoreForPoint(x, y) { const rect = elements.deck.getBoundingClientRect(); const right = x > rect.left + rect.width / 2; const bottom = y > rect.top + rect.height / 2; return bottom ? (right ? 5 : 2) : (right ? 4 : 3); }
function render() {
  const done = currentBatchRatings().length; const item = currentCandidate();
  elements.batchNumber.textContent = String(state.batch).padStart(2, "0"); elements.progressText.textContent = `${Math.min(done + 1, batchSize)} of ${batchSize}`; elements.progressBar.style.width = `${(done / batchSize) * 100}%`; elements.undo.disabled = state.ratings.length === 0;
  elements.batchComplete.hidden = done < batchSize; elements.deck.parentElement.hidden = done >= batchSize;
  if (item) { elements.cardTerritory.textContent = item.territory; elements.cardName.textContent = item.name; elements.cardDescription.textContent = item.description; elements.cardSource.textContent = item.source === "generated" ? "Generated from your previous ratings" : "Initial naming field"; elements.card.style.transform = "translate(0,0) rotate(0)"; }
  renderHistory(); renderAnalysis();
}
function renderHistory() {
  const counts = [2,3,4,5].map(score => state.ratings.filter(item => item.score === score).length); elements.stats.replaceChildren(...counts.map((count, i) => { const tag = document.createElement("span"); tag.textContent = `${i + 2}: ${count}`; return tag; })); elements.historyList.replaceChildren();
  [...state.ratings].reverse().forEach(rating => { const item = candidate(rating.id); if (!item) return; const node = document.getElementById("history-row").content.cloneNode(true); node.querySelector(".history-score").textContent = rating.score; node.querySelector("h3").textContent = item.name; node.querySelector("p").textContent = item.description; node.querySelector("small").textContent = item.territory; elements.historyList.appendChild(node); });
}
function renderAnalysis() { const data = state.latestAnalysis; elements.analysis.hidden = !data; if (!data) return; elements.analysisText.textContent = data.analysis; elements.analysisTags.replaceChildren(...[...(data.likes || []), ...(data.avoids || []).map(x => `Avoid: ${x}`)].map(text => { const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = text; return tag; })); }
function rate(score) { const item = currentCandidate(); if (!item) return; state.ratings.push({ id: item.id, score, at: new Date().toISOString(), batch: state.batch }); save(); render(); }
function undo() { state.ratings.pop(); save(); render(); }
function nextSeedBatch() { const ids = state.candidates.filter(item => item.source === "seed").slice(state.nextSeed, state.nextSeed + batchSize).map(item => item.id); if (!ids.length) return generateMessage("Initial 200-name field is complete. Use local generation for the next batch."); state.batches.push({ batch: state.batch, reflection: elements.reflection.value.trim(), source: "seed" }); state.batch += 1; state.activeIds = ids; state.nextSeed += ids.length; elements.reflection.value = ""; save(); render(); }
function generateMessage(message) { elements.generationMessage.textContent = message; }
async function checkBridge() { if (!["localhost", "127.0.0.1"].includes(location.hostname)) { bridgeAvailable = false; elements.bridgeStatus.textContent = "Local generation is available at localhost"; return; } try { const r = await fetch("/api/health", { cache: "no-store" }); if (!r.ok) throw new Error(); bridgeAvailable = true; elements.bridgeStatus.textContent = "Local Codex bridge ready"; } catch { bridgeAvailable = false; elements.bridgeStatus.textContent = "Bridge unavailable"; } }
async function generate() {
  if (!bridgeAvailable) return generateMessage("Run `node naming/decide/bridge.mjs`, then open http://127.0.0.1:4310/naming/decide/. Vercel cannot access your local Codex CLI.");
  elements.generate.disabled = true; generateMessage("Codex is analyzing this batch and drafting 20 new names…");
  const ratings = state.ratings.map(rating => { const item = candidate(rating.id); return { name: item.name, territory: item.territory, description: item.description, score: rating.score, batch: rating.batch }; });
  try { const r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ratings, reflection: elements.reflection.value.trim(), count: 20 }) }); const result = await r.json(); if (!r.ok) throw new Error(result.error || "Generation failed");
    const generated = result.names.map((item, index) => ({ id: `generated-${Date.now()}-${index}`, ...item, source: "generated" })); state.candidates.push(...generated); state.batches.push({ batch: state.batch, reflection: elements.reflection.value.trim(), source: "codex", analysis: result.analysis }); state.latestAnalysis = result; state.batch += 1; state.activeIds = generated.map(item => item.id); elements.reflection.value = ""; save(); render(); generateMessage("New 20-name batch is ready.");
  } catch (error) { generateMessage(error instanceof Error ? error.message : "Generation failed"); } finally { elements.generate.disabled = false; }
}
document.querySelectorAll("[data-score]").forEach(button => button.addEventListener("click", () => rate(Number(button.dataset.score)))); elements.undo.addEventListener("click", undo); elements.continueSeed.addEventListener("click", nextSeedBatch); elements.generate.addEventListener("click", generate); elements.reset.addEventListener("click", () => { if (confirm("Clear all ratings, batches, and generated names on this device?")) { state = freshState(); save(); render(); } });
elements.card.addEventListener("pointerdown", event => { drag = { x: event.clientX, y: event.clientY }; elements.card.setPointerCapture(event.pointerId); });
elements.card.addEventListener("pointermove", event => { if (!drag) return; const dx = event.clientX - drag.x, dy = event.clientY - drag.y; elements.card.style.transform = `translate(${dx}px,${dy}px) rotate(${dx / 22}deg)`; });
elements.card.addEventListener("pointerup", event => { if (!drag) return; const dx = event.clientX - drag.x, dy = event.clientY - drag.y; drag = null; if (Math.hypot(dx, dy) < 55) return render(); rate(scoreForPoint(event.clientX, event.clientY)); });
window.addEventListener("keydown", event => { if (["2","3","4","5"].includes(event.key) && !elements.batchComplete.hidden) return; if (["2","3","4","5"].includes(event.key)) rate(Number(event.key)); if (event.key.toLowerCase() === "z" && (event.metaKey || event.ctrlKey)) undo(); });
checkBridge(); render();
