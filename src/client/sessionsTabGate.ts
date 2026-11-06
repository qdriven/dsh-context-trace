import type { Translate } from './i18n'
import type { ContextSettings } from './settings'
import type { ClientCtx } from './services'
import { watchGate } from './toggleGate'

const SESSIONS_ORDER = 25

export function watchSessionsTab(
  ctx: ClientCtx,
  settings: ContextSettings,
  view: (props: { sessionId?: string } & Record<string, unknown>) => unknown,
  t: Translate,
  ns: string,
): () => void {
  return watchGate(
    settings.store,
    () => settings.sessionsTab() === 'show',
    () => [ctx.slots.inject('conversation.view', () => ctx.slots.register(
      { name: 'conversation.view', id: 'sessions', order: SESSIONS_ORDER, locale: ns, label: () => t('tab.sessions') },
      view,
    ))],
  )
}
