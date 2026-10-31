// Spare Cycles in a pane: the three games drawn in text cells. This surface
// module runs on the app's drawing thread, so play continues while the model
// works and nothing reaches the conversation. It has no DOM or canvas, so these
// are cell ports of the web games, with the same adaptive rules and levels.

type Hist = number[]
export type Progress = {
  comet: { level: number; ms: number; best: number | null; hist: Hist }
  glide: { drive: number; sign: number; stars: number; hist: Hist }
  board: { level: number; deadline: number; acc: number; hist: Hist }
}
export const freshProgress = (): Progress => ({
  comet: { level: 0, ms: 500, best: null, hist: [] },
  glide: { drive: 40, sign: 40, stars: 0, hist: [] },
  board: { level: 0, deadline: 2500, acc: 0, hist: [] },
})

const TICK = 33
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]!

// ---- adaptive rules (same as engine.js in the web version) ----------------------
type Stair = { value: number; min: number; max: number; down: number; factor: number; streak: number; dir: number; reversals: number[] }
const stair = (value: number, min: number, max: number, down: number, factor: number): Stair =>
  ({ value, min, max, down, factor, streak: 0, dir: 0, reversals: [] })
function step(s: Stair, correct: boolean) {
  let dir = 0
  if (!correct) { s.streak = 0; dir = 1 } else if (++s.streak >= s.down) { s.streak = 0; dir = -1 }
  if (!dir) return
  if (s.dir && dir !== s.dir) s.reversals.push(s.value)
  s.dir = dir
  s.value = clamp(dir < 0 ? s.value * s.factor : s.value / s.factor, s.min, s.max)
}
function threshold(s: Stair) {
  const r = s.reversals.slice(-5)
  return r.length ? r.reduce((a, b) => a + b, 0) / r.length : s.value
}
function blockChange(acc: number, perLevel: number) { // Anguera et al. 2013: toward 80%
  const d = clamp(acc - 0.8, -0.25, 0.2)
  return Math.abs(d) <= 0.025 ? 0 : Math.round(d / perLevel)
}
const pushHist = (h: Hist, v: number) => [...h, Math.round(v)].slice(-12)

// ---- level tables -----------------------------------------------------------------
export const COMET_LEVELS = [
  { ring: -1, dis: 0, pair: ['★', '●'] }, { ring: 0, dis: 0, pair: ['★', '●'] }, { ring: 1, dis: 0, pair: ['★', '●'] }, { ring: 2, dis: 0, pair: ['★', '●'] },
  { ring: 1, dis: 7, pair: ['★', '✦'] }, { ring: 2, dis: 15, pair: ['★', '✦'] }, { ring: 2, dis: 23, pair: ['✦', '✧'] }, { ring: 2, dis: 23, pair: ['✧', '◇'] },
]
const COMET_UP = 110
const COMET_TRIALS = 20
const GLIDE_STAGES = 6
const LURES = [
  [['●', 'cyan'], ['■', 'red'], ['●', 'red'], ['■', 'cyan']],
  [['●', 'yellow'], ['■', 'yellow']],
  [['◆', 'cyan'], ['◆', 'red']],
]
export const BOARD_LEVELS = [
  { p: 0.2, cti: 500, flank: 0 }, { p: 0.35, cti: 300, flank: 0 }, { p: 0.5, cti: 150, flank: 0 },
  { p: 0.5, cti: 0, flank: 0 }, { p: 0.5, cti: 150, flank: 0.5 }, { p: 0.5, cti: 0, flank: 0.5 },
]
const DIGITS = [1, 2, 3, 4, 6, 7, 8, 9]
const keyFor = (rule: string, d: number) => (rule === 'parity' ? (d % 2 ? 'left' : 'right') : d < 5 ? 'left' : 'right')
const glideStage = (stars: number) => Math.min(GLIDE_STAGES - 1, Math.floor(stars / 2))

