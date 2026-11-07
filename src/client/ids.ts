/**
 * Stable registration ids for dsh-context-explainer.
 *
 * They are deliberately distinct from the plain dsh-context plugin so both
 * bundles can be loaded side by side: slot ids, locale namespaces and command
 * names are all keyed by these values.
 */
export const PLUGIN_ID = 'dsh-context-explainer'

export const LOCALE_NS = PLUGIN_ID

export const JUMP_SLOT = 'conversation.chat.assistant-actions'

export const JUMP_SLOT_ID = 'context-jump-explainer'

export const CONTEXT_VIEW_SLOT = 'conversation.view'

export const CONTEXT_VIEW_ID = 'context-explainer'

export const FLEET_VIEW_ID = 'fleet-explainer'

export const SIDEBAR_TAB_SLOT = 'sidebar.right.pane.tab'

export const SIDEBAR_TAB_ID = 'dsh-context-explainer'

export const COMMAND_ID = 'context-explainer'

export const MODAL_OVERLAY_SLOT = 'conversation.input.overlay'

export const MODAL_OVERLAY_ID = 'context-modal-explainer'

export interface SlotRegistrationInfo {
  /** Human readable purpose of the registration. */
  labelKey: string
  /** Loader slot name the entry is seated in. */
  slot: string
  /** Id the entry is registered under (this is what makes it unique). */
  id: string
}

export const SLOT_REGISTRATIONS: readonly SlotRegistrationInfo[] = [
  { labelKey: 'plugin.slots.view', slot: CONTEXT_VIEW_SLOT, id: CONTEXT_VIEW_ID },
  { labelKey: 'plugin.slots.fleet', slot: CONTEXT_VIEW_SLOT, id: FLEET_VIEW_ID },
  { labelKey: 'plugin.slots.sidebar', slot: SIDEBAR_TAB_SLOT, id: SIDEBAR_TAB_ID },
  { labelKey: 'plugin.slots.jump', slot: JUMP_SLOT, id: JUMP_SLOT_ID },
  { labelKey: 'plugin.slots.command', slot: '/ command', id: COMMAND_ID },
  { labelKey: 'plugin.slots.overlay', slot: MODAL_OVERLAY_SLOT, id: MODAL_OVERLAY_ID },
]
