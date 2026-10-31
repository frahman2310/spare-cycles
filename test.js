// node test.js — checks the adaptive rules converge where the literature says.
import assert from "node:assert/strict";
import "./engine.js";
const { staircase, stepStaircase, threshold, blockLevelChange } = globalThis.Engine;

// Simulated player: chance of a correct answer rises with display time.
// p(ms) = 0.5 + 0.5 * (1 - exp(-ms / 60)); p = 0.707 at ~32 ms, p = 0.794 at ~53 ms.
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const player = (ms) => rand() < 0.5 + 0.5 * (1 - Math.exp(-ms / 60));

function run(down) {
  const ests = [];
  for (let rep = 0; rep < 200; rep++) {
    const s = staircase({ value: 500, min: 17, max: 500, down });
    for (let t = 0; t < 120; t++) stepStaircase(s, player(s.value));
    ests.push(threshold(s, 8));
  }
  ests.sort((a, b) => a - b);
  return ests[100]; // median
}

const two = run(2), three = run(3);
assert.ok(two > 25 && two < 40, `2-down-1-up median ${two.toFixed(1)} ms, expected near 32`);
assert.ok(three > 44 && three < 62, `3-down-1-up median ${three.toFixed(1)} ms, expected near 53`);
assert.ok(three > two, "3-down-1-up must settle at a higher (easier) value");

// Bounds hold.
const s = staircase({ value: 20, min: 17, max: 500 });
for (let i = 0; i < 50; i++) stepStaircase(s, true);
assert.equal(s.value, 17);

// NeuroRacer block rule: 90% -> 6 levels harder (~40 ms at 7 ms/level),
// 80% -> no change, <=55% -> 14 levels easier (~100 ms).
assert.equal(blockLevelChange(0.9, 0.0175), 6);
assert.equal(blockLevelChange(0.81, 0.0175), 0);
assert.equal(blockLevelChange(0.55, 0.0175), -14);
assert.equal(blockLevelChange(0.1, 0.0175), -14);

console.log(`ok  2-down-1-up ≈ ${two.toFixed(0)} ms, 3-down-1-up ≈ ${three.toFixed(0)} ms`);

// MCP smoke test: the stdio server lists the tool, links it to the ui:// page,
// and serves one self-contained HTML document with the engine and bridge inlined.
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const client = new Client({ name: "test", version: "0" });
const dataFile = join(mkdtempSync(join(tmpdir(), "sc-")), "progress.json");
await client.connect(new StdioClientTransport({ command: process.execPath, args: ["server.js", "--stdio"], env: { ...process.env, SPARE_CYCLES_DATA: dataFile } }));
const { tools } = await client.listTools();
const tool = tools.find((t) => t.name === "play_spare_cycles");
assert.ok(tool, "tool registered");
const uri = tool._meta?.ui?.resourceUri;
assert.equal(uri, "ui://spare-cycles/games.html");
const called = await client.callTool({ name: "play_spare_cycles", arguments: { game: "track" } });
assert.match(called.content[0].text, /track/);
const { contents } = await client.readResource({ uri });
assert.equal(contents[0].mimeType, "text/html;profile=mcp-app");
const html = contents[0].text;
assert.ok(!html.includes('src="engine.js"') && html.includes("blockLevelChange"), "engine inlined");
assert.ok(!html.includes("<!-- mcp-bridge -->") && html.includes("const McpApps={") && !/export\s*\{[^}]*\}\s*;?\s*<\/script>/.test(html), "bridge inlined");
// Progress round-trips through the server and stays hidden from the model.
const prog = tools.find((t) => t.name === "spare_cycles_progress");
assert.deepEqual(prog?._meta?.ui?.visibility, ["app"]);
const saved = { flash: { level: 3, ms: 140, best: 120 }, "hist:flash": [{ t: 1, v: 120 }] };
await client.callTool({ name: "spare_cycles_progress", arguments: { data: saved } });
const loaded = await client.callTool({ name: "spare_cycles_progress", arguments: {} });
assert.deepEqual(loaded.structuredContent.data, saved);
await client.close();
console.log(`ok  MCP: tool + ${Math.round(html.length / 1024)} KB ui:// page`);

// Web build: one self-contained page with the engine inlined and no MCP bridge.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const buildDir = mkdtempSync(join(tmpdir(), "sc-build-"));
execFileSync(process.execPath, ["scripts/build-page.mjs", buildDir]);
const web = readFileSync(join(buildDir, "index.html"), "utf8");
assert.ok(web.includes("blockLevelChange") && !web.includes('src="engine.js"'), "web build inlines the engine");
assert.ok(!web.includes("McpApps") && web.includes("fonts.googleapis.com"), "web build has fonts and no MCP bridge");
console.log(`ok  web build: ${Math.round(web.length / 1024)} KB`);
