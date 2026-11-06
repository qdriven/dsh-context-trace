import { useEffect, useState } from 'react'

const pendingFocus = new Map<string, number>()

const focusListeners = new Set<() => void>()

export function requestTraceFocus(sessionId: string): void {
  pendingFocus.set(sessionId, Date.now())
  for (const listener of focusListeners) listener()
}

export function subscribeTraceFocus(listener: () => void): () => void {
  focusListeners.add(listener)
  return () => { focusListeners.delete(listener) }
}

export function takeTraceFocus(sessionId: string | undefined): number | null {
  if (sessionId === undefined) return null
  const stamp = pendingFocus.get(sessionId)
  if (stamp === undefined) return null
  pendingFocus.delete(sessionId)
  return stamp
}

export function useTraceFocus(sessionId: string | undefined): number | null {
  const [stamp, setStamp] = useState<number | null>(null)
  useEffect(() => {
    if (sessionId === undefined || sessionId === '') return undefined
    const sync = (): void => {
      const next = takeTraceFocus(sessionId)
      if (next !== null) setStamp(next)
    }
    sync()
    return subscribeTraceFocus(sync)
  }, [sessionId])
  return stamp
}