// ---- app state ----------------------------------------------------------------------
type Comet = { kind: 'comet'; s: Stair; trial: number; correct: number; phase: 'fix' | 'show' | 'mask' | 'spot' | 'same' | 'fb'; left: number; a: string; b: string; k: number; others: [number, number][]; spotOk: boolean; ok: boolean }
type Glide = { kind: 'glide'; t: number; w: number; speed: number; windowMs: number; gx: number; gy: number; tx: number | null; ty: number | null; inside: number; frames: number; hits: number; cr: number; signs: number; next: number; pool: string[][]; spark: null | { target: boolean; ch: string; color: string; x: number; y: number; age: number; hit: boolean; fa: boolean }; press: boolean }
type Board = { kind: 'board'; s: Stair; t: number; rule: string; switched: boolean; d: number; flank: number | null; phase: 'cue' | 'stim' | 'fb'; left: number; rt: number; score: number; n: number; ok: boolean; said: string | null; repeat: number[]; sw: number[] }
type Result = { kind: 'result'; game: 'comet' | 'glide' | 'board'; lines: string[] }
type Hub = { kind: 'hub' }
export type App = { p: Progress; v: Hub | Comet | Glide | Board | Result; w: number; h: number; post: (p: Progress) => void }

export function makeApp(p: Progress, post: (p: Progress) => void): App { return { p, v: { kind: 'hub' }, w: 44, h: 16, post } }

const ringPos = (a: App, ring: number, k: number): [number, number] => {
  const rx = (a.w / 2 - 3) * (ring + 1) / 3, ry = (a.h / 2 - 1.5) * (ring + 1) / 3, t = (k * Math.PI) / 4
  return [Math.round(a.w / 2 + rx * Math.cos(t)), Math.round(a.h / 2 + ry * Math.sin(t))]
}
const ringAt = (a: App, w: number): [number, number] => [
  a.w / 2 + (a.w / 2 - 7) * (0.84 * Math.sin(w * 0.0031) + 0.16 * Math.sin(w * 0.0097 + 2)),
  a.h / 2 + (a.h / 2 - 3) * (0.77 * Math.sin(w * 0.0043 + 1) + 0.23 * Math.sin(w * 0.0121)),
]
const inRing = (x: number, y: number, rx: number, ry: number) => ((x - rx) / 6) ** 2 + ((y - ry) / 3) ** 2 < 1

// ---- starting games --------------------------------------------------------------
function nextCometTrial(a: App, g: Comet) {
  const L = COMET_LEVELS[a.p.comet.level]!
  const same = Math.random() < 0.5
  g.a = pick(L.pair); g.b = same ? g.a : L.pair[0] === g.a ? L.pair[1]! : L.pair[0]!
  g.k = Math.floor(Math.random() * 8)
  const free: [number, number][] = []
  for (let r = 0; r < 3; r++) for (let j = 0; j < 8; j++) if (!(r === L.ring && j === g.k)) free.push([r, j])
  for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [free[i], free[j]] = [free[j]!, free[i]!] }
  g.others = free.slice(0, L.dis)
  g.trial++; g.phase = 'fix'; g.left = 450; g.spotOk = true
}
export function start(a: App, game: 'comet' | 'glide' | 'board') {
  if (game === 'comet') {
    const g: Comet = { kind: 'comet', s: stair(a.p.comet.ms, TICK, 500, 2, 0.8), trial: 0, correct: 0, phase: 'fix', left: 0, a: '', b: '', k: 0, others: [], spotOk: true, ok: false }
    a.v = g; nextCometTrial(a, g)
  } else if (game === 'glide') {
    const q = a.p.glide, [gx, gy] = ringAt(a, 0)
    a.v = { kind: 'glide', t: 0, w: 0, speed: 60 + 2.5 * q.drive, windowMs: clamp(1100 - 7 * q.sign, 300, 1100), gx, gy, tx: null, ty: null, inside: 0, frames: 0, hits: 0, cr: 0, signs: 0, next: 1500, pool: LURES.slice(0, glideStage(q.stars) < 2 ? 1 : glideStage(q.stars) < 4 ? 2 : 3).flat(), spark: null, press: false }
  } else {
    const g: Board = { kind: 'board', s: stair(a.p.board.deadline, 450, 4000, 3, 0.9), t: 0, rule: pick(['parity', 'magnitude']), switched: false, d: 1, flank: null, phase: 'cue', left: 0, rt: 0, score: 0, n: 0, ok: false, said: null, repeat: [], sw: [] }
    a.v = g; nextBoardTrial(a, g)
  }
}
function nextBoardTrial(a: App, g: Board) {
  const L = BOARD_LEVELS[a.p.board.level]!
  g.switched = Math.random() < L.p
  if (g.switched) g.rule = g.rule === 'parity' ? 'magnitude' : 'parity'
  g.d = pick(DIGITS)
  g.flank = Math.random() < L.flank ? pick(DIGITS.filter(x => keyFor(g.rule, x) !== keyFor(g.rule, g.d))) : null
  g.said = null
  if (L.cti) { g.phase = 'cue'; g.left = L.cti } else beginStim(g)
}
function beginStim(g: Board) { g.phase = 'stim'; g.left = g.s.value; g.rt = 0 }

