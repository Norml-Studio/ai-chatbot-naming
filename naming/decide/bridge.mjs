#!/usr/bin/env node
import http from "node:http";
import { readFile, stat, mkdtemp, rm, mkdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { tmpdir, homedir, networkInterfaces, hostname } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "../..");
const schemaPath = join(here, "response.schema.json");
const codex = process.env.CODEX_BIN || "codex";
const port = Number(process.env.PORT || 4310);
const lan = process.argv.includes("--lan");
const host = lan ? "0.0.0.0" : "127.0.0.1";
const dbPath = process.env.NAMING_DB_PATH || join(homedir(), "Library", "Application Support", "Norml Studio", "Naming Decision Lab", "decision-lab.sqlite");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };
const generationJobs = new Map();

function send(res, code, body, type = "application/json; charset=utf-8") { res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" }); res.end(typeof body === "string" ? body : JSON.stringify(body)); }
async function body(req) { let text = ""; for await (const chunk of req) { text += chunk; if (text.length > 1_500_000) throw new Error("Request too large"); } return JSON.parse(text || "{}"); }
function sqlite(sql) { return new Promise((resolveSql, rejectSql) => { const child = spawn("/usr/bin/sqlite3", [dbPath, sql], { stdio: ["ignore", "pipe", "pipe"] }); let output = "", error = ""; child.stdout.on("data", chunk => { output += chunk; }); child.stderr.on("data", chunk => { error += chunk; }); child.on("error", rejectSql); child.on("close", code => code === 0 ? resolveSql(output) : rejectSql(new Error(error || `sqlite3 exited with ${code}`))); }); }
async function initDb() { await mkdir(dirname(dbPath), { recursive: true }); await sqlite("CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);"); }
async function readState() { const value = (await sqlite("SELECT value FROM app_state WHERE key = 'decision_lab' LIMIT 1;")).trim(); return value ? JSON.parse(Buffer.from(value, "base64").toString("utf8")) : null; }
async function writeState(state) { const value = Buffer.from(JSON.stringify(state), "utf8").toString("base64"); await sqlite(`INSERT INTO app_state (key, value, updated_at) VALUES ('decision_lab', '${value}', datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`); }
function decisionId() { return `decision-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function workspaceFrom(raw) {
  if (raw?.version === 2 && Array.isArray(raw.decisions)) return raw;
  if (raw?.candidates?.length) return { version: 2, activeId: "chatbot-naming", decisions: [{ id: "chatbot-naming", title: "AI assistant naming", brief: "Find a clear, distinctive product name for a WordPress-first AI assistant for website visitors.", kind: "naming", createdAt: new Date().toISOString(), ...raw }] };
  return { version: 2, activeId: null, decisions: [] };
}
async function persistGeneration(payload, result) {
  const stamp = Date.now();
  const candidates = result.names.map((item, index) => ({ id: `${payload.decisionId || "decision"}-generated-${stamp}-${index + 1}`, ...item, source: "generated" }));
  if (!payload.decisionId || !payload.runId) return candidates;
  const workspace = workspaceFrom(await readState());
  const decision = workspace.decisions.find(item => item.id === payload.decisionId);
  if (!decision || decision.prefetch?.runId !== payload.runId) return candidates;
  decision.prefetch = { ...decision.prefetch, status: "ready", candidates, analysis: result, readyAt: new Date().toISOString() };
  await writeState(workspace);
  return candidates;
}
async function persistGenerationError(payload, error) {
  if (!payload.decisionId || !payload.runId) return;
  const workspace = workspaceFrom(await readState());
  const decision = workspace.decisions.find(item => item.id === payload.decisionId);
  if (!decision || decision.prefetch?.runId !== payload.runId) return;
  decision.prefetch = { ...decision.prefetch, status: "error", error: error instanceof Error ? error.message : "Generation failed" };
  await writeState(workspace);
}
function runCodex(prompt) {
  return new Promise(async (resolveRun, rejectRun) => {
    const temp = await mkdtemp(join(tmpdir(), "naming-decide-"));
    const output = join(temp, "response.json");
    const child = spawn(codex, ["exec", "--ephemeral", "--sandbox", "read-only", "--output-schema", schemaPath, "--output-last-message", output, "-"], { cwd: appRoot, stdio: ["pipe", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", async error => { await rm(temp, { recursive: true, force: true }); rejectRun(error); });
    child.on("close", async code => {
      try {
        if (code !== 0) throw new Error(stderr || `Codex exited with ${code}`);
        const response = JSON.parse(await readFile(output, "utf8"));
        await rm(temp, { recursive: true, force: true });
        resolveRun(response);
      } catch (error) { await rm(temp, { recursive: true, force: true }); rejectRun(error); }
    });
    child.stdin.end(prompt);
  });
}
function createPrompt(payload) {
  if (payload.mode === "seed") return `You are setting up a Decinder decision session. Create exactly ${payload.count || 30} short, deliberately varied cards for this decision. Each card must be a genuine option the user can rate 2–5, not an explanation, question, or minor rewrite of another card. Use the schema's name field for the card text, territory field for the distinct angle or trade-off, and description for one concise explanation. Do not make claims about legal clearance, factual certainty, or market validation.\n\nDecision title: ${JSON.stringify(payload.title)}\nDecision brief: ${JSON.stringify(payload.brief)}\n\nReturn only JSON matching the provided schema.`;
  const decision = payload.decision ? `You are helping with this Decinder decision: ${JSON.stringify(payload.decision.title)}. Decision brief: ${JSON.stringify(payload.decision.brief)}.` : "You are helping name a WordPress-first AI assistant for website visitors.";
  return `${decision} The user rates cards 2–5: 2 = strong no, 3 = no, 4 = yes, 5 = strong yes. Analyze the user's demonstrated preference. Do not claim trademark or domain availability. Avoid cards already rated 2 or 3 and avoid close variants. Generate exactly ${payload.count || 30} fresh cards for the next Decinder cycle: 20 core cards followed by a 10-card buffer. The user’s batch reflection is: ${JSON.stringify(payload.reflection || "No extra notes.")}\n\nRated candidates:\n${JSON.stringify(payload.ratings || [])}\n\nReturn only JSON matching the provided schema. The descriptions should explain the territory or trade-off in a single concise sentence.`;
}
async function staticFile(req, res) {
  const url = new URL(req.url, "http://localhost");
  let requestPath = decodeURIComponent(url.pathname);
  if (requestPath === "/") requestPath = "/naming/decide/";
  if (requestPath.endsWith("/")) requestPath += "index.html";
  const target = resolve(appRoot, `.${normalize(requestPath)}`);
  if (!target.startsWith(appRoot)) return send(res, 403, "Forbidden", "text/plain");
  try { const info = await stat(target); if (!info.isFile()) throw new Error("Not a file"); res.writeHead(200, { "Content-Type": mime[extname(target)] || "application/octet-stream" }); createReadStream(target).pipe(res); } catch { send(res, 404, "Not found", "text/plain"); }
}
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/health") return send(res, 200, { ok: true, bridge: "local", codex, database: dbPath, lan });
    if (req.method === "GET" && req.url === "/api/state") return send(res, 200, { state: await readState() });
    if (req.method === "PUT" && req.url === "/api/state") { const payload = await body(req); if (!payload.state || typeof payload.state !== "object") return send(res, 400, { error: "A state object is required." }); await writeState(payload.state); return send(res, 200, { ok: true }); }
    if (req.method === "POST" && req.url === "/api/generate") {
      const payload = await body(req);
      if (!Array.isArray(payload.ratings) || payload.ratings.length === 0) return send(res, 400, { error: "At least one rated name is required." });
      const count = Math.max(1, Math.min(30, Number(payload.count) || 30));
      const normalizedPayload = { ...payload, count };
      const jobKey = payload.decisionId && payload.runId ? `${payload.decisionId}:${payload.runId}` : null;
      let job = jobKey ? generationJobs.get(jobKey) : null;
      if (!job) {
        job = (async () => {
          try {
            const result = await runCodex(createPrompt(normalizedPayload));
            if (!Array.isArray(result.names) || result.names.length !== count) throw new Error(`Codex returned ${result.names?.length || 0} cards instead of ${count}. Retry this set.`);
            const candidates = await persistGeneration(normalizedPayload, result);
            return { ...result, candidates };
          } catch (error) {
            await persistGenerationError(normalizedPayload, error);
            throw error;
          }
        })();
        if (jobKey) {
          const trackedJob = job.then(value => { generationJobs.delete(jobKey); return value; }, error => { generationJobs.delete(jobKey); throw error; });
          generationJobs.set(jobKey, trackedJob);
          job = trackedJob;
        }
      }
      return send(res, 200, await job);
    }
    if (req.method === "POST" && req.url === "/api/decisions") {
      const payload = await body(req);
      const title = typeof payload.title === "string" ? payload.title.trim() : "";
      const brief = typeof payload.brief === "string" ? payload.brief.trim() : "";
      if (!title || !brief) return send(res, 400, { error: "A title and decision brief are required." });
      const count = Math.max(1, Math.min(30, Number(payload.count) || 30));
      const result = await runCodex(createPrompt({ mode: "seed", title, brief, count }));
      if (!Array.isArray(result.names) || result.names.length !== count) return send(res, 502, { error: `Codex returned ${result.names?.length || 0} cards instead of ${count}. Retry this decision.` });
      const workspace = workspaceFrom(await readState());
      const id = decisionId(); const createdAt = new Date().toISOString();
      const decision = { id, title, brief, kind: "decision", createdAt, candidates: result.names.map((item, index) => ({ id: `${id}-card-${index + 1}`, ...item, source: "generated" })), ratings: [], batches: [], batch: 1, activeIds: [], nextSeed: result.names.length, latestAnalysis: { ...result, analysis: result.analysis || "Initial 20 + 10 set created from the decision brief." }, draftReflection: "", prefetch: { status: "idle" } };
      decision.activeIds = decision.candidates.map(item => item.id); workspace.decisions.push(decision); workspace.activeId = id; await writeState(workspace);
      return send(res, 200, { decision, workspace });
    }
    return staticFile(req, res);
  } catch (error) { return send(res, 500, { error: error instanceof Error ? error.message : "Generation failed" }); }
});
await initDb();
server.listen(port, host, () => {
  console.log(`Naming decision lab → http://127.0.0.1:${port}/naming/decide/`);
  console.log(`SQLite state → ${dbPath}`);
  if (lan) {
    const addresses = Object.values(networkInterfaces()).flat().filter(info => info && info.family === "IPv4" && !info.internal).map(info => info.address);
    const localHost = hostname().endsWith(".local") ? hostname() : `${hostname()}.local`;
    console.log(`Phone on the same Wi‑Fi → http://${localHost}:${port}/naming/decide/`);
    addresses.forEach(address => console.log(`Phone fallback → http://${address}:${port}/naming/decide/`));
  } else console.log("For iPhone access on the same Wi‑Fi, restart with: node naming/decide/bridge.mjs --lan");
});
