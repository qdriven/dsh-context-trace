import { readFile, stat } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import { type ConnectionHostFace, registerPostRoute } from './connection'

export const FILE_ROUTE = '/api/dsh-context-explainer/file'

/** Hard cap so a stray huge file cannot freeze the panel. */
const MAX_BYTES = 512 * 1024

function reply(value: unknown): Response {
  return Response.json(value, { headers: { 'cache-control': 'no-store' } })
}

function failure(code: string, message: string): Response {
  return reply({ ok: false, error: { code, message } })
}

async function handle(request: Request): Promise<Response> {
  let path: unknown
  try {
    const body = await request.json() as { path?: unknown } | null
    path = body?.path
  } catch {
    return failure('dsh-context-explainer/bad-request', 'body is not JSON')
  }
  if (typeof path !== 'string' || path === '') return failure('dsh-context-explainer/bad-request', 'path is required')
  try {
    const info = await stat(path)
    if (!info.isFile()) return failure('dsh-context-explainer/not-a-file', 'path is not a regular file')
    if (info.size > MAX_BYTES) {
      const head = await readFile(path, { encoding: 'utf8' })
      return reply({ ok: true, path, text: head.slice(0, MAX_BYTES), truncated: true, size: info.size })
    }
    const text = await readFile(path, 'utf8')
    if (text.includes('\u0000')) return failure('dsh-context-explainer/binary', 'file is not text')
    return reply({ ok: true, path, text, truncated: false, size: info.size })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'read failed'
    return failure('dsh-context-explainer/read-failed', message)
  }
}

export function watchFileRoute(ctx: Context): () => void {
  const fiber = ctx.inject(['connection'], (c) => {
    const connection = c.get('connection') as ConnectionHostFace | undefined
    registerPostRoute(c, connection, FILE_ROUTE, handle, 'dsh-context-explainer: file preview route')
  })
  const dispose = (fiber as { dispose?: () => unknown } | undefined)?.dispose
  return () => { void dispose?.call(fiber) }
}
