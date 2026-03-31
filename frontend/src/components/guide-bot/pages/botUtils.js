/**
 * botUtils.js — Shared DOM utilities for all guide-bot page handlers.
 *
 * No React imports — pure DOM helpers only.
 * Imported by uploadBot, modelBot, projectBot, managementBot.
 */

// ---------------------------------------------------------------------------
// Set value on a React-controlled input (bypasses React synthetic events)
// ---------------------------------------------------------------------------
export function setReactInputValue(input, value) {
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  nativeSetter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

// ---------------------------------------------------------------------------
// Click a button inside the antd modal by text
// ---------------------------------------------------------------------------
export function clickModalButton(text) {
  const btn = Array.from(document.querySelectorAll('.ant-modal button, .ant-modal-body button'))
    .find(b => b.textContent.trim().includes(text));
  if (btn) btn.click();
}

// ---------------------------------------------------------------------------
// Click a workspace sidebar menu item by exact label text
// e.g. clickSidebarItem('Management'), clickSidebarItem('Dataset')
// ---------------------------------------------------------------------------
export function clickSidebarItem(label) {
  const el = Array.from(document.querySelectorAll('li, a, span'))
    .find(e => e.textContent.trim() === label);
  if (el) el.click();
}

// ---------------------------------------------------------------------------
// Click the first dataset card in a Management column.
// colIndex: 0 = Unassigned, 1 = Annotating, 2 = Dataset
// Each column is .ant-col-8; dataset cards are nested inside the container card.
// ---------------------------------------------------------------------------
export function clickColumnCard(colIndex) {
  const cols = Array.from(document.querySelectorAll('.ant-col.ant-col-8'));
  const col = cols[colIndex];
  if (!col) return;
  // Dataset cards are nested inside the outer container card (.ant-card .ant-card)
  const cards = col.querySelectorAll('.ant-card .ant-card');
  if (cards[0]) cards[0].click();
}
