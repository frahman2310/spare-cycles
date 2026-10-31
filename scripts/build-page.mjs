// Builds the standalone web version (GitHub Pages): one HTML file with the
// engine inlined and the web fonts linked. Usage: node scripts/build-page.mjs [outDir]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Instrument+Sans:wght@500;600;700&display=swap">';
const html = read("games.html")
  .replace('<script src="engine.js"></script>', () => `<script>${read("engine.js")}</script>`)
  .replace("<!-- mcp-bridge -->\n", "")
  .replace("<title>Spare Cycles</title>", `<title>Spare Cycles</title>\n${FONTS}`);

const out = process.argv[2] ?? "dist";
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/index.html`, html);
console.log(`Built ${out}/index.html (${Math.round(html.length / 1024)} KB)`);
