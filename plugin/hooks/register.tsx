import type { Register } from 'claude-code'

const PANE = 'spare-cycles'
const TITLE = 'Spare Cycles'
const FULL = 'https://frahman2310.github.io/spare-cycles/'
const OPEN = { id: PANE, title: TITLE } as const

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'spare-cycles',
      description: 'Open the attention games in a side pane. Runs mid-turn and does not involve Claude.',
      immediate: true,
    })

    return next(e)
  })

  on('command.run', { command: 'spare-cycles' }, async $ => {
    const { isPlaced } = await $.ui.open(OPEN)

    return { text: isPlaced ? 'Spare Cycles is open in the side pane.' : `No side pane here. Play at ${FULL}` }
  })

  // One click, on every chat, and it never reaches the model. The engine's own
  // [-] mark on the band collapses it for anyone who wants the room back.
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Button } = $.ui.resolve(e)

    return (
      <Box>
        <Button key="spare-cycles-open" label="Spare Cycles" onPress={() => $.ui.open(OPEN)} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Link, Text } = $.ui.resolve(e)
    const full = <Link href={FULL} label="Full version and brain notes" />

    if (e.surface !== 'desktop' && e.surface !== 'terminal') {
      return (
        <Box flexDirection="column">
          <Text>The games need a desktop or terminal session here.</Text>
          {full}
        </Box>
      )
    }

    const { Client } = $.ui.resolve(e)
    const progress = await $.store.get('progress')

    return (
      <Box flexDirection="column">
        <Client key="games" module="./games.ts" props={{ ...(progress ? { progress } : {}), mono: e.surface === 'desktop' }} flexGrow={1} />
        {full}
      </Box>
    )
  })

  // Levels and history outlive the session.
  on('ui.message', async ($, e) => {
    if (e.data && typeof e.data === 'object') await $.store.set('progress', e.data)

    return {}
  })
}
