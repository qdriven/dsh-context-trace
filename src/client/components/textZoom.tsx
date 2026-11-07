import { createElement as h, useState, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useEscapeClose } from './escapeClose'

export interface ZoomFace {
  open: boolean
  openZoom: () => void
  closeZoom: () => void
}

/** Tiny shared state for a text block that can be read full-width. */
export function useTextZoom(): ZoomFace {
  const [open, setOpen] = useState(false)
  useEscapeClose(open, () => { setOpen(false) })
  return {
    open,
    openZoom: () => { setOpen(true) },
    closeZoom: () => { setOpen(false) },
  }
}

export function ZoomButton(props: {
  open: boolean
  title: string
  onOpen: () => void
}): ReactElement {
  return (
    <button
      type="button"
      className={'lc-ts-zoom lc-gran-btn' + (props.open ? ' lc-gran-on' : '')}
      title={props.title}
      aria-label={props.title}
      aria-pressed={props.open}
      onClick={props.onOpen}
    >⛶</button>
  )
}

export function ZoomOverlay(props: {
  open: boolean
  label: string
  title: string
  meta?: ReactNode
  tools?: ReactNode
  children: ReactNode
  onClose: () => void
}): ReactElement | null {
  if (!props.open) return null
  return createPortal(
    <div className="lc-text-zoom" role="dialog" aria-modal="true" aria-label={props.label}>
      <div className="lc-text-zoom-bar">
        <span className="lc-text-zoom-title">
          <span className="lc-text-zoom-mark" aria-hidden>{'⛶'}</span>
          {props.label}
        </span>
        {props.meta}
        <span className="lc-text-zoom-tools">
          {props.tools}
          <button
            type="button"
            className="lc-gran-btn lc-text-zoom-close"
            onClick={props.onClose}
            title={props.title}
          >✕</button>
        </span>
      </div>
      <div className="lc-text-zoom-body">{props.children}</div>
    </div>,
    document.body,
  )
}
