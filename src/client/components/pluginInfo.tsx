import { createElement as h, useState, type ReactElement, type ReactNode } from 'react'
import { IconPlugin, IconSettings } from '../primitives'
import { siDeepseek, siGithub, type SimpleIcon } from 'simple-icons'
import { useNewerVersion } from '../latestVersion'
import { PLUGIN_NAME, PLUGIN_REPO, PLUGIN_REPO_SHORT, PLUGIN_VERSION } from '../meta'
import { PLUGIN_ID, SLOT_REGISTRATIONS } from '../ids'
import { openPluginSettings, type ClientCtx } from '../services'
import type { ViewKit } from '../viewkit'

function SiteMark({ icon }: { icon: SimpleIcon }): ReactElement {
  return (
    <svg width={12} height={12} className="lc-pi-labelicon" viewBox="-2 -2 28 28" fill="none" aria-hidden>
      <path d={icon.path} fill="currentColor" />
    </svg>
  )
}

export function makePluginInfo(kit: ViewKit, ctx: ClientCtx): () => ReactElement {
  const { t } = kit
  const row = (icon: ReactElement, label: string, value: ReactNode, href: string, hint: string) => (
    <a className="lc-pi-row group/pi" href={href} target="_blank" rel="noreferrer">
      <div className="lc-pi-label">{icon}{label}</div>
      <div className="lc-pi-value group-hover/pi:underline" title={hint}>{value}</div>
    </a>
  )

  function PluginInfo(props: { children?: ReactNode }): ReactElement {
    const update = useNewerVersion()
    const nameText = PLUGIN_NAME + ' (v' + PLUGIN_VERSION + ')'
    const nameValue: ReactNode[] = [nameText]
    if (update) nameValue.push(<span key="update" className="lc-pi-update">{'↑ v' + update}</span>)
    return (
      <div className="lc-card">
        <div className="lc-card-title">
          <span className="lc-card-title-text">
            <IconPlugin size={14} />
            {t('plugin.title')}
          </span>
          <a className="lc-card-sub lc-pi-hint hover:underline" href={PLUGIN_REPO} target="_blank" rel="noreferrer">
            {t('plugin.hint')}
          </a>
        </div>
        <div className="lc-pi-grid">
          {row(<SiteMark icon={siDeepseek} />, t('plugin.name'), nameValue, PLUGIN_REPO, update !== null ? nameText + ' ↑ v' + update : nameText)}
          {row(<SiteMark icon={siGithub} />, t('plugin.github'), PLUGIN_REPO_SHORT, PLUGIN_REPO, PLUGIN_REPO_SHORT)}
          <button type="button" className="lc-pi-row lc-pi-row-btn group/pi" onClick={() => { openPluginSettings(ctx) }}>
            <div className="lc-pi-label"><IconSettings size={12} className="lc-pi-labelicon" />{t('plugin.settings')}</div>
            <div className="lc-pi-value group-hover/pi:underline" title={t('plugin.settingsOpen')}>{t('plugin.settingsOpen')}</div>
          </button>
        </div>
        {props.children}
      </div>
    )
  }

  function SlotInfo(): ReactElement {
    const [open, setOpen] = useState(false)
    return (
      <div className="lc-pi-section">
        <button
          type="button"
          className="lc-pi-section-head lc-pi-section-toggle"
          aria-expanded={open}
          onClick={() => { setOpen(value => !value) }}
        >
          <span className="lc-pi-chev" aria-hidden>{open ? '▾' : '▸'}</span>
          <span className="lc-pi-section-title">{t('plugin.slots.title')}</span>
          <span className="lc-pi-code">{PLUGIN_ID}</span>
        </button>
        {open ? (
          <div className="lc-pi-slotgrid">
            {SLOT_REGISTRATIONS.map((slot, index) => (
              <div className="lc-pi-row" key={slot.labelKey}>
                <div className="lc-pi-label">{t(slot.labelKey)}</div>
                <div className="lc-pi-value lc-pi-slot">
                  <span className="lc-pi-code">{slot.slot}</span>
                  <span className="lc-pi-arrow">→</span>
                  <span className={'lc-pi-code lc-pi-id lc-slot-c' + String(index % 5)}>{slot.id}</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return function PluginInfoCard(): ReactElement {
    return h(PluginInfo, null, h(SlotInfo))
  }
}
