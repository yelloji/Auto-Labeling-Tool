/**
 * manualLabelingBot.js — Manual labeling canvas logic for the guide bot.
 *
 * First snapshot-based version:
 *   1. Label popup open
 *   2. Null-marked image
 *   3. Smart tool active
 *   4. Polygon drawing in progress
 *   5. Image already has annotations
 *   6. Empty image
 *
 * The bot on this page should behave like an annotation coach:
 * short context, short next step, 1-3 relevant actions.
 */

function clickTool(toolKey) {
  const btn = document.querySelector(`[data-tool-key="${toolKey}"]`);
  if (btn) btn.click();
}

function clickModalButton(text) {
  const btn = Array.from(document.querySelectorAll('.ant-modal button, .ant-modal-wrap button'))
    .find(b => b.textContent.trim() === text || b.textContent.trim().includes(text));
  if (btn) btn.click();
}

function openLabelSelect() {
  const selectEl = document.querySelector('.ant-modal .ant-select');
  if (selectEl) selectEl.click();
}

function triggerImageNavigation(key) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

function refreshGuideSoon(delay = 250) {
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('manualLabelingGuideRefresh', {
      detail: { forceRefresh: true }
    }));
  }, delay);
}

function getUsedInImageCount() {
  const el = Array.from(document.querySelectorAll('div, span, p'))
    .find(node => /Used in this image \(\d+\)/.test(node.textContent.trim()));
  if (!el) return 0;
  const match = el.textContent.trim().match(/\((\d+)\)/);
  return match ? parseInt(match[1], 10) : 0;
}

function isLabelPopupOpen() {
  return !!Array.from(document.querySelectorAll('.ant-modal-wrap'))
    .find(el => {
      const style = window.getComputedStyle(el);
      const isVisible = style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        !el.classList.contains('ant-modal-wrap-hidden') &&
        !el.getAttribute('aria-hidden');

      return isVisible &&
        el.textContent.includes('Available labels') &&
        (el.textContent.includes('Change label to:') || el.textContent.includes('Select label:'));
    });
}

function isNullMarked() {
  return !!document.querySelector('[data-tool-key="null"].ant-btn-primary');
}

function isSmartActive() {
  return !!document.querySelector('[data-tool-key="smart_polygon"].ant-btn-primary');
}

function isBoxActive() {
  return !!document.querySelector('[data-tool-key="box"].ant-btn-primary');
}

function isPolygonActive() {
  return !!document.querySelector('[data-tool-key="polygon"].ant-btn-primary');
}

function isPolygonDrawing() {
  const state = window.__manualLabelingGuideState;
  if (state?.activeTool === 'polygon' && state?.isPolygonDrawing && state?.polygonPointsCount > 0) {
    return true;
  }

  return !!Array.from(document.querySelectorAll('div, span, p'))
    .find(el => el.textContent.includes('Backspace to undo') && (
      el.textContent.includes('points added') ||
      el.textContent.includes('Click first point') ||
      el.textContent.includes('press Enter to complete')
    ));
}

function isManualLabelingPage() {
  return !!document.querySelector('[data-tool-key="select"]') &&
         !!document.querySelector('[data-tool-key="box"]') &&
         !!document.querySelector('[data-tool-key="polygon"]');
}

function makeState(wizardType, text, options, step) {
  return {
    wizardType,
    conversation: [{ role: 'bot', text, inputType: 'buttons', options, step }],
    step,
  };
}

function getPopupMainOptions(lang) {
  return lang === 'it'
    ? ['Quando uso etichetta esistente?', 'Quando creo una nuova etichetta?', 'Cosa significa Anteprima?']
    : ['When do I use an existing label?', 'When do I create a new label?', 'What does Preview mean?'];
}

function getNullMainOptions(lang) {
  return lang === 'it'
    ? ['Rimuovi Null', 'Immagine Successiva', 'Quando usare Null?']
    : ['Remove Null', 'Next Image', 'When should I use Null?'];
}

