const storageKey = "naming-decision-lab:v1";
const $ = id => document.getElementById(id);
const bridgeHost = () => location.port === "4310";
function localState() { try { return JSON.parse(localStorage.getItem(storageKey)); } catch { return null; } }
function activeDecision(raw) { return raw?.version === 2 ? raw.decisions?.find(item => item.id === raw.activeId) || raw.decisions?.[0] : raw; }
async function getState() {
  if (!bridgeHost()) return localState();
  try { const response = await fetch("/api/state", { cache: "no-store" }); const remote = await response.json(); return remote.state || localState(); } catch { return localState(); }
}
function candidate(state, id) { return state.candidates.find(item => item.id === id); }
function nameCard(item, score) {
  const node = document.createElement("article"); node.className = "name-card";
  const label = document.createElement("span"); label.textContent = `${score} · ${item.territory}`;
  const name = document.createElement("strong"); name.textContent = item.name;
  const desc = document.createElement("p"); desc.textContent = item.description;
  node.append(label, name, desc); return node;
}
function render(state) {
  const ratings = state.ratings || [];
  $("bridge-status").textContent = bridgeHost() ? "Shared SQLite record" : "This browser's saved record";
  $("rated-total").textContent = ratings.length;
  const completed = state.batches?.length || 0;
  const current = ratings.filter(rating => rating.batch === state.batch).length;
  $("progress-copy").textContent = `${completed} batch${completed === 1 ? "" : "es"} closed, with ${current ? `${current} names waiting for your next reflection` : "the next batch ready"}.`;
  [2,3,4,5].forEach(score => $("score-" + score).textContent = ratings.filter(item => item.score === score).length);
  const items = ratings.map(rating => ({ rating, item: candidate(state, rating.id) })).filter(entry => entry.item);
  const shortlist = items.filter(entry => entry.rating.score >= 4).sort((a,b) => b.rating.score - a.rating.score || b.rating.at.localeCompare(a.rating.at));
  $("shortlist").replaceChildren(...shortlist.map(entry => nameCard(entry.item, entry.rating.score)));
  const groups = new Map();
  items.forEach(({item, rating}) => { const group = groups.get(item.territory) || { total: 0, count: 0 }; group.total += rating.score; group.count += 1; groups.set(item.territory, group); });
  const territories = [...groups.entries()].map(([name, value]) => ({ name, ...value, avg: value.total / value.count })).sort((a,b) => b.avg - a.avg || b.count - a.count);
  $("territories").replaceChildren(...territories.map(group => { const row = document.createElement("article"); row.className = "territory-row"; const name = document.createElement("strong"); name.textContent = group.name; const average = document.createElement("span"); average.textContent = `${group.avg.toFixed(1)} / 5 · ${group.count}`; const bar = document.createElement("i"); const fill = document.createElement("b"); fill.style.width = `${((group.avg - 2) / 3) * 100}%`; bar.append(fill); row.append(name, average, bar); return row; }));
  const rejected = items.filter(entry => entry.rating.score <= 3).sort((a,b) => a.rating.score - b.rating.score || b.rating.at.localeCompare(a.rating.at));
  $("rejected-count").textContent = rejected.length;
  $("rejected-list").replaceChildren(...rejected.map(entry => nameCard(entry.item, entry.rating.score)));
  if (state.latestAnalysis) { $("model-analysis").hidden = false; $("analysis-text").textContent = state.latestAnalysis.analysis; const tags = [...(state.latestAnalysis.likes || []), ...(state.latestAnalysis.avoids || []).map(item => `Avoid: ${item}`)]; $("analysis-tags").replaceChildren(...tags.map(text => { const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = text; return tag; })); }
  $("results").hidden = false;
}
getState().then(raw => { const state = activeDecision(raw); if (state?.ratings?.length) render(state); else $("empty").hidden = false; });