// ---- finishing ----------------------------------------------------------------------
function finishComet(a: App, g: Comet) {
  const thr = threshold(g.s), q = a.p.comet, up = thr <= COMET_UP && q.level < COMET_LEVELS.length - 1
  a.p.comet = { level: q.level + (up ? 1 : 0), ms: up ? Math.min(500, thr * 3) : g.s.value, best: up ? null : Math.min(q.best ?? Infinity, thr), hist: pushHist(q.hist, thr) }
  a.v = { kind: 'result', game: 'comet', lines: [`Flash threshold ${Math.round(thr)} ms · ${g.correct}/${COMET_TRIALS} correct`, up ? `Level ${q.level + 2} unlocked` : `Clear the level at ${COMET_UP} ms or less`] }
  a.post(a.p)
}
function finishGlide(a: App, g: Glide) {
  const q = a.p.glide, tr = g.inside / Math.max(1, g.frames), sg = g.signs ? (g.hits + g.cr) / g.signs : 1, both = tr >= 0.8 && sg >= 0.8
  const next = { drive: clamp(q.drive + blockChange(tr, 0.0058), 0, 200), sign: clamp(q.sign + blockChange(sg, 0.0175), 0, 114), stars: q.stars + (both ? 1 : 0) }
  const up = glideStage(next.stars) > glideStage(q.stars)
  a.p.glide = { ...next, hist: pushHist(q.hist, next.drive + next.sign) }
  a.v = { kind: 'result', game: 'glide', lines: [`In the light ${Math.round(tr * 100)}% · sparks ${Math.round(sg * 100)}% (${g.signs} shown)`, up ? `Stage ${glideStage(next.stars) + 1} unlocked` : both ? 'Both at 80%. One more clears the stage' : 'Both tasks retune toward 80%'] }
  a.post(a.p)
}
const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length
function finishBoard(a: App, g: Board) {
  const q = a.p.board, acc = g.n ? g.score / g.n : 0, cost = g.sw.length && g.repeat.length ? Math.round(mean(g.sw) - mean(g.repeat)) : null
  const up = acc >= 0.8 && g.n >= 12 && q.level < BOARD_LEVELS.length - 1
  a.p.board = { level: q.level + (up ? 1 : 0), deadline: up ? Math.min(4000, g.s.value * 1.3) : g.s.value, acc: up ? 0 : acc, hist: cost == null ? q.hist : pushHist(q.hist, cost) }
  a.v = { kind: 'result', game: 'board', lines: [`Score ${g.score} of ${g.n} (${Math.round(acc * 100)}%) · switch cost ${cost == null ? '–' : cost + ' ms'}`, up ? `Level ${q.level + 2} unlocked` : 'Clear the level with 80% correct'] }
  a.post(a.p)
}

