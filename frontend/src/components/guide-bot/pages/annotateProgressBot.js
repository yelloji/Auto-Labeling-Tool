/**
 * annotateProgressBot.js — Annotation Progress page logic for the guide bot.
 *
 * Snapshot-on-open (3 states):
 *   State 1 — Split drawer open → show all 5 split method options
 *   State 2 — All images labeled → show Add to Dataset button + Train/Val/Test explanation
 *   State 3 — Some images not labeled → show count + Start Labeling button
 *
 * Exports:
 *   checkAnnotateProgressPageState(lang, refs, setters)
 *   handleAnnotateProgressAnswer(step, value, lang, refs, setters)
 */

// ---------------------------------------------------------------------------
// Internal DOM helpers (split drawer)
// ---------------------------------------------------------------------------

// Select a split method in the Ant Design Select inside the open drawer
// by calling its React fiber onChange directly (no dropdown click needed)
function selectSplitMethod(value) {
  const selectEl = document.querySelector('.ant-drawer-open .ant-select');
  if (!selectEl) return;
  const key = Object.keys(selectEl).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
  if (!key) return;
  let fiber = selectEl[key];
  while (fiber) {
    const props = fiber.memoizedProps || fiber.pendingProps;
    if (props && typeof props.onChange === 'function') {
      props.onChange(value);
      return;
    }
    fiber = fiber.return;
  }
}

// Set the range slider values [trainEndPoint, valEndPoint] via React fiber
// trainEndPoint = trainPct, valEndPoint = trainPct + valPct
function setSliderValues(trainPct, valPct) {
  const sliderEl = document.querySelector('.ant-drawer-open .ant-slider');
  if (!sliderEl) return;
  const key = Object.keys(sliderEl).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
  if (!key) return;
  let fiber = sliderEl[key];
  while (fiber) {
    const props = fiber.memoizedProps || fiber.pendingProps;
    if (props && typeof props.onChange === 'function') {
      props.onChange([trainPct, trainPct + valPct]);
      return;
    }
    fiber = fiber.return;
  }
}

// Click "Update & Go to Workspace" button inside the open drawer
function clickDrawerSubmit() {
  const btn = Array.from(document.querySelectorAll('.ant-drawer-open button'))
    .find(b => b.textContent.trim() === 'Update & Go to Workspace');
  if (btn) btn.click();
}

