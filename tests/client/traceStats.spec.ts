import { describe, expect, test } from 'vitest'
import { traceStepsOf, traceTalliesOf, traceTimingOf, traceTokensOf, traceTurnsOf } from '../../src/client/traceStats'
import type { CommandRecord, ContextTimelineDetail, RequestRecord, SurfaceNode, TimingSpan } from '../../src/shared/types'

function requestOf(partial: Partial<RequestRecord>): RequestRecord {
  return {
    turn: 1,
    step: 1,
    time: 1000,
    seq: 10,
    system: 100,
    tools: 50,
    user: 200,
    inject: 300,
    assistant: 400,
    tool: 500,
    total: 1550,
    ...partial,
  }
}

function detailOf(overrides: Partial<ContextTimelineDetail> = {}): ContextTimelineDetail {
  return {
    rev: 1,
    requests: [],
    events: [],
    nodes: [],
    archive: [],
    droppedNodes: 0,
    ...overrides,
  }
}

const nodeOf = (seq: number, partial: Partial<SurfaceNode> = {}): SurfaceNode => ({
  seq,
  cat: 'user',
  tokens: 10,
  ...partial,
})

const spanOf = (kind: TimingSpan['kind'], start: number, end: number): TimingSpan => ({ kind, start, end })

const commandOf = (partial: Partial<CommandRecord>): CommandRecord => ({
  seq: 30,
  time: 1000,
  tool: 'pwsh',
  start: 1000,
  status: 'completed',
  err: false,
  ...partial,
})

describe('traceStepsOf', () => {
  test('assigns nodes to the step whose request seq covers them', () => {
    const detail = detailOf({
      requests: [
        requestOf({ turn: 1, step: 1, seq: 10, time: 1000, total: 100 }),
        requestOf({ turn: 1, step: 2, seq: 20, time: 2000, total: 200 }),
      ],
      nodes: [
        nodeOf(5, { cat: 'user', tokens: 1 }),
        nodeOf(12, { cat: 'skill', skill: 'task-workflow', tokens: 7 }),
        nodeOf(15, { cat: 'tool', tool: 'read', err: true }),
        nodeOf(22, { cat: 'assistant', tokens: 3 }),
      ],
    })
    const steps = traceStepsOf(detail)
    expect(steps).toHaveLength(2)
    expect(steps[0].seq).toBe(10)
    expect(steps[0].skills).toEqual([])
    expect(steps[0].tools).toEqual([])
    expect(steps[1].seq).toBe(20)
    expect(steps[1].skills).toEqual([{ name: 'task-workflow', tokens: 7 }])
    expect(steps[1].tools).toEqual([{ name: 'read', err: true }])
  })

  test('filters commands by turn and step', () => {
    const detail = detailOf({
      requests: [requestOf({ turn: 2, step: 1, seq: 10, time: 1000, total: 100 })],
      commands: [
        commandOf({ seq: 11, turn: 2, step: 1, tool: 'pwsh', cmd: 'dir' }),
        commandOf({ seq: 12, turn: 2, step: 2, tool: 'pwsh', cmd: 'whoami' }),
        commandOf({ seq: 13, turn: 3, step: 1, tool: 'pwsh', cmd: 'pwd' }),
      ],
    })
    const steps = traceStepsOf(detail)
    expect(steps[0].commands.map(c => c.cmd)).toEqual(['dir'])
  })

  test('reports estimated flags and exact usage when present', () => {
    const detail = detailOf({
      requests: [
        requestOf({ seq: 10, time: 1000, prompt: 120, cacheRead: 300, output: 40, total: 1500 }),
      ],
    })
    const steps = traceStepsOf(detail)
    expect(steps[0].tokens.estimated).toBe(false)
    expect(steps[0].tokens.cacheRead).toBe(300)
    expect(steps[0].tokens.output).toBe(40)
    expect(steps[0].tokens.input).toBe(120)
  })

  test('sums prompt from categories when prompt is absent', () => {
    const detail = detailOf({
      requests: [requestOf({ seq: 10, time: 1000 })],
    })
    const steps = traceStepsOf(detail)
    expect(steps[0].tokens.input).toBe(1550)
    expect(steps[0].tokens.estimated).toBe(true)
  })

  test('keeps spans that end before or start after the request time', () => {
    const detail = detailOf({
      requests: [requestOf({ seq: 10, time: 1000, total: 100 })],
      spans: [
        spanOf('ttft', 900, 950),
        spanOf('reasoning', 950, 990),
        spanOf('tools', 1100, 1200),
      ],
    })
    const steps = traceStepsOf(detail)
    expect(steps[0].spans.map(s => s.kind).sort()).toEqual(['reasoning', 'tools', 'ttft'])
  })

  test('sorts requests by seq and maps activeMs', () => {
    const detail = detailOf({
      requests: [
        requestOf({ seq: 20, time: 2000, total: 200, activeMs: 500 }),
        requestOf({ seq: 10, time: 1000, total: 100, activeMs: 300 }),
      ],
    })
    const steps = traceStepsOf(detail)
    expect(steps.map(s => s.seq)).toEqual([10, 20])
    expect(steps[0].activeMs).toBe(300)
    expect(steps[1].activeMs).toBe(500)
  })
})

