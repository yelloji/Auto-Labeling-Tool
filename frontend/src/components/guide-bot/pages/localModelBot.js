/**
 * localModelBot.js - Project-scoped Models section logic for the guide bot.
 *
 * This page is different from the main /models page:
 * - uploading here creates a model local to the current project
 * - "Include Global Models" is only a view toggle
 * - trained models can appear here after being added from training/model lab
 */

import { setReactInputValue } from './botUtils';
import { getUploadWizardSteps, handleModelAnswer as handleGlobalModelAnswer } from './modelBot';

function getPublishedState() {
  return window.__localModelsGuideState || null;
}

function isLocalModelsPage() {
  const state = getPublishedState();
  if (state?.isProjectModelsPage) return true;

  const heading = Array.from(document.querySelectorAll('h1, h2, h3, .ant-typography'))
    .find(el => el.textContent?.trim() === 'AI Models');
  const uploadBtn = Array.from(document.querySelectorAll('button'))
    .find(btn => btn.textContent?.trim() === 'Upload Model');
  const helperText = Array.from(document.querySelectorAll('div, span, p'))
    .find(el => el.textContent?.trim() === 'Manage models for auto-labeling in this project');

  return !!heading && !!uploadBtn && !!helperText;
}

function getSearchInput() {
  return document.querySelector('input[placeholder="Search models..."]');
}

function clearSearch() {
  const input = getSearchInput();
  if (!input) return false;
  setReactInputValue(input, '');
  return true;
}

function getFilterSelect() {
  return document.querySelector('.ant-select');
}

function setFilterToAll() {
  const selectEl = getFilterSelect();
  if (!selectEl) return false;

  const key = Object.keys(selectEl).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
  if (!key) return false;

  let fiber = selectEl[key];
  while (fiber) {
    const props = fiber.memoizedProps || fiber.pendingProps;
    if (props && typeof props.onChange === 'function') {
      props.onChange('all');
      return true;
    }
    fiber = fiber.return;
  }

  return false;
}

function toggleIncludeGlobal() {
  const switchButton = document.querySelector('button[role="switch"]');
  if (switchButton) {
    switchButton.click();
    return true;
  }
  return false;
}

function getBackLabel(lang) {
  return lang === 'it' ? 'Indietro' : 'Back';
}

function getUploadActionLabel(lang) {
  return lang === 'it' ? 'Carica un modello del progetto' : 'Upload a Project Model';
}

function getUploadHelpLabel(lang) {
  return lang === 'it' ? 'Come carico un modello del progetto?' : 'How do I upload a project model?';
}

function getScopeHelpLabel(lang) {
  return lang === 'it' ? 'Cosa significano Local, Global e Trained?' : 'What do Local, Global, and Trained mean?';
}

function getGlobalToggleHelpLabel(lang) {
  return lang === 'it' ? 'Cosa fa Include Global Models?' : 'What does Include Global Models do?';
}

function getPageHelpLabel(lang) {
  return lang === 'it' ? 'Come funziona questa pagina?' : 'How does this page work?';
}

function getFilesHelpLabel(lang) {
  return lang === 'it' ? 'Quali file sono supportati?' : 'What files are supported?';
}

function getGuideUploadLabel(lang) {
  return lang === 'it' ? 'Guidami passo per passo' : 'Guide me step by step';
}

function getClearSearchLabel(lang) {
  return lang === 'it' ? 'Cancella ricerca' : 'Clear Search';
}

function getClearFilterLabel(lang) {
  return lang === 'it' ? 'Resetta filtro' : 'Clear Filter';
}

function getShowGlobalLabel(lang) {
  return lang === 'it' ? 'Mostra anche i modelli globali' : 'Show Global Models Too';
}

function getHideGlobalLabel(lang) {
  return lang === 'it' ? 'Nascondi i modelli globali' : 'Hide Global Models';
}

function getDetailsHelpLabel(lang) {
  return lang === 'it' ? 'Cosa mostrano questi dettagli?' : 'What do these details show?';
}

function getClassesHelpLabel(lang) {
  return lang === 'it' ? 'Cosa significa Classes?' : 'What does Classes mean?';
}

function makeState(wizardType, text, options, step) {
  return {
    wizardType,
    conversation: [{ role: 'bot', text, inputType: 'buttons', options, step }],
    step,
  };
}

function applyFreshLocalModelSnapshot(lang, refs, setters) {
  const { setIsOpen, setWizardMode, setWizardType, setConversation, setWizardStep } = setters;
  const next = checkLocalModelPageState(lang, refs, setters);
  if (!next) return;

  setIsOpen(true);
  setWizardMode(true);
  setWizardType(next.wizardType);
  setConversation(next.conversation);
  setWizardStep(next.step);
}

export function startLocalUploadModelWizard(lang, setters) {
  const {
    setWizardMode, setWizardType, setWizardData, setIsOnnx,
    setTextInput, setWizardStep, setConversation
  } = setters;

  const button = Array.from(document.querySelectorAll('button'))
    .find(btn => btn.textContent?.trim() === 'Upload Model');
  if (button) setTimeout(() => button.click(), 100);

  setWizardMode(true);
  setWizardType('local-upload-model');
  setWizardData({});
  setIsOnnx(false);
  setTextInput('');

  const steps = getUploadWizardSteps(lang);
  const firstStep = steps.find(s => s.step === 'name');
  setWizardStep('name');
  setConversation([{
    role: 'bot',
    text: lang === 'it'
      ? 'Questo modello sara disponibile solo in questo progetto. ' + firstStep.text
      : 'This model will be available only in this project. ' + firstStep.text,
    inputType: firstStep.inputType,
    placeholder: firstStep.placeholder,
    step: 'name',
  }]);
}

export function checkLocalModelPageState(lang, refs, setters) {
  if (!isLocalModelsPage()) return null;

  const state = getPublishedState() || {};
  const {
    loading = false,
    uploadModalVisible = false,
    viewModalVisible = false,
    searchTerm = '',
    filterType = 'all',
    includeGlobal = false,
    modelsCount = 0,
    filteredCount = 0,
  } = state;

  if (loading) {
    const text = lang === 'it'
      ? 'Sto caricando i modelli disponibili per questo progetto. Tra poco potrai controllare modelli locali, globali e addestrati.'
      : 'I am loading the models available for this project. In a moment you will be able to review local, global, and trained models.';
    return makeState('local-models-loading', text, [], 'local-models-loading');
  }

  if (uploadModalVisible) {
    const text = lang === 'it'
      ? 'Questa finestra serve per aggiungere un modello solo a questo progetto. Qui inserisci nome, tipo, file e i dettagli necessari per il caricamento.'
      : 'This window is for adding a model only to this project. Here you provide the name, type, file, and the details needed for the upload.';
    return makeState(
      'local-models-upload-modal',
      text,
      [getUploadActionLabel(lang), getUploadHelpLabel(lang), getFilesHelpLabel(lang)],
      'local-models-upload-modal'
    );
  }

  if (viewModalVisible) {
    const text = lang === 'it'
      ? 'Questa finestra mostra i dettagli del modello scelto. Qui puoi controllare stato, dimensione, classi e metadati prima di usarlo.'
      : 'This window shows the details of the selected model. Here you can check the status, size, classes, and metadata before using it.';
    return makeState(
      'local-models-view-details',
      text,
      [getDetailsHelpLabel(lang), getClassesHelpLabel(lang)],
      'local-models-view-details'
    );
  }

  if (modelsCount === 0 && !includeGlobal) {
    const text = lang === 'it'
      ? 'In questo progetto non ci sono ancora modelli locali. Puoi caricare un modello qui oppure mostrare anche i modelli globali gia disponibili nell app.'
      : 'There are no local models in this project yet. You can upload one here, or show the global models that are already available in the app.';
    return makeState(
      'local-models-empty',
      text,
      [getUploadActionLabel(lang), getGlobalToggleHelpLabel(lang), getShowGlobalLabel(lang)],
      'local-models-empty'
    );
  }

  if (filteredCount === 0 && (searchTerm || filterType !== 'all')) {
    const text = lang === 'it'
      ? 'I modelli esistono, ma la ricerca o il filtro stanno nascondendo i risultati. Prova a cancellare la ricerca o a resettare il filtro.'
      : 'The models exist, but your search or type filter is hiding the results. Try clearing the search or resetting the filter.';
    return makeState(
      'local-models-filtered-empty',
      text,
      [getClearSearchLabel(lang), getClearFilterLabel(lang), getUploadActionLabel(lang)],
      'local-models-filtered-empty'
    );
  }

  if (searchTerm || filterType !== 'all') {
    const parts = [];
    if (searchTerm) parts.push(lang === 'it' ? `ricerca "${searchTerm}"` : `search "${searchTerm}"`);
    if (filterType !== 'all') parts.push(lang === 'it' ? `filtro "${filterType}"` : `filter "${filterType}"`);
    const text = lang === 'it'
      ? `Stai guardando un elenco ristretto di modelli con ${parts.join(' e ')}. Questo aiuta a trovare velocemente il modello giusto per il progetto.`
      : `You are viewing a narrowed model list with ${parts.join(' and ')}. This helps you find the right model for the project more quickly.`;
    return makeState(
      'local-models-filtered',
      text,
      [getClearSearchLabel(lang), getClearFilterLabel(lang), getPageHelpLabel(lang)],
      'local-models-filtered'
    );
  }

  if (includeGlobal) {
    const text = lang === 'it'
      ? `Stai vedendo ${filteredCount} modelli tra locali e globali. Il toggle Include Global Models cambia solo la vista dell elenco: non copia i modelli globali nel progetto.`
      : `You are viewing ${filteredCount} models from both local and global sources. The Include Global Models toggle only changes the list view. It does not copy global models into the project.`;
    return makeState(
      'local-models-include-global',
      text,
      [getGlobalToggleHelpLabel(lang), getScopeHelpLabel(lang), getHideGlobalLabel(lang)],
      'local-models-include-global'
    );
  }

  const text = lang === 'it'
    ? `Questa e la pagina Modelli del progetto. Qui puoi controllare ${filteredCount} modelli disponibili per questo progetto, caricare un modello locale, oppure usare modelli addestrati gia aggiunti al progetto.`
    : `This is the project Models page. Here you can review ${filteredCount} models available for this project, upload a local model, or use trained models that were already added to the project.`;
  return makeState(
    'local-models-default',
    text,
    [getPageHelpLabel(lang), getScopeHelpLabel(lang), getGlobalToggleHelpLabel(lang), getUploadActionLabel(lang)],
    'local-models-default'
  );
}

