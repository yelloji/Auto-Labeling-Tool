// Shared helpers for Models UI
// - buildClassesCSV: generate CSV string with header id,name
// - copyTextToClipboard: robust clipboard copy with fallback

export function buildClassesCSV(classes) {
  const list = Array.isArray(classes) ? classes : [];
  const header = 'id,name';
  const rows = list.map((name, idx) => `${idx},${String(name).replace(/"/g, '"')}`);
  return [header, ...rows].join('\n');
}

export async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {
    // fallthrough to legacy
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch (_) {
    return false;
  }
}