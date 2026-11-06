import { useDeferredValue, useEffect, useMemo, useState, type ReactElement } from 'react'
import { useSessionsSnapshot } from '../agentHeads'
import { sessionsFaceOf } from '../agentTree'
import { requestTraceFocus } from '../traceFocus'
import { displayCurrencyOf, estimateSessionCost, formatCost } from '../cost'
import { useModelPrices } from '../modelPrices'
import { fetchOverviewBatch, filterRows, pageOf, projectOf, rowsOfSnapshot, sortRows, type GroupCount, type OverviewBatch, type OverviewRow, type OverviewSort, UNGROUPED_KEY } from '../overview'
import type { ClientCtx, SessionStandardProps } from '../services'
import type { ContextSettings } from '../settings'
import type { ViewKit } from '../viewkit'
import { makeOverviewCard } from './overviewCard'
import { ClearableInput } from './clearableInput'
import { IconData } from '../primitives'

const SORTS: readonly OverviewSort[] = ['recent', 'tokens', 'context']

const SNAPSHOT_POLL_MS = 30_000

export interface SessionsTabProps extends SessionStandardProps {
  onOpenTrace?(sessionId: string): void
}

export function makeSessionsTab(
  ctx: ClientCtx,
  kit: ViewKit,
  _settings: ContextSettings,
): (props: SessionsTabProps) => ReactElement | null {
  const { t } = kit
  const OverviewCard = makeOverviewCard(kit)

  function SessionsTabBody(props: SessionsTabProps): ReactElement | null {
    const face = useMemo(() => sessionsFaceOf(ctx), [ctx])
    const snapshot = useDeferredValue(useSessionsSnapshot(face))
    const { book } = useModelPrices()
    const currency = displayCurrencyOf(ctx.locale)
    const [query, setQuery] = useState('')
    const [group, setGroup] = useState<string | null>(null)
    const [sort, setSort] = useState<OverviewSort>('recent')
    const [page, setPage] = useState(0)
    const [batched, setBatched] = useState<OverviewBatch | null>(null)

    useEffect(() => {
      let alive = true
      const load = (): void => {
        void fetchOverviewBatch().then((next) => {
          if (alive) setBatched(next)
        }).catch(() => {})
      }
      load()
      const timer = setInterval(load, SNAPSHOT_POLL_MS)
      return () => {
        alive = false
        clearInterval(timer)
      }
    }, [])

    const rows = useMemo(() => rowsOfSnapshot(snapshot, undefined, batched ?? undefined), [snapshot, batched])
    const groups = useMemo(() => {
      if (rows === null) return null
      const byId: Record<string, string> = {}
      for (const row of rows) {
        const title = projectOf(row.cwd)
        if (title !== undefined) byId[row.id] = title
      }
      return byId
    }, [rows])

    const scoped = useMemo(
      () => (rows === null ? [] : filterRows(rows, { scope: { start: null, end: null }, day: null, query })),
      [rows, query],
    )
    const counts: GroupCount[] = useMemo(() => {
      if (scoped.length === 0) return []
      const byTitle = new Map<string, number>()
      let ungrouped = 0
      for (const row of scoped) {
        const title = groups !== null ? groups[row.id] : undefined
        if (title === undefined) ungrouped++
        else byTitle.set(title, (byTitle.get(title) ?? 0) + 1)
      }
      const chips: GroupCount[] = []
      for (const [key, count] of byTitle) chips.push({ key, count })
      if (ungrouped > 0) chips.push({ key: UNGROUPED_KEY, count: ungrouped })
      return chips
    }, [scoped, groups])
    const visible = useMemo(
      () => sortRows(
        group === null ? scoped : scoped.filter(row => (groups !== null ? groups[row.id] : undefined) === group),
        sort,
      ),
      [scoped, group, groups, sort],
    )
    const paged = pageOf(visible, page)

    useEffect(() => { setPage(0) }, [query, group, sort])

    const openTrace = (id: string): void => {
      requestTraceFocus(id)
      props.onOpenTrace?.(id)
    }
    const costLabelOf = (row: OverviewRow): string => {
      if (row.familyCost === null) return '—'
      const cost = estimateSessionCost(row.familyCost, book, currency)
      return cost === null ? '—' : formatCost(cost, currency)
    }

    return (
      <section className="lc-ov-list" aria-label={t('sessions.title')}>
        <div className="lc-ov-list-head">
          <span className="lc-ov-list-title"><IconData size={14} />{t('sessions.title')}</span>
          <span className="lc-ov-list-count">{visible.length}</span>
          <ClearableInput
            className="lc-ov-search"
            type="search"
            value={query}
            placeholder={t('sessions.search')}
            clearLabel={t('field.clear')}
            onChange={setQuery}
          />
          <div className="lc-gran" role="group" aria-label={t('ov.list.sortLabel')}>
            {SORTS.map(s => (
              <button
                key={s}
                type="button"
                className={'lc-gran-btn' + (sort === s ? ' lc-gran-on' : '')}
                onClick={() => { setSort(s) }}
              >{t('ov.list.sort.' + s)}</button>
            ))}
          </div>
        </div>

        {counts.length > 0 && (
          <div className="lc-ov-groups" role="group" aria-label={t('ov.group.label')}>
            <button
              type="button"
              className={'lc-ov-chip' + (group === null ? ' lc-ov-chip-on' : '')}
              onClick={() => { setGroup(null) }}
            >{t('ov.range.all')}<span className="lc-ov-chip-n">{scoped.length}</span></button>
            {counts.map(c => (
              <button
                key={c.key}
                type="button"
                className={'lc-ov-chip' + (group === c.key ? ' lc-ov-chip-on' : '')}
                onClick={() => { setGroup(group === c.key ? null : c.key) }}
              >{c.key === UNGROUPED_KEY ? t('ov.group.ungrouped') : c.key}<span className="lc-ov-chip-n">{c.count}</span></button>
            ))}
          </div>
        )}

        {rows === null ? (
          <div className="lc-empty">{t('ov.unavailable')}</div>
        ) : visible.length === 0 ? (
          <div className="lc-empty">{t(rows.length === 0 ? 'ov.list.empty' : 'ov.list.noMatch')}</div>
        ) : (
          <>
            <div className="lc-ov-grid">
              {paged.items.map(row => (
                <OverviewCard
                  key={row.id}
                  row={row}
                  {...(groups !== null ? { group: groups[row.id] } : {})}
                  costLabel={costLabelOf(row)}
                  now={Date.now()}
                  onOpen={openTrace}
                />
              ))}
            </div>
            {paged.count > 1 && (
              <div className="lc-ov-pager" role="navigation" aria-label={t('ov.list.pager')}>
                <button
                  type="button"
                  className="lc-ov-pager-btn"
                  disabled={paged.index === 0}
                  aria-label={t('ov.list.prev')}
                  onClick={() => { setPage(paged.index - 1) }}
                >‹</button>
                <span className="lc-ov-pager-n">{t('ov.list.page', { n: paged.index + 1, total: paged.count })}</span>
                <button
                  type="button"
                  className="lc-ov-pager-btn"
                  disabled={paged.index === paged.count - 1}
                  aria-label={t('ov.list.next')}
                  onClick={() => { setPage(paged.index + 1) }}
                >›</button>
              </div>
            )}
          </>
        )}
      </section>
    )
  }

  return function SessionsTab(props: SessionsTabProps): ReactElement | null {
    return <SessionsTabBody {...props} />
  }
}