describe('traceTokensOf', () => {
  test('sums category buckets across steps', () => {
    const detail = detailOf({
      requests: [
        requestOf({ seq: 10, time: 1000, system: 100, tools: 50, user: 200, inject: 300, assistant: 400, tool: 500 }),
        requestOf({ seq: 20, time: 2000, system: 10, tools: 20, user: 30, inject: 40, assistant: 50, tool: 60 }),
      ],
    })
    const totals = traceTokensOf(traceStepsOf(detail))
    expect(totals).not.toBeNull()
    expect(totals?.system).toBe(110)
    expect(totals?.tools).toBe(70)
    expect(totals?.user).toBe(230)
    expect(totals?.inject).toBe(340)
    expect(totals?.assistant).toBe(450)
    expect(totals?.tool).toBe(560)
    expect(totals?.estimated).toBe(true)
  })

  test('returns null for empty steps', () => {
    expect(traceTokensOf([])).toBeNull()
  })
})

describe('traceTimingOf', () => {
  test('sums spans by kind and activeMs wall time', () => {
    const detail = detailOf({
      requests: [
        requestOf({ seq: 10, time: 1000, total: 100, activeMs: 500 }),
      ],
      spans: [
        spanOf('ttft', 900, 950),
        spanOf('reasoning', 950, 990),
        spanOf('tools', 1100, 1200),
        spanOf('other', 1200, 1300),
      ],
    })
    const totals = traceTimingOf(traceStepsOf(detail))
    expect(totals?.wallMs).toBe(500)
    expect(totals?.ttftMs).toBe(50)
    expect(totals?.reasoningMs).toBe(40)
    expect(totals?.toolsMs).toBe(100)
    expect(totals?.otherMs).toBe(100)
  })

  test('returns null for empty steps', () => {
    expect(traceTimingOf([])).toBeNull()
  })
})

describe('traceTalliesOf', () => {
  test('tallies skills, tools and commands across steps', () => {
    const detail = detailOf({
      requests: [
        requestOf({ seq: 10, time: 1000, total: 100 }),
        requestOf({ seq: 20, time: 2000, total: 200 }),
      ],
      nodes: [
        nodeOf(5, { cat: 'skill', skill: 'task-workflow', tokens: 7 }),
        nodeOf(12, { cat: 'skill', skill: 'task-workflow', tokens: 7 }),
        nodeOf(15, { cat: 'tool', tool: 'read' }),
        nodeOf(18, { cat: 'tool', tool: 'read' }),
      ],
      commands: [
        commandOf({ seq: 11, turn: 1, step: 1, tool: 'pwsh' }),
        commandOf({ seq: 21, turn: 1, step: 2, tool: 'pwsh' }),
      ],
    })
    const tallies = traceTalliesOf(traceStepsOf(detail))
    expect(tallies.skills).toEqual([{ name: 'task-workflow', n: 2, last: 2000 }])
    expect(tallies.tools).toEqual([{ name: 'read', n: 2, last: 2000 }])
    expect(tallies.commands).toEqual([{ name: 'pwsh', n: 2, last: 2000 }])
  })

  test('orders tallies by count descending', () => {
    const detail = detailOf({
      requests: [
        requestOf({ seq: 10, time: 1000, total: 100 }),
        requestOf({ seq: 20, time: 2000, total: 200 }),
      ],
      nodes: [
        nodeOf(5, { cat: 'tool', tool: 'read' }),
        nodeOf(15, { cat: 'tool', tool: 'read' }),
        nodeOf(18, { cat: 'tool', tool: 'edit' }),
      ],
    })
    const tallies = traceTalliesOf(traceStepsOf(detail))
    expect(tallies.tools.map(t => t.name)).toEqual(['read', 'edit'])
  })
})

describe('traceTurnsOf', () => {
  test('groups steps by turn and sums tokens, output and active ms', () => {
    const detail = detailOf({
      requests: [
        requestOf({ turn: 1, step: 1, seq: 10, time: 1000, total: 100, output: 30, activeMs: 500 }),
        requestOf({ turn: 1, step: 2, seq: 20, time: 2000, total: 200, output: 40, activeMs: 600 }),
        requestOf({ turn: 2, step: 1, seq: 30, time: 3000, total: 300, output: 50, activeMs: 700 }),
      ],
    })
    const bars = traceTurnsOf(traceStepsOf(detail))
    expect(bars).toEqual([
      { turn: 1, steps: 2, tokens: 300, output: 70, activeMs: 1100, system: 200, tools: 100, user: 400, inject: 600, skill: 0, assistant: 800, tool: 1000 },
      { turn: 2, steps: 1, tokens: 300, output: 50, activeMs: 700, system: 100, tools: 50, user: 200, inject: 300, skill: 0, assistant: 400, tool: 500 },
    ])
  })

  test('returns empty bars for empty steps', () => {
    expect(traceTurnsOf([])).toEqual([])
  })

  test('keeps ascending turn order across interleaved requests', () => {
    const detail = detailOf({
      requests: [
        requestOf({ turn: 2, step: 1, seq: 30, time: 3000, total: 300 }),
        requestOf({ turn: 1, step: 1, seq: 10, time: 1000, total: 100 }),
        requestOf({ turn: 1, step: 2, seq: 20, time: 2000, total: 200 }),
      ],
    })
    const bars = traceTurnsOf(traceStepsOf(detail))
    expect(bars.map(b => b.turn)).toEqual([1, 2])
    expect(bars[0].tokens).toBe(300)
  })

  test('omits absent output and active ms as zero', () => {
    const detail = detailOf({
      requests: [
        requestOf({ turn: 1, step: 1, seq: 10, time: 1000, total: 150 }),
        requestOf({ turn: 2, step: 1, seq: 20, time: 2000, total: 250 }),
      ],
    })
    const bars = traceTurnsOf(traceStepsOf(detail))
    expect(bars[0].output).toBe(0)
    expect(bars[0].activeMs).toBe(0)
    expect(bars[1].tokens).toBe(250)
  })
})
