// web/src/keybindings.js
/* The user's keybindings from ~/.px0/keybindings.json map an action id (ACTIONS in
   shortcuts.js) to one combo or a list: {"diff.toggle": "Ctrl+D"}. Combos are
   written as the help sheet writes them. Mod is Cmd on a Mac and Ctrl elsewhere;
   Cmd and Ctrl name the key itself. They are checked before the built-in
   shortcuts, which keep working alongside them. */
import { api, isMac } from './state.js';

const NAMED = {
  left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
  esc: 'Escape', escape: 'Escape', enter: 'Enter', tab: 'Tab', space: 'Space',
  home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown',
  backspace: 'Backspace', delete: 'Delete',
};
const PUNCT = {
  '[': 'BracketLeft', ']': 'BracketRight', '\\': 'Backslash', ',': 'Comma', '.': 'Period',
  '/': 'Slash', ';': 'Semicolon', "'": 'Quote', '`': 'Backquote', '-': 'Minus', '=': 'Equal',
};

/* Keys match on e.code, not e.key: on a Mac, Option+letter types a symbol. */
function codeFor(key) {
  if (/^[a-z]$/i.test(key)) return 'Key' + key.toUpperCase();
  if (/^[0-9]$/.test(key)) return 'Digit' + key;
  if (/^f([1-9]|1[0-2])$/i.test(key)) return key.toUpperCase();
  return PUNCT[key] || NAMED[key.toLowerCase()] || null;
}

/** @returns {{ctrl:boolean, meta:boolean, alt:boolean, shift:boolean, code:string, label:string}|null} */
export function parseCombo(combo) {
  if (typeof combo !== 'string') return null;
  const parts = combo.split('+').map(p => p.trim());
  const key = parts.pop() || '';
  const c = { ctrl: false, meta: false, alt: false, shift: false, code: codeFor(key), label: '' };
  if (!c.code) return null;
  for (const m of parts.map(p => p.toLowerCase())) {
    if (m === 'mod') c[isMac ? 'meta' : 'ctrl'] = true;
    else if (m === 'ctrl' || m === 'control') c.ctrl = true;
    else if (m === 'cmd' || m === 'meta' || m === 'super') c.meta = true;
    else if (m === 'alt' || m === 'option' || m === 'opt') c.alt = true;
    else if (m === 'shift') c.shift = true;
    else return null;
  }
  // Back to keyLabel's spelling, where Mod is the platform's main modifier.
  const mods = isMac
    ? [c.ctrl && 'Ctrl', c.alt && 'Alt', c.shift && 'Shift', c.meta && 'Mod']
    : [c.ctrl && 'Mod', c.meta && 'Meta', c.alt && 'Alt', c.shift && 'Shift'];
  c.label = [...mods.filter(Boolean), key.length === 1 ? key.toUpperCase() : key].join('+');
  return c;
}

let bindings = []; // [{ action, combo }]

export async function loadKeybindings() {
  try {
    const res = await api('/api/keybindings');
    if (res.problem) console.warn('px0: ignoring keybindings.json:', res.problem);
    const next = [];
    for (const [action, v] of Object.entries(res.bindings || {})) {
      for (const s of Array.isArray(v) ? v : [v]) {
        const combo = parseCombo(s);
        if (combo) next.push({ action, combo });
        else console.warn(`px0: keybindings.json: cannot read ${JSON.stringify(s)} for ${action}`);
      }
    }
    bindings = next;
  } catch (err) {
    console.warn('px0: could not load keybindings', err);
  }
}

/** The action bound to this key press, or null. */
export function boundAction(e) {
  for (const { action, combo: c } of bindings) {
    if (e.code === c.code && e.ctrlKey === c.ctrl && e.metaKey === c.meta &&
        e.altKey === c.alt && e.shiftKey === c.shift) return action;
  }
  return null;
}

/** Help sheet labels of the user's combos for an action. */
export const userCombos = action => bindings.filter(b => b.action === action).map(b => b.combo.label);
