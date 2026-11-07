import { createElement as h, useEffect, useRef, useState, type ReactElement, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useEscapeClose } from './escapeClose'
import type { ViewKit } from '../viewkit'

/**
 * In-place fullscreen: the caller expands its own root element with CSS while
 * this layer only adds the floating toolbar (native fullscreen toggle + exit)
 * and the Escape / scroll-lock plumbing. Keeping the single mounted view means
 * every button, chart and piece of state stays live instead of being cloned.
 */
export function makeFullscreenLayer(kit: ViewKit) {
  const { t } = kit
  function FullscreenLayer(props: {
    open: boolean
    onClose: () => void
    targetRef: RefObject<HTMLElement | null>
  }): ReactElement | null {
    const { open, onClose, targetRef } = props
    const [native, setNative] = useState(false)
    const barRef = useRef<HTMLDivElement | null>(null)
    useEscapeClose(open, onClose)
    useEffect(() => {
      if (!open) return undefined
      const previous = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = previous }
    }, [open])
    useEffect(() => {
      if (!open) return undefined
      const onChange = (): void => setNative(document.fullscreenElement === targetRef.current)
      document.addEventListener('fullscreenchange', onChange)
      return () => { document.removeEventListener('fullscreenchange', onChange) }
    }, [open, targetRef])
    if (!open) return null
    const toggleNative = (): void => {
      const el = targetRef.current
      if (el === null) return
      if (document.fullscreenElement !== null) void document.exitFullscreen().catch(() => {})
      else void el.requestFullscreen().catch(() => {})
    }
    return createPortal(
      <div className="lc-fs-dock" ref={barRef} role="toolbar" aria-label={t('fs.title')}>
        <button type="button" className="lc-gran-btn lc-fs-dock-btn" onClick={toggleNative} title={t('fs.native')}>
          {native ? t('fs.windowed') : t('fs.native')}
        </button>
        <button type="button" className="lc-gran-btn lc-fs-dock-btn" onClick={onClose} title={t('fs.close')}>
          {t('fs.close')} ✕
        </button>
      </div>,
      document.body,
    )
  }
  return FullscreenLayer
}