// ---- input --------------------------------------------------------------------------
export function key(a: App, k: string): boolean {
  const v = a.v
  if (k === 'b' && v.kind !== 'hub') { a.v = { kind: 'hub' }; return true }
  if (v.kind === 'hub') {
    if (k === '1') start(a, 'comet'); else if (k === '2') start(a, 'glide'); else if (k === '3') start(a, 'board'); else return false
    return true
  }
  if (v.kind === 'result') { if (k === 'return' || k === ' ') { start(a, v.game); return true } return false }
  if (v.kind === 'comet') {
    if (v.phase === 'spot' && /^[1-8]$/.test(k)) { answerSpot(a, v, Number(k) - 1); return true }
    if (v.phase === 'same') {
      if (k === 'left' || k === 's') answerSame(v, true); else if (k === 'right' || k === 'd') answerSame(v, false); else return false
      return true
    }
    return false
  }
  if (v.kind === 'glide') {
    if (k === ' ') { v.press = true; return true }
    const dx = k === 'left' ? -2 : k === 'right' ? 2 : 0, dy = k === 'up' ? -1 : k === 'down' ? 1 : 0
    if (dx || dy) { v.gx = clamp(v.gx + dx, 0, a.w - 1); v.gy = clamp(v.gy + dy, 0, a.h - 1); v.tx = v.ty = null; return true }
    return false
  }
  if (v.kind === 'board' && v.phase === 'stim' && (k === 'left' || k === 'right')) { answerBoard(v, k); return true }
  return false
}
function answerSpot(a: App, g: Comet, spot: number) { g.spotOk = spot === g.k; g.phase = 'same' }
function answerSame(g: Comet, same: boolean) {
  g.ok = g.spotOk && same === (g.a === g.b)
  step(g.s, g.ok); if (g.ok) g.correct++
  g.phase = 'fb'; g.left = 300
}
function answerBoard(g: Board, said: string | null) {
  g.said = said; g.ok = said === keyFor(g.rule, g.d); g.n++
  if (g.ok) { g.score++; (g.switched ? g.sw : g.repeat).push(g.rt) }
  step(g.s, g.ok); g.phase = 'fb'; g.left = 250
}
export function pointer(a: App, type: string, x: number, y: number): boolean {
  const v = a.v
  if (v.kind === 'glide') { if (type === 'move' || type === 'down') { v.tx = x; v.ty = y; return false } return false }
  if (type !== 'down') return false
  if (v.kind === 'hub') { const row = Math.floor(y / 4); if (row >= 0 && row < 3) { start(a, (['comet', 'glide', 'board'] as const)[row]!); return true } return false }
  if (v.kind === 'result') { start(a, v.game); return true }
  if (v.kind === 'comet') {
    if (v.phase === 'spot') {
      const L = COMET_LEVELS[a.p.comet.level]!; let best = 0, dist = Infinity
      for (let j = 0; j < 8; j++) { const [px, py] = ringPos(a, L.ring, j), d = ((x - px) / 2) ** 2 + (y - py) ** 2; if (d < dist) { dist = d; best = j } }
      answerSpot(a, v, best); return true
    }
    if (v.phase === 'same') { answerSame(v, x < a.w / 2); return true }
    return false
  }
  if (v.kind === 'board' && v.phase === 'stim') { answerBoard(v, x < a.w / 2 ? 'left' : 'right'); return true }
  return false
}