function getSmartMainOptions(lang) {
  return lang === 'it'
    ? ['Come uso Smart Polygon?', 'Passa a Box', 'Passa a Polygon']
    : ['How do I use Smart Polygon?', 'Switch to Box', 'Switch to Polygon'];
}

function getBoxMainOptions(lang) {
  return lang === 'it'
    ? ['Come uso Box?', 'Passa a Polygon', 'Passa a Smart Polygon']
    : ['How do I use Box?', 'Switch to Polygon', 'Switch to Smart Polygon'];
}

function getPolygonMainOptions(lang) {
  return lang === 'it'
    ? ['Come uso Polygon?', 'Passa a Box', 'Passa a Smart Polygon']
    : ['How do I use Polygon?', 'Switch to Box', 'Switch to Smart Polygon'];
}

export function checkManualLabelingPageState(lang, refs, setters) {
  if (!isManualLabelingPage()) return null;
  const state = window.__manualLabelingGuideState || {};

  if (isLabelPopupOpen()) {
    const text = lang === 'it'
      ? 'Stai scegliendo l etichetta per questa area. Se l etichetta esiste gia nel progetto, selezionala. Se non esiste ancora, creane una nuova.'
      : 'You are choosing the label for this marked area. If the label already exists in this project, select it. If not, create a new one.';
    const options = getPopupMainOptions(lang);
    return makeState('manual-labeling-popup', text, options, 'popup-choice');
  }

  if (isNullMarked()) {
    const text = lang === 'it'
      ? 'Questa immagine e segnata come sfondo, quindi non ricevera una normale etichetta oggetto. Se vedi davvero un oggetto, rimuovi Null e continua a etichettare.'
      : 'This image is marked as background, so it will not get a normal object label. If you really see an object here, remove Null and continue labeling.';
    const options = getNullMainOptions(lang);
    return makeState('manual-labeling-null', text, options, 'null-choice');
  }

  if (state.activeTool === 'smart_polygon' || isSmartActive()) {
    const text = lang === 'it'
      ? 'Lo strumento Smart Polygon ti aiuta a seguire il bordo dell oggetto. Muovi il mouse per vedere l anteprima, clicca per aggiungere punti utili, usa Alt piu click se vuoi escludere una zona sbagliata.'
      : 'The Smart tool helps follow the object boundary for you. Move your mouse to preview the shape, click to add helpful points, and use Alt+click if you want to exclude a wrong area.';
    const options = getSmartMainOptions(lang);
    return makeState('manual-labeling-smart', text, options, 'smart-choice');
  }

  if (isPolygonDrawing()) {
    const text = lang === 'it'
      ? 'Stai disegnando una forma precisa. Continua a cliccare intorno al bordo dell oggetto, poi premi Enter o fai doppio click per completare. Backspace rimuove l ultimo punto.'
      : 'You are drawing a precise shape. Keep clicking around the object edge, then press Enter or double-click to finish. Backspace removes the last point.';
    const options = lang === 'it'
      ? ['Come finisco?', 'Passa a Select', 'Quando usare Polygon?']
      : ['How do I finish?', 'Switch to Select', 'When should I use Polygon?'];
    return makeState('manual-labeling-polygon', text, options, 'polygon-choice');
  }

  if (state.activeTool === 'polygon' || isPolygonActive()) {
    const text = lang === 'it'
      ? 'Polygon serve per tracciare manualmente un bordo preciso. Clicca punto per punto attorno all oggetto, poi chiudi la forma quando il contorno sembra corretto.'
      : 'Polygon is for drawing a precise manual outline. Click point by point around the object, then close the shape when the contour looks right.';
    const options = getPolygonMainOptions(lang);
    return makeState('manual-labeling-polygon-ready', text, options, 'polygon-ready-choice');
  }

  if (state.activeTool === 'box' || isBoxActive()) {
    const text = lang === 'it'
      ? 'Box e il modo piu semplice per iniziare. Clicca e trascina per disegnare un riquadro attorno all oggetto, poi scegli l etichetta.'
      : 'Box is the simplest way to begin. Click and drag to draw a rectangle around the object, then choose the label.';
    const options = getBoxMainOptions(lang);
    return makeState('manual-labeling-box', text, options, 'box-choice');
  }

  const usedCount = getUsedInImageCount();
  if (usedCount > 0) {
    const text = lang === 'it'
      ? 'Questa immagine ha gia etichette. Se sono corrette, passa oltre. Se qualcosa e sbagliato, usa [+] Select per correggere o eliminare l annotazione, oppure aggiungi un nuovo oggetto.'
      : `This image already has labels. If they look correct, move on. If something is wrong, use [+] Select to change or delete that annotation, or add a new object.`;
    const options = lang === 'it'
      ? ['[+] Select per Correggere', '[ ] Box', '[/\\] Polygon', '[*] Smart Polygon']
      : ['[+] Select to Fix', '[ ] Box', '[/\\] Polygon', '[*] Smart Polygon'];
    return makeState('manual-labeling-has-annotations', text, options, 'annotated-choice');
  }

  const text = lang === 'it'
    ? 'Questa immagine non e ancora etichettata. Scegli il modo piu semplice per iniziare: Box per oggetti rettangolari, Polygon per un bordo manuale preciso, Smart Polygon per un aiuto piu veloce, Null se non c e nulla da etichettare.'
    : 'This image is not labeled yet. Choose the simplest way to begin: Box for rectangular objects, Polygon for a precise manual outline, Smart for faster AI-assisted outlining, or Null if there is nothing to label.';
  const options = lang === 'it'
    ? ['[ ] Box', '[/\\] Polygon', '[*] Smart Polygon', '[N] Null']
    : ['[ ] Box', '[/\\] Polygon', '[*] Smart Polygon', '[N] Null'];
  return makeState('manual-labeling-empty', text, options, 'empty-choice');
}