export function handleLocalModelAnswer(step, value, lang, refs, setters, wizardData, setWizardData, isOnnx, setIsOnnx) {
  const { addMessage, setWizardMode, setWizardType, setConversation, setIsOpen, requestReopen } = setters;

  const backLabel = getBackLabel(lang);
  const uploadActionLabel = getUploadActionLabel(lang);
  const uploadHelpLabel = getUploadHelpLabel(lang);
  const scopeHelpLabel = getScopeHelpLabel(lang);
  const globalToggleHelpLabel = getGlobalToggleHelpLabel(lang);
  const pageHelpLabel = getPageHelpLabel(lang);
  const filesHelpLabel = getFilesHelpLabel(lang);
  const guideUploadLabel = getGuideUploadLabel(lang);
  const clearSearchLabel = getClearSearchLabel(lang);
  const clearFilterLabel = getClearFilterLabel(lang);
  const showGlobalLabel = getShowGlobalLabel(lang);
  const hideGlobalLabel = getHideGlobalLabel(lang);
  const detailsHelpLabel = getDetailsHelpLabel(lang);
  const classesHelpLabel = getClassesHelpLabel(lang);

  function closeBot() {
    setWizardMode(false);
    setWizardType(null);
    setConversation([]);
    setIsOpen(false);
  }

  if (step === 'local-models-default' || step === 'local-models-empty' || step === 'local-models-filtered' || step === 'local-models-include-global') {
    if (value === pageHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Questa pagina raccoglie i modelli che puoi usare in questo progetto. Alcuni sono locali al progetto, altri possono essere mostrati solo in vista globale, e i modelli addestrati possono arrivare qui dopo il deploy dal training.'
          : 'This page collects the models you can use in this project. Some are local to the project, others can be shown from the global list, and trained models can appear here after they are deployed from training.',
        { inputType: 'buttons', options: [backLabel], step: 'local-models-page-help' }
      );
      return;
    }

    if (value === scopeHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Local significa che il modello appartiene solo a questo progetto. Global significa che il modello e condiviso nell app e puo essere mostrato anche qui. Trained significa che il modello arriva da un training o esperimento e poi e stato aggiunto al progetto.'
          : 'Local means the model belongs only to this project. Global means the model is shared across the app and can also be shown here. Trained means the model came from a training run or experiment and was later added to the project.',
        { inputType: 'buttons', options: [backLabel], step: 'local-models-scope-help' }
      );
      return;
    }

    if (value === globalToggleHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Include Global Models e solo un filtro di vista. Quando e spento vedi solo i modelli locali del progetto. Quando e acceso vedi insieme modelli locali e globali. Non copia nessun modello globale dentro il progetto.'
          : 'Include Global Models is only a view filter. When it is off, you see only the project-local models. When it is on, you see local and global models together. It does not copy any global model into the project.',
        { inputType: 'buttons', options: [backLabel], step: 'local-models-global-help' }
      );
      return;
    }
  }

  if (step === 'local-models-upload-modal' || step === 'local-models-default' || step === 'local-models-empty' || step === 'local-models-filtered-empty' || step === 'local-models-include-global') {
    if (value === uploadActionLabel) {
      startLocalUploadModelWizard(lang, setters);
      return;
    }
  }

  if (step === 'local-models-upload-modal') {
    if (value === uploadHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Per caricare un modello del progetto, scegli un nome chiaro, seleziona il tipo corretto, poi carica il file del modello. Se il file richiede informazioni aggiuntive, questa finestra ti chiedera i dettagli necessari.'
          : 'To upload a project model, choose a clear name, select the correct type, and then upload the model file. If the file needs extra information, this window will ask you for the required details.',
        { inputType: 'buttons', options: [guideUploadLabel, backLabel], step: 'local-models-upload-help' }
      );
      return;
    }

    if (value === filesHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Questa finestra supporta file .pt, .onnx e .engine. Per i file .pt e .onnx devi anche indicare la dimensione di input del training. Per .onnx puoi aggiungere YAML oppure classi e nc manualmente.'
          : 'This window supports .pt, .onnx, and .engine files. For .pt and .onnx files you also need the training input size. For .onnx you can provide YAML, or classes and nc manually.',
        { inputType: 'buttons', options: [guideUploadLabel, backLabel], step: 'local-models-files-help' }
      );
      return;
    }

    if (value === guideUploadLabel) {
      startLocalUploadModelWizard(lang, setters);
      return;
    }
  }

  if (step === 'local-models-view-details') {
    if (value === detailsHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Qui puoi controllare i metadati del modello: formato, numero di classi, dimensione di input del training, stato, dimensione file e descrizione. Queste informazioni aiutano a capire se il modello e pronto da usare.'
          : 'Here you can check the model metadata: format, number of classes, training input size, status, file size, and description. These details help you understand whether the model is ready to use.',
        { inputType: 'buttons', options: [backLabel], step: 'local-models-details-help' }
      );
      return;
    }

    if (value === classesHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Classes mostra i nomi delle categorie che questo modello riconosce. Il totale aiuta a capire quante classi il modello supporta, e il CSV puo essere utile per controllare o riusare l elenco.'
          : 'Classes shows the category names this model can recognize. The total helps you understand how many classes the model supports, and the CSV can be useful if you want to review or reuse the list.',
        { inputType: 'buttons', options: [backLabel], step: 'local-models-classes-help' }
      );
      return;
    }
  }

  if (step === 'local-models-empty' && value === showGlobalLabel) {
    toggleIncludeGlobal();
    return;
  }

  if (step === 'local-models-include-global' && value === hideGlobalLabel) {
    toggleIncludeGlobal();
    return;
  }

  if ((step === 'local-models-filtered' || step === 'local-models-filtered-empty') && value === clearSearchLabel) {
    clearSearch();
    return;
  }

  if ((step === 'local-models-filtered' || step === 'local-models-filtered-empty') && value === clearFilterLabel) {
    setFilterToAll();
    return;
  }

  if (
    step === 'local-models-page-help' ||
    step === 'local-models-scope-help' ||
    step === 'local-models-global-help' ||
    step === 'local-models-upload-help' ||
    step === 'local-models-files-help' ||
    step === 'local-models-details-help' ||
    step === 'local-models-classes-help'
  ) {
    if (value === backLabel) {
      applyFreshLocalModelSnapshot(lang, refs, setters);
      return;
    }
  }

  if (step === 'local-upload-model') {
    const wrappedSetters = {
      ...setters,
      setScriptKey: () => setters.setScriptKey('/workspace/models'),
    };

    if (step === 'pt-done' || step === 'nc') {
      requestReopen();
    }

    handleGlobalModelAnswer(step, value, lang, wrappedSetters, wizardData, setWizardData, isOnnx, setIsOnnx);
    return;
  }

  if (step === 'name' || step === 'description' || step === 'type' || step === 'file-selected' || step === 'width' || step === 'height' || step === 'yaml' || step === 'classes' || step === 'pt-done' || step === 'nc') {
    const wrappedSetters = {
      ...setters,
      setScriptKey: () => setters.setScriptKey('/workspace/models'),
    };

    if (step === 'pt-done' || step === 'nc') {
      requestReopen();
    }

    handleGlobalModelAnswer(step, value, lang, wrappedSetters, wizardData, setWizardData, isOnnx, setIsOnnx);
    return;
  }

  closeBot();
}
