import { useState, type ReactElement } from 'react'
import { CATS } from '../categories'
import { fmtShare } from '../format'
import type { TraceTallies, TraceTimingTotals, TraceTokenTotals } from '../traceStats'
import type { ViewKit } from '../viewkit'
import type { DonutProps } from './donut'
import { SliceList, type SliceRow } from './sliceList'
import { IconClock, IconDatabase, IconSkill } from '../primitives'

const TIMING_PARTS: { key: string; color: string; labelKey: string; value: (t: TraceTimingTotals) => number }[] = [
  { key: 'ttft', color: 'var(--color-slate-400)', labelKey: 'timing.ttft', value: t => t.ttftMs },
  { key: 'reasoning', color: 'var(--color-violet-500)', labelKey: 'timing.reasoning', value: t => t.reasoningMs },
  { key: 'text', color: 'var(--color-blue-500)', labelKey: 'timing.text', value: t => t.textMs },
  { key: 'toolarg', color: 'var(--color-amber-500)', labelKey: 'timing.toolArgs', value: t => t.toolArgMs },
  { key: 'tools', color: 'var(--color-teal-500)', labelKey: 'timing.tools', value: t => t.toolsMs },
  { key: 'other', color: 'var(--color-stone-400)', labelKey: 'timing.other', value: t => t.otherMs },
]

export interface TraceStatsProps {
  tokens: TraceTokenTotals | null
  timing: TraceTimingTotals | null
  tallies: TraceTallies
  estimated: boolean
}

function tallyRows(kit: Pick<ViewKit, 'fmt'>, tallies: readonly { name: string; n: number }[], total: number): SliceRow[] {
  const { fmt } = kit
  return tallies.slice(0, 12).map(tally => ({
    key: tally.name,
    color: 'var(--color-teal-500)',
    label: tally.name,
    pct: total > 0 ? fmtShare(tally.n, total) : '—',
    count: fmt(tally.n),
  }))
}
export function makeTraceStats(kit: ViewKit, Donut: (props: DonutProps) => ReactElement): (props: TraceStatsProps) => ReactElement {
  const { t, fmt, fmtDuration } = kit
  return function TraceStats(props: TraceStatsProps): ReactElement {
    const [hoverToken, setHoverToken] = useState<string | null>(null)
    const [hoverTiming, setHoverTiming] = useState<string | null>(null)
    const tokens = props.tokens
    const timing = props.timing
    const tokenParts = tokens !== null
      ? CATS.map(c => ({ key: c.key, color: c.color, value: tokens[c.key as keyof TraceTokenTotals] as number }))
      : []
    const tokenTotal = tokens?.total ?? 0
    const tokenRows: SliceRow[] = tokens === null
      ? []
      : CATS
        .filter(c => (tokens[c.key as keyof TraceTokenTotals] as number) > 0)
        .map((c) => {
          const value = tokens[c.key as keyof TraceTokenTotals] as number
          return {
            key: c.key,
            color: c.color,
            label: t('cat.' + c.key),
            pct: fmtShare(value, tokenTotal),
            count: '≈' + fmt(value),
          }
        })
    const timingParts = timing !== null
      ? TIMING_PARTS.map(p => ({ ...p, value: p.value(timing) }))
      : []
    const timingTotal = timingParts.reduce((a, x) => a + x.value, 0)
    const timingRows: SliceRow[] = timingParts
      .filter(p => p.value > 0)
      .map(p => ({
        key: p.key,
        color: p.color,
        label: t(p.labelKey),
        pct: fmtShare(p.value, timingTotal),
        count: fmtDuration(p.value),
      }))
    const skills = props.tallies.skills
    const tools = props.tallies.tools
    const commands = props.tallies.commands
    const skillTotal = skills.reduce((a, s) => a + s.n, 0)
    const toolTotal = tools.reduce((a, s) => a + s.n, 0)
    const commandTotal = commands.reduce((a, s) => a + s.n, 0)
    return (
      <div className="lc-trace-stats">
        <div className="lc-trace-stats-grid">
          <div className="lc-card lc-col-donut">
            <div className="lc-card-title">
              <span className="lc-card-title-text"><IconDatabase size={14} />{t('tokens.title')}</span>
              {props.estimated ? <span className="lc-trace-est">{t('trace.estimate')}</span> : null}
            </div>
            {tokenRows.length === 0
              ? <div className="lc-empty">{t('ov.stats.empty')}</div>
              : (
                <div className="lc-donut-row flex items-center justify-start gap-3 min-w-0">
                  <Donut
                    segments={tokenParts}
                    size={96}
                    centerTop={fmt(tokenTotal)}
                    centerSub={t('tokens.total')}
                    hoverKey={hoverToken}
                    onHoverKey={setHoverToken}
                  />
                  <SliceList rows={tokenRows} hoverKey={hoverToken} onHoverKey={setHoverToken} />
                </div>
              )}
          </div>
          <div className="lc-card lc-col-donut">
            <div className="lc-card-title">
              <span className="lc-card-title-text"><IconClock size={14} />{t('timing.title')}</span>
            </div>
            {timingRows.length === 0
              ? <div className="lc-empty">{t('ov.stats.empty')}</div>
              : (
                <div className="lc-donut-row flex items-center justify-start gap-3 min-w-0">
                  <Donut
                    segments={timingParts}
                    size={96}
                    centerTop={fmtDuration(timingTotal)}
                    centerSub={t('timing.total')}
                    hoverKey={hoverTiming}
                    onHoverKey={setHoverTiming}
                  />
                  <SliceList rows={timingRows} hoverKey={hoverTiming} onHoverKey={setHoverTiming} />
                </div>
              )}
          </div>
        </div>
        <div className="lc-trace-tallies">
          <div className="lc-card lc-ov-tile">
            <div className="lc-card-title">
              <span className="lc-card-title-text"><IconSkill size={14} />{t('stats.skills')}</span>
              <span className="lc-card-sub">{skills.length}</span>
            </div>
            {skills.length === 0
              ? <div className="lc-empty">{t('ov.skills.empty')}</div>
              : <SliceList rows={tallyRows({ fmt }, skills, skillTotal)} />}
          </div>
          <div className="lc-card lc-ov-tile">
            <div className="lc-card-title">
              <span className="lc-card-title-text"><IconDatabase size={14} />{t('stats.toolCalls')}</span>
              <span className="lc-card-sub">{tools.length}</span>
            </div>
            {tools.length === 0
              ? <div className="lc-empty">{t('ov.tools.empty')}</div>
              : <SliceList rows={tallyRows({ fmt }, tools, toolTotal)} />}
          </div>
          <div className="lc-card lc-ov-tile">
            <div className="lc-card-title">
              <span className="lc-card-title-text"><IconClock size={14} />{t('stats.commands')}</span>
              <span className="lc-card-sub">{commands.length}</span>
            </div>
            {commands.length === 0
              ? <div className="lc-empty">{t('ov.cmds.empty')}</div>
              : <SliceList rows={tallyRows({ fmt }, commands, commandTotal)} />}
          </div>
        </div>
      </div>
    )
  }
}