// ---- clock -----------------------------------------------------------------------------
export function tick(a: App, dt: number): boolean {
  const v = a.v
  if (v.kind === 'comet') {
    if (v.phase === 'spot' || v.phase === 'same') return false
    v.left -= dt
    if (v.left > 0) return false
    const L = COMET_LEVELS[a.p.comet.level]!
    if (v.phase === 'fix') { v.phase = 'show'; v.left = v.s.value }
    else if (v.phase === 'show') { v.phase = 'mask'; v.left = 400 }
    else if (v.phase === 'mask') v.phase = L.ring >= 0 ? 'spot' : 'same'
    else if (v.trial >= COMET_TRIALS) finishComet(a, v)
    else nextCometTrial(a, v)
    return true
  }
  if (v.kind === 'glide') {
    v.t += dt; v.w += (v.speed * dt) / 1000
    if (v.tx != null && v.ty != null) { // the pointer pulls the glider at a capped speed
      const dx = v.tx - v.gx, dy = (v.ty - v.gy) * 2, d = Math.hypot(dx, dy), m = (40 * dt) / 1000
      if (d > 0.5) { v.gx += (dx / d) * Math.min(m, d); v.gy += ((dy / d) * Math.min(m, d)) / 2 }
    }
    const [rx, ry] = ringAt(a, v.w); v.frames++; if (inRing(v.gx, v.gy, rx, ry)) v.inside++
    v.next -= dt
    if (!v.spark && v.next <= 0) {
      const target = Math.random() < 1 / 3, lure = pick(v.pool)
      v.spark = { target, ch: target ? '◆' : lure[0]!, color: target ? 'yellow' : lure[1]!, x: Math.floor(Math.random() * (a.w - 4)) + 2, y: Math.floor(Math.random() * (a.h - 2)) + 1, age: 0, hit: false, fa: false }
      v.next = 2000 + Math.random() * 1000
    }
    if (v.spark) {
      const s = v.spark; s.age += dt
      if (v.press) { if (s.target) s.hit = s.hit || s.age <= v.windowMs; else s.fa = true }
      if (s.age > Math.max(v.windowMs, 400)) { v.signs++; if (s.target ? s.hit : !s.fa) { if (s.target) v.hits++; else v.cr++ } v.spark = null }
    }
    v.press = false
    if (v.t >= 30000) finishGlide(a, v)
    return true
  }
  if (v.kind === 'board') {
    v.t += dt
    if (v.phase === 'stim') {
      v.rt += dt; v.left -= dt
      if (v.left <= 0) answerBoard(v, null)
      return true
    }
    v.left -= dt
    if (v.left > 0) return false
    if (v.phase === 'cue') beginStim(v)
    else if (v.t >= 45000) finishBoard(a, v)
    else nextBoardTrial(a, v)
    return true
  }
  return false
}

