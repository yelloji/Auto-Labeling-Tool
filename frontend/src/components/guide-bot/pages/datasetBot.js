/**
 * datasetBot.js - Dataset section logic for the guide bot.
 *
 * Snapshot-on-open states:
 *   1. Loading
 *   2. Empty dataset
 *   3. No filter results
 *   4. Search active
 *   5. Class filter active
 *   6. Split filter active
 *   7. Default dataset grid
 *
 * Design goal:
 *   review, verify, and prepare for release
 *   with simple explanations for non-technical users.
 */

import { setReactInputValue } from './botUtils';

function getDatasetContainer() {
  return document.querySelector('.dataset-container');
}

function isDatasetPage() {
  const container = getDatasetContainer();
  if (!container) return false;

  const createBtn = Array.from(container.querySelectorAll('button'))
    .find(btn => btn.textContent.trim() === 'Create New Release');
  const refreshBtn = Array.from(container.querySelectorAll('button'))
    .find(btn => btn.textContent.trim() === 'Refresh');
  return !!createBtn && !!refreshBtn;
}

function getSearchInput() {
  const container = getDatasetContainer();
  return container?.querySelector('input[placeholder="Search dataset images by name..."]') || null;
}

function getFilterSelects() {
  return Array.from(document.querySelectorAll('.dataset-container .ant-select'));
}

function getSelectDisplayText(index) {
  const select = getFilterSelects()[index];
  const text = select?.querySelector('.ant-select-selection-item')?.textContent?.trim();
  return text || '';
}

function setSelectValue(index, value) {
  const selectEl = getFilterSelects()[index];
  if (!selectEl) return false;

  const key = Object.keys(selectEl).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
  if (!key) return false;

  let fiber = selectEl[key];
  while (fiber) {
    const props = fiber.memoizedProps || fiber.pendingProps;
    if (props && typeof props.onChange === 'function') {
      props.onChange(value);
      return true;
    }
    fiber = fiber.return;
  }

  return false;
}

function getImageCards() {
  return Array.from(document.querySelectorAll('.dataset-container .image-card'));
}

function isDatasetLoading() {
  const container = getDatasetContainer();
  if (!container) return false;

  return !!Array.from(container.querySelectorAll('div, span, p'))
    .find(el => el.textContent.trim() === 'Loading dataset images...');
}

function startDatasetLoadingObserver(lang, refs, setters) {
  const { processingObserverRef } = refs;
  const { setIsOpen, setWizardMode, setWizardType, setConversation, setWizardStep } = setters;

  if (processingObserverRef.current) {
    processingObserverRef.current.disconnect();
    processingObserverRef.current = null;
  }

  const container = getDatasetContainer();
  if (!container) return;

  const obs = new MutationObserver(() => {
    if (isDatasetLoading()) return;
    if (!isDatasetPage()) return;

    obs.disconnect();
    processingObserverRef.current = null;

    const state = checkDatasetPageState(lang, refs, setters);
    if (!state) return;

    setIsOpen(true);
    setWizardMode(true);
    setWizardType(state.wizardType);
    setConversation(state.conversation);
    setWizardStep(state.step);
  });

  obs.observe(container, { childList: true, subtree: true });
  processingObserverRef.current = obs;
}

function clickCreateRelease() {
  const btn = Array.from(document.querySelectorAll('button'))
    .find(button => button.textContent.trim() === 'Create New Release');
  if (btn) btn.click();
}

function clickFirstImageCard() {
  const card = getImageCards()[0];
  if (card) card.click();
}

function clearSearch() {
  const input = getSearchInput();
  if (!input) return false;
  setReactInputValue(input, '');
  return true;
}

function clearFilters() {
  let changed = false;
  changed = setSelectValue(0, 'all') || changed;
  changed = setSelectValue(1, 'all') || changed;
  changed = setSelectValue(2, 'all') || changed;
  changed = setSelectValue(3, 'newest') || changed;
  return changed;
}

function getBackLabel(lang) {
  return lang === 'it' ? 'Indietro' : 'Back';
}

function getHowLabel(lang) {
  return lang === 'it' ? 'Come funziona questa pagina?' : 'How does this page work?';
}

function getSplitHelpLabel(lang) {
  return lang === 'it' ? 'Cosa significano Train / Valid / Test?' : 'What do Train / Valid / Test mean?';
}

function getFiltersHelpLabel(lang) {
  return lang === 'it' ? 'Cosa fanno i filtri?' : 'What do the filters do?';
}

