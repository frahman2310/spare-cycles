# Spare Cycles

[![test](https://github.com/frahman2310/spare-cycles/actions/workflows/test.yml/badge.svg)](https://github.com/frahman2310/spare-cycles/actions/workflows/test.yml)

Three short attention games you can play inside Claude, ChatGPT, Cursor or VS Code while the AI works. They run as an [MCP App](https://github.com/modelcontextprotocol/ext-apps): ask your assistant for "a game while I wait" and they open inline in the chat. Where the host supports it, you can pop them out or open them fullscreen.

**Play in your browser:** [frahman2310.github.io/spare-cycles](https://frahman2310.github.io/spare-cycles/). Nothing to install; progress stays in your browser.

**In Claude Code:** install the plugin for a side pane in every chat. Click **Spare Cycles** above the prompt, or run `/spare-cycles`, and play while Claude keeps working. Nothing is sent to the model and the session isn't interrupted.

![Spare Cycles brain map lab: a brain map with Comet Watch's regions highlighted, next to three games with level meters, score readouts and trends](docs/hub-light.png)

<p>
  <img src="docs/switchboard-dark.png" alt="Switchboard mid-trial in dark mode: an amber panel asks below or above 5 for the digit 9" width="66%">
  <img src="docs/hub-phone-dark.png" alt="The lab at phone width in dark mode" width="30%">
</p>

<sub>Screenshots show example progress data.</sub>

## The games

| Game | What you do | What adapts | Research basis |
|---|---|---|---|
| **Comet Watch** | Two star glyphs flash in the centre while a comet streaks past. Click where the comet was, then say whether the glyphs were the same or different. | Flash time (500 → 17 ms), using a 2-down-1-up staircase. Levels widen the comet ring, add tail-less look-alike stars, then make "different" glyphs differ by a single point. | Useful field of view research (Ball et al. 1988), the paradigm behind the speed arm of the NIH ACTIVE trial |
| **Lantern Glide** | Keep your glider inside a drifting ring of light while catching only gold diamond sparks. | After each 30 s run, ring speed and the catch window both retune toward 80% accuracy. Stages make lures more target-like. | Pursuit tracking plus go/no-go dual-task research. The adaptive rule follows Anguera et al., *Nature* 2013 |
| **Switchboard** | Sort each digit with ← or →. A green panel means odd/even; an amber panel means below/above 5. | Answer deadline, using a 3-down-1-up staircase (~79%). Levels raise the switch rate, shorten preparation time, and add conflicting flanker digits. | Parity/magnitude task switching (Sudevan & Taylor 1987; Rogers & Monsell 1995) |

All three are original designs. They use long-published research paradigms and are not copies of any commercial product.

## The brain map lab

The hub is a brain map lab:
- a side-view brain map shows the regions each task engages in imaging studies (approximate, with inner and deep regions drawn dashed);
- each game card has a level track (Comet Watch 8 levels; Lantern Glide 6 lure-similarity stages; Switchboard 6 levels of switch rate, preparation time and flanker conflict) and a trend line of your score;
- "Brain notes" on each card separate what the task *engages*, what *training studies found* (with dose), and what is *not established*. Every claim links to its source.

Hosts run the game in a sandbox without browser storage, so the game saves levels and history through the MCP server to `~/.spare-cycles/progress.json` (set `SPARE_CYCLES_DATA` to change the location). The save tool is app-only, so the AI model never sees it. In a plain browser, progress is stored locally.

## The science

Each game is a short, simplified version of a long-studied research task. The in-app brain notes cite every claim; the main sources are below.

| Game | Engages (imaging studies) | What training studies found | Not established |
|---|---|---|---|
| Comet Watch | Frontoparietal control, cingulo-opercular and dorsal attention networks during the UFOV task ([Kraft et al. 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9886714)) | In the ACTIVE trial, ~10 hours of speed training in adults 65+ left speed gains measurable at 10 years ([Rebok et al. 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4055506/)). With booster sessions it was linked to fewer dementia diagnoses over 20 years (HR 0.75; [Coe et al. 2026](https://doi.org/10.1002/trc2.70197)) | That minutes of casual play change brain structure or chemistry |
| Lantern Glide | Intraparietal sulcus, dorsal premotor cortex and anterior insula in dual-tasking ([Worringer et al. 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC7254756)); pre-SMA and right inferior frontal gyrus when holding back | 12 hours of a steer-and-react game (NeuroRacer) cut multitasking cost in older adults from 64% to 16% and raised midline frontal theta ([Anguera et al. 2013](https://pmc.ncbi.nlm.nih.gov/articles/PMC3983066/)) | A randomised replication with a brain measure |
| Switchboard | Inferior frontal junction and posterior parietal cortex across 36 switching studies ([Kim et al. 2012](https://research.knu.ac.kr/en/publications/domain-general-and-domain-preferential-brain-regions-associated-w/)) | Practice shrinks switch costs on similar tasks ([Karbach & Kray 2009](https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1467-7687.2009.00846.x)); in older adults, far transfer showed up mainly against passive controls ([Karbach & Verhaeghen 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4381540)) | Broad benefits beyond switching tasks |

People reliably improve at what they practise. Evidence that brain games improve everyday life is weak ([Simons et al. 2016](https://journals.sagepub.com/doi/10.1177/1529100616661983)), and the studies above used hours of training over weeks, not short breaks.

## Install

### Side pane in Claude Code

This is the best fit for playing mid-session. At the prompt of a terminal session:

```text
/plugin install spare-cycles --marketplace frahman2310/spare-cycles
```

In the desktop app, click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `frahman2310/spare-cycles`, then **Add plugin**. It loads in new sessions.

The pane draws the games in text cells, because a pane can't host a web page. It has the same adaptive rules and levels as the web version, with a coarser exposure floor in Comet Watch (one 33 ms tick). Levels and history are saved across sessions, separately from the web and MCP versions.

### MCP App in Claude Desktop, ChatGPT, Cursor or VS Code

These open in the chat when you ask for them. You need Node 20+.

```bash
git clone https://github.com/frahman2310/spare-cycles.git
```

```bash
cd spare-cycles && npm install
```

In the configs below, replace `/absolute/path/to/spare-cycles` with where you cloned it. If your MCP host can't find `node`, use the full path from `which node`.

**Claude Desktop**: add this to `claude_desktop_config.json`:
```json
{ "mcpServers": { "spare-cycles": { "command": "node", "args": ["/absolute/path/to/spare-cycles/server.js", "--stdio"] } } }
```

**Cursor** (2.6+): add the same block to `~/.cursor/mcp.json`. A Cursor forum thread reports that MCP App views stopped rendering in 3.11.19 (they worked in 3.10.11).

**VS Code**: add this to `.vscode/mcp.json`:
```json
{ "servers": { "spare-cycles": { "type": "stdio", "command": "node", "args": ["/absolute/path/to/spare-cycles/server.js", "--stdio"] } } }
```

**ChatGPT and claude.ai (web)**: these need a public HTTPS URL. Run `npm start`, which serves MCP at `http://localhost:3001/mcp`. Expose that endpoint through a tunnel or a host, then add the URL as a custom connector (ChatGPT developer mode → Apps & Connectors; Claude → Settings → Connectors).

**Anywhere else, including terminal agents like Claude Code CLI**: run `npm start` and open `http://localhost:3001/` in a browser or your editor's browser panel.

Then ask: *"open spare cycles"* or *"give me a game while you work"*.

## Develop

Run `npm start`, then open `http://localhost:3001/` to play in a browser.

| File | What it is |
|---|---|
| `games.html` | The three games and the lab interface. Opens standalone in a browser |
| `engine.js` | Adaptive difficulty rules (staircases and the per-run block rule) |
| `server.js` | MCP server: serves the games as a `ui://` MCP App over stdio or HTTP, and saves progress |
| `scripts/build-page.mjs` | Builds the single-file web version that GitHub Pages serves (`npm run build`) |
| `plugin/` | The Claude Code side pane: `hooks/register.tsx` adds the button, command and pane; `hooks/games.ts` is the cell version of the games |
| `test.js` | Checks the adaptive rules converge where theory predicts, and smoke-tests the MCP server |

`server.js` inlines `engine.js` and the MCP Apps bridge into `games.html`, so hosts receive one self-contained page. Run `npm test` before opening a pull request; CI runs it on Node 20 and 22. `npm run test:plugin` (Node 22+) plays each pane game to the end with a simulated player, and `claude plugin test plugin` checks the hooks.

## Disclaimer

This is an independent project, not affiliated with Posit Science (BrainHQ), Akili, Lumos Labs or any other brain-training company. These are short, simplified versions of research tasks, made for breaks. They are not medical devices and have not been tested as treatments. Results from studies of the original programs don't carry over to them automatically.

## License

MIT. See [LICENSE](LICENSE).
