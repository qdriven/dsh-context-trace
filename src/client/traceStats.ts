import type { CommandRecord, ContextTimelineDetail, SurfaceNode, TimingSpan } from '../shared/types'

export interface TraceSkillUse {
  name: string
  tokens: number
}

export interface TraceToolUse {
  name: string
  err: boolean
  ms?: number
}

export interface TraceStepTokens {
  system: number
  tools: number
  user: number
  inject: number
  skill: number
  assistant: number
  tool: number
  input: number
  cacheRead?: number
  output?: number
  total: number
  estimated: boolean
}

export interface TraceStepView {
  turn: number
  step: number
  seq: number
  time: number
  tokens: TraceStepTokens
  skills: TraceSkillUse[]
  tools: TraceToolUse[]
  commands: CommandRecord[]
  spans: TimingSpan[]
  nodes: SurfaceNode[]
  activeMs?: number
}

export interface TraceTokenTotals {
  system: number
  tools: number
  user: number
  inject: number
  skill: number
  assistant: number
  tool: number
  output: number
  cacheRead: number
  total: number
  estimated: boolean
}

export interface TraceTimingTotals {
  wallMs: number
  ttftMs: number
  reasoningMs: number
  textMs: number
  toolArgMs: number
  toolsMs: number
  otherMs: number
}

export interface TraceTally {
  name: string
  n: number
  last: number
}

export interface TraceTallies {
  skills: TraceTally[]
  tools: TraceTally[]
  commands: TraceTally[]
}

export interface TraceTurnBar {
  turn: number
  steps: number
  tokens: number
  output: number
  activeMs: number
  system: number
  tools: number
  user: number
  inject: number
  skill: number
  assistant: number
  tool: number
}

export function traceTurnsOf(steps: readonly TraceStepView[]): TraceTurnBar[] {
  const bars: TraceTurnBar[] = []
  let lastTurn = -1
  for (const step of steps) {
    if (step.turn !== lastTurn) {
      bars.push({
        turn: step.turn,
        steps: 0,
        tokens: 0,
        output: 0,
        activeMs: 0,
        system: 0,
        tools: 0,
        user: 0,
        inject: 0,
        skill: 0,
        assistant: 0,
        tool: 0,
      })
      lastTurn = step.turn
    }
    const bar = bars[bars.length - 1]
    bar.steps += 1
    bar.tokens += step.tokens.total
    bar.output += step.tokens.output ?? 0
    bar.activeMs += step.activeMs ?? 0
    bar.system += step.tokens.system
    bar.tools += step.tokens.tools
    bar.user += step.tokens.user
    bar.inject += step.tokens.inject
    bar.skill += step.tokens.skill
    bar.assistant += step.tokens.assistant
    bar.tool += step.tokens.tool
  }
  return bars
}

export function traceStepsOf(detail: ContextTimelineDetail): TraceStepView[] {
  const requests = [...detail.requests].sort((a, b) => a.seq - b.seq)
  const steps: TraceStepView[] = []
  const toolMs = new Map<string, number>()
  const spans = [...(detail.spans ?? [])].sort((a, b) => (a.start - b.start) || (a.end - b.end))
  for (let index = 0; index < requests.length; index++) {
    const req = requests[index]
    const prevTime = index > 0 ? requests[index - 1].time : Number.NEGATIVE_INFINITY
    const nextTime = index + 1 < requests.length ? requests[index + 1].time : Number.POSITIVE_INFINITY
    const startSeq = index > 0 ? requests[index - 1].seq : -1
    const skills: TraceSkillUse[] = []
    const tools: TraceToolUse[] = []
    const stepSpans: TimingSpan[] = []
    const stepNodes: SurfaceNode[] = []
    for (const node of detail.nodes) {
      if (node.seq <= startSeq || node.seq > req.seq) continue
      stepNodes.push(node)
      if (node.cat === 'skill' && typeof node.skill === 'string') skills.push({ name: node.skill, tokens: node.tokens })
      else if (node.cat === 'tool' && typeof node.tool === 'string') tools.push({ name: node.tool, err: node.err === true })
    }
    for (const span of spans) {
      if (span.start >= prevTime && span.end <= nextTime) stepSpans.push(span)
    }
    const commands = (detail.commands ?? []).filter(c => c.turn === req.turn && c.step === req.step)
    for (const c of commands) {
      const dur = typeof c.end === 'number' ? Math.max(0, c.end - c.start) : 0
      const known = toolMs.get(c.tool) ?? 0
      toolMs.set(c.tool, known + dur)
    }
    for (const t of tools) {
      const ms = toolMs.get(t.name)
      if (ms !== undefined) t.ms = ms
    }
    const estimated = req.cacheRead === undefined && req.output === undefined
    const system = req.system
    const toolDefs = req.tools
    const user = req.user
    const inject = req.inject
    const skill = req.skill ?? 0
    const assistant = req.assistant
    const tool = req.tool
    steps.push({
      turn: req.turn ?? 0,
      step: req.step ?? 0,
      seq: req.seq,
      time: req.time,
      tokens: {
        system,
        tools: toolDefs,
        user,
        inject,
        skill,
        assistant,
        tool,
        input: req.prompt !== undefined ? req.prompt : system + toolDefs + user + inject + skill + assistant + tool,
        ...(req.cacheRead !== undefined ? { cacheRead: req.cacheRead } : {}),
        ...(req.output !== undefined ? { output: req.output } : {}),
        total: req.total,
        estimated,
      },
      skills,
      tools,
      commands,
      spans: stepSpans,
      nodes: stepNodes,
      ...(req.activeMs !== undefined ? { activeMs: req.activeMs } : {}),
    })
  }
  return steps
}

