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
// Finds column by header text — robust against other ant-col-8 elements on page.
// Dataset cards have the 'hoverable' prop (ant-card-hoverable); the container card does not.
// ---------------------------------------------------------------------------
export function clickColumnCard(colIndex) {
  const HEADERS = ['Unassigned', 'Annotating', 'Dataset'];
  const header = HEADERS[colIndex];
  if (!header) return;

  // Find the column whose card header starts with the target text
  const col = Array.from(document.querySelectorAll('.ant-col')).find(c => {
    const head = c.querySelector('.ant-card-head');
    return head && head.textContent.trim().startsWith(header);
  });
  if (!col) return;

  // Dataset cards are hoverable; the container column card is not
  const card = col.querySelector('.ant-card-hoverable');
  if (card) card.click();
}
