export function mergeModelLabGuideState(patch, options = {}) {
  if (typeof window === 'undefined') return;

  const prev = window.__modellabGuideState || {};
  const next = {
    ...prev,
    ...patch,
    isModelLabPage: true,
  };

  window.__modellabGuideState = next;
  window.dispatchEvent(new CustomEvent('modellabGuideStateChanged', {
    detail: { forceRefresh: !!options.forceRefresh, patch, state: next },
  }));
}

export function replaceModelLabGuideState(state, options = {}) {
  if (typeof window === 'undefined') return;

  const next = {
    isModelLabPage: true,
    ...state,
  };

  window.__modellabGuideState = next;
  window.dispatchEvent(new CustomEvent('modellabGuideStateChanged', {
    detail: { forceRefresh: !!options.forceRefresh, state: next },
  }));
}

export function clearModelLabGuideState() {
  if (typeof window === 'undefined') return;
  delete window.__modellabGuideState;
}