export function handleManualLabelingAnswer(step, value, lang, refs, setters) {
  const { setIsOpen, setWizardMode, setWizardType, setConversation, addMessage } = setters;

  function closeBot() {
    setWizardMode(false);
    setWizardType(null);
    setConversation([]);
    setIsOpen(false);
  }

  if (step === 'popup-choice') {
    if (value.includes('existing label') || value.includes('etichetta esistente')) {
      const explain = lang === 'it'
        ? 'Usa un etichetta esistente quando il nome corretto e gia nella lista sopra. Ti basta sceglierla dall elenco, controllare Anteprima e poi confermare.'
        : 'Use an existing label when the correct name is already in the list above. Just choose it from the list, check Preview, and then confirm.';
      const backLabel = lang === 'it' ? 'Indietro' : 'Back';
      addMessage('bot', explain, { inputType: 'buttons', options: [backLabel], step: 'popup-back' });
      return;
    }
    if (value.includes('create a new') || value.includes('creo una nuova')) {
      const explain = lang === 'it'
        ? 'Crea una nuova etichetta solo se il nome giusto non esiste ancora. Scrivi il nuovo nome nel campo di testo, poi controlla Anteprima prima di confermare.'
        : 'Create a new label only if the correct name does not exist yet. Type the new name in the text field, then check Preview before you confirm.';
      const backLabel = lang === 'it' ? 'Indietro' : 'Back';
      addMessage('bot', explain, { inputType: 'buttons', options: [backLabel], step: 'popup-back' });
      return;
    }
    const explain = lang === 'it'
      ? 'Anteprima ti mostra come apparira il nome dell etichetta salvata sull immagine. Serve solo per controllare prima di confermare.'
      : 'Preview shows how the saved label name will appear on the image. It is only a quick check before you confirm.';
    const backLabel = lang === 'it' ? 'Indietro' : 'Back';
    addMessage('bot', explain, { inputType: 'buttons', options: [backLabel], step: 'popup-back' });
    return;
  }

  if (step === 'popup-back') {
    const intro = lang === 'it'
      ? 'Stai scegliendo l etichetta per questa area. Se l etichetta esiste gia nel progetto, selezionala. Se non esiste ancora, creane una nuova.'
      : 'You are choosing the label for this marked area. If the label already exists in this project, select it. If not, create a new one.';
    addMessage('bot', intro, { inputType: 'buttons', options: getPopupMainOptions(lang), step: 'popup-choice' });
    return;
  }

  if (step === 'null-choice') {
    if (value.includes('Remove') || value.includes('Rimuovi')) {
      clickTool('null');
      closeBot();
      refreshGuideSoon(300);
      return;
    }
    if (value.includes('Next') || value.includes('Successiva')) {
      triggerImageNavigation('ArrowRight');
      closeBot();
      refreshGuideSoon(400);
      return;
    }
    const explain = lang === 'it'
      ? 'Usa Null quando l immagine non contiene nessun oggetto utile da etichettare. In questo modo il sistema sa che questa immagine e intenzionalmente vuota.'
      : 'Use Null when the image does not contain any useful object to label. This tells the system that this image is intentionally empty.';
    const backLabel = lang === 'it' ? 'Indietro' : 'Back';
    addMessage('bot', explain, { inputType: 'buttons', options: [backLabel], step: 'null-back' });
    return;
  }

  if (step === 'null-back') {
    const intro = lang === 'it'
      ? 'Questa immagine e segnata come sfondo, quindi non ricevera una normale etichetta oggetto. Se vedi davvero un oggetto, rimuovi Null e continua a etichettare.'
      : 'This image is marked as background, so it will not get a normal object label. If you really see an object here, remove Null and continue labeling.';
    addMessage('bot', intro, { inputType: 'buttons', options: getNullMainOptions(lang), step: 'null-choice' });
    return;
  }

  if (step === 'smart-choice') {
    if (value.includes('Smart Polygon')) {
      const explain = lang === 'it'
        ? 'Smart Polygon ti aiuta a seguire il bordo dell oggetto con l aiuto del modello. Muovi il mouse per vedere la forma suggerita, poi clicca per guidarla meglio.'
        : 'Smart Polygon helps follow the object boundary with help from the model. Move your mouse to preview the suggested shape, then click to guide it better.';
      const backLabel = lang === 'it' ? 'Indietro' : 'Back';
      addMessage('bot', explain, { inputType: 'buttons', options: [backLabel], step: 'smart-back' });
      return;
    }
    if (value.includes('How') || value.includes('Come')) {
      const explain = lang === 'it'
        ? 'Muovi il mouse sopra l oggetto per vedere la forma suggerita. Clicca per aggiungere punti positivi. Usa Alt piu click per togliere una parte sbagliata. Quando il contorno sembra giusto, completa la forma.'
        : 'Move the mouse over the object to see the suggested shape. Click to add positive points. Use Alt+click to remove a wrong area. When the outline looks right, complete the shape.';
      const backLabel = lang === 'it' ? 'Indietro' : 'Back';
      addMessage('bot', explain, { inputType: 'buttons', options: [backLabel], step: 'smart-back' });
      return;
    }
    if (value.includes('Box')) {
      clickTool('box');
      closeBot();
      refreshGuideSoon(300);
      return;
    }
    if (value.includes('Polygon')) {
      clickTool('polygon');
      closeBot();
      refreshGuideSoon(300);
      return;
    }
  }

  if (step === 'smart-back') {
    const intro = lang === 'it'
      ? 'Lo strumento Smart Polygon ti aiuta a seguire il bordo dell oggetto. Muovi il mouse per vedere l anteprima, clicca per aggiungere punti utili, usa Alt piu click se vuoi escludere una zona sbagliata.'
      : 'The Smart tool helps follow the object boundary for you. Move your mouse to preview the shape, click to add helpful points, and use Alt+click if you want to exclude a wrong area.';
    addMessage('bot', intro, { inputType: 'buttons', options: getSmartMainOptions(lang), step: 'smart-choice' });
    return;
  }

  if (step === 'box-choice') {
    if (value.includes('How') || value.includes('Come')) {
      const explain = lang === 'it'
        ? 'Con Box, clicca e trascina intorno all oggetto per creare un riquadro. Quando rilasci il mouse, si apre la scelta dell etichetta.'
        : 'With Box, click and drag around the object to create a rectangle. When you release the mouse, the label choice opens.';
      const backLabel = lang === 'it' ? 'Indietro' : 'Back';
      addMessage('bot', explain, { inputType: 'buttons', options: [backLabel], step: 'box-back' });
      return;
    }
    if (value.includes('Polygon')) {
      clickTool('polygon');
      closeBot();
      refreshGuideSoon(300);
      return;
    }
    if (value.includes('Smart Polygon')) {
      clickTool('smart_polygon');
      closeBot();
      refreshGuideSoon(300);
      return;
    }
  }

  if (step === 'box-back') {
    const intro = lang === 'it'
      ? 'Box e il modo piu semplice per iniziare. Clicca e trascina per disegnare un riquadro attorno all oggetto, poi scegli l etichetta.'
      : 'Box is the simplest way to begin. Click and drag to draw a rectangle around the object, then choose the label.';
    addMessage('bot', intro, { inputType: 'buttons', options: getBoxMainOptions(lang), step: 'box-choice' });
    return;
  }

  if (step === 'polygon-choice') {
    if (value.includes('finish') || value.includes('finisco')) {
      const explain = lang === 'it'
        ? 'Per chiudere la forma, premi Enter oppure fai doppio click vicino al punto finale. Backspace rimuove l ultimo punto ed Escape annulla la forma in corso. Durante il disegno puoi usare Shift+Z per annullare un punto e Shift+Y per ripristinarlo. Dopo che hai completato il polygon, Ctrl+Z annulla e Ctrl+Y ripristina. Nota: l annulla funziona dopo il completamento del polygon.'
        : 'To close the shape, press Enter or double-click near the end point. Backspace removes the last point and Escape cancels the shape in progress. While drawing, you can use Shift+Z to undo a point and Shift+Y to redo it. After you complete the polygon, Ctrl+Z undoes and Ctrl+Y redoes. Note: undo works after polygon completion.';
      const backLabel = lang === 'it' ? 'Indietro' : 'Back';
      addMessage('bot', explain, { inputType: 'buttons', options: [backLabel], step: 'polygon-drawing-back' });
      return;
    }
    if (value.includes('Select')) {
      clickTool('select');
      closeBot();
      refreshGuideSoon(300);
      return;
    }
    const explain = lang === 'it'
      ? 'Polygon e utile quando l oggetto non ha una forma rettangolare semplice e vuoi controllare manualmente il bordo. Durante il disegno puoi usare Backspace per togliere l ultimo punto, Enter per completare, Escape per annullare, Shift+Z per annullare un punto e Shift+Y per ripristinarlo. Dopo il completamento, Ctrl+Z annulla e Ctrl+Y ripristina.'
      : 'Polygon is useful when the object does not fit a simple rectangle and you want full manual control of the boundary. While drawing, use Backspace to remove the last point, Enter to finish, Escape to cancel, Shift+Z to undo a point, and Shift+Y to redo it. After completion, Ctrl+Z undoes and Ctrl+Y redoes.';
      const backLabel = lang === 'it' ? 'Indietro' : 'Back';
      addMessage('bot', explain, { inputType: 'buttons', options: [backLabel], step: 'polygon-drawing-back' });
      return;
    }

  if (step === 'polygon-drawing-back') {
    const intro = lang === 'it'
      ? 'Stai disegnando una forma precisa. Continua a cliccare intorno al bordo dell oggetto, poi premi Enter o fai doppio click per completare. Backspace rimuove l ultimo punto.'
      : 'You are drawing a precise shape. Keep clicking around the object edge, then press Enter or double-click to finish. Backspace removes the last point.';
    const options = lang === 'it'
      ? ['Come finisco?', 'Passa a Select', 'Quando usare Polygon?']
      : ['How do I finish?', 'Switch to Select', 'When should I use Polygon?'];
    addMessage('bot', intro, { inputType: 'buttons', options, step: 'polygon-choice' });
    return;
  }

  if (step === 'polygon-ready-choice') {
    if (value.includes('How') || value.includes('Come')) {
      const explain = lang === 'it'
        ? 'Con Polygon, clicca attorno al bordo dell oggetto per aggiungere punti. Quando hai finito, premi Enter o fai doppio click per chiudere la forma. Backspace rimuove l ultimo punto ed Escape annulla la forma in corso. Durante il disegno puoi usare Shift+Z per annullare un punto e Shift+Y per ripristinarlo. Dopo il completamento, Ctrl+Z annulla e Ctrl+Y ripristina. Nota: l annulla funziona dopo il completamento del polygon.'
        : 'With Polygon, click around the object edge to add points. When you are done, press Enter or double-click to close the shape. Backspace removes the last point and Escape cancels the shape in progress. While drawing, you can use Shift+Z to undo a point and Shift+Y to redo it. After completion, Ctrl+Z undoes and Ctrl+Y redoes. Note: undo works after polygon completion.';
      const backLabel = lang === 'it' ? 'Indietro' : 'Back';
      addMessage('bot', explain, { inputType: 'buttons', options: [backLabel], step: 'polygon-ready-back' });
      return;
    }
    if (value.includes('Box')) {
      clickTool('box');
      closeBot();
      refreshGuideSoon(300);
      return;
    }
    if (value.includes('Smart Polygon')) {
      clickTool('smart_polygon');
      closeBot();
      refreshGuideSoon(300);
      return;
    }
  }

  if (step === 'polygon-ready-back') {
    const intro = lang === 'it'
      ? 'Polygon serve per tracciare manualmente un bordo preciso. Clicca punto per punto attorno all oggetto, poi chiudi la forma quando il contorno sembra corretto.'
      : 'Polygon is for drawing a precise manual outline. Click point by point around the object, then close the shape when the contour looks right.';
    addMessage('bot', intro, { inputType: 'buttons', options: getPolygonMainOptions(lang), step: 'polygon-ready-choice' });
    return;
  }

  if (step === 'annotated-choice') {
    if (value.includes('Smart Polygon')) {
      clickTool('smart_polygon');
      closeBot();
      refreshGuideSoon(300);
      return;
    }
    if (value.includes('Select')) {
      clickTool('select');
      closeBot();
      refreshGuideSoon(300);
      return;
    }
    if (value.includes('Box')) {
      clickTool('box');
      closeBot();
      refreshGuideSoon(300);
      return;
    }
    if (value.includes('Polygon')) {
      clickTool('polygon');
      closeBot();
      refreshGuideSoon(300);
      return;
    }
  }

  if (step === 'empty-choice') {
    if (value.includes('Smart Polygon')) {
      clickTool('smart_polygon');
      closeBot();
      refreshGuideSoon(300);
      return;
    }
    if (value.includes('Box')) {
      clickTool('box');
      closeBot();
      refreshGuideSoon(300);
      return;
    }
    if (value.includes('Polygon')) {
      clickTool('polygon');
      closeBot();
      refreshGuideSoon(300);
      return;
    }
    if (value.includes('Null')) {
      clickTool('null');
      closeBot();
      refreshGuideSoon(300);
    }
  }
}
