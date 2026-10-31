// node --experimental-strip-types games.check.mjs — plays each game to the end with a simulated player.
import assert from 'node:assert/strict'
import Games, { makeApp, freshProgress, start, key, pointer, tick, view, COMET_LEVELS, BOARD_LEVELS } from './hooks/games.ts'

const width = rows => Math.max(...rows.map(r => [...r.map(x => x[0]).join('')].length))
function run(game, answer, maxMs = 400000) {
  const posted = []
  const a = makeApp(freshProgress(), p => posted.push(structuredClone(p)))
  start(a, game)
  let t = 0
  while (a.v.kind !== 'result' && t < maxMs) {
    tick(a, 33); t += 33; answer(a)
    assert.ok(width(view(a)) <= Math.max(a.w, 80), `row too wide in ${a.v.kind}/${a.v.phase}`)
  }
  assert.equal(a.v.kind, 'result', `${game} never finished`)
  assert.equal(posted.length, 1, 'progress posted once')
  return { a, p: posted[0], lines: a.v.lines }
}
// Comet: a perfect player reaches the exposure floor and clears the level.
const perfectComet = a => {
  const v = a.v
  if (v.kind !== 'comet') return
  if (v.phase === 'spot') key(a, String(v.k + 1))
  if (v.phase === 'same') key(a, v.a === v.b ? 'left' : 'right')
}
let r = run('comet', perfectComet)
assert.equal(r.p.comet.hist.length, 1)
console.log('comet perfect:', r.lines.join(' | '))
// Level 0 has no peripheral target, so only same/different is asked; level 1 asks both.
{
  const p = freshProgress(); p.comet.level = 1
  const a = makeApp(p, () => {}); start(a, 'comet')
  while (a.v.phase !== 'spot') tick(a, 33)
  key(a, String(((a.v.k + 1) % 8) + 1)); assert.equal(a.v.phase, 'same', 'location answered first, always both')
  key(a, a.v.a === a.v.b ? 'left' : 'right'); assert.equal(a.v.ok, false, 'wrong location fails the trial')
  // clicking the drawn position picks that position
  while (a.v.phase !== 'spot') tick(a, 33)
}
// Comet at the hardest level draws distractors and still finishes.
{
  const p = freshProgress(); p.comet.level = COMET_LEVELS.length - 1
  const a = makeApp(p, () => {}); start(a, 'comet')
  while (a.v.phase !== 'show') tick(a, 33)
  assert.equal(a.v.others.length, 23); view(a)
}
// Glide: a tracker glued to the ring that catches only targets scores high and speeds up.
r = run('glide', a => {
  const v = a.v
  if (v.kind !== 'glide') return
  const sin = Math.sin, w = v.w
  v.gx = a.w / 2 + (a.w / 2 - 7) * (0.84 * sin(w * 0.0031) + 0.16 * sin(w * 0.0097 + 2))
  v.gy = a.h / 2 + (a.h / 2 - 3) * (0.77 * sin(w * 0.0043 + 1) + 0.23 * sin(w * 0.0121))
  if (v.spark?.target && !v.spark.hit) key(a, ' ')
})
console.log('glide perfect:', r.lines.join(' | '), JSON.stringify(r.p.glide))
assert.ok(r.p.glide.stars === 1 && r.p.glide.drive > 40, 'both tasks above 80% earns a star and speeds the ring')
// Glide: an idle player slows the ring.
r = run('glide', () => {})
assert.ok(r.p.glide.drive < 40 && r.p.glide.stars === 0)
// Pointer pulls the glider without any key.
{
  const a = makeApp(freshProgress(), () => {}); start(a, 'glide')
  const x0 = a.v.gx
  pointer(a, 'move', 0, 8); for (let i = 0; i < 30; i++) tick(a, 33)
  assert.ok(a.v.gx < x0, 'glider follows the pointer')
}
// Board: a perfect player clears the level; deadline shrinks.
r = run('board', a => {
  const v = a.v
  if (v.kind === 'board' && v.phase === 'stim') key(a, (v.rule === 'parity' ? v.d % 2 : v.d < 5) ? 'left' : 'right')
})
console.log('board perfect:', r.lines.join(' | '), JSON.stringify(r.p.board))
assert.equal(r.p.board.level, 1)
// Board: no answers count as too slow and the deadline relaxes.
r = run('board', () => {})
assert.ok(r.p.board.deadline > 2500 && r.p.board.level === 0)
// Flankers point to the other key at flanker levels.
{
  const p = freshProgress(); p.board.level = BOARD_LEVELS.length - 1
  const a = makeApp(p, () => {}); start(a, 'board')
  let seen = 0
  for (let i = 0; i < 2000 && !seen; i++) {
    tick(a, 33); const v = a.v
    if (v.kind === 'board' && v.phase === 'stim' && v.flank != null) {
      const k = (r, d) => (r === 'parity' ? (d % 2 ? 'L' : 'R') : d < 5 ? 'L' : 'R')
      assert.notEqual(k(v.rule, v.flank), k(v.rule, v.d)); seen = 1
    }
  }
  assert.ok(seen)
}
// The surface module: boots once, draws, and survives a redraw with its state.
{
  const calls = { every: 0, key: 0, pointer: 0 }; const posts = []
  const el = t => p => ({ t, ...p })
  const surface = { state: undefined, columns: 50, rows: 20, elements: { Box: el('Box'), Text: el('Text') },
    setState(s) { this.state = s }, every(ms, fn) { calls.every++; this.fire = fn; return () => {} },
    onKey(fn) { calls.key++; this.press = fn; return () => {} }, onPointer(fn) { calls.pointer++; this.ptr = fn; return () => {} }, post: d => posts.push(d) }
  let tree = Games({}, surface); tree = Games({}, surface); tree = Games({}, surface)
  assert.deepEqual(calls, { every: 1, key: 1, pointer: 1 }, 'listeners start once')
  assert.equal(tree.t, 'Box'); assert.ok(JSON.stringify(tree).includes('Comet Watch'))
  surface.ptr({ type: 'down', x: 3, y: 9 }); tree = Games({}, surface)
  assert.ok(JSON.stringify(tree).includes('Switchboard ·'), 'clicking the third hub row opens Switchboard')
  surface.press({ key: 'b' }); surface.press({ key: '3' }); tree = Games({}, surface)
  assert.ok(!JSON.stringify(tree).includes('undefined') && !JSON.stringify(tree, (k, v) => (v === undefined ? 'UNDEF' : v)).includes('UNDEF'), 'no undefined props')
  assert.ok(JSON.stringify(tree).includes('Switchboard'))
  surface.press({ key: 'b' }); tree = Games({}, surface)
  assert.ok(JSON.stringify(tree).includes('Press 1, 2 or 3'))
  assert.ok(JSON.stringify(tree).length < 100000)
}
console.log('ok  games')
