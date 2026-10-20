// Adaptive difficulty rules shared by the games. Pure functions, no DOM, so
// test.js can check them in Node and games.html can load them as a plain script.
(function (root) {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

  // Transformed up-down staircase (Levitt 1971). `down` correct in a row makes
  // the task harder (value shrinks by `factor`); one error makes it easier.
  // 2-down-1-up converges near 70.7% correct, 3-down-1-up near 79.4%.
  // Flash Field uses 2-down-1-up on display time, as in the original UFOV test
  // (US 5,801,810, expired). Rule Flip uses 3-down-1-up on the response deadline.
  function staircase({ value, min, max, down = 2, factor = 0.8 }) {
    return { value, min, max, down, factor, streak: 0, dir: 0, reversals: [] };
  }

  function stepStaircase(s, correct) {
    let dir = 0; // -1 harder, +1 easier
    if (!correct) { s.streak = 0; dir = 1; }
    else if (++s.streak >= s.down) { s.streak = 0; dir = -1; }
    if (!dir) return s;
    if (s.dir && dir !== s.dir) s.reversals.push(s.value);
    s.dir = dir;
    s.value = clamp(dir < 0 ? s.value * s.factor : s.value / s.factor, s.min, s.max);
    return s;
  }

  // Threshold estimate: mean of the last n reversal points (UFOV used last 5 of 7).
  function threshold(s, n = 5) {
    const r = s.reversals.slice(-n);
    return r.length ? mean(r) : s.value;
  }

  // Block rule from NeuroRacer (Anguera et al. 2013, Nature, Methods): after each
  // run, move one level per `perLevel` of accuracy away from the 80% target, with
  // no change inside 77.5-82.5%. Positive result = harder. Capped at the paper's
  // 55% floor (25 points below target).
  function blockLevelChange(accuracy, perLevel, target = 0.8, deadband = 0.025) {
    const d = clamp(accuracy - target, -0.25, 0.2);
    return Math.abs(d) <= deadband ? 0 : Math.round(d / perLevel);
  }

  root.Engine = { clamp, mean, staircase, stepStaircase, threshold, blockLevelChange };
})(typeof window !== "undefined" ? window : globalThis);
