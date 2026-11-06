import { type ReactElement } from 'react'
import { CATS } from '../categories'
import type { TraceTurnBar } from '../traceStats'
import type { ViewKit } from '../viewkit'
import { IconClock } from '../primitives'

const MAX_BARS = 15
const BAR_MAX_HEIGHT = 84
const BAR_MIN_HEIGHT = 2

export interface TraceTurnBarsProps {
  turns: readonly TraceTurnBar[]
}

export function makeTraceTurnBars(kit: ViewKit): (props: TraceTurnBarsProps) => ReactElement {
  const { t, fmt } = kit
  return function TraceTurnBars(props: TraceTurnBarsProps): ReactElement {
    const turns = props.turns
    if (turns.length === 0) return <div className="lc-trace-turns" />
    const shown = turns.length <= MAX_BARS
      ? turns
      : [...turns].sort((a, b) => (b.tokens - a.tokens) || (b.activeMs - a.activeMs)).slice(0, MAX_BARS).sort((a, b) => a.turn - b.turn)
    const max = shown.reduce((peak, bar) => Math.max(peak, bar.tokens), 0)
    const total = turns.reduce((sum, bar) => sum + bar.tokens, 0)
    return (
      <div className="lc-trace-turns">
        <div className="lc-trace-turns-title">
          <span className="lc-trace-turns-label"><IconClock size={14} />{t('trace.turns')}</span>
          <span className="lc-trace-turns-total">{fmt(total)} {t('tokens.total')}</span>
        </div>
        {turns.length > MAX_BARS
          ? <div className="lc-trace-turns-note">{t('trace.turnsTop', { n: shown.length, total: turns.length })}</div>
          : null}
        <div className="lc-trace-turns-chart">
          {shown.map((bar) => {
            const height = max > 0 ? Math.max(BAR_MIN_HEIGHT, bar.tokens / max * BAR_MAX_HEIGHT) : BAR_MIN_HEIGHT
            const cats = CATS.map(c => ({ key: c.key, color: c.color, value: bar[c.key] }))
            const visible = cats.filter(c => c.value > 0)
            const catTotal = visible.reduce((sum, c) => sum + c.value, 0)
            const catTitle = visible
              .map(c => `${t('cat.' + c.key)} ${fmt(c.value)}`)
              .join(' · ')
            return (
              <div key={bar.turn} className="lc-trace-turns-col">
                <div className="lc-trace-turns-bar-wrap" style={{ height: BAR_MAX_HEIGHT }}>
                  <div
                    className="lc-trace-turns-stack"
                    style={{ height }}
                    title={`${t('trace.turn')} ${bar.turn} · ${fmt(bar.tokens)} ${t('tokens.total')}${catTotal > 0 ? ' · ' + catTitle : ''}`}
                  >
                    {catTotal > 0 && visible.map(c => (
                      <div
                        key={c.key}
                        className="lc-trace-turns-seg"
                        style={{ background: c.color, flexGrow: c.value / catTotal }}
                      />
                    ))}
                  </div>
                  <span className="lc-trace-turns-value">{fmt(bar.tokens)}</span>
                </div>
                <span className="lc-trace-turns-axis">{bar.turn}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
}
