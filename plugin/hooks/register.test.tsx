import { expect, test } from 'claude-code/testing'

const PANE = { plugin: 'spare-cycles', component: 'Pane', requestId: 'spare-cycles', props: { title: 'Spare Cycles', isFocused: false, bodyColumns: 50, placement: 'dock', scroll: { offset: 0, bodyRows: 24 }, view: {} } } as const

test('desktop and terminal draw the games; other surfaces draw the link', async ($, on) => {
  on('store.get', () => ({ value: undefined }))
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Client' })).toBeTruthy()
    await ui.unmount()
  }
  for (const surface of ['vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Client' })).toBeFalsy()
    expect(await ui.find({ type: 'Text', text: /need a desktop/ })).toBeTruthy()
    await ui.unmount()
  }
})

function setup($: any, on: any, mcp: () => unknown) {
  const calls = { opened: 0, mcp: [] as unknown[] }
  on('command.register', () => ({ value: { command: 'spare-cycles' } }))
  on('ui.open', () => { calls.opened++; return { value: { isPlaced: true } } })
  on('mcp.call', (_: unknown, e: unknown) => { calls.mcp.push(e); return mcp() })
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  return calls
}

test('the command opens the full game in the browser pane, with no text pane', async ($, on) => {
  const calls = setup($, on, () => ({ value: { content: [], isError: false } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const out = await $.command.run({ command: 'spare-cycles', args: '' })
  expect(calls.mcp.length).toBe(1)
  expect(JSON.stringify(calls.mcp[0])).toMatch(/Claude_Browser.*preview_start.*frahman2310\.github\.io/)
  expect(calls.opened).toBe(0)
  expect(out.text).toMatch(/browser pane/)
})

test('with no browser pane it falls back to the text pane', async ($, on) => {
  const calls = setup($, on, () => { throw new Error('no such server') })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const out = await $.command.run({ command: 'spare-cycles', args: '' })
  expect(calls.opened).toBe(1)
  expect(out.text).toMatch(/side pane/)
})

test('a browser pane that reports an error also falls back', async ($, on) => {
  const calls = setup($, on, () => ({ value: { content: [], isError: true } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'spare-cycles', args: '' })
  expect(calls.opened).toBe(1)
})
