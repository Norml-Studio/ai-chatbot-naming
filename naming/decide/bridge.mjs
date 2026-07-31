#!/usr/bin/env node
import http from "node:http";
import { readFile, stat, mkdtemp, rm } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "../..");
const schemaPath = join(here, "response.schema.json");
const codex = process.env.CODEX_BIN || "codex";
const port = Number(process.env.PORT || 4310);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };

function send(res, code, body, type = "application/json; charset=utf-8") { res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" }); res.end(typeof body === "string" ? body : JSON.stringify(body)); }
async function body(req) { let text = ""; for await (const chunk of req) { text += chunk; if (text.length > 1_500_000) throw new Error("Request too large"); } return JSON.parse(text || "{}"); }
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
  return `You are helping name a WordPress-first AI assistant for website visitors. The user rates names 2–5: 2 = strong no, 3 = no, 4 = yes, 5 = strong yes. Analyze the user's demonstrated naming preference. Do not claim trademark or domain availability. Avoid names already rated 2 or 3 and avoid close variants. Generate exactly ${payload.count || 20} fresh names. The user’s batch reflection is: ${JSON.stringify(payload.reflection || "No extra notes.")}\n\nRated candidates:\n${JSON.stringify(payload.ratings || [])}\n\nReturn only JSON matching the provided schema. The descriptions should explain the semantic/sound territory in a single concise sentence.`;
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
    if (req.method === "GET" && req.url === "/api/health") return send(res, 200, { ok: true, bridge: "local", codex });
    if (req.method === "POST" && req.url === "/api/generate") {
      const payload = await body(req);
      if (!Array.isArray(payload.ratings) || payload.ratings.length === 0) return send(res, 400, { error: "At least one rated name is required." });
      const result = await runCodex(createPrompt(payload));
      return send(res, 200, result);
    }
    return staticFile(req, res);
  } catch (error) { return send(res, 500, { error: error instanceof Error ? error.message : "Generation failed" }); }
});
server.listen(port, "127.0.0.1", () => console.log(`Naming decision lab → http://127.0.0.1:${port}/naming/decide/`));
