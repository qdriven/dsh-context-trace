import type { Translate } from './i18n'
import type { ContextSettings } from './settings'
import type { ClientCtx } from './services'
import { watchGate } from './toggleGate'

const TRACE_ORDER = 26

export function watchTraceTab(
  ctx: ClientCtx,
  settings: ContextSettings,
  view: (props: { sessionId?: string } & Record<string, unknown>) => unknown,
  t: Translate,
  ns: string,
): () => void {
  return watchGate(
    settings.store,
    () => settings.traceTab() === 'show',
    () => [ctx.slots.inject('conversation.view', () => ctx.slots.register(
      { name: 'conversation.view', id: 'trace', order: TRACE_ORDER, locale: ns, label: () => t('tab.trace') },
      view,
    ))],
  )
}
