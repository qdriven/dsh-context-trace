import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { useSessionsSnapshot } from '../agentHeads'
import { sessionsFaceOf } from '../agentTree'
import { makeDetailFetcher } from '../timelineSource'
import type { ContextTimelineDetail } from '../../shared/types'
import { useTraceFocus } from '../traceFocus'
import { traceStepsOf, traceTalliesOf, traceTimingOf, traceTokensOf, traceTurnsOf } from '../traceStats'
import { makeTraceStats } from './traceStats'
import { makeTraceTurnBars } from './traceTurnBars'
import { makeTraceTurnsChart, type TraceEntryDetail } from './traceTurnsChart'
import type { ClientCtx, SessionStandardProps } from '../services'
import type { ContextSettings } from '../settings'
import type { ViewKit } from '../viewkit'
import { ClearableInput } from './clearableInput'
import { Donut } from './donut'
import { asRecord } from '../services'
import { useHistoryFace } from '../historyPage'
import { IconClose, IconSearch } from '../primitives'

export interface TraceTabProps extends SessionStandardProps {
  onOpenSessions?(): void
}

interface TraceOption {
  id: string
  title: string
  cwd?: string
}

function traceOptionsOf(snapshot: unknown): TraceOption[] {
  const state = asRecord(snapshot)
  if (state === null || !Array.isArray(state.ids)) return []
  const byId = asRecord(state.byId) ?? {}
  const ids: string[] = state.ids.filter((id): id is string => typeof id === 'string')
  const out: TraceOption[] = []
  for (const id of ids) {
    const rec = asRecord(byId[id])
    if (rec === null || rec.blank === true) continue
    const title = typeof rec.displayTitle === 'string' && rec.displayTitle !== ''
      ? rec.displayTitle
      : typeof rec.title === 'string' && rec.title !== ''
        ? rec.title
        : id
    const cwd = typeof rec.cwd === 'string' && rec.cwd !== '' ? rec.cwd : undefined
    out.push({ id, title, ...(cwd !== undefined ? { cwd } : {}) })
  }
  out.sort((a, b) => (a.title < b.title ? -1 : 1))
  return out
}

function rawEventsOf(response: unknown): readonly unknown[] {
  const r = asRecord(response)
  const value = asRecord(r?.value)
  const records = value?.records
  return Array.isArray(records) ? records : []
}

function eventSummaryOf(entry: unknown): { type: string; seq: string; time: string } | null {
  const rec = asRecord(entry)
  const ev = asRecord(rec?.event ?? entry)
  if (ev === null) return null
  const type = typeof ev.type === 'string' ? ev.type : '?'
  const seq = typeof ev.seq === 'number' ? String(ev.seq) : ''
  const time = typeof ev.time === 'number'
    ? new Date(ev.time).toISOString().slice(11, 19)
    : ''
  return { type, seq, time }
}

function textOfBlocks(blocks: unknown): string {
  if (!Array.isArray(blocks)) return ''
  let out = ''
  for (const block of blocks) {
    const rec = asRecord(block)
    const text = rec?.text
    if (typeof text === 'string' && text !== '') out += text + '\n'
  }
  return out.trim()
}

function entryOf(
  entry: unknown,
): { type: string; seq: number; time: number; data: Record<string, unknown>; sourceEventSeqs?: readonly unknown[] } | null {
  const rec = asRecord(entry)
  const ev = asRecord(rec?.event ?? entry)
  if (ev === null) return null
  const type = typeof ev.type === 'string' ? ev.type : null
  const seq = typeof ev.seq === 'number' ? ev.seq : null
  const time = typeof ev.time === 'number' ? ev.time : null
  if (type === null || seq === null || time === null) return null
  const data = asRecord(ev.data) ?? {}
  const sourceEventSeqs = Array.isArray(ev.sourceEventSeqs) ? ev.sourceEventSeqs : undefined
  return { type, seq, time, data, ...(sourceEventSeqs !== undefined ? { sourceEventSeqs } : {}) }
}

