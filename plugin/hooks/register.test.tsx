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

test('the command runs mid-turn and opens the pane without the model', async ($, on) => {
  let opened = 0
  on('command.register', () => ({ value: { command: 'spare-cycles' } }))
  on('ui.open', () => { opened++; return { value: { isPlaced: true } } })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const out = await $.command.run({ command: 'spare-cycles', args: '' })
  expect(opened).toBe(1)
  expect(out.text).toMatch(/side pane/)
})