function getFixImageLabel(lang) {
  return lang === 'it' ? 'Correggi un immagine' : 'Fix an Image';
}

function getCreateReleaseLabel(lang) {
  return lang === 'it' ? 'Crea Nuova Release' : 'Create New Release';
}

function getClearSearchLabel(lang) {
  return lang === 'it' ? 'Cancella Ricerca' : 'Clear Search';
}

function getClearFiltersLabel(lang) {
  return lang === 'it' ? 'Resetta Filtri' : 'Clear Filters';
}

function getWhyClickImageLabel(lang) {
  return lang === 'it' ? 'Perche cliccare un immagine qui?' : 'Why would I click an image here?';
}

function getWhenReleaseLabel(lang) {
  return lang === 'it' ? 'Quando creo una release?' : 'When should I create a release?';
}

function getReviewActionsLabel(lang) {
  return lang === 'it' ? 'Cosa posso fare qui?' : 'What can I do here?';
}

function makeState(wizardType, text, options, step) {
  return {
    wizardType,
    conversation: [{ role: 'bot', text, inputType: 'buttons', options, step }],
    step,
  };
}

function applyFreshDatasetSnapshot(lang, refs, setters) {
  const { setIsOpen, setWizardMode, setWizardType, setConversation, setWizardStep } = setters;
  const state = checkDatasetPageState(lang, refs, setters);
  if (!state) return;

  setIsOpen(true);
  setWizardMode(true);
  setWizardType(state.wizardType);
  setConversation(state.conversation);
  setWizardStep(state.step);
}

export function checkDatasetPageState(lang, refs, setters) {
  const container = getDatasetContainer();
  const loadingText = container
    ? Array.from(container.querySelectorAll('div, span, p'))
        .find(el => el.textContent.trim() === 'Loading dataset images...')
    : null;

  if (!container || (!isDatasetPage() && !loadingText)) return null;

  if (loadingText) {
    startDatasetLoadingObserver(lang, refs, setters);
    const text = lang === 'it'
      ? 'Sto preparando le immagini del dataset per la revisione. Quando il caricamento finisce, qui potrai controllare immagini, filtri e release.'
      : 'I am preparing the dataset images for review. When loading finishes, you can check images, filters, and release options here.';
    return makeState('dataset-loading', text, [], 'dataset-loading');
  }

  const emptyText = Array.from(document.querySelectorAll('div, span, p'))
    .find(el => el.textContent.trim() === 'No labeled dataset images found');
  if (emptyText) {
    const text = lang === 'it'
      ? 'Qui non ci sono ancora immagini pronte per il training. Prima completa l etichettatura in Management e Annotation Progress, poi torneranno visibili qui.'
      : 'There are no images ready for training here yet. First finish labeling in Management and Annotation Progress, then they will appear here.';
    const options = [
      lang === 'it' ? 'Vai a Management' : 'Go to Management',
      getHowLabel(lang),
    ];
    return makeState('dataset-empty', text, options, 'dataset-empty');
  }

  const noResultsText = Array.from(document.querySelectorAll('div, span, p'))
    .find(el => el.textContent.trim() === 'No images match your filters');
  if (noResultsText) {
    const text = lang === 'it'
      ? 'Le immagini esistono, ma la ricerca o i filtri stanno nascondendo i risultati. Prova a cancellare la ricerca o a resettare i filtri.'
      : 'The images exist, but your search or filters are hiding the results. Try clearing the search or resetting the filters.';
    const options = [getClearSearchLabel(lang), getClearFiltersLabel(lang), getFiltersHelpLabel(lang)];
    return makeState('dataset-no-results', text, options, 'dataset-no-results');
  }

  const searchValue = getSearchInput()?.value?.trim() || '';
  const splitText = getSelectDisplayText(0);
  const datasetText = getSelectDisplayText(1);
  const classText = getSelectDisplayText(2);

  if (searchValue) {
    const text = lang === 'it'
      ? `Stai cercando immagini con "${searchValue}". Questo aiuta a trovare rapidamente un file specifico prima di controllarlo o correggerlo.`
      : `You are searching for images with "${searchValue}". This helps you find a specific file quickly before reviewing or fixing it.`;
    const options = [getClearSearchLabel(lang), getFixImageLabel(lang), getHowLabel(lang)];
    return makeState('dataset-search', text, options, 'dataset-search');
  }

  if (classText && classText !== 'All Classes') {
    const text = lang === 'it'
      ? `Stai guardando solo le immagini che contengono la classe "${classText}". Questo e utile per controllare se una classe specifica e coerente in tutto il dataset.`
      : `You are viewing only images that contain the "${classText}" class. This is useful when you want to review whether one class is consistent across the dataset.`;
    const options = [getClearFiltersLabel(lang), getFixImageLabel(lang), getFiltersHelpLabel(lang)];
    return makeState('dataset-class-filter', text, options, 'dataset-class-filter');
  }

  if (splitText && splitText !== 'All Splits') {
    const text = lang === 'it'
      ? `Stai guardando il gruppo "${splitText}". Qui puoi controllare quali immagini finiranno in Train, Validation o Test prima della release.`
      : `You are viewing the "${splitText}" group. Here you can check which images will go to Train, Validation, or Test before the release.`;
    const options = [getSplitHelpLabel(lang), getClearFiltersLabel(lang), getCreateReleaseLabel(lang)];
    return makeState('dataset-split-filter', text, options, 'dataset-split-filter');
  }

  if (datasetText && datasetText !== 'All Datasets') {
    const text = lang === 'it'
      ? `Stai guardando solo il dataset "${datasetText}". Questo e utile quando vuoi revisionare un gruppo specifico prima di creare la release.`
      : `You are viewing only the "${datasetText}" dataset. This is useful when you want to review one specific group before creating a release.`;
    const options = [getClearFiltersLabel(lang), getFixImageLabel(lang), getHowLabel(lang)];
    return makeState('dataset-dataset-filter', text, options, 'dataset-dataset-filter');
  }

  const cardCount = getImageCards().length;
  const text = lang === 'it'
    ? `Questa e la sezione Dataset. Qui puoi rivedere ${cardCount} immagini pronte per il training, controllare split e classi, correggere eventuali errori, e poi passare alla Release.`
    : `This is the Dataset section. Here you can review ${cardCount} images ready for training, check splits and classes, fix anything wrong, and then move on to Release.`;
  const options = [getHowLabel(lang), getReviewActionsLabel(lang), getCreateReleaseLabel(lang)];
  return makeState('dataset-default', text, options, 'dataset-default');
}