// ---- drawing: a row is a list of [text, colour?] runs -------------------------------
type Run = [string, string?, boolean?]
const SPARK = '▁▂▃▄▅▆▇█'
function trend(h: Hist, lower: boolean) {
  if (h.length < 2) return ''
  const lo = Math.min(...h), hi = Math.max(...h), span = hi - lo || 1
  return h.map(v => SPARK[Math.round(((lower ? hi - v : v - lo) / span) * 7)]).join('')
}
function meter(n: number, level: number, frac: number) {
  let s = ''
  for (let i = 0; i < n; i++) s += i < level ? '█' : i === level ? (frac >= 0.5 ? '▓' : frac > 0 ? '▒' : '░') : '░'
  return s
}
class Grid {
  w: number
  h: number
  cells: { ch: string; color?: string }[][]
  constructor(w: number, h: number) { this.w = w; this.h = h; this.cells = Array.from({ length: h }, () => Array.from({ length: w }, () => ({ ch: ' ' }))) }
  put(x: number, y: number, s: string, color?: string) { x = Math.round(x); y = Math.round(y); if (y < 0 || y >= this.h) return; [...s].forEach((ch, i) => { const c = this.cells[y]![x + i]; if (c) { c.ch = ch; c.color = color } }) }
  center(y: number, s: string, color?: string) { this.put(Math.floor((this.w - [...s].length) / 2), y, s, color) }
  rows(): Run[][] {
    return this.cells.map(row => {
      const runs: Run[] = []
      for (const c of row) { const last = runs[runs.length - 1]; if (last && last[1] === c.color) last[0] += c.ch; else runs.push([c.ch, c.color]) }
      return runs
    })
  }
}
export function view(a: App): Run[][] {
  const v = a.v, W = a.w
  if (v.kind === 'hub') {
    const c = a.p.comet, g = a.p.glide, b = a.p.board, st = glideStage(g.stars)
    const row = (n: string, name: string, color: string, lv: string, m: string, score: string, tr: string, about: string): Run[][] => [
      [[`${n} `, 'gray'], [name, color, true], [`  ${lv}  `, 'gray'], [m, color]],
      [['  ', undefined], [score, undefined, true], [tr ? `  ${tr}` : '', color]],
      [[`  ${about}`, 'gray']],
      [['', undefined]],
    ]
    return [
      [['Press 1, 2 or 3, or click a game · b goes back', 'gray']],
      ...row('1', 'Comet Watch', 'cyan', `Level ${c.level + 1}/${COMET_LEVELS.length}`, meter(COMET_LEVELS.length, c.level, c.best == null ? 0 : (500 - c.best) / (500 - COMET_UP)), c.hist.length ? `Flash threshold ${c.hist.at(-1)} ms` : 'Not played yet', trend(c.hist, true), 'Visual attention and processing speed. About 1 min'),
      ...row('2', 'Lantern Glide', 'magenta', `Stage ${st + 1}/${GLIDE_STAGES}`, meter(GLIDE_STAGES, st, (g.stars % 2) / 2), g.hist.length ? `Multitask level ${g.hist.at(-1)}` : 'Not played yet', trend(g.hist, false), 'Tracking while holding back. 30 s'),
      ...row('3', 'Switchboard', 'green', `Level ${b.level + 1}/${BOARD_LEVELS.length}`, meter(BOARD_LEVELS.length, b.level, clamp(b.acc / 0.8, 0, 1)), b.hist.length ? `Switch cost ${b.hist.at(-1)} ms` : 'Not played yet', trend(b.hist, true), 'Switching between rules. 45 s'),
    ]
  }
  if (v.kind === 'result') {
    const name = v.game === 'comet' ? 'Comet Watch' : v.game === 'glide' ? 'Lantern Glide' : 'Switchboard'
    return [[[name, undefined, true]], [['', undefined]], [[v.lines[0]!, undefined]], [[v.lines[1]!, 'gray']], [['', undefined]], [['Enter or click plays again · b goes back', 'gray']]]
  }
  const g = new Grid(W, a.h)
  if (v.kind === 'comet') {
    const L = COMET_LEVELS[a.p.comet.level]!, cx = W / 2, cy = Math.floor(a.h / 2)
    const head: Run[] = [[`Comet Watch · trial ${v.trial}/${COMET_TRIALS} · flash ${Math.round(v.s.value)} ms`, 'gray']]
    if (v.phase === 'fix') g.put(cx, cy, '+', 'gray')
    if (v.phase === 'show') {
      g.put(cx - 3, cy, v.a); g.put(cx + 3, cy, v.b)
      for (const [r, j] of v.others) { const [x, y] = ringPos(a, r, j); g.put(x, y, '○', 'cyan') }
      if (L.ring >= 0) { const [x, y] = ringPos(a, L.ring, v.k); g.put(x, y, '◉', 'cyan'); g.put(x - 1, y, '~', 'cyan') }
    }
    if (v.phase === 'mask') for (let i = 0; i < g.h; i++) for (let j = 0; j < W; j++) if (Math.random() < 0.28) g.put(j, i, pick(['░', '▒', '▓', '×']), 'gray')
    if (v.phase === 'spot') {
      g.center(cy, 'Where was the comet? 1-8 or click', 'gray')
      for (let j = 0; j < 8; j++) { const [x, y] = ringPos(a, L.ring, j); g.put(x, y, String(j + 1), 'cyan') }
    }
    if (v.phase === 'same') { g.center(cy - 1, 'Were the two centre glyphs the same?', 'gray'); g.center(cy + 1, '← same     different →') }
    if (v.phase === 'fb') g.center(cy, v.ok ? '✓' : '✗', v.ok ? 'green' : 'red')
    return [head, ...g.rows()]
  }
  if (v.kind === 'glide') {
    const [rx, ry] = ringAt(a, v.w), ok = inRing(v.gx, v.gy, rx, ry)
    for (let y = 0; y < a.h; y++) for (let x = 0; x < W; x++) if (inRing(x, y, rx, ry)) g.put(x, y, '░', 'gray')
    if (v.spark && v.spark.age < 400) g.put(v.spark.x, v.spark.y, v.spark.ch, v.spark.color)
    g.put(v.gx, v.gy, '●', ok ? 'magenta' : 'red')
    return [[[`Lantern Glide · ${Math.ceil((30000 - v.t) / 1000)} s · stay in the light · Space for `, 'gray'], ['◆', 'yellow']], ...g.rows()]
  }
  const L = BOARD_LEVELS[a.p.board.level]!, parity = v.rule === 'parity', color = parity ? 'green' : 'yellow', cy = Math.floor(a.h / 2)
  const head: Run[] = [[`Switchboard · ${Math.max(0, Math.ceil((45000 - v.t) / 1000))} s · score ${v.score} · ${(v.s.value / 1000).toFixed(2)} s per answer`, 'gray']]
  if (v.phase === 'fb') g.center(cy, v.ok ? '✓' : v.said ? '✗' : 'too slow', v.ok ? 'green' : 'red')
  else {
    g.center(cy - 3, parity ? '← odd  ·  even →' : '← below 5  ·  above 5 →', color)
    g.center(cy - 2, '┌───────────────┐', color); g.center(cy - 1, '│               │', color); g.center(cy, '│               │', color); g.center(cy + 1, '│               │', color); g.center(cy + 2, '└───────────────┘', color)
    if (v.phase === 'stim') {
      if (v.flank != null && L.flank) { g.put(W / 2 - 5, cy, String(v.flank), 'gray'); g.put(W / 2 + 5, cy, String(v.flank), 'gray') }
      g.put(Math.floor(W / 2), cy, String(v.d))
      const bar = Math.round((clamp(v.left / v.s.value, 0, 1)) * 15); g.center(cy + 3, '▬'.repeat(bar), 'gray')
    }
  }
  return [head, ...g.rows()]
}

