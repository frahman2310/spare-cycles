#!/usr/bin/env node
// Spare Cycles MCP server. Serves the games as an MCP App (ui:// resource) so
// Claude, ChatGPT, Cursor and VS Code render them inline.
//   node server.js --stdio   local hosts (Claude Desktop, Cursor, VS Code)
//   node server.js           HTTP on :3001 — /mcp for remote hosts, / to play in a browser
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { createServer as createHttpServer } from "node:http";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { z } from "zod";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const { version } = JSON.parse(read("./package.json"));
const URI = "ui://spare-cycles/games.html";
const GAMES = ["flash", "track", "flip"];
// Hosts sandbox the game without browser storage, so progress lives on this machine.
// ponytail: one shared file; a remote multi-user deployment needs per-user storage.
const DATA = process.env.SPARE_CYCLES_DATA ?? join(homedir(), ".spare-cycles", "progress.json");
const loadProgress = () => { try { return JSON.parse(readFileSync(DATA, "utf8")); } catch { return {}; } };
function saveProgress(data) {
  mkdirSync(dirname(DATA), { recursive: true });
  writeFileSync(DATA + ".tmp", JSON.stringify(data)); renameSync(DATA + ".tmp", DATA); // atomic: no half-written file
}

// The SDK's prebuilt bundle ends in one `export{a as App,...}` statement; turn it
// into a local binding so the whole bridge fits in a single inline module script.
function bridge() {
  const file = createRequire(import.meta.url).resolve("@modelcontextprotocol/ext-apps/app-with-deps");
  const sdk = readFileSync(file, "utf8").replace(/export\s*\{([^}]*)\}\s*;?\s*$/, (_, list) =>
    "const McpApps={" + list.split(",").map((pair) => {
      const [local, name = local] = pair.trim().split(/\s+as\s+/);
      return `${name}:${local}`;
    }).join(",") + "};");
  return `<script type="module">${sdk}
const app = new McpApps.App({ name: "spare-cycles", version: ${JSON.stringify(version)} }, {}, { autoResize: true });
const modes = { pip: document.getElementById("mode-pip"), fullscreen: document.getElementById("mode-full") };
function onContext(ctx) {
  if (ctx.theme) McpApps.applyDocumentTheme(ctx.theme);
  for (const [mode, btn] of Object.entries(modes)) btn.hidden = !ctx.availableDisplayModes?.includes(mode) || ctx.displayMode === mode;
}
for (const [mode, btn] of Object.entries(modes)) btn.onclick = () => app.requestDisplayMode({ mode }).catch(console.error);
app.onhostcontextchanged = onContext;
app.ontoolinput = ({ arguments: args }) => args?.game && window.SpareCycles.select(args.game);
window.SpareCycles.openLink = (url) => app.openLink({ url }).catch(console.error);
app.onteardown = async () => ({});
await app.connect();
onContext(app.getHostContext() ?? {});
const progress = (args) => app.callServerTool({ name: "spare_cycles_progress", arguments: args });
let saveTimer;
window.SpareCycles.persist = (data) => { clearTimeout(saveTimer); saveTimer = setTimeout(() => progress({ data }).catch(console.error), 400); };
progress({}).then((r) => window.SpareCycles.load(r.structuredContent?.data ?? {})).catch(console.error);
</script>`;
}

// Inline engine.js and the bridge so the page is one self-contained document.
function page({ mcp }) {
  return read("./games.html")
    .replace('<script src="engine.js"></script>', () => `<script>${read("./engine.js")}</script>`)
    .replace("<!-- mcp-bridge -->", () => (mcp ? bridge() : ""));
}

function createServer() {
  const server = new McpServer({ name: "spare-cycles", version });
  registerAppTool(server, "play_spare_cycles", {
    title: "Spare Cycles: attention games",
    description:
      "Opens three short attention-training games the user can play while waiting for a response: " +
      "Comet Watch (speed of processing), Lantern Glide (tracking + react multitasking) and Switchboard (task switching). " +
      "Call when the user asks for a game, a break, or something to do while waiting.",
    inputSchema: z.object({ game: z.enum(GAMES).optional().describe("Game to open directly (flash = Comet Watch, track = Lantern Glide, flip = Switchboard); omit to open the brain map lab") }),
    _meta: { ui: { resourceUri: URI } },
  }, async ({ game }) => ({
    content: [{ type: "text", text: `Opened Spare Cycles${game ? ` (${game})` : ""}. The games run in the panel; nothing to do here.` }],
  }));
  // App-only: the game loads and saves its levels; the model never sees this tool.
  registerAppTool(server, "spare_cycles_progress", {
    title: "Spare Cycles progress",
    description: "Loads saved game progress, or saves it when `data` is given.",
    inputSchema: z.object({ data: z.record(z.string(), z.unknown()).optional() }),
    outputSchema: z.object({ data: z.record(z.string(), z.unknown()) }),
    _meta: { ui: { visibility: ["app"] } },
  }, async ({ data }) => {
    if (data) {
      if (JSON.stringify(data).length > 256 * 1024) throw new Error("Progress too large");
      saveProgress(data);
    }
    const stored = data ?? loadProgress();
    return { content: [{ type: "text", text: data ? "Progress saved" : "Progress loaded" }], structuredContent: { data: stored } };
  });
  registerAppResource(server, URI, URI, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
    contents: [{ uri: URI, mimeType: RESOURCE_MIME_TYPE, text: page({ mcp: true }) }],
  }));
  return server;
}

if (process.argv.includes("--stdio")) {
  await createServer().connect(new StdioServerTransport());
} else {
  const port = Number(process.env.PORT ?? 3001);
  createHttpServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
    if (req.method === "OPTIONS") return res.writeHead(204).end();
    if (req.url === "/" || req.url === "/index.html") {
      return res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(page({ mcp: false }));
    }
    if (!req.url.startsWith("/mcp")) return res.writeHead(404).end("Not found");

    // Stateless: a fresh server and transport per request.
    let body;
    if (req.method === "POST") {
      const chunks = []; for await (const c of req) chunks.push(c);
      try { body = JSON.parse(Buffer.concat(chunks).toString() || "null"); }
      catch { return res.writeHead(400).end("Invalid JSON"); }
    }
    const server = createServer();
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) res.writeHead(500).end();
    }
  }).listen(port, () => console.log(`Spare Cycles: play at http://localhost:${port}/  ·  MCP endpoint http://localhost:${port}/mcp`));
}
