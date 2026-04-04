function getPublishedState() {
  return window.__modellabGuideState || null;
}

function isModelLabPage() {
  const state = getPublishedState();
  if (state?.isModelLabPage) return true;

  const heading = Array.from(document.querySelectorAll('h1, h2, h3, .ant-typography'))
    .find((el) => el.textContent?.trim() === 'Model Lab');
  return !!heading;
}

function getBackLabel(lang) {
  return lang === 'it' ? 'Indietro' : 'Back';
}

function getFlowLabel(lang) {
  return lang === 'it' ? 'Come funziona tutto il flusso?' : 'How does the full flow work?';
}

function getCurrentViewLabel(lang) {
  return lang === 'it' ? 'Cosa sto vedendo adesso?' : 'What am I seeing right now?';
}

function getNextStepLabel(lang) {
  return lang === 'it' ? 'Cosa controllo dopo?' : 'What should I check next?';
}

function getReviewHelpLabel(lang) {
  return lang === 'it' ? 'Come funziona questa review?' : 'How does this review work?';
}

function getAnalyticsHelpLabel(lang) {
  return lang === 'it' ? 'Come leggo questi analytics?' : 'How do I read these analytics?';
}

function getConfigHelpLabel(lang) {
  return lang === 'it' ? 'Che differenza c e tra View e Advanced?' : 'What is the difference between View and Advanced?';
}

function getValidationHelpLabel(lang) {
  return lang === 'it' ? 'Come devo usare validation?' : 'How should I use validation?';
}

function getComparisonHelpLabel(lang) {
  return lang === 'it' ? 'Come funziona il confronto?' : 'How does comparison work?';
}

function getModelManagerHelpLabel(lang) {
  return lang === 'it' ? 'Come uso i file del modello?' : 'How do I use these model files?';
}

function getRunValidationLabel(lang) {
  return lang === 'it' ? 'Run Validation' : 'Run Validation';
}

function getOpenPredictionAnalyticsLabel(lang) {
  return lang === 'it' ? 'Open Prediction Analytics' : 'Open Prediction Analytics';
}

function getSendSettingsLabel(lang) {
  return lang === 'it' ? 'Send Settings to Training' : 'Send Settings to Training';
}

function getDownloadBestLabel(lang) {
  return lang === 'it' ? 'Download Best Model' : 'Download Best Model';
}

function getDownloadLastLabel(lang) {
  return lang === 'it' ? 'Download Last Model' : 'Download Last Model';
}

function getAddBestLabel(lang) {
  return lang === 'it' ? 'Add Best Model to Project' : 'Add Best Model to Project';
}

function getAddLastLabel(lang) {
  return lang === 'it' ? 'Add Last Model to Project' : 'Add Last Model to Project';
}