// ---- the surface module -----------------------------------------------------------------
type S = { app: App; n: number }
export default function Games(props: { progress?: Progress; mono?: boolean }, surface: any) {
  let app: App | undefined = surface.state?.app
  if (!app) {
    const a = makeApp(props?.progress ?? freshProgress(), p => surface.post(JSON.parse(JSON.stringify(p))))
    app = a
    let n = 0
    const redraw = () => surface.setState({ app: a, n: ++n } satisfies S)
    surface.every(TICK, () => { if (tick(a, TICK)) redraw() })
    surface.onKey((e: { key: string }) => { if (key(a, e.key)) redraw() })
    surface.onPointer((e: { type: string; x: number; y: number }) => { if (pointer(a, e.type, e.x, e.y - 1)) redraw() })
    redraw()
  }
  if (surface.columns > 0) app.w = Math.max(30, surface.columns)
  if (surface.rows > 2) app.h = Math.max(12, Math.min(22, surface.rows - 1))
  const { Box, Text } = surface.elements
  // The grid needs a fixed-width face: terminals always have one, the desktop asks for it.
  const face = props?.mono ? { mono: true } : {}
  return Box({
    flexDirection: 'column',
    children: view(app).map(row =>
      Text({ ...face, children: row.map(([text, color, bold]) => (color || bold ? Text({ ...face, ...(color ? { color } : {}), ...(bold ? { weight: 'bold' } : {}), children: text }) : text)) }),
    ),
  })
}
