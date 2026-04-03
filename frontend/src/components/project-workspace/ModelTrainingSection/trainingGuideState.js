export function mergeTrainingGuideState(patch, options = {}) {
  if (typeof window === 'undefined') return;

  const prev = window.__trainingGuideState || {};
  const next = {
    ...prev,
    ...patch,
    isTrainingPage: true,
  };

  window.__trainingGuideState = next;
  window.dispatchEvent(new CustomEvent('trainingGuideStateChanged', {
    detail: { forceRefresh: !!options.forceRefresh, patch },
  }));
}

export function replaceTrainingGuideState(state, options = {}) {
  if (typeof window === 'undefined') return;

  window.__trainingGuideState = {
    isTrainingPage: true,
    ...state,
  };

  window.dispatchEvent(new CustomEvent('trainingGuideStateChanged', {
    detail: { forceRefresh: !!options.forceRefresh, state: window.__trainingGuideState },
  }));
}

export function clearTrainingGuideState() {
  if (typeof window === 'undefined') return;
  delete window.__trainingGuideState;
}