export function traceTokensOf(steps: readonly TraceStepView[]): TraceTokenTotals | null {
  if (steps.length === 0) return null
  const totals: TraceTokenTotals = {
    system: 0,
    tools: 0,
    user: 0,
    inject: 0,
    skill: 0,
    assistant: 0,
    tool: 0,
    output: 0,
    cacheRead: 0,
    total: 0,
    estimated: true,
  }
  let anyPrecise = false
  for (const step of steps) {
    totals.system += step.tokens.system
    totals.tools += step.tokens.tools
    totals.user += step.tokens.user
    totals.inject += step.tokens.inject
    totals.skill += step.tokens.skill
    totals.assistant += step.tokens.assistant
    totals.tool += step.tokens.tool
    totals.output += step.tokens.output ?? 0
    totals.cacheRead += step.tokens.cacheRead ?? 0
    if (!step.tokens.estimated) anyPrecise = true
  }
  totals.total = totals.system + totals.tools + totals.user + totals.inject
    + totals.skill + totals.assistant + totals.tool + totals.output + totals.cacheRead
  totals.estimated = !anyPrecise
  return totals
}

export function traceTimingOf(steps: readonly TraceStepView[]): TraceTimingTotals | null {
  if (steps.length === 0) return null
  const totals: TraceTimingTotals = { wallMs: 0, ttftMs: 0, reasoningMs: 0, textMs: 0, toolArgMs: 0, toolsMs: 0, otherMs: 0 }
  for (const step of steps) {
    if (step.activeMs !== undefined) totals.wallMs += step.activeMs
    for (const span of step.spans) {
      const ms = Math.max(0, span.end - span.start)
      switch (span.kind) {
        case 'ttft': totals.ttftMs += ms; break
        case 'reasoning': totals.reasoningMs += ms; break
        case 'text': totals.textMs += ms; break
        case 'toolarg': totals.toolArgMs += ms; break
        case 'tools': totals.toolsMs += ms; break
        default: totals.otherMs += ms
      }
    }
  }
  return totals
}

export function traceTalliesOf(steps: readonly TraceStepView[]): TraceTallies {
  const skills = new Map<string, TraceTally>()
  const tools = new Map<string, TraceTally>()
  const commands = new Map<string, TraceTally>()
  for (const step of steps) {
    for (const s of step.skills) bump(skills, s.name, step.time)
    for (const t of step.tools) bump(tools, t.name, step.time)
    for (const c of step.commands) bump(commands, c.tool, step.time)
  }
  const byCount = (a: TraceTally, b: TraceTally): number => (b.n - a.n) || (b.last - a.last) || (a.name < b.name ? -1 : 1)
  return {
    skills: [...skills.values()].sort(byCount),
    tools: [...tools.values()].sort(byCount),
    commands: [...commands.values()].sort(byCount),
  }
}

function bump(table: Map<string, TraceTally>, name: string, last: number): void {
  const known = table.get(name)
  if (known === undefined) table.set(name, { name, n: 1, last })
  else {
    known.n += 1
    if (last > known.last) known.last = last
  }
}
