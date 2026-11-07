import type { CommandRecord, CommandStats, ContextTimeline, ContextEventRecord, RequestRecord, TimelineCounts } from '../shared/types'

/** Turn/step drill-down applied to every panel on the context page. */
export interface Scope {
  turn: number | null
  step: number | null
}

export const EMPTY_SCOPE: Scope = { turn: null, step: null }

export function scopeActive(scope: Scope): boolean {
  return scope.turn !== null
}

export function turnsOf(requests: readonly RequestRecord[]): number[] {
  const set = new Set<number>()
  for (const req of requests) set.add(req.turn ?? 0)
  return [...set].sort((a, b) => a - b)
}

export interface StepOption {
  turn: number
  step: number
  seq: number
}

export function stepsOf(requests: readonly RequestRecord[], turn: number | null): StepOption[] {
  const out: StepOption[] = []
  const seen = new Set<string>()
  for (const req of requests) {
    const t = req.turn ?? 0
    if (turn !== null && t !== turn) continue
    const s = req.step ?? 0
    const key = String(t) + ':' + String(s)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ turn: t, step: s, seq: req.seq })
  }
  return out
}

function countsOf(requests: readonly RequestRecord[], events: readonly ContextEventRecord[]): TimelineCounts {
  const turns = new Set<number>()
  for (const req of requests) turns.add(req.turn ?? 0)
  let injects = 0
  let compactions = 0
  let prunes = 0
  const skills = new Set<string>()
  for (const ev of events) {
    if (ev.kind === 'inject') injects++
    else if (ev.kind === 'compaction') compactions++
    else if (ev.kind === 'prune') prunes++
    if (ev.sub === 'skill' && typeof ev.name === 'string' && ev.name !== '') skills.add(ev.name)
  }
  return { turns: turns.size, steps: requests.length, injects, compactions, prunes, skills: skills.size }
}

function commandStatsOf(records: readonly CommandRecord[]): CommandStats {
  let failed = 0
  let ms = 0
  let bg = 0
  for (const rec of records) {
    if (rec.status === 'failed') failed++
    if (rec.status === 'completed' || rec.status === 'failed') ms += Math.max(0, (rec.end ?? rec.start) - rec.start)
    if (rec.background === true) bg++
  }
  return { runs: records.length, failed, ms, bg }
}

/**
 * Narrow a timeline snapshot down to one turn (optionally one step inside it).
 * Panels that consume the returned snapshot then show that slice only.
 */
export function scopeTimeline(data: ContextTimeline, scope: Scope): ContextTimeline {
  if (scope.turn === null) return data
  const turn = scope.turn
  const step = scope.step
  const requests = data.requests.filter(req => (
    (req.turn ?? 0) === turn && (step === null || (req.step ?? 0) === step)
  ))
  /* v8 ignore next 1 */
  if (requests.length === 0) return data
  const seqs = requests.map(req => req.seq)
  const lo = Math.min(...seqs)
  const hi = Math.max(...seqs)
  const inRange = (seq: number): boolean => seq >= lo && seq <= hi
  const events = data.events.filter(ev => {
    if (ev.turn !== undefined) return ev.turn === turn && (step === null || ev.step === undefined || ev.step === step)
    if (ev.fromTurn !== undefined) return ev.fromTurn === turn
    return inRange(ev.seq)
  })
  const nodes = data.nodes.filter(node => inRange(node.seq))
  const archive = data.archive.filter(node => inRange(node.seq))
  const fileOps = data.fileOps?.filter(op => inRange(op.seq))
  const commands = data.commands?.filter(rec => (
    rec.turn === undefined
      ? inRange(rec.seq)
      : rec.turn === turn && (step === null || rec.step === undefined || rec.step === step)
  ))
  const times = requests.map(req => req.time)
  const t0 = Math.min(...times)
  const t1 = Math.max(...times)
  const spans = data.spans?.filter(span => span.start >= t0 && span.start <= t1)
  return {
    ...data,
    requests,
    events,
    nodes,
    archive,
    ...(fileOps !== undefined ? { fileOps } : {}),
    ...(commands !== undefined ? { commands, commandStats: commandStatsOf(commands) } : {}),
    ...(spans !== undefined ? { spans } : {}),
    counts: countsOf(requests, events),
  }
}
