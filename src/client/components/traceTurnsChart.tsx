import { useState, type ReactElement } from 'react'
import { CATS } from '../categories'
import { fmtShare } from '../format'
import type { TraceStepView, TraceTurnBar } from '../traceStats'
import type { ViewKit } from '../viewkit'
import type { DonutProps } from './donut'

const TURN_COLORS: readonly string[] = [
  'var(--color-blue-500)',
  'var(--color-violet-500)',
  'var(--color-teal-500)',
  'var(--color-pink-500)',
  'var(--color-amber-500)',
  'var(--color-green-500)',
  'var(--color-indigo-500)',
  'var(--color-orange-500)',
  'var(--color-cyan-500)',
  'var(--color-rose-500)',
]

const DONUT_SIZE = 220
const TURNS_PER_PAGE = 5

const FILTER_CATS: readonly string[] = ['tool', 'skill', 'assistant', 'user', 'inject']

export interface TraceEntryDetail {
  args?: string
  result?: string
  err?: boolean
  startTime?: number
  durationMs?: number
  schema?: string
}

export interface TraceTurnsChartProps {
  turns: readonly TraceTurnBar[]
  steps: readonly TraceStepView[]
  selectedSeq?: number | null
  onSelectStep?(seq: number | null): void
  fetchEntry?(seq: number): Promise<TraceEntryDetail | null>
}

interface ContentEntry {
  step: number
  node: TraceStepView['nodes'][number]
}