function isVisibleElement(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function clickVisibleButtonByText(text, { exact = true, root = document } = {}) {
  const buttons = Array.from(root.querySelectorAll('button'))
    .filter((btn) => !btn.closest('.guide-bot-wrapper'))
    .filter((btn) => isVisibleElement(btn) && !btn.disabled);

  const normalized = text.trim();
  const button = buttons.find((btn) => {
    const btnText = (btn.textContent || '').replace(/\s+/g, ' ').trim();
    return exact ? btnText === normalized : btnText.includes(normalized);
  });

  if (!button) return false;
  button.click();
  return true;
}

function clickModelManagerAction(titleText, buttonText) {
  const cards = Array.from(document.querySelectorAll('.model-card'))
    .filter((card) => isVisibleElement(card));

  const card = cards.find((el) => (el.textContent || '').includes(titleText));
  if (!card) return false;
  return clickVisibleButtonByText(buttonText, { root: card });
}

function makeState(wizardType, text, options, step) {
  return {
    wizardType,
    conversation: [{ role: 'bot', text, inputType: 'buttons', options, step }],
    step,
  };
}

function applyFreshModelLabSnapshot(lang, refs, setters) {
  const state = checkModelLabPageState(lang, refs, setters);
  if (!state) return;

  setters.setIsOpen(true);
  setters.setWizardMode(true);
  setters.setWizardType(state.wizardType);
  setters.setConversation(state.conversation);
  setters.setWizardStep(state.step);
}

function getTopLevelSummary(state, lang) {
  const tab = state.activeTopLevelTab || 'overview';
  const trainingName = state.selectedTrainingName || 'this training';

  if (tab === 'configuration') {
    return lang === 'it'
      ? `Stai guardando Configuration per ${trainingName}. Qui prima controlli cosa e stato usato davvero in questo training, poi puoi riusare quei valori per un training futuro.`
      : `You are in Configuration for ${trainingName}. Here you first check what was really used in this training, then you can reuse those values for a future training.`;
  }

  if (tab === 'model-manager') {
    return lang === 'it'
      ? `Stai guardando Model Manager per ${trainingName}. Qui giudichi i file prodotti dal training e decidi cosa scaricare o aggiungere al progetto per il riuso.`
      : `You are in Model Manager for ${trainingName}. Here you judge the files produced by the training and decide what to download or add to the project for reuse.`;
  }

  if (tab === 'validation') {
    return lang === 'it'
      ? `Stai guardando Validation per ${trainingName}. Qui prepari o controlli esperimenti di validazione legati a questo training specifico.`
      : `You are in Validation for ${trainingName}. Here you prepare or inspect validation experiments tied to this specific training.`;
  }

  if (tab === 'prediction') {
    return lang === 'it'
      ? `Stai guardando Prediction per ${trainingName}. Qui crei prediction run, filtri i risultati, apri la review immagine e poi passi agli analytics e al report finale.`
      : `You are in Prediction for ${trainingName}. Here you create prediction runs, filter results, open image review, and then move into analytics and the final report.`;
  }

  if (tab === 'comparison-engine') {
    return lang === 'it'
      ? `Stai guardando Comparison Engine per ${trainingName}. Qui confronti prediction run tra modelli o sessioni diverse per capire chi migliora davvero.`
      : `You are in Comparison Engine for ${trainingName}. Here you compare prediction runs across models or sessions to see what actually improved.`;
  }

  return lang === 'it'
    ? `Stai guardando Overview per ${trainingName}. Questo e il punto di partenza per capire com e finito il training prima di passare a config, validation, prediction e report.`
    : `You are in Overview for ${trainingName}. This is the starting point for understanding how the training finished before moving on to config, validation, prediction, and report.`;
}

function getCurrentViewText(state, lang) {
  const stateKey = state.stateKey || null;

  if (!state.hasTrainings) {
    return lang === 'it'
      ? 'In questo momento la lista a sinistra non contiene training completati. Model Lab diventa utile dopo che almeno un training ha prodotto un risultato da ispezionare.'
      : 'Right now the list on the left has no completed trainings. Model Lab becomes useful after at least one training has produced a result to inspect.';
  }

  if (!state.selectedTrainingId) {
    return lang === 'it'
      ? 'In questo momento la lista dei trained models esiste, ma non hai ancora scelto un training. Il flusso parte sempre da sinistra: selezioni un training e poi il workspace a destra prende vita.'
      : 'Right now the trained-model list exists, but you have not selected a training yet. The flow always starts on the left: select a training, then the right workspace comes to life.';
  }

  if (state.predictionHelpOpen) {
    return lang === 'it'
      ? 'Adesso sei nell help della prediction image review. Questa parte spiega colori di confidence, toggle visivi, stati PASS/FAIL/UNVERIFIED e come la review diventa memoria riusabile.'
      : 'You are currently in prediction image review help. This part explains confidence colors, visual toggles, PASS/FAIL/UNVERIFIED states, and how review becomes reusable memory.';
  }

  if (state.classifyMissingOpen) {
    return lang === 'it'
      ? 'Adesso stai classificando un oggetto mancante che hai segnato manualmente. Qui il sistema ti chiede di assegnare la classe corretta cosi questa conoscenza puo essere riusata dopo.'
      : 'You are currently classifying a missing object that you marked manually. Here the system asks for the correct class so this knowledge can be reused later.';
  }

  if (state.predictionViewerOpen) {
    return lang === 'it'
      ? 'Adesso sei dentro la review immagine avanzata. Questa non e solo una preview: qui verifichi predizioni, segni errori, aggiungi missing objects e impari dai suggerimenti storici.'
      : 'You are currently inside advanced image review. This is not just a preview: here you verify predictions, mark errors, add missing objects, and learn from historical hints.';
  }

  if (state.predictionAnalyticsOpen) {
    const tab = state.activePredictionAnalyticsTab || 'overview';
    const tabText = tab.charAt(0).toUpperCase() + tab.slice(1);
    return lang === 'it'
      ? `Adesso sei in Prediction Analytics, tab ${tabText}. Questa parte trasforma i risultati della prediction in lettura operativa e si chiude naturalmente nel report.`
      : `You are currently in Prediction Analytics, ${tabText}. This area turns prediction output into operational reading and naturally ends in the report.`;
  }

  if (stateKey === 'modellab-confusion-modal') {
    return lang === 'it'
      ? 'Adesso stai guardando la confusion matrix in grande. Questo passaggio serve a capire dove il modello confonde classi diverse prima di continuare verso validation o prediction.'
      : 'You are currently looking at the confusion matrix in full size. This step helps you see where the model confuses different classes before continuing toward validation or prediction.';
  }

  if (stateKey === 'modellab-comparison-viewer') {
    return lang === 'it'
      ? 'Adesso sei nel comparison viewer delle immagini cambiate. Qui non guardi metriche astratte: guardi un caso concreto per capire che cosa e migliorato, peggiorato o rimasto sbagliato.'
      : 'You are currently in the comparison viewer for changed images. Here you are not looking at abstract metrics: you are looking at a concrete case to understand what improved, regressed, or stayed wrong.';
  }

  if (state.activeTopLevelTab === 'validation' && state.validationNameValid === false) {
    return lang === 'it'
      ? 'Adesso sei in Validation, ma il nome dell esperimento non e ancora valido per avviare il run. Qui il bot deve prima aiutarti a completare il contesto giusto e solo dopo suggerire l esecuzione.'
      : 'You are currently in Validation, but the experiment name is not yet valid enough to start the run. Here the bot should first help you complete the right setup and only then suggest execution.';
  }

  return getTopLevelSummary(state, lang);
}

function getNextStepText(state, lang) {
  const tab = state.activeTopLevelTab || 'overview';
  const stateKey = state.stateKey || null;

  if (!state.hasTrainings) {
    return lang === 'it'
      ? 'Il passo successivo e completare almeno un training nel workspace di training. Dopo, torna qui per ispezionare il modello finito.'
      : 'The next step is to complete at least one training in the training workspace. After that, come back here to inspect the finished model.';
  }

  if (!state.selectedTrainingId) {
    return lang === 'it'
      ? 'Il passo successivo e selezionare un training dalla colonna sinistra. Dopo la selezione, inizia da Overview e poi segui la storia verso Validation, Prediction e Report.'
      : 'The next step is to select a training from the left column. After selection, start in Overview and then follow the story toward Validation, Prediction, and Report.';
  }

  if (state.predictionHelpOpen || state.classifyMissingOpen || state.predictionViewerOpen) {
    return lang === 'it'
      ? 'Dopo questa review, torna ai risultati Prediction per controllare se i filtri e i feedback ti mostrano un pattern utile. Se vuoi una lettura decisionale, apri Analytics e finisci nel Report.'
      : 'After this review, return to Prediction results to see whether the filters and feedback reveal a useful pattern. If you want decision support, open Analytics and finish in Report.';
  }

  if (state.predictionAnalyticsOpen) {
    return lang === 'it'
      ? 'Dopo questo analytics, il passo naturale e aprire o leggere il Report per chiudere il ragionamento con readiness, warnings e export PDF.'
      : 'After this analytics view, the natural next step is to open or read Report so you can close the reasoning with readiness, warnings, and PDF export.';
  }

  if (stateKey === 'modellab-confusion-modal') {
    return lang === 'it'
      ? 'Dopo aver letto la confusion matrix, chiudi questa vista e continua con Validation o Prediction per controllare se gli errori che vedi qui si confermano anche nei risultati operativi.'
      : 'After reading the confusion matrix, close this view and continue with Validation or Prediction to check whether the errors you see here also appear in the operational results.';
  }

  if (stateKey === 'modellab-comparison-viewer') {
    return lang === 'it'
      ? 'Dopo aver capito questa immagine cambiata, continua a sfogliare i casi affetti oppure torna al confronto principale per vedere se il challenger vince davvero in modo consistente.'
      : 'After understanding this changed image, continue browsing the affected cases or return to the main comparison view to judge whether the challenger really wins consistently.';
  }

  if (tab === 'overview') {
    return lang === 'it'
      ? 'Dopo aver capito il risultato finale qui, controlla Configuration per vedere cosa e stato usato davvero, poi Validation e Prediction per giudicare se il modello regge bene.'
      : 'After understanding the final result here, check Configuration to see what was actually used, then move to Validation and Prediction to judge whether the model really holds up.';
  }

  if (tab === 'configuration') {
    if (state.advancedConfigCanSendToTraining) {
      return lang === 'it'
        ? `Dopo aver rifinito questi valori, puoi inviarli al training in coda "${state.advancedConfigQueuedTrainingName}" e poi continuare il nuovo run dal workspace di training.`
        : `After refining these values, you can send them into the queued training "${state.advancedConfigQueuedTrainingName}" and then continue the new run from the training workspace.`;
    }
    return lang === 'it'
      ? 'Dopo Configuration, vai a Validation o Prediction. Configuration ti prepara il contesto; Validation e Prediction ti dicono se il modello e operativo.'
      : 'After Configuration, go to Validation or Prediction. Configuration prepares the context; Validation and Prediction tell you whether the model is operational.';
  }

  if (tab === 'model-manager') {
    return lang === 'it'
      ? 'Dopo Model Manager, se vuoi giudicare il modello prima del riuso, passa da Validation o Prediction. Se e gia buono, puoi aggiungerlo al progetto per uso futuro.'
      : 'After Model Manager, if you still need to judge the model before reuse, move through Validation or Prediction. If it is already good, you can add it to the project for future use.';
  }

  if (tab === 'validation') {
    if (state.validationNameValid === false) {
      return lang === 'it'
        ? 'Prima del run, completa un nome valido per l esperimento. Solo dopo ha senso lanciare Validation e confrontare il nuovo risultato con la history.'
        : 'Before running anything, complete a valid experiment name. Only then does it make sense to launch Validation and compare the new result with the history.';
    }
    return lang === 'it'
      ? 'Dopo Validation, vai a Prediction per vedere il comportamento immagine per immagine e poi usa Analytics/Report per capire readiness e punti ciechi.'
      : 'After Validation, go to Prediction to see image-by-image behavior, then use Analytics/Report to understand readiness and blind spots.';
  }

  if (tab === 'prediction') {
    return lang === 'it'
      ? 'Dopo Prediction, apri la review immagine se vuoi controllare errori specifici, oppure vai in Analytics e chiudi il percorso nel Report.'
      : 'After Prediction, open image review if you want to inspect specific errors, or go into Analytics and close the journey in Report.';
  }

  return lang === 'it'
    ? 'Dopo il confronto, controlla le immagini cambiate e poi torna al modello migliore per leggere Analytics e Report prima di una decisione finale.'
    : 'After comparison, inspect the changed images and then return to the stronger model to read Analytics and Report before a final decision.';
}

export function checkModelLabPageState(lang) {
  if (!isModelLabPage()) return null;

  const state = getPublishedState() || {};

  if (!state.hasTrainings) {
    const text = getCurrentViewText(state, lang);
    return makeState('modellab-no-trainings', text, [getFlowLabel(lang), getBackLabel(lang)], 'modellab-no-trainings');
  }

  if (!state.selectedTrainingId) {
    const text = getCurrentViewText(state, lang);
    return makeState('modellab-empty', text, [getFlowLabel(lang), getCurrentViewLabel(lang), getBackLabel(lang)], 'modellab-empty');
  }

  if (state.classifyMissingOpen) {
    return makeState('modellab-prediction-classify-missing', getCurrentViewText(state, lang), [getReviewHelpLabel(lang), getNextStepLabel(lang), getBackLabel(lang)], 'modellab-prediction-classify-missing');
  }

  if (state.predictionHelpOpen) {
    return makeState('modellab-prediction-help', getCurrentViewText(state, lang), [getReviewHelpLabel(lang), getNextStepLabel(lang), getBackLabel(lang)], 'modellab-prediction-help');
  }

  if (state.predictionViewerOpen) {
    return makeState('modellab-prediction-image-viewer', getCurrentViewText(state, lang), [getReviewHelpLabel(lang), getNextStepLabel(lang), getBackLabel(lang)], 'modellab-prediction-image-viewer');
  }

  if (state.predictionAnalyticsOpen) {
    const analyticsStateKey = state.activePredictionAnalyticsTab
      ? `modellab-prediction-analytics-${state.activePredictionAnalyticsTab}`
      : 'modellab-prediction-analytics';
    return makeState(analyticsStateKey, getCurrentViewText(state, lang), [getAnalyticsHelpLabel(lang), getNextStepLabel(lang), getBackLabel(lang)], analyticsStateKey);
  }

  if (state.stateKey === 'modellab-confusion-modal') {
    return makeState('modellab-confusion-modal', getCurrentViewText(state, lang), [getCurrentViewLabel(lang), getNextStepLabel(lang), getBackLabel(lang)], 'modellab-confusion-modal');
  }

  if (state.stateKey === 'modellab-comparison-viewer') {
    return makeState('modellab-comparison-viewer', getCurrentViewText(state, lang), [getComparisonHelpLabel(lang), getNextStepLabel(lang), getBackLabel(lang)], 'modellab-comparison-viewer');
  }

  if (state.activeTopLevelTab === 'configuration') {
    const configStateKey = state.activeConfigTab === 'editor' ? 'modellab-config-advanced' : 'modellab-config-view';
    const options = [getConfigHelpLabel(lang), getNextStepLabel(lang), getBackLabel(lang)];
    if (state.activeConfigTab === 'editor' && state.advancedConfigCanSendToTraining) {
      options.splice(1, 0, getSendSettingsLabel(lang));
    }
    return makeState(configStateKey, getCurrentViewText(state, lang), options, configStateKey);
  }

  if (state.activeTopLevelTab === 'model-manager') {
    const options = [getModelManagerHelpLabel(lang)];
    if (state.modelManagerHasBestModel) options.push(getDownloadBestLabel(lang), getAddBestLabel(lang));
    if (state.modelManagerHasLastModel) options.push(getDownloadLastLabel(lang), getAddLastLabel(lang));
    options.push(getNextStepLabel(lang), getBackLabel(lang));
    return makeState('modellab-model-manager', getCurrentViewText(state, lang), options, 'modellab-model-manager');
  }

  if (state.activeTopLevelTab === 'validation') {
    const options = [getValidationHelpLabel(lang)];
    if (state.validationNameValid) options.push(getRunValidationLabel(lang));
    options.push(getNextStepLabel(lang), getBackLabel(lang));
    return makeState('modellab-validation', getCurrentViewText(state, lang), options, 'modellab-validation');
  }

  if (state.activeTopLevelTab === 'comparison-engine') {
    return makeState('modellab-comparison-engine', getCurrentViewText(state, lang), [getComparisonHelpLabel(lang), getNextStepLabel(lang), getBackLabel(lang)], 'modellab-comparison-engine');
  }

  if (state.activeTopLevelTab === 'prediction') {
    const options = [getReviewHelpLabel(lang)];
    if (state.selectedPredictionExperimentId) options.push(getOpenPredictionAnalyticsLabel(lang));
    options.push(getNextStepLabel(lang), getBackLabel(lang));
    return makeState('modellab-prediction', getCurrentViewText(state, lang), options, 'modellab-prediction');
  }

  return makeState('modellab-overview', getCurrentViewText(state, lang), [getFlowLabel(lang), getCurrentViewLabel(lang), getNextStepLabel(lang)], 'modellab-overview');
}

export function handleModelLabAnswer(step, value, lang, refs, setters) {
  const { addMessage } = setters;
  const state = getPublishedState() || {};

  const flowLabel = getFlowLabel(lang);
  const currentViewLabel = getCurrentViewLabel(lang);
  const nextStepLabel = getNextStepLabel(lang);
  const reviewHelpLabel = getReviewHelpLabel(lang);
  const analyticsHelpLabel = getAnalyticsHelpLabel(lang);
  const configHelpLabel = getConfigHelpLabel(lang);
  const validationHelpLabel = getValidationHelpLabel(lang);
  const comparisonHelpLabel = getComparisonHelpLabel(lang);
  const modelManagerHelpLabel = getModelManagerHelpLabel(lang);
  const runValidationLabel = getRunValidationLabel(lang);
  const openPredictionAnalyticsLabel = getOpenPredictionAnalyticsLabel(lang);
  const sendSettingsLabel = getSendSettingsLabel(lang);
  const downloadBestLabel = getDownloadBestLabel(lang);
  const downloadLastLabel = getDownloadLastLabel(lang);
  const addBestLabel = getAddBestLabel(lang);
  const addLastLabel = getAddLastLabel(lang);
  const backLabel = getBackLabel(lang);

  if (value === flowLabel) {
    addMessage('bot', lang === 'it'
      ? 'Il flusso completo di Model Lab e questo: prima scegli un training nella lista a sinistra, poi leggi Overview per capire il risultato finale, poi Configuration e Model Manager per capire riuso e file, poi Validation e Prediction per giudicare il comportamento, e infine Analytics/Report o Comparison Engine per una decisione finale.'
      : 'The full Model Lab flow is this: first choose a training in the list on the left, then read Overview to understand the final result, then Configuration and Model Manager for reuse and files, then Validation and Prediction to judge behavior, and finally Analytics/Report or Comparison Engine for a final decision.',
      { inputType: 'buttons', options: [nextStepLabel, backLabel], step }
    );
    return;
  }

  if (value === currentViewLabel) {
    addMessage('bot', getCurrentViewText(state, lang), { inputType: 'buttons', options: [nextStepLabel, backLabel], step });
    return;
  }

  if (value === nextStepLabel) {
    addMessage('bot', getNextStepText(state, lang), { inputType: 'buttons', options: [backLabel], step });
    return;
  }

  if (value === reviewHelpLabel) {
    addMessage('bot', lang === 'it'
      ? 'La review Prediction e la parte piu operativa di Model Lab. Qui non guardi soltanto il risultato: verifichi singole detections, segni PASS o FAIL, aggiungi missing objects e costruisci memoria riusabile che puo aiutare confronti futuri.'
      : 'Prediction review is the most operational part of Model Lab. Here you do not just look at output: you verify individual detections, mark PASS or FAIL, add missing objects, and build reusable memory that can help future comparisons.',
      { inputType: 'buttons', options: [nextStepLabel, backLabel], step }
    );
    return;
  }

  if (value === analyticsHelpLabel) {
    addMessage('bot', lang === 'it'
      ? 'Prediction Analytics non serve solo a mostrare grafici. Serve a trasformare prediction output in decision support: quality, confidence behavior, blind spots, deployment readiness e infine report PDF.'
      : 'Prediction Analytics is not only for showing charts. It turns prediction output into decision support: quality, confidence behavior, blind spots, deployment readiness, and finally the PDF report.',
      { inputType: 'buttons', options: [nextStepLabel, backLabel], step }
    );
    return;
  }

  if (value === openPredictionAnalyticsLabel) {
    const clicked = clickVisibleButtonByText('Analytics', { exact: false });
    addMessage('bot', clicked
      ? (lang === 'it' ? 'Sto aprendo Prediction Analytics dalla prediction corrente.' : 'I am opening Prediction Analytics from the current prediction.')
      : (lang === 'it' ? 'Non sono riuscito ad aprire Analytics da qui. Controlla che esista una prediction completata selezionata.' : 'I could not open Analytics from here. Check that a completed prediction is currently selected.'),
      { inputType: 'buttons', options: [backLabel], step }
    );
    return;
  }

  if (value === configHelpLabel) {
    const sendText = state.advancedConfigCanSendToTraining
      ? (lang === 'it'
        ? ` In questo momento puoi anche inviarli al training in coda "${state.advancedConfigQueuedTrainingName}".`
        : ` Right now you can also send them into the queued training "${state.advancedConfigQueuedTrainingName}".`)
      : (lang === 'it'
        ? ' In questo momento pero non c e ancora un training in coda pronto a riceverli.'
        : ' Right now there is not yet a queued training ready to receive them.');

    addMessage('bot', lang === 'it'
      ? `View Config mostra cosa e stato davvero usato in quel training concluso. Advanced Config Editor invece serve a riusare e modificare quei valori per il prossimo training, senza cambiare il training gia finito.${sendText}`
      : `View Config shows what was actually used in that finished training. Advanced Config Editor is for reusing and modifying those values for the next training, without changing the already finished one.${sendText}`,
      { inputType: 'buttons', options: [nextStepLabel, backLabel], step }
    );
    return;
  }

  if (value === sendSettingsLabel) {
    const clicked = clickVisibleButtonByText('Add to Upcoming Training', { exact: false });
    addMessage('bot', clicked
      ? (lang === 'it' ? 'Sto inviando queste impostazioni al training in coda.' : 'I am sending these settings into the queued training.')
      : (lang === 'it' ? 'Non sono riuscito a inviare le impostazioni da qui. Controlla che esista davvero un training in coda pronto a riceverle.' : 'I could not send the settings from here. Check that a queued training really exists and is ready to receive them.'),
      { inputType: 'buttons', options: [backLabel], step }
    );
    return;
  }

  if (value === modelManagerHelpLabel) {
    addMessage('bot', lang === 'it'
      ? 'Model Manager ti aiuta a prendere il risultato del training e trasformarlo in un file riusabile. In pratica qui decidi se scaricare best o last, oppure aggiungere il modello al progetto per retraining, riuso o passaggio ai passi successivi.'
      : 'Model Manager helps you turn the training result into a reusable asset. In practice, this is where you decide whether to download best or last, or add the model into the project for retraining, reuse, or later steps.',
      { inputType: 'buttons', options: [nextStepLabel, backLabel], step }
    );
    return;
  }

  if (value === downloadBestLabel) {
    const clicked = clickModelManagerAction('Best Model (best.pt)', 'Download');
    addMessage('bot', clicked
      ? (lang === 'it' ? 'Sto scaricando il best model.' : 'I am downloading the best model.')
      : (lang === 'it' ? 'Non sono riuscito a trovare il pulsante per scaricare il best model.' : 'I could not find the button to download the best model.'),
      { inputType: 'buttons', options: [backLabel], step }
    );
    return;
  }

  if (value === downloadLastLabel) {
    const clicked = clickModelManagerAction('Last Checkpoint (last.pt)', 'Download');
    addMessage('bot', clicked
      ? (lang === 'it' ? 'Sto scaricando il last model.' : 'I am downloading the last model.')
      : (lang === 'it' ? 'Non sono riuscito a trovare il pulsante per scaricare il last model.' : 'I could not find the button to download the last model.'),
      { inputType: 'buttons', options: [backLabel], step }
    );
    return;
  }

  if (value === addBestLabel) {
    const clicked = clickModelManagerAction('Best Model (best.pt)', 'Add to Project');
    addMessage('bot', clicked
      ? (lang === 'it' ? 'Sto aggiungendo il best model al progetto.' : 'I am adding the best model to the project.')
      : (lang === 'it' ? 'Non sono riuscito a trovare il pulsante per aggiungere il best model al progetto.' : 'I could not find the button to add the best model to the project.'),
      { inputType: 'buttons', options: [backLabel], step }
    );
    return;
  }

  if (value === addLastLabel) {
    const clicked = clickModelManagerAction('Last Checkpoint (last.pt)', 'Add to Project');
    addMessage('bot', clicked
      ? (lang === 'it' ? 'Sto aggiungendo il last model al progetto.' : 'I am adding the last model to the project.')
      : (lang === 'it' ? 'Non sono riuscito a trovare il pulsante per aggiungere il last model al progetto.' : 'I could not find the button to add the last model to the project.'),
      { inputType: 'buttons', options: [backLabel], step }
    );
    return;
  }

  if (value === validationHelpLabel) {
    addMessage('bot', lang === 'it'
      ? 'Validation ti aiuta a creare un esperimento di controllo sul training selezionato. Prima dai un nome valido all esperimento, poi scegli split e soglie, poi confronti il nuovo risultato con la history di validation per quel training.'
      : 'Validation helps you create a checking experiment for the selected training. First give the experiment a valid name, then choose split and thresholds, then compare the new result with the validation history for that training.',
      { inputType: 'buttons', options: [nextStepLabel, backLabel], step }
    );
    return;
  }

  if (value === runValidationLabel) {
    const clicked = clickVisibleButtonByText('Run Validation', { exact: false });
    addMessage('bot', clicked
      ? (lang === 'it' ? 'Sto avviando la validation per il training selezionato.' : 'I am starting validation for the selected training.')
      : (lang === 'it' ? 'Non sono riuscito ad avviare Validation da qui. Controlla che il nome dell esperimento sia valido e che il bottone sia disponibile.' : 'I could not start Validation from here. Check that the experiment name is valid and the button is available.'),
      { inputType: 'buttons', options: [backLabel], step }
    );
    return;
  }

  if (value === comparisonHelpLabel) {
    addMessage('bot', lang === 'it'
      ? 'Comparison Engine confronta prediction run tra baseline e challenger. Il senso del confronto arriva quando entrambi hanno immagini comuni, cosi puoi capire false positives risolti, missed objects risolti e nuove regressioni.'
      : 'Comparison Engine compares prediction runs between baseline and challenger. The comparison becomes meaningful when both sides share common images, so you can understand resolved false positives, resolved misses, and new regressions.',
      { inputType: 'buttons', options: [nextStepLabel, backLabel], step }
    );
    return;
  }

  if (value === backLabel) {
    applyFreshModelLabSnapshot(lang, refs, setters);
  }
}
