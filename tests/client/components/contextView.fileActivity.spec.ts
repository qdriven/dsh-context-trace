import { createElement as h } from 'react'
import assert from 'node:assert/strict'
import { describe, test, vi } from 'vitest'
import { DICT_EN } from '../../../src/client/i18n'
import type { UseChatLike } from '../../../src/client/services'
import type { ContextTimeline } from '../../../src/shared/types'
import { TestClientCtx } from '../helpers/harness'
import { click, flush, hover, mount, query, queryAll, settle, text, unhover, until } from '../helpers/kit'
import { buttonByText, makeView, projectionsFor, T0, timeline } from './contextViewHarness'

describe('ContextView — file activity card', () => {
  const rest = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 200))
  function fileTimeline(): ContextTimeline {
    const req = (seq: number, time: number, extra: Record<string, unknown> = {}) =>
      ({ seq, time, system: 10, tools: 20, user: 10, inject: 0, assistant: 20, tool: 10, total: 70, ...extra })
    return timeline({
      requests: [
        req(2, T0 + 1000, { turn: 1, step: 1 }),
        req(4, T0 + 3000, { turn: 1, step: 2 }),
        req(6, T0 + 5000),
        req(7, T0 + 6000),
        req(8, T0 + 7000, { turn: 2, step: 1 }),
        req(9, T0 + 8000, { turn: 3, step: 1 }),
      ],
      nodes: [
        { seq: 1, cat: 'user', tokens: 10, text: 'hi', time: T0 + 500 },
        { seq: 2, cat: 'assistant', tokens: 20, text: 'r1', time: T0 + 1000 },
        { seq: 3, cat: 'tool', tokens: 30, tool: 'read', time: T0 + 2000 },
        { seq: 4, cat: 'assistant', tokens: 60, text: 'r2', time: T0 + 3000 },
        { seq: 6, cat: 'assistant', tokens: 80, text: 'r3', time: T0 + 5000 },
        { seq: 7, cat: 'assistant', tokens: 80, text: 'r3b', time: T0 + 6000 },
        { seq: 8, cat: 'assistant', tokens: 80, text: 'r4', time: T0 + 7000 },
        { seq: 9, cat: 'assistant', tokens: 80, text: 'r5', time: T0 + 8000 },
      ],
      archive: [
        { seq: 5, cat: 'tool', tokens: 30, tool: 'edit', gone: 6, time: T0 + 4000 },
      ],
    })
  }

  const fileConv = [
    { kind: 'tool', seq: 3, call: { name: 'read', argsRaw: JSON.stringify({ file_path: '/src/a.ts' }) } },
    { kind: 'tool', seq: 5, call: { name: 'edit', argsRaw: JSON.stringify({ file_path: '/src/a.ts', old_string: 'a\nb', new_string: 'a' }) } },
  ]

  async function mountFiles(sessionId: string) {
    const View = makeView(new TestClientCtx())
    const m = await mount(h(View, {
      sessionId,
      useProjection: projectionsFor(fileTimeline()),
      useChat: (sel =>
        sel({
          legacy: { nodes: fileConv } })) as UseChatLike,
    }))
    const card = queryAll(m.container, '.lc-card').find(c => text(c).includes(DICT_EN['files.title']))
    assert.ok(card !== undefined)
    return { m, card }
  }

  test('follows the chart pick with debounced hover: an exclusive next-step bound, a trailing rapid sweep, and a DNA rest', async () => {
    const { m, card } = await mountFiles('sv-files-scope')
    assert.ok(text(card).includes('+1') && text(card).includes('−2'))

    await hover(query(m.container, '.lc-bar[data-seq="2"]'))
    await rest()
    assert.equal(queryAll(card, '.lc-fa-meta-delta').length, 0)
    assert.equal(queryAll(card, '.lc-fa-row').length, 1)

    await hover(query(m.container, '.lc-bar[data-seq="6"]'))
    await rest()
    assert.ok(text(card).includes('+1'))

    await unhover(query(m.container, '.lc-chart'))
    assert.ok(text(card).includes('−2'))

    const frozen = performance.now()
    const clock = vi.spyOn(performance, 'now').mockReturnValue(frozen)
    await hover(query(m.container, '.lc-bar[data-seq="2"]'))
    await hover(query(m.container, '.lc-bar[data-seq="4"]'))
    await hover(query(m.container, '.lc-bar[data-seq="6"]'))
    clock.mockRestore()
    await until(() => text(card).includes('+1'), 'the trailing hover lands on the last bar')

    await click(buttonByText(m.container, DICT_EN['trend.dna']))
    await hover(query(m.container, '.lc-bar[data-seq="2"]'))
    await settle(80)
    assert.ok(text(card).includes('−2'), 'the cross-card preview stays on the latest scope')
    await settle(300)
    assert.ok(!text(card).includes('−2'))
    await m.unmount()
  })

  test('op clicks reveal the result in the browser', async () => {
    const { m, card } = await mountFiles('sv-files-locate')
    const pick = query<HTMLSelectElement>(m.container, 'select.lc-br-pick')

    await click(query(card, '.lc-fa-row'))
    const ops = queryAll(card, '.lc-fa-op')
    assert.equal(ops.length, 2)
    assert.ok(text(query(ops[1], '.lc-fa-op-time')).includes('T1 S2'))
    assert.ok(/^\d{2}:\d{2}:\d{2}$/.test(text(query(ops[0], '.lc-fa-op-time'))))
    await click(ops[0])
    assert.equal(pick.value, 'live')
    await click(ops[1])
    assert.equal(pick.value, '4')
    assert.ok(text(query(m.container, '.lc-br-elem-on')).includes('/src/a.ts'))
    await m.unmount()
  })

  test('a nested PTC op reveals on its parent run_code result, not on its dispatch seq', async () => {
    const ptcTimeline = timeline({
      requests: [
        { seq: 2, turn: 1, step: 1, time: T0 + 1000, system: 10, tools: 20, user: 10, inject: 0, assistant: 20, tool: 10, total: 70 },
        { seq: 4, turn: 1, step: 2, time: T0 + 3000, system: 10, tools: 20, user: 10, inject: 0, assistant: 20, tool: 10, total: 70 },
      ],
      nodes: [
        { seq: 2, cat: 'assistant', tokens: 20, text: 'r1', time: T0 + 1000 },
        { seq: 3, cat: 'tool', tokens: 30, tool: 'run_code', time: T0 + 2000 },
        { seq: 4, cat: 'assistant', tokens: 60, text: 'r2', time: T0 + 3000 },
      ],
    })
    const ptcConv = [
      {
        kind: 'tool-result',
        seq: 3,
        call: { name: 'run_code', argsRaw: JSON.stringify({ code: 'await tools.edit(…)', description: 'Fix the failing test' }) },
        subCalls: [
          {
            kind: 'tool-result',
            seq: 2,
            time: T0 + 1500,
            call: { name: 'edit', argsRaw: JSON.stringify({ file_path: '/src/a.ts', old_string: 'a\nb', new_string: 'a' }) },
            isError: false,
            subCalls: [],
          },
        ],
      },
    ]
    const View = makeView(new TestClientCtx())
    const m = await mount(h(View, {
      sessionId: 'sv-ptc-locate',
      useProjection: projectionsFor(ptcTimeline),
      useChat: (sel =>
        sel({
          legacy: { nodes: ptcConv } })) as UseChatLike,
    }))
    const card = queryAll(m.container, '.lc-card').find(c => text(c).includes(DICT_EN['files.title']))
    assert.ok(card !== undefined)
    await click(query(card, '.lc-fa-row'))
    assert.ok(text(card).includes('edit'))
    assert.ok(text(card).includes('Fix the failing test'))
    await click(query(card, '.lc-fa-op'))
    const pick = query<HTMLSelectElement>(m.container, 'select.lc-br-pick')
    assert.equal(pick.value, '4')
    assert.ok(text(query(m.container, '.lc-br-elem-on')).includes('Fix the failing test'))
    await m.unmount()
  })

  function openCtx(sessionId: string, sidebarRight?: { openResource: (address: string) => void }) {
    const opened: string[] = []
    const calls: string[] = []
    const ctx = new TestClientCtx({
      services: {
        sessions: { list: { getSnapshot: () => ({ byId: { [sessionId]: { cwd: '/repo' } } }) } },
        connection: {
          isLoopback: true,
          rpc: {
            call: (_channel: string, endpoint: string, payload: unknown) => {
              if (endpoint === 'session/canOpenWorkspacePath') return Promise.resolve({ ok: true, value: true })
              calls.push(endpoint)
              opened.push((payload as { args: { request: { path: string } } }).args.request.path)
              return Promise.resolve({ ok: true, value: { opened: true } })
            },
          },
        },
        ...(sidebarRight === undefined ? {} : { sidebarRight }),
      },
    })
    return { ctx, opened, calls }
  }

  async function mountOpen(sessionId: string, filePath: string, ctx: TestClientCtx) {
    const View = makeView(ctx)
    const conv = [
      { kind: 'tool', seq: 3, call: { name: 'read', argsRaw: JSON.stringify({ file_path: filePath }) } },
    ]
    const m = await mount(h(View, {
      sessionId,
      useProjection: projectionsFor(fileTimeline()),
      useChat: (sel =>
        sel({
          legacy: { nodes: conv } })) as UseChatLike,
    }))
    await flush()
    const card = queryAll(m.container, '.lc-card').find(c => text(c).includes(DICT_EN['files.title']))
    assert.ok(card !== undefined)
    return { m, card }
  }

  function stubFileFetch(payload: unknown = { ok: true, text: 'const a = 1', truncated: false, size: 11 }) {
    const calls: { url: string; body: string }[] = []
    const original = globalThis.fetch
    const stub = async (url: unknown, init?: { body?: unknown }) => {
      calls.push({ url: String(url), body: typeof init?.body === 'string' ? init.body : '' })
      return { ok: true, json: async () => payload }
    }
    ;(globalThis as { fetch: unknown }).fetch = stub
    return { calls, restore: () => { (globalThis as { fetch: unknown }).fetch = original } }
  }

  test('a file row click opens the in-plugin preview instead of the DSH window', async () => {
    const { ctx, opened, calls } = openCtx('sv-files-open')
    const stub = stubFileFetch()
    try {
      const { m, card } = await mountOpen('sv-files-open', '/repo/src/a.ts', ctx)
      const row = query(card, '.lc-fa-row')
      assert.ok(row.querySelector('.lc-fa-path em')?.textContent === './src/')
      const name = query(row, '.lc-fa-file')
      assert.equal(name.getAttribute('title'), DICT_EN['files.preview'])
      await click(name)
      await flush()
      assert.deepEqual(opened, [], 'no system opener runs')
      assert.deepEqual(calls, [], 'no DSH rpc runs')
      assert.equal(stub.calls.length, 1)
      assert.ok(stub.calls[0].url.includes('api/dsh-context-explainer/file'))
      assert.ok(stub.calls[0].body.includes('/repo/src/a.ts'))
      assert.ok(document.querySelector('.lc-text-zoom') !== null, 'the plugin overlay renders the file')
      await m.unmount()
    } finally {
      stub.restore()
    }
  })

  test('every enlarge entry stays inside the plugin: the row zoom button opens the same overlay', async () => {
    const previewed: string[] = []
    const { ctx, opened } = openCtx('sv-preview', { openResource: (address: string) => { previewed.push(address) } })
    const stub = stubFileFetch({ ok: true, text: 'line', truncated: true, size: 4 })
    try {
      const { m, card } = await mountOpen('sv-preview', '/repo/src/a.ts', ctx)
      const zoom = query(query(card, '.lc-fa-row'), '.lc-fa-zoom')
      await click(zoom)
      await flush()
      assert.deepEqual(previewed, [])
      assert.deepEqual(opened, [])
      assert.equal(stub.calls.length, 1)
      assert.ok(document.querySelector('.lc-zoom-pre') !== null)
      await m.unmount()
    } finally {
      stub.restore()
    }
  })

  test('an unencodable path still renders inside the plugin and never opens the system viewer', async () => {
    const previewed: string[] = []
    const { ctx, opened } = openCtx('sv-preview-bad', { openResource: (address: string) => { previewed.push(address) } })
    const stub = stubFileFetch({ ok: false, error: { code: 'x', message: 'read failed' } })
    try {
      const { m, card } = await mountOpen('sv-preview-bad', '\uD800', ctx)
      await click(query(query(card, '.lc-fa-row'), '.lc-fa-file'))
      await flush()
      assert.deepEqual(previewed, [])
      assert.deepEqual(opened, [])
      assert.equal(stub.calls.length, 1)
      assert.ok((document.body.textContent ?? '').includes('read failed'))
      await m.unmount()
    } finally {
      stub.restore()
    }
  })

  test('a capability probe that settles after unmount drops its answer', async () => {
    let resolveProbe!: (value: unknown) => void
    const ctx = new TestClientCtx({
      services: {
        connection: {
          isLoopback: true,
          rpc: { call: () => new Promise(resolve => { resolveProbe = resolve }) },
        },
      },
    })
    const View = makeView(ctx)
    const m = await mount(h(View, {
      sessionId: 'sv-open-late',
      useProjection: projectionsFor(fileTimeline()),
    }))
    await m.unmount()
    resolveProbe({ ok: true, value: true })
    await new Promise(resolve => setTimeout(resolve, 0))
  })

  test('a ctx without service access degrades the card wiring, not the view', async () => {
    const View = makeView({} as unknown as TestClientCtx)
    const m = await mount(h(View, { sessionId: '' }))
    assert.ok(text(m.container).includes(DICT_EN.loading))
    await m.unmount()
  })
})