export function handleDatasetAnswer(step, value, lang, refs, setters) {
  const {
    addMessage,
    requestReopen,
    setWizardMode,
    setWizardType,
    setConversation,
    setIsOpen,
  } = setters;

  const backLabel = getBackLabel(lang);
  const howLabel = getHowLabel(lang);
  const splitHelpLabel = getSplitHelpLabel(lang);
  const filtersHelpLabel = getFiltersHelpLabel(lang);
  const fixImageLabel = getFixImageLabel(lang);
  const createReleaseLabel = getCreateReleaseLabel(lang);
  const clearSearchLabel = getClearSearchLabel(lang);
  const clearFiltersLabel = getClearFiltersLabel(lang);
  const whyClickImageLabel = getWhyClickImageLabel(lang);
  const whenReleaseLabel = getWhenReleaseLabel(lang);
  const reviewActionsLabel = getReviewActionsLabel(lang);

  function closeBot() {
    setWizardMode(false);
    setWizardType(null);
    setConversation([]);
    setIsOpen(false);
  }

  if (
    (step === 'dataset-default' ||
      step === 'dataset-search' ||
      step === 'dataset-class-filter' ||
      step === 'dataset-split-filter' ||
      step === 'dataset-dataset-filter' ||
      step === 'dataset-empty') &&
    value === howLabel
  ) {
    const intro = lang === 'it'
      ? 'Questa pagina serve per rivedere le immagini gia pronte per il training e capire se e il momento giusto per passare alla Release.'
      : 'This page is for reviewing images that are already ready for training and deciding whether it is the right moment to move to Release.';
    addMessage('bot', intro, {
      inputType: 'buttons',
      options: [splitHelpLabel, filtersHelpLabel, whyClickImageLabel, whenReleaseLabel, backLabel],
      step: 'dataset-how-choice',
    });
    return;
  }

  if (
    (step === 'dataset-default' ||
      step === 'dataset-search' ||
      step === 'dataset-class-filter' ||
      step === 'dataset-split-filter' ||
      step === 'dataset-dataset-filter') &&
    value === reviewActionsLabel
  ) {
    const intro = lang === 'it'
      ? 'Qui le azioni principali servono per controllare un immagine oppure passare alla Release quando tutto sembra corretto.'
      : 'The main actions here are for checking one image or moving to Release when everything looks correct.';
    addMessage('bot', intro, {
      inputType: 'buttons',
      options: [fixImageLabel, createReleaseLabel, backLabel],
      step: 'dataset-action-choice',
    });
    return;
  }

  if (step === 'dataset-how-choice' || step === 'dataset-no-results') {
    if (value === backLabel) {
      applyFreshDatasetSnapshot(lang, refs, setters);
      return;
    }

    if (value === splitHelpLabel) {
      const text = lang === 'it'
        ? 'Train serve per insegnare al modello. Validation serve per controllare come sta imparando durante il training. Test serve per la verifica finale. Le etichette colorate sulle immagini ti mostrano subito a quale gruppo appartiene ogni immagine.'
        : 'Train is used to teach the model. Validation is used to check how well it is learning during training. Test is used for the final evaluation. The colored tags on each image show which group that image belongs to.';
      addMessage('bot', text, { inputType: 'buttons', options: [backLabel], step: 'dataset-how-topic-back' });
      return;
    }

    if (value === filtersHelpLabel) {
      const text = lang === 'it'
        ? 'Ricerca trova un file per nome. Split mostra solo Train, Validation o Test. Dataset mostra un gruppo specifico. Class mostra solo immagini che contengono una certa etichetta. Sort cambia l ordine delle schede.'
        : 'Search finds a file by name. Split shows only Train, Validation, or Test. Dataset shows one specific dataset group. Class shows only images that contain one label. Sort changes the card order.';
      addMessage('bot', text, { inputType: 'buttons', options: [backLabel], step: 'dataset-how-topic-back' });
      return;
    }

    if (value === whyClickImageLabel) {
      const text = lang === 'it'
        ? 'Cliccare un immagine qui ti riporta nel canvas di etichettatura. Serve per correggere una label, controllare un oggetto difficile, o sistemare un immagine prima della release.'
        : 'Clicking an image here takes you back to the labeling canvas. Use this when you want to correct a label, inspect a difficult object, or fix one image before release.';
      addMessage('bot', text, { inputType: 'buttons', options: [backLabel], step: 'dataset-how-topic-back' });
      return;
    }

    if (value === whenReleaseLabel) {
      const text = lang === 'it'
        ? 'Crea una release quando le immagini e le etichette qui sembrano corrette. Il pulsante Create New Release ti porta alla sezione Release, dove completerai gli ultimi passaggi della release del dataset.'
        : 'Create a release when the images and labels here look correct. The Create New Release button takes you to the Release section, where you complete the remaining dataset release steps.';
      addMessage('bot', text, { inputType: 'buttons', options: [backLabel], step: 'dataset-how-topic-back' });
      return;
    }
  }

  if (step === 'dataset-how-topic-back' && value === backLabel) {
    const intro = lang === 'it'
      ? 'Questa pagina serve per rivedere le immagini gia pronte per il training e capire se e il momento giusto per passare alla Release.'
      : 'This page is for reviewing images that are already ready for training and deciding whether it is the right moment to move to Release.';
    addMessage('bot', intro, {
      inputType: 'buttons',
      options: [splitHelpLabel, filtersHelpLabel, whyClickImageLabel, whenReleaseLabel, backLabel],
      step: 'dataset-how-choice',
    });
    return;
  }

  if (step === 'dataset-action-choice') {
    if (value === backLabel) {
      applyFreshDatasetSnapshot(lang, refs, setters);
      return;
    }
    if (value === fixImageLabel) {
      requestReopen?.();
      setTimeout(() => clickFirstImageCard(), 120);
      closeBot();
      return;
    }
    if (value === createReleaseLabel) {
      requestReopen?.();
      setTimeout(() => clickCreateRelease(), 120);
      closeBot();
      return;
    }
  }

  if (value === clearSearchLabel) {
    clearSearch();
    setTimeout(() => applyFreshDatasetSnapshot(lang, refs, setters), 180);
    return;
  }

  if (value === clearFiltersLabel) {
    clearFilters();
    clearSearch();
    setTimeout(() => applyFreshDatasetSnapshot(lang, refs, setters), 220);
    return;
  }

  if (value === createReleaseLabel) {
    requestReopen?.();
    setTimeout(() => clickCreateRelease(), 120);
    closeBot();
    return;
  }

  if (value === fixImageLabel) {
    requestReopen?.();
    setTimeout(() => clickFirstImageCard(), 120);
    closeBot();
    return;
  }

  if (step === 'dataset-empty') {
    requestReopen?.();
    setTimeout(() => {
      const item = Array.from(document.querySelectorAll('li, a, span'))
        .find(el => el.textContent.trim() === 'Management');
      if (item) item.click();
    }, 120);
    closeBot();
  }
}