export function makeTraceTab(
  ctx: ClientCtx,
  kit: ViewKit,
  _settings: ContextSettings,
): (props: TraceTabProps) => ReactElement {
  const { t, fmt, fmtDuration } = kit
  const TraceStats = makeTraceStats(kit, Donut)
  const TraceTurnBars = makeTraceTurnBars(kit)
  const TraceTurnsChart = makeTraceTurnsChart(kit, Donut)

  function TraceTabBody(props: TraceTabProps): ReactElement | null {
    const face = useMemo(() => sessionsFaceOf(ctx), [ctx])
    const snapshot = useSessionsSnapshot(face)
    const historyFace = useHistoryFace()
    const focusStamp = useTraceFocus(props.sessionId)
    const [pickedId, setPickedId] = useState<string | undefined>(props.sessionId)
    const [query, setQuery] = useState('')
    const [rawOpen, setRawOpen] = useState(false)
    const [detail, setDetail] = useState<ContextTimelineDetail | null>(null)
    const [failed, setFailed] = useState(false)
    const [loading, setLoading] = useState(false)
    const [rawEvents, setRawEvents] = useState<readonly unknown[]>([])
    const [rawLoading, setRawLoading] = useState(false)
    const [rawFailed, setRawFailed] = useState(false)
    const [open, setOpen] = useState(false)
    const [chartTab, setChartTab] = useState<'bars' | 'donuts'>('bars')
    const [selectedSeq, setSelectedSeq] = useState<number | null>(null)
    const [turnFilter, setTurnFilter] = useState<number | null>(null)
    const [stepFilter, setStepFilter] = useState<number | null>(null)
    const generation = useRef(0)

    useEffect(() => {
      if (focusStamp !== null && props.sessionId !== undefined) setPickedId(props.sessionId)
    }, [focusStamp, props.sessionId])

    const sessionId = pickedId

    const options = useMemo(() => traceOptionsOf(snapshot), [snapshot])
    const filtered = useMemo(() => {
      const q = query.trim().toLowerCase()
      if (q === '') return options
      return options.filter(r => r.title.toLowerCase().includes(q)
        || (r.cwd !== undefined && r.cwd.toLowerCase().includes(q)))
    }, [options, query])

    useEffect(() => {
      if (sessionId === undefined || sessionId === '') return
      const gen = ++generation.current
      setDetail(null)
      setFailed(false)
      setLoading(true)
      setRawEvents([])
      setRawOpen(false)
      const fetcher = makeDetailFetcher(sessionId)
      if (fetcher === undefined) {
        setLoading(false)
        return
      }
      void fetcher().then((d) => {
        if (generation.current !== gen) return
        setDetail(d)
        setLoading(false)
        if (d === null) setFailed(true)
      }).catch(() => {
        if (generation.current !== gen) return
        setFailed(true)
        setLoading(false)
      })
    }, [sessionId])

    useEffect(() => {
      if (!rawOpen || sessionId === undefined || historyFace === undefined) return
      if (rawEvents.length > 0 || rawLoading || rawFailed) return
      setRawLoading(true)
      void historyFace({
        address: { kind: 'session', sessionId },
        throughSeq: Number.MAX_SAFE_INTEGER,
        beforeSeq: Number.MAX_SAFE_INTEGER,
        maxMessages: 200,
      }, new AbortController().signal).then((response) => {
        setRawEvents(rawEventsOf(response))
        setRawLoading(false)
      }).catch(() => {
        setRawFailed(true)
        setRawLoading(false)
      })
    }, [rawOpen, sessionId, historyFace, rawEvents.length, rawLoading, rawFailed])

    const steps = useMemo(() => (detail !== null ? traceStepsOf(detail) : []), [detail])
    const filteredSteps = useMemo(() => steps.filter(s =>
      (turnFilter === null || s.turn === turnFilter)
      && (stepFilter === null || s.step === stepFilter)), [steps, turnFilter, stepFilter])
    const turnOptions = useMemo(() => [...new Set(steps.map(s => s.turn))].sort((a, b) => a - b), [steps])
    const stepOptions = useMemo(() => {
      if (turnFilter === null) return []
      return [...new Set(steps.filter(s => s.turn === turnFilter).map(s => s.step))].sort((a, b) => a - b)
    }, [steps, turnFilter])
    const focusedSteps = useMemo(() => {
      if (selectedSeq === null) return filteredSteps
      return filteredSteps.filter(s => s.seq === selectedSeq)
    }, [filteredSteps, selectedSeq])
    const selectedStep = useMemo(() => steps.find(s => s.seq === selectedSeq) ?? null, [steps, selectedSeq])
    const tokenTotals = useMemo(() => traceTokensOf(focusedSteps), [focusedSteps])
    const timingTotals = useMemo(() => traceTimingOf(focusedSteps), [focusedSteps])
    const tallies = useMemo(() => traceTalliesOf(focusedSteps), [focusedSteps])
    const turnBars = useMemo(() => traceTurnsOf(filteredSteps), [filteredSteps])
    const estimated = tokenTotals === null || tokenTotals.estimated

    const fetchEntry = useMemo(() => {
      if (sessionId === undefined || historyFace === undefined) return undefined
      return async (seq: number): Promise<TraceEntryDetail | null> => {
        const response = await historyFace({
          address: { kind: 'session', sessionId },
          throughSeq: Number.MAX_SAFE_INTEGER,
          beforeSeq: seq + 1,
          maxMessages: 400,
        }, new AbortController().signal)
        const records = rawEventsOf(response)
        let args: string | undefined
        let result: string | undefined
        let err = false
        let startTime: number | undefined
        let resultTime: number | undefined
        let toolName: string | undefined
        let matched = false
        for (const entry of records) {
          const ev = entryOf(entry)
          if (ev === null || ev.seq !== seq) continue
          matched = true
          if (ev.type === 'tool/result') {
            resultTime = ev.time
            const message = asRecord(ev.data.message)
            const text = textOfBlocks(message?.content)
            if (text !== '') result = text
            if (message?.isError === true) err = true
            const callSeq = Array.isArray(ev.sourceEventSeqs) && typeof ev.sourceEventSeqs[0] === 'number'
              ? ev.sourceEventSeqs[0]
              : null
            if (callSeq !== null) {
              for (const inner of records) {
                const call = entryOf(inner)
                if (call === null || call.type !== 'tool/call' || call.seq !== callSeq) continue
                const raw = call.data.arguments
                if (typeof raw === 'string' && raw !== '') args = raw
                if (typeof call.time === 'number') startTime = call.time
                if (typeof call.data.name === 'string') toolName = call.data.name
                break
              }
            }
            break
          }
          if (ev.type === 'assistant/message' || ev.type === 'user/message' || ev.type === 'developer/message') {
            if (typeof ev.time === 'number') startTime = ev.time
            const message = asRecord(ev.data.message)
            const text = textOfBlocks(message?.content)
            if (text !== '') result = text
            break
          }
        }
        if (!matched) return null
        let schema: string | undefined
        if (toolName !== undefined) {
          for (const entry of records) {
            const ev = entryOf(entry)
            if (ev === null || ev.type !== 'request/header') continue
            const header = asRecord(ev.data.header)
            const tools = Array.isArray(header?.tools) ? header.tools : []
            const tool = tools.find(x => asRecord(x)?.name === toolName) as Record<string, unknown> | undefined
            if (tool !== undefined) {
              schema = JSON.stringify(tool, null, 2).slice(0, 4000)
              break
            }
          }
        }
        if (result === undefined && args === undefined) return null
        const durationMs = typeof startTime === 'number' && typeof resultTime === 'number'
          ? Math.max(0, resultTime - startTime)
          : undefined
        return {
          ...(result !== undefined ? { result } : {}),
          ...(args !== undefined ? { args } : {}),
          err,
          ...(startTime !== undefined ? { startTime } : {}),
          ...(durationMs !== undefined ? { durationMs } : {}),
          ...(schema !== undefined ? { schema } : {}),
        }
      }
    }, [sessionId, historyFace])

    const picked = options.find(r => r.id === sessionId)
    const openTraceId = (id: string): void => {
      setPickedId(id)
      setOpen(false)
    }

    return (
      <section className="lc-trace-page" aria-label={t('trace.title')}>
        <div className="lc-trace-head">
          <div className="lc-trace-pick">
            <button
              type="button"
              className="lc-trace-pick-btn"
              aria-haspopup="listbox"
              aria-expanded={open}
              onClick={() => { setOpen(o => !o) }}
              title={picked?.cwd}
            >
              <IconSearch size={14} />
              <span className="lc-trace-pick-label">{picked !== undefined ? picked.title : t('trace.pickEmpty')}</span>
            </button>
            {open && (
              <div className="lc-trace-pick-pop" role="listbox">
                <ClearableInput
                  className="lc-trace-search"
                  type="search"
                  value={query}
                  placeholder={t('trace.search')}
                  clearLabel={t('field.clear')}
                  onChange={setQuery}
                />
                <div className="lc-trace-pick-list">
                  {filtered.length === 0 ? <div className="lc-empty">{t('trace.noMatch')}</div> : null}
                  {filtered.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      role="option"
                      aria-selected={r.id === sessionId}
                      className={'lc-trace-pick-item' + (r.id === sessionId ? ' lc-trace-pick-item-on' : '')}
                      onClick={() => { openTraceId(r.id) }}
                    >
                      <span className="lc-trace-pick-item-title">{r.title}</span>
                      {r.cwd !== undefined ? <span className="lc-trace-pick-item-cwd">{r.cwd}</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="lc-trace-head-actions">
            <button
              type="button"
              className="lc-trace-raw-btn"
              aria-expanded={rawOpen}
              onClick={() => { setRawOpen(o => !o) }}
            >{t(rawOpen ? 'trace.rawClose' : 'trace.rawOpen')}</button>
            {props.onOpenSessions !== undefined && (
              <button type="button" className="lc-trace-raw-btn" onClick={() => { props.onOpenSessions?.() }}>{t('trace.toSessions')}</button>
            )}
          </div>
        </div>

        {rawOpen && (
          <div className="lc-trace-raw">
            <div className="lc-trace-raw-head">
              <span>{t('trace.rawTitle')}</span>
              {rawLoading ? <span className="lc-trace-raw-state">{t('trace.loading')}</span> : null}
              {rawFailed ? <span className="lc-trace-raw-state">{t('trace.rawFailed')}</span> : null}
              {rawEvents.length > 0 ? <span className="lc-trace-raw-state">{rawEvents.length}</span> : null}
              <button type="button" className="lc-trace-raw-close" aria-label={t('trace.rawClose')} onClick={() => { setRawOpen(false) }}>
                <IconClose size={14} />
              </button>
            </div>
            <div className="lc-trace-raw-body">
              {rawEvents.map((entry, i) => {
                const ev = eventSummaryOf(entry)
                if (ev === null) return <div key={i} className="lc-trace-raw-row" />
                return (
                  <div key={i} className="lc-trace-raw-row">
                    <span className="lc-trace-raw-seq">{ev.seq}</span>
                    <span className="lc-trace-raw-time">{ev.time}</span>
                    <span className="lc-trace-raw-type">{ev.type}</span>
                  </div>
                )
              })}
              {rawEvents.length === 0 && !rawLoading && !rawFailed
                ? <div className="lc-empty">{t('trace.rawEmpty')}</div>
                : null}
            </div>
          </div>
        )}

        {sessionId === undefined ? (
          <div className="lc-empty">{t('trace.pickEmpty')}</div>
        ) : loading ? (
          <div className="lc-empty">{t('trace.loading')}</div>
        ) : failed ? (
          <div className="lc-empty">{t('trace.failed')}</div>
        ) : detail === null ? (
          <div className="lc-empty">{t('trace.noDetail')}</div>
        ) : (
          <>
            <div className="lc-trace-summary">
              <span className="lc-trace-summary-item">{t('stats.steps')} {fmt(steps.length)}</span>
              <span className="lc-trace-summary-item">{t('stats.turns')} {fmt(new Set(steps.map(s => s.turn)).size)}</span>
              <span className="lc-trace-summary-item">{t('tokens.total')} {fmt(tokenTotals?.total ?? 0)}</span>
              <span className="lc-trace-summary-item">{t('timing.total')} {fmtDuration(timingTotals?.wallMs ?? 0)}</span>
              {estimated ? <span className="lc-trace-est">{t('trace.estimate')}</span> : null}
            </div>
            <div className="lc-trace-filters">
              <span className="lc-trace-filter-label">{t('trace.filterTurn')}</span>
              <select
                className="lc-trace-filter-select"
                aria-label={t('trace.filterTurn')}
                value={turnFilter ?? ''}
                onChange={(e) => { setTurnFilter(e.target.value === '' ? null : Number(e.target.value)); setStepFilter(null) }}
              >
                <option value="">{t('trace.filterAllTurns')}</option>
                {turnOptions.map(n => <option key={n} value={n}>{t('trace.turn')} {n}</option>)}
              </select>
              <span className="lc-trace-filter-label">{t('trace.filterStep')}</span>
              <select
                className="lc-trace-filter-select"
                aria-label={t('trace.filterStep')}
                value={stepFilter ?? ''}
                disabled={turnFilter === null}
                onChange={(e) => { setStepFilter(e.target.value === '' ? null : Number(e.target.value)) }}
              >
                <option value="">{turnFilter === null ? t('trace.filterStepsHint') : t('trace.filterAllSteps')}</option>
                {stepOptions.map(n => <option key={n} value={n}>{t('trace.stepIn')} {n}</option>)}
              </select>
              {turnFilter !== null || stepFilter !== null ? (
                <button type="button" className="lc-trace-filter-clear" onClick={() => { setTurnFilter(null); setStepFilter(null) }}>
                  {t('trace.filterClear')}
                </button>
              ) : null}
            </div>
            <div className="lc-trace-chart-tabs" role="tablist" aria-label={t('trace.chart')}>
              <button
                type="button"
                role="tab"
                aria-selected={chartTab === 'bars'}
                className={'lc-trace-chart-tab' + (chartTab === 'bars' ? ' lc-trace-chart-tab-on' : '')}
                onClick={() => { setChartTab('bars') }}
              >{t('trace.chartBars')}</button>
              <button
                type="button"
                role="tab"
                aria-selected={chartTab === 'donuts'}
                className={'lc-trace-chart-tab' + (chartTab === 'donuts' ? ' lc-trace-chart-tab-on' : '')}
                onClick={() => { setChartTab('donuts') }}
              >{t('trace.chartDonuts')}</button>
            </div>
            {chartTab === 'bars' ? <TraceTurnBars turns={turnBars} /> : (
              <TraceTurnsChart
                turns={turnBars}
                steps={filteredSteps}
                selectedSeq={selectedSeq}
                onSelectStep={setSelectedSeq}
                fetchEntry={fetchEntry}
              />
            )}
            {selectedStep !== null ? (
              <div className="lc-trace-focus-note">{t('trace.focusStep', { turn: selectedStep.turn, step: selectedStep.step })}</div>
            ) : null}
            <TraceStats tokens={tokenTotals} timing={timingTotals} tallies={tallies} estimated={estimated} />
          </>
        )}
      </section>
    )
  }

  return function TraceTab(props: TraceTabProps): ReactElement {
    return <TraceTabBody {...props} />
  }
}