export function makeTraceTurnsChart(
  kit: ViewKit,
  Donut: (props: DonutProps) => ReactElement,
): (props: TraceTurnsChartProps) => ReactElement {
  const { t, fmt, fmtDuration, fmtTime } = kit
  function tagOf(entry: ContentEntry): string {
    const n = entry.node
    if (n.cat === 'tool') return n.tool !== undefined ? n.tool : t('trace.contentTool')
    if (n.cat === 'skill') return n.skill !== undefined ? n.skill : t('trace.contentSkill')
    return t('cat.' + n.cat)
  }
  function StepHead(props: { step: TraceStepView; selected: boolean; onPick(): void }): ReactElement {
    const step = props.step
    return (
      <button type="button" className={'lc-trace-content-step-head' + (props.selected ? ' lc-trace-content-step-on' : '')} onClick={() => { props.onPick() }}>
        <span className="lc-trace-content-step-name">{t('trace.stepIn')} {step.step}</span>
        <span className="lc-trace-content-step-stat">{t('tokens.total')} {fmt(step.tokens.total)}</span>
        {step.tokens.output !== undefined
          ? <span className="lc-trace-content-step-stat">{t('stats.io')} {fmt(step.tokens.output)}</span>
          : null}
        {step.tokens.cacheRead !== undefined
          ? <span className="lc-trace-content-step-stat">{t('stats.cacheHit')} {fmt(step.tokens.cacheRead)}</span>
          : null}
        {step.activeMs !== undefined
          ? <span className="lc-trace-content-step-stat">{t('timing.total')} {fmtDuration(step.activeMs)}</span>
          : null}
      </button>
    )
  }
  function DetailBody(props: { detail: TraceEntryDetail; entry: ContentEntry }): ReactElement {
    const n = props.entry.node
    const hierarchy = n.cat === 'tool'
      ? `${t('cat.assistant')} › ${n.tool ?? t('trace.contentTool')}`
      : n.cat === 'skill'
        ? `${t('cat.skill')} › ${n.skill ?? t('trace.contentSkill')}`
        : t('cat.' + n.cat)
    return (
      <>
        <div className="lc-trace-content-detail-row">
          <span className="lc-trace-content-detail-label">{t('trace.detailHierarchy')}</span>
          <span className="lc-trace-content-detail-value">{hierarchy}</span>
        </div>
        <div className="lc-trace-content-detail-row">
          <span className="lc-trace-content-detail-label">{t('trace.detailStatus')}</span>
          <span className={'lc-trace-content-detail-value' + (n.err === true || props.detail.err === true ? ' lc-trace-content-err' : '')}>
            {n.err === true || props.detail.err === true ? t('trace.detailFailed') : t('trace.detailDone')}
          </span>
        </div>
        {props.detail.startTime !== undefined
          ? (
            <div className="lc-trace-content-detail-row">
              <span className="lc-trace-content-detail-label">{t('trace.detailStart')}</span>
              <span className="lc-trace-content-detail-value">{fmtTime(props.detail.startTime)}</span>
            </div>
          )
          : null}
        {props.detail.durationMs !== undefined
          ? (
            <div className="lc-trace-content-detail-row">
              <span className="lc-trace-content-detail-label">{t('trace.detailDuration')}</span>
              <span className="lc-trace-content-detail-value">{fmtDuration(props.detail.durationMs)}</span>
            </div>
          )
          : null}
        {props.detail.args !== undefined
          ? (
            <div className="lc-trace-content-detail-block">
              <span className="lc-trace-content-detail-label">{t('trace.contentArgs')}</span>
              <pre className="lc-trace-content-detail-pre">{props.detail.args}</pre>
            </div>
          )
          : null}
        {props.detail.result !== undefined
          ? (
            <div className="lc-trace-content-detail-block">
              <span className="lc-trace-content-detail-label">{t('trace.contentResult')}</span>
              <pre className="lc-trace-content-detail-pre">{props.detail.result}</pre>
            </div>
          )
          : null}
        {props.detail.schema !== undefined
          ? (
            <div className="lc-trace-content-detail-block">
              <span className="lc-trace-content-detail-label">{t('trace.detailSchema')}</span>
              <pre className="lc-trace-content-detail-pre">{props.detail.schema}</pre>
            </div>
          )
          : null}
      </>
    )
  }
  return function TraceTurnsChart(props: TraceTurnsChartProps): ReactElement {
    const turns = props.turns
    const [picked, setPicked] = useState<string | null>(null)
    const [pickedCat, setPickedCat] = useState<string | null>(null)
    const [page, setPage] = useState(1)
    const [filterCat, setFilterCat] = useState<string | null>(null)
    const [pickedSeq, setPickedSeq] = useState<number | null>(null)
    const [details, setDetails] = useState<Map<number, TraceEntryDetail | null>>(new Map())
    const [loadingDetail, setLoadingDetail] = useState<number | null>(null)
    if (turns.length === 0) return <div className="lc-trace-turns-chart" />
    const ranked = [...turns].sort((a, b) => (b.tokens - a.tokens) || (a.turn - b.turn))
    const total = turns.reduce((sum, bar) => sum + bar.tokens, 0)
    const segments = turns.map((bar, i) => ({
      key: String(bar.turn),
      color: TURN_COLORS[i % TURN_COLORS.length],
      value: bar.tokens,
    }))
    const pickedTurn = picked !== null ? turns.find(bar => String(bar.turn) === picked) ?? null : null
    const active = pickedTurn ?? ranked[0]
    const detailSegments = CATS
      .map(c => ({ key: c.key, color: c.color, value: active[c.key] }))
      .filter(s => s.value > 0)
    const detailTotal = detailSegments.reduce((sum, s) => sum + s.value, 0)
    const single = pickedTurn !== null
    const entriesOf = (turn: number): ContentEntry[] =>
      props.steps
        .filter(s => s.turn === turn)
        .flatMap(s => s.nodes.map(n => ({ step: s.step, node: n })))
        .sort((a, b) => a.node.seq - b.node.seq)
    const stepsOf = (turn: number): TraceStepView[] =>
      [...props.steps.filter(s => s.turn === turn)].sort((a, b) => a.seq - b.seq)
    const singleSteps = single
      ? stepsOf(active.turn).filter(s => filterCat === null || s.nodes.some(n => n.cat === filterCat))
      : []
    const descending = [...turns].sort((a, b) => b.turn - a.turn)
    const pageCount = Math.max(1, Math.ceil(descending.length / TURNS_PER_PAGE))
    const safePage = Math.min(page, pageCount)
    const pageTurns = descending.slice((safePage - 1) * TURNS_PER_PAGE, safePage * TURNS_PER_PAGE)
    const pickStep = (seq: number): void => {
      props.onSelectStep?.(props.selectedSeq === seq ? null : seq)
    }
    const pickEntry = (seq: number): void => {
      setPickedSeq(seq)
      if (details.has(seq)) return
      if (props.fetchEntry === undefined) return
      setLoadingDetail(seq)
      void props.fetchEntry(seq).then((detail) => {
        setDetails(prev => new Map(prev).set(seq, detail))
        setLoadingDetail(null)
      }).catch(() => {
        setDetails(prev => new Map(prev).set(seq, null))
        setLoadingDetail(null)
      })
    }
    const pickedEntry = (() => {
      if (pickedSeq === null) return null
      for (const bar of single ? [active] : pageTurns) {
        const found = entriesOf(bar.turn).find(e => e.node.seq === pickedSeq)
        if (found !== undefined) return found
      }
      return null
    })()
    const pickedDetail = pickedSeq !== null ? details.get(pickedSeq) : undefined
    function ContentRow(props: {
      entry: ContentEntry
      picked: boolean
      onPick(): void
    }): ReactElement {
      const n = props.entry.node
      return (
        <button type="button" className={'lc-trace-content-row' + (props.picked ? ' lc-trace-content-row-on' : '')} onClick={() => { props.onPick() }}>
          <span className={'lc-trace-content-tag' + (n.err === true ? ' lc-trace-content-err' : '')}>{tagOf(props.entry)}</span>
          <span className="lc-trace-content-text">
            {n.text !== undefined && n.text !== '' ? n.text : t('trace.contentNoText')}
          </span>
          <span className="lc-trace-content-tokens">{fmt(n.tokens)}</span>
        </button>
      )
    }
    return (
      <div className="lc-trace-steps-chart">
        <div className="lc-trace-steps-donuts">
          <div className="lc-card lc-col-donut">
            <div className="lc-card-title">
              <span className="lc-card-title-text">{t('trace.turnsShare')}</span>
            </div>
            <div className="lc-donut-row flex items-center justify-start gap-2 min-w-0">
              <Donut
                segments={segments}
                size={DONUT_SIZE}
                centerTop={fmt(total)}
                centerSub={t('tokens.total')}
                hoverKey={picked}
                pickKey={picked}
                onPickKey={(key) => { setPicked(picked === key ? null : key) }}
              />
              <div className="lc-trace-steps-legend">
                {turns.map((bar, i) => (
                  <button key={bar.turn} type="button" className="lc-trace-steps-legend-row" onClick={() => { setPicked(String(bar.turn) === picked ? null : String(bar.turn)) }}>
                    <span className="lc-trace-steps-legend-dot" style={{ background: segments[i].color }} />
                    <span className="lc-trace-steps-legend-name">{t('trace.turn')} {bar.turn}</span>
                    <span className="lc-trace-steps-legend-val">{fmt(bar.tokens)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="lc-card lc-col-donut">
            <div className="lc-card-title">
              <span className="lc-card-title-text">{t('trace.turnsDetail')}</span>
            </div>
            {detailSegments.length === 0
              ? <div className="lc-empty">{t('ov.stats.empty')}</div>
              : (
                <div className="lc-donut-row flex items-center justify-start gap-2 min-w-0">
                  <Donut
                    segments={detailSegments}
                    size={DONUT_SIZE}
                    centerTop={fmt(active.tokens)}
                    centerSub={`${t('trace.turn')} ${active.turn}`}
                    hoverKey={pickedCat}
                    pickKey={pickedCat}
                    onPickKey={setPickedCat}
                  />
                  <div className="lc-trace-steps-legend">
                    {detailSegments.map(s => (
                      <button key={s.key} type="button" className="lc-trace-steps-legend-row" onClick={() => { setPickedCat(pickedCat === s.key ? null : s.key) }}>
                        <span className="lc-trace-steps-legend-dot" style={{ background: s.color }} />
                        <span className="lc-trace-steps-legend-name">{t('cat.' + s.key)}</span>
                        <span className="lc-trace-steps-legend-val">
                          {fmt(s.value)}{detailTotal > 0 ? ' · ' + fmtShare(s.value, detailTotal) : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </div>
        <div className="lc-trace-content">
          <div className="lc-trace-content-body">
            <div className="lc-trace-content-list">
              {single ? (
                <>
                  <div className="lc-trace-content-title">
                    {pickedCat !== null
                      ? t('trace.contentTitleCat', { turn: active.turn, cat: t('cat.' + pickedCat) })
                      : t('trace.contentTitle', { turn: active.turn })}
                  </div>
                  <div className="lc-trace-content-filters" role="group" aria-label={t('trace.filter')}>
                    <button type="button" className={'lc-trace-content-filter' + (filterCat === null ? ' lc-trace-content-filter-on' : '')} onClick={() => { setFilterCat(null) }}>
                      {t('trace.filterAll')}
                    </button>
                    {FILTER_CATS.map(cat => (
                      <button key={cat} type="button" className={'lc-trace-content-filter' + (filterCat === cat ? ' lc-trace-content-filter-on' : '')} onClick={() => { setFilterCat(filterCat === cat ? null : cat) }}>
                        {t('cat.' + cat)}
                      </button>
                    ))}
                  </div>
                  {singleSteps.length === 0
                    ? <div className="lc-empty">{t('trace.contentEmpty')}</div>
                    : singleSteps.map(step => (
                      <div key={step.seq} className="lc-trace-content-step">
                        <StepHead step={step} selected={props.selectedSeq === step.seq} onPick={() => { pickStep(step.seq) }} />
                        {entriesOf(active.turn)
                          .filter(entry => entry.step === step.step
                            && (pickedCat === null || entry.node.cat === pickedCat)
                            && (filterCat === null || entry.node.cat === filterCat))
                          .map(entry => (
                            <ContentRow
                              key={entry.node.seq}
                              entry={entry}
                              picked={pickedSeq === entry.node.seq}
                              onPick={() => { pickEntry(entry.node.seq) }}
                            />
                          ))}
                      </div>
                    ))}
                </>
              ) : (
                <>
                  <div className="lc-trace-content-title">{t('trace.contentAll')}</div>
                  {pageTurns.map((bar) => {
                    const steps = stepsOf(bar.turn)
                    return (
                      <div key={bar.turn} className="lc-trace-content-turn">
                        <div className="lc-trace-content-turn-title">
                          {t('trace.turn')} {bar.turn} · {fmt(bar.tokens)} {t('tokens.total')}
                        </div>
                        {steps.length === 0
                          ? <div className="lc-empty">{t('trace.contentEmpty')}</div>
                          : steps.map(step => (
                            <div key={step.seq} className="lc-trace-content-step">
                              <StepHead step={step} selected={props.selectedSeq === step.seq} onPick={() => { pickStep(step.seq) }} />
                              {entriesOf(bar.turn)
                                .filter(entry => entry.step === step.step)
                                .map(entry => (
                                  <ContentRow
                                    key={entry.node.seq}
                                    entry={entry}
                                    picked={pickedSeq === entry.node.seq}
                                    onPick={() => { pickEntry(entry.node.seq) }}
                                  />
                                ))}
                            </div>
                          ))}
                      </div>
                    )
                  })}
                  <div className="lc-trace-content-pager">
                    <button type="button" className="lc-trace-content-page-btn" disabled={safePage <= 1} onClick={() => { setPage(safePage - 1) }}>
                      {t('trace.contentPrev')}
                    </button>
                    <span className="lc-trace-content-page-now">{t('trace.contentPage', { n: safePage, total: pageCount })}</span>
                    <button type="button" className="lc-trace-content-page-btn" disabled={safePage >= pageCount} onClick={() => { setPage(safePage + 1) }}>
                      {t('trace.contentNext')}
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="lc-trace-content-panel">
              {pickedEntry === null ? (
                <div className="lc-empty">{t('trace.panelEmpty')}</div>
              ) : (
                <>
                  <div className="lc-trace-content-panel-head">
                    <span className={'lc-trace-content-panel-tag' + (pickedEntry.node.err === true ? ' lc-trace-content-err' : '')}>
                      {tagOf(pickedEntry)}
                    </span>
                    <span className="lc-trace-content-panel-meta">{t('trace.stepIn')} {pickedEntry.step}</span>
                    <span className="lc-trace-content-panel-tokens">{fmt(pickedEntry.node.tokens)}</span>
                  </div>
                  {pickedEntry.node.text !== undefined && pickedEntry.node.text !== '' ? (
                    <div className="lc-trace-content-detail-block">
                      <span className="lc-trace-content-detail-label">{t('trace.contentText')}</span>
                      <pre className="lc-trace-content-detail-pre">{pickedEntry.node.text}</pre>
                    </div>
                  ) : null}
                  {pickedDetail === undefined
                    ? (loadingDetail === pickedSeq
                      ? <div className="lc-trace-content-detail-line">{t('trace.loading')}</div>
                      : <div className="lc-trace-content-detail-line">{t('trace.contentNoDetail')}</div>)
                    : pickedDetail === null
                      || (pickedDetail.args === undefined && pickedDetail.result === undefined && pickedDetail.schema === undefined)
                      ? <div className="lc-trace-content-detail-line">{t('trace.contentNoDetail')}</div>
                      : <DetailBody detail={pickedDetail} entry={pickedEntry} />}                </>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }
}