// ---------------------------------------------------------------------------
// Snapshot check
// ---------------------------------------------------------------------------
export function checkAnnotateProgressPageState(lang, refs, setters) {
  // ---- State 1: Split drawer is open ----
  const drawerEl = document.querySelector('.ant-drawer-open');
  if (drawerEl) {
    const hasSplitTitle = Array.from(drawerEl.querySelectorAll('*'))
      .some(el => el.children.length === 0 && el.textContent.trim() === 'Split Method');
    if (hasSplitTitle) {
      const msg = lang === 'it'
        ? 'Scegli come suddividere le immagini etichettate:\n• Usa Suddivisione Esistente — mantiene i valori train/val/test attuali\n• Suddividi per % — assegna casualmente in base alle percentuali che scegli\n• Tutte al Training — tutte le immagini vanno al set di training\n• Tutte alla Validation — tutte al set di validazione\n• Tutte al Test — tutte al set di test'
        : 'Choose how to split your labeled images:\n• Use Existing Split — keeps current train/val/test assignments\n• Split by % (Train/Val/Test) — randomly assigns by percentage you set\n• All to Train Set — all images go to training\n• All to Validation Set — all images go to validation\n• All to Test Set — all images go to test';

      const opts = lang === 'it'
        ? ['Usa Suddivisione Esistente', 'Suddividi per % (Train/Val/Test)', 'Tutte al Training', 'Tutte alla Validation', 'Tutte al Test']
        : ['Use Existing Split', 'Split by % (Train/Val/Test)', 'All to Train Set', 'All to Validation Set', 'All to Test Set'];

      return {
        wizardType: 'annotate-progress-split',
        conversation: [{ role: 'bot', text: msg, inputType: 'buttons', options: opts, step: 'split-choose' }],
        step: 'split-choose',
      };
    }
  }

  // Detect Annotation Progress page by "Overall Progress:" text
  const overallEl = Array.from(document.querySelectorAll('div, span, p'))
    .find(el => el.textContent.trim().startsWith('Overall Progress:'));
  if (!overallEl) return null;

  const addBtn = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.trim() === 'Add Images to Dataset');

  // ---- State 2: All images labeled ----
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

  // ---- State 3: Some images not labeled ----
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
  const { setIsOpen, setWizardMode, setWizardType, setConversation, addMessage, requestReopen } = setters;

  function closeBot() {
    setWizardMode(false);
    setWizardType(null);
    setConversation([]);
    setIsOpen(false);
  }

  // ---- Split drawer: user chose a split method ----
  if (step === 'split-choose') {
    const isRandom = value.includes('Split by') || value.includes('Suddividi per');
    if (isRandom) {
      const askMsg = lang === 'it'
        ? 'Inserisci Train% e Validation% separati da spazio o virgola (es. 70 20). Il Test verrà calcolato automaticamente.'
        : 'Enter Train% and Validation% separated by space or comma (e.g. 70 20). Test is calculated automatically.';
      addMessage('bot', askMsg, { inputType: 'text', placeholder: '70 20', step: 'split-random-percentages' });
      return;
    }

    // Map button label → dropdown value
    const VALUE_MAP = {
      'Use Existing Split':      'use_existing',
      'All to Train Set':        'all_train',
      'All to Validation Set':   'all_val',
      'All to Test Set':         'all_test',
      'Usa Suddivisione Esistente': 'use_existing',
      'Tutte al Training':       'all_train',
      'Tutte alla Validation':   'all_val',
      'Tutte al Test':           'all_test',
    };
    const dropdownValue = VALUE_MAP[value];
    if (dropdownValue) {
      setTimeout(() => {
        selectSplitMethod(dropdownValue);
        setTimeout(() => clickDrawerSubmit(), 300);
      }, 200);
    }
    requestReopen?.();
    closeBot();
    return;
  }

  // ---- Split by %: parse Train% and Val%, validate, set slider, submit ----
  if (step === 'split-random-percentages') {
    const nums = value.split(/[\s,]+/).map(n => parseInt(n, 10)).filter(n => !isNaN(n));
    const valid = nums.length >= 2 && nums[0] > 0 && nums[1] > 0 && nums[0] + nums[1] < 100;
    if (!valid) {
      const errMsg = lang === 'it'
        ? 'Valori non validi. Inserisci due numeri (es. 70 20) che sommino a meno di 100.'
        : 'Invalid values. Enter two numbers (e.g. 70 20) that sum to less than 100.';
      addMessage('bot', errMsg, { inputType: 'text', placeholder: '70 20', step: 'split-random-percentages' });
      return;
    }
    const [trainPct, valPct] = nums;
    const testPct = 100 - trainPct - valPct;
    const confirmMsg = lang === 'it'
      ? `Train: ${trainPct}%, Validation: ${valPct}%, Test: ${testPct}%. Applico e invio.`
      : `Train: ${trainPct}%, Validation: ${valPct}%, Test: ${testPct}%. Applying and submitting.`;
    addMessage('bot', confirmMsg, {});
    setTimeout(() => {
      selectSplitMethod('assign_random');
      setTimeout(() => {
        setSliderValues(trainPct, valPct);
        setTimeout(() => clickDrawerSubmit(), 400);
      }, 300);
    }, 200);
    requestReopen?.();
    closeBot();
    return;
  }

  // ---- All labeled state — two buttons: What is Train/Val/Test? and Add to Dataset ----
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
    requestReopen?.();
    closeBot();
    return;
  }

  // ---- After Train/Val/Test explanation — Add to Dataset button ----
  if (step === 'progress-add') {
    setTimeout(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent.trim() === 'Add Images to Dataset');
      if (btn) btn.click();
    }, 200);
    requestReopen?.();
    closeBot();
    return;
  }

  // ---- Incomplete state — click Unannotated tab then first image card ----
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
    requestReopen?.();
    closeBot();
    return;
  }
}
