import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { onLayoutReset, touchLayout } from '../layoutStore'

export interface ColumnSplit {
  /** Pinned pixel width for the resized column, null until the user drags. */
  width: number | null
  /** Attach to the flex row that hosts the resizer. */
  rootRef: RefObject<HTMLDivElement>
  onPointerDown: (ev: ReactPointerEvent<HTMLDivElement>) => void
}

/**
 * Drag-to-resize for a column inside a flex row. The resizer sits to the LEFT of
 * the target column, so dragging left widens it.
 */
export function useColumnSplit(targetSelector: string, min = 280): ColumnSplit {
  const [width, setWidth] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => onLayoutReset(() => { setWidth(null) }), [])
  const onPointerDown = useCallback((ev: ReactPointerEvent<HTMLDivElement>): void => {
    const root = ev.currentTarget.parentElement
    if (root === null) return
    const target = root.querySelector<HTMLElement>(targetSelector)
    if (target === null) return
    ev.preventDefault()
    const rect = root.getBoundingClientRect()
    const startWidth = target.getBoundingClientRect().width
    const startX = ev.clientX
    const onMove = (move: PointerEvent): void => {
      const next = Math.round(startWidth - (move.clientX - startX))
      const max = Math.max(min, rect.width - min)
      setWidth(Math.min(max, Math.max(min, next)))
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [min, targetSelector])
  return { width, rootRef, onPointerDown }
}

/**
 * Drag handle for the edge of a panel: growing the PREVIOUS sibling.
 * Used for stacked fleet boards (vertical) and the graph column (horizontal).
 */
export function useEdgeResize(axis: 'x' | 'y', min = 140, target: 'prev' | 'next' = 'prev'): (ev: ReactPointerEvent<HTMLDivElement>) => void {
  return useCallback((ev: ReactPointerEvent<HTMLDivElement>): void => {
    const prev = target === 'prev'
      ? ev.currentTarget.previousElementSibling
      : ev.currentTarget.nextElementSibling
    if (!(prev instanceof HTMLElement)) return
    ev.preventDefault()
    const rect = prev.getBoundingClientRect()
    const start = axis === 'x' ? rect.width : rect.height
    const startPos = axis === 'x' ? ev.clientX : ev.clientY
    const parent = prev.parentElement
    const gridParent = parent !== null && getComputedStyle(parent).display === 'grid' ? parent : null
    const onMove = (move: PointerEvent): void => {
      const delta = (axis === 'x' ? move.clientX : move.clientY) - startPos
      const size = Math.max(min, Math.round(start + delta))
      if (axis === 'x') {
        if (gridParent !== null) touchLayout(gridParent, { 'grid-template-columns': size + 'px 9px minmax(0, 1fr)' })
        else touchLayout(prev, { width: size + 'px', flex: '0 0 auto' })
      } else {
        touchLayout(prev, { height: size + 'px', 'max-height': 'none' })
      }
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [axis, min, target])
}
