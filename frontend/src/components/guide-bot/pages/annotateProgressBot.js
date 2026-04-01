/**
 * annotateProgressBot.js — Annotation Progress page logic for the guide bot.
 *
 * Snapshot-on-open (2 states):
 *   State 1 — All images labeled → show Add to Dataset button + Train/Val/Test explanation
 *   State 2 — Some images not labeled → show count + Start Labeling button
 *
 * Exports:
 *   checkAnnotateProgressPageState(lang, refs, setters)
 *   handleAnnotateProgressAnswer(step, value, lang, refs, setters)
 */

// ---------------------------------------------------------------------------
// Snapshot check
// ---------------------------------------------------------------------------
export function checkAnnotateProgressPageState(lang, refs, setters) {
  // Detect Annotation Progress page by "Overall Progress:" text
  const overallEl = Array.from(document.querySelectorAll('div, span, p'))
    .find(el => el.textContent.trim().startsWith('Overall Progress:'));
  if (!overallEl) return null;

  const addBtn = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.trim() === 'Add Images to Dataset');

  // ---- State 1: All images labeled ----
  if (addBtn) {
    const msg = lang === 'it'
      ? 'Tutte le immagini sono etichettate! Aggiungile al Dataset — scegli come suddividerle in Train, Validation e Test.'
      : 'All images are labeled! Add them to the Dataset — choose how to split them into Train, Validation and Test.';
    const whatLabel = lang === 'it' ? 'Cosa sono Train/Val/Test?' : 'What is Train/Val/Test?';
    const addLabel  = lang === 'it' ? 'Aggiungi al Dataset'       : 'Add to Dataset';
    return {
      wizardType: 'annotate-progress-complete',
      conversation: [{ role: 'bot', text: msg, inputType: 'buttons', options: [whatLabel, addLabel], step: 'progress-complete' }],
      step: 'progress-complete',
    };
  }

  // ---- State 2: Some images not labeled ----
  const match = overallEl.textContent.trim().match(/(\d+)\s*\/\s*(\d+)/);
  const labeled    = match ? parseInt(match[1]) : 0;
  const total      = match ? parseInt(match[2]) : 0;
  const remaining  = total - labeled;

  const msg = lang === 'it'
    ? `${labeled} immagin${labeled !== 1 ? 'i' : 'e'} etichettate, ${remaining} rimanenti. Clicca su qualsiasi immagine non etichettata per aprire il canvas e disegnare i riquadri.`
    : `${labeled} image${labeled !== 1 ? 's' : ''} labeled, ${remaining} remaining. Click any unlabeled image to open the canvas and draw boxes.`;
  const startLabel = lang === 'it' ? 'Inizia Etichettatura' : 'Start Labeling';
  return {
    wizardType: 'annotate-progress-incomplete',
    conversation: [{ role: 'bot', text: msg, inputType: 'buttons', options: [startLabel], step: 'progress-incomplete' }],
    step: 'progress-incomplete',
  };
}

// ---------------------------------------------------------------------------
// Handle wizard answers
// ---------------------------------------------------------------------------
export function handleAnnotateProgressAnswer(step, value, lang, refs, setters) {
  const { setIsOpen, setWizardMode, setWizardType, setConversation, addMessage } = setters;

  function closeBot() {
    setWizardMode(false);
    setWizardType(null);
    setConversation([]);
    setIsOpen(false);
  }

  // All labeled state — two buttons: What is Train/Val/Test? and Add to Dataset
  if (step === 'progress-complete') {
    const isWhat = value.includes('Train') || value.includes('Cosa');
    if (isWhat) {
      const explanation = lang === 'it'
        ? 'Train (60-70%): immagini da cui l\'AI impara. Validation (20-30%): immagini per verificare l\'apprendimento. Test (10%): verifica finale dell\'accuratezza. Usa il cursore per regolare le percentuali.'
        : 'Train (60-70%): images the AI learns from. Validation (20-30%): images to check learning accuracy. Test (10%): final accuracy check. Use the slider to adjust the percentages.';
      const addLabel = lang === 'it' ? 'Aggiungi al Dataset' : 'Add to Dataset';
      addMessage('bot', explanation, { inputType: 'buttons', options: [addLabel], step: 'progress-add' });
      return;
    }
    // Add to Dataset — click the button
    setTimeout(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent.trim() === 'Add Images to Dataset');
      if (btn) btn.click();
    }, 200);
    closeBot();
    return;
  }

  // After Train/Val/Test explanation — Add to Dataset button
  if (step === 'progress-add') {
    setTimeout(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent.trim() === 'Add Images to Dataset');
      if (btn) btn.click();
    }, 200);
    closeBot();
    return;
  }

  // Incomplete state — click Unannotated tab then first image card
  if (step === 'progress-incomplete') {
    setTimeout(() => {
      const tabs = Array.from(document.querySelectorAll('.ant-tabs-tab'));
      const unannotatedTab = tabs.find(t => t.textContent.includes('Unannotated'));
      if (unannotatedTab) {
        unannotatedTab.click();
        setTimeout(() => {
          const card = document.querySelector('.ant-card-hoverable');
          if (card) card.click();
        }, 400);
      } else {
        // Fallback: click first card that contains Unlabeled tag
        const card = Array.from(document.querySelectorAll('.ant-card-hoverable'))
          .find(c => c.textContent.includes('Unlabeled'));
        if (card) card.click();
      }
    }, 200);
    closeBot();
    return;
  }
}
