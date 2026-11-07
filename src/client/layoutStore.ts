import { useEffect } from 'react'

const saved = new Map<HTMLElement, Map<string, string>>()
const listeners = new Set<() => void>()

/** Remember the original inline value once, then apply the custom one. */
export function touchLayout(el: HTMLElement, props: Record<string, string>): void {
  let map = saved.get(el)
  if (map === undefined) {
    map = new Map()
    saved.set(el, map)
  }
  for (const [prop, value] of Object.entries(props)) {
    if (!map.has(prop)) map.set(prop, el.style.getPropertyValue(prop))
    el.style.setProperty(prop, value)
  }
}

/** Restore every panel the user resized back to its default layout. */
export function resetLayout(): void {
  for (const [el, map] of saved) {
    for (const [prop, value] of map) {
      if (value === '') el.style.removeProperty(prop)
      else el.style.setProperty(prop, value)
    }
  }
  saved.clear()
  for (const listener of listeners) listener()
}

export function onLayoutReset(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useLayoutReset(listener: () => void): void {
  useEffect(() => onLayoutReset(listener), [listener])
}
