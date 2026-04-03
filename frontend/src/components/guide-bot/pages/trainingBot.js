function getPublishedState() {
  return window.__trainingGuideState || null;
}

function isVisibleElement(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isTrainingPage() {
  const state = getPublishedState();
  if (state?.isTrainingPage) return true;

  const title = Array.from(document.querySelectorAll('h1, h2, h3, .ant-typography'))
    .find((el) => el.textContent?.trim() === 'Model Training');
  return !!title;
}

function findVisibleButtonByText(text, root = document) {
  return Array.from(root.querySelectorAll('button'))
    .filter((btn) => !btn.closest('.guide-bot-wrapper'))
    .find((btn) => isVisibleElement(btn) && btn.textContent?.trim() === text && !btn.disabled);
}

function clickButtonByText(text, root = document) {
  const btn = findVisibleButtonByText(text, root);
  if (!btn) return false;
  btn.click();
  return true;
}

function clickTrainingAction({ text, selector }) {
  const roots = [
    document.querySelector('.ant-modal-root'),
    document.querySelector('.ant-modal-wrap'),
    document.querySelector('.ant-card'),
    document,
  ].filter(Boolean);

  if (selector) {
    for (const root of roots) {
      const el = root.querySelector(selector);
      if (el && isVisibleElement(el) && !el.closest('.guide-bot-wrapper') && !el.disabled) {
        el.click();
        return true;
      }
    }
  }

  if (text) {
    for (const root of roots) {
      if (clickButtonByText(text, root)) return true;
    }
  }

  return false;
}

function getBackLabel(lang) {
  return lang === 'it' ? 'Indietro' : 'Back';
}

function getPageHelpLabel(lang) {
  return lang === 'it' ? 'Come funziona questa pagina?' : 'How does this page work?';
}

function getBlockedHelpLabel(lang) {
  return lang === 'it' ? 'Perche il training non puo partire ancora?' : "Why can't training start yet?";
}

function getUserModeLabel(lang) {
  return lang === 'it' ? 'Che cos e User mode?' : 'What is User mode?';
}

function getDeveloperModeLabel(lang) {
  return lang === 'it' ? 'Cosa cambia in Developer mode?' : 'What changes in Developer mode?';
}

function getAdvancedApproachLabel(lang) {
  return lang === 'it' ? 'Come devo usare le impostazioni avanzate?' : 'How should I approach advanced settings?';
}

function getDatasetHelpLabel(lang) {
  return lang === 'it' ? 'Come scelgo una release dataset?' : 'How do I pick a dataset release?';
}

function getDatasetAfterSelectLabel(lang) {
  return lang === 'it' ? 'Cosa succede dopo aver scelto la release?' : 'What happens after I select a release?';
}

function getModelHelpLabel(lang) {
  return lang === 'it' ? 'Come scelgo un pretrained model?' : 'How do I choose a pretrained model?';
}

function getPreflightHelpLabel(lang) {
  return lang === 'it' ? 'Cosa devo controllare prima del training?' : 'What should I check before training?';
}

function getStatusHelpLabel(lang) {
  return lang === 'it' ? 'Cosa mostra Status?' : 'What does Status show?';
}

function getConfigPreviewLabel(lang) {
  return lang === 'it' ? 'Che cos e Config Preview?' : 'What is Config Preview?';
}

function getLiveMetricsLabel(lang) {
  return lang === 'it' ? 'Come leggo le metriche live?' : 'How do I read the live metrics?';
}

function getResultsHelpLabel(lang) {
  return lang === 'it' ? 'Come leggo questi risultati?' : 'How do I read these results?';
}

function getInitializingHelpLabel(lang) {
  return lang === 'it' ? 'Cosa sta succedendo adesso?' : 'What is happening now?';
}

function getFailedCauseLabel(lang) {
  return lang === 'it' ? 'Cosa potrebbe aver causato questo errore?' : 'What might have caused this?';
}

function getNewTrainingLabel(lang) {
  return lang === 'it' ? 'Come inizio un nuovo training?' : 'How do I start a new training?';
}

function getSingleClassLabel(lang) {
  return lang === 'it' ? 'Perche Single Class e importante qui?' : 'Why is Single Class important here?';
}

function getSmartAutoLabel(lang) {
  return lang === 'it' ? 'Come sceglie Smart Auto l optimizer?' : 'How does Smart Auto choose the optimizer?';
}

function getYolo26Label(lang) {
  return lang === 'it' ? 'Perche MuSGD e consigliato per YOLO26?' : 'Why is MuSGD recommended for YOLO26?';
}

function getOptimizationLabel(lang) {
  return lang === 'it' ? 'Cosa controlla Optimization?' : 'What does Optimization control?';
}

function getLossWeightsLabel(lang) {
  return lang === 'it' ? 'Cosa fanno i Loss Weights?' : 'What do Loss Weights do?';
}

function getAugmentationLabel(lang) {
  return lang === 'it' ? 'Cosa cambiano le impostazioni di Augmentation?' : 'What do Augmentation settings change?';
}

function getTaskSegLabel(lang) {
  return lang === 'it' ? 'A cosa servono Task & Segmentation?' : 'What are Task & Segmentation settings for?';
}

function getValidationLabel(lang) {
  return lang === 'it' ? 'Cosa controlla Validation?' : 'What does Validation control?';
}

function getAiConsoleLabel(lang) {
  return lang === 'it' ? 'A cosa serve AI Console?' : 'What is AI Console for?';
}

function getAiVsStatusLabel(lang) {
  return lang === 'it' ? 'In cosa e diverso da Status?' : 'How is this different from Status?';
}

function getTerminalProtectedLabel(lang) {
  return lang === 'it' ? 'Perche l accesso al terminale e protetto?' : 'Why is terminal access protected?';
}

function getChooseGpuLabel(lang) {
  return lang === 'it' ? 'Come scelgo una GPU?' : 'How do I choose a GPU?';
}

function getNoGpuLabel(lang) {
  return lang === 'it' ? 'Cosa succede se non c e una GPU disponibile?' : 'What if no GPU is available?';
}

function getStartTrainingLabel(lang) {
  return lang === 'it' ? 'Start Training' : 'Start Training';
}

function getOpenAiConsoleLabel(lang) {
  return lang === 'it' ? 'Apri AI Console' : 'Open AI Console';
}

function getHideAiConsoleLabel(lang) {
  return lang === 'it' ? 'Nascondi AI Console' : 'Hide AI Console';
}

function makeState(wizardType, text, options, step) {
  return {
    wizardType,
    conversation: [{ role: 'bot', text, inputType: 'buttons', options, step }],
    step,
  };
}

function applyFreshTrainingSnapshot(lang, refs, setters) {
  const next = checkTrainingPageState(lang, refs, setters);
  if (!next) return;

  setters.setIsOpen(true);
  setters.setWizardMode(true);
  setters.setWizardType(next.wizardType);
  setters.setConversation(next.conversation);
  setters.setWizardStep(next.step);
}

function getTrainingStateKey(state) {
  if (!state) return null;
  if (state.terminalPasswordOpen) return 'training-terminal-password';
  if (state.devPasswordOpen) return 'training-dev-password';
  if (state.devChangePasswordOpen) return 'training-dev-change-password';
  if (state.gpuDialogOpen) return 'training-gpu-dialog';
  if (state.aiConsoleVisible) return 'training-ai-console';
  if (state.showInitializing) return 'training-initializing';
  if (state.showRunningDashboard) return 'training-running';
  if (state.showFailed) return 'training-failed';
  if (state.showLastResult) return 'training-status-last-result';
  if (state.mode === 'developer') {
    return state.startTrainingEnabled ? 'training-developer-ready' : 'training-developer-empty';
  }
  return state.startTrainingEnabled ? 'training-user-ready' : 'training-user-empty';
}

function getDatasetFlowText(state, lang) {
  if (state.datasetExtracted) {
    return lang === 'it'
      ? 'La release e gia estratta e preparata per il training.'
      : 'The release is already extracted and prepared for training.';
  }
  if (state.datasetZipSelected) {
    return lang === 'it'
      ? 'La release zip e stata selezionata, ma deve ancora essere preparata o estratta.'
      : 'The release zip has been selected, but it still needs to be prepared or extracted.';
  }
  return lang === 'it'
    ? 'Devi ancora scegliere una release dataset da questo progetto.'
    : 'You still need to choose a dataset release from this project.';
}

export function checkTrainingPageState(lang, refs, setters) {
  if (!isTrainingPage()) return null;

  const state = getPublishedState() || {};
  const key = getTrainingStateKey(state);

  const pageHelpLabel = getPageHelpLabel(lang);
  const blockedHelpLabel = getBlockedHelpLabel(lang);
  const userModeLabel = getUserModeLabel(lang);
  const developerModeLabel = getDeveloperModeLabel(lang);
  const advancedApproachLabel = getAdvancedApproachLabel(lang);
  const datasetHelpLabel = getDatasetHelpLabel(lang);
  const modelHelpLabel = getModelHelpLabel(lang);
  const preflightHelpLabel = getPreflightHelpLabel(lang);
  const statusHelpLabel = getStatusHelpLabel(lang);
  const configPreviewLabel = getConfigPreviewLabel(lang);
  const liveMetricsLabel = getLiveMetricsLabel(lang);
  const resultsHelpLabel = getResultsHelpLabel(lang);
  const initializingHelpLabel = getInitializingHelpLabel(lang);
  const failedCauseLabel = getFailedCauseLabel(lang);
  const newTrainingLabel = getNewTrainingLabel(lang);
  const aiConsoleLabel = getAiConsoleLabel(lang);
  const aiVsStatusLabel = getAiVsStatusLabel(lang);
  const terminalProtectedLabel = getTerminalProtectedLabel(lang);
  const chooseGpuLabel = getChooseGpuLabel(lang);
  const noGpuLabel = getNoGpuLabel(lang);
  const startTrainingLabel = getStartTrainingLabel(lang);
  const openAiConsoleLabel = getOpenAiConsoleLabel(lang);
  const hideAiConsoleLabel = getHideAiConsoleLabel(lang);

  switch (key) {
    case 'training-terminal-password':
      return makeState(
        key,
        lang === 'it'
          ? 'Questa finestra protegge l accesso al terminale di AI Console. Qui puoi collegarti al flusso diagnostico live del training solo con la password corretta.'
          : 'This window protects access to the AI Console terminal. Here you can connect to the live diagnostics stream only with the correct password.',
        [terminalProtectedLabel],
        key
      );

    case 'training-dev-password':
      return makeState(
        key,
        lang === 'it'
          ? 'Developer mode e protetto perche apre controlli avanzati che possono cambiare in modo importante il comportamento del training.'
          : 'Developer mode is protected because it opens advanced controls that can change training behavior in important ways.',
        [developerModeLabel],
        key
      );

    case 'training-dev-change-password':
      return makeState(
        key,
        lang === 'it'
          ? 'Qui puoi cambiare la password che protegge Developer mode. Fallo solo se vuoi aggiornare il controllo di accesso alle impostazioni avanzate.'
          : 'Here you can change the password that protects Developer mode. Do this only if you want to update access control for the advanced settings.',
        [lang === 'it' ? 'A cosa serve questa finestra?' : 'What is this for?'],
        key
      );

    case 'training-gpu-dialog':
      return makeState(
        key,
        lang === 'it'
          ? 'Hai aperto la scelta della GPU. Qui puoi vedere l hardware disponibile e scegliere quale GPU usare per questo training.'
          : 'You opened the GPU chooser. Here you can inspect the available hardware and choose which GPU this training should use.',
        [chooseGpuLabel, noGpuLabel],
        key
      );

    case 'training-ai-console':
      return makeState(
        key,
        lang === 'it'
          ? 'AI Console e la vista tecnica live del training. Qui puoi seguire output diagnostici e terminale, separati dalla vista Status piu orientata all utente.'
          : 'AI Console is the technical live view of the training. Here you can follow diagnostics and terminal output separately from the more user-facing Status view.',
        [aiConsoleLabel, aiVsStatusLabel, hideAiConsoleLabel],
        key
      );

    case 'training-initializing':
      return makeState(
        key,
        lang === 'it'
          ? 'Il training sta iniziando. Il modello, la release scelta e il ciclo iniziale vengono preparati prima che compaiano le prime metriche live.'
          : 'Training is starting now. The model, selected release, and the initial pipeline are being prepared before the first live metrics appear.',
        [initializingHelpLabel],
        key
      );

    case 'training-running':
      return makeState(
        key,
        lang === 'it'
          ? 'Il training e in esecuzione. La scheda Status mostra avanzamento, losses, memoria GPU e metriche di validazione mentre il run procede.'
          : 'Training is running. The Status tab is showing progress, losses, GPU memory, and validation metrics while the run continues.',
        [liveMetricsLabel, statusHelpLabel],
        key
      );

    case 'training-failed':
      return makeState(
        key,
        lang === 'it'
          ? 'L ultimo training non e terminato correttamente. Questa non e una buona run finale: conviene capire la causa e poi ripartire con una nuova configurazione corretta.'
          : 'The last training did not finish correctly. This is not a valid final run: it is worth understanding the cause and then starting again with a corrected configuration.',
        [failedCauseLabel, newTrainingLabel],
        key
      );

    case 'training-status-last-result':
      return makeState(
        key,
        lang === 'it'
          ? 'Qui stai vedendo l ultimo risultato completato, anche se in questo momento non c e un training attivo. Questa vista serve per leggere e confrontare il run precedente.'
          : 'Here you are viewing the last completed result even though no training is active right now. This view is for reading and comparing the previous run.',
        [resultsHelpLabel, configPreviewLabel],
        key
      );

    case 'training-developer-empty':
      return makeState(
        key,
        lang === 'it'
          ? 'Sei in Developer mode. Hai accesso ai controlli avanzati, ma il training non puo partire finche Name, Dataset e Model non sono tutti pronti.'
          : 'You are in Developer mode. Advanced controls are available, but training cannot start until Name, Dataset, and Model are all ready.',
        [developerModeLabel, blockedHelpLabel, advancedApproachLabel, datasetHelpLabel, modelHelpLabel],
        key
      );

    case 'training-developer-ready':
      return makeState(
        key,
        lang === 'it'
          ? 'Developer mode e pronto. Ora puoi avviare il training, aprire AI Console oppure regolare con attenzione i gruppi avanzati come Optimization, Augmentation e Validation.'
          : 'Developer mode is ready. You can now start training, open AI Console, or carefully tune advanced groups like Optimization, Augmentation, and Validation.',
        [advancedApproachLabel, startTrainingLabel, statusHelpLabel, openAiConsoleLabel],
        key
      );

    case 'training-user-ready':
      return makeState(
        key,
        lang === 'it'
          ? 'Il preflight e completo: Name, Dataset e Model sono pronti. Ora puoi controllare Config Preview o Status e poi avviare il training in modo sicuro da User mode.'
          : 'The preflight is complete: Name, Dataset, and Model are ready. You can now review Config Preview or Status and then start training safely from User mode.',
        [preflightHelpLabel, startTrainingLabel, statusHelpLabel, configPreviewLabel],
        key
      );

    case 'training-user-empty':
    default:
      return makeState(
        'training-user-empty',
        lang === 'it'
          ? 'Questa pagina configura il training del modello. Prima completa il preflight con Name, Dataset e Model; poi potrai avviare il training e seguire Config Preview o Status.'
          : 'This page configures model training. First complete the preflight with Name, Dataset, and Model, then you can start training and review Config Preview or Status.',
        [pageHelpLabel, blockedHelpLabel, userModeLabel, datasetHelpLabel, modelHelpLabel],
        'training-user-empty'
      );
  }
}

export function handleTrainingAnswer(step, value, lang, refs, setters) {
  const {
    addMessage,
    setWizardMode,
    setWizardType,
    setConversation,
    setIsOpen,
    requestReopen,
  } = setters;

  const state = getPublishedState() || {};
  const backLabel = getBackLabel(lang);

  const pageHelpLabel = getPageHelpLabel(lang);
  const blockedHelpLabel = getBlockedHelpLabel(lang);
  const userModeLabel = getUserModeLabel(lang);
  const developerModeLabel = getDeveloperModeLabel(lang);
  const advancedApproachLabel = getAdvancedApproachLabel(lang);
  const datasetHelpLabel = getDatasetHelpLabel(lang);
  const datasetAfterSelectLabel = getDatasetAfterSelectLabel(lang);
  const modelHelpLabel = getModelHelpLabel(lang);
  const preflightHelpLabel = getPreflightHelpLabel(lang);
  const statusHelpLabel = getStatusHelpLabel(lang);
  const configPreviewLabel = getConfigPreviewLabel(lang);
  const liveMetricsLabel = getLiveMetricsLabel(lang);
  const resultsHelpLabel = getResultsHelpLabel(lang);
  const initializingHelpLabel = getInitializingHelpLabel(lang);
  const failedCauseLabel = getFailedCauseLabel(lang);
  const newTrainingLabel = getNewTrainingLabel(lang);
  const singleClassLabel = getSingleClassLabel(lang);
  const smartAutoLabel = getSmartAutoLabel(lang);
  const yolo26Label = getYolo26Label(lang);
  const optimizationLabel = getOptimizationLabel(lang);
  const lossWeightsLabel = getLossWeightsLabel(lang);
  const augmentationLabel = getAugmentationLabel(lang);
  const taskSegLabel = getTaskSegLabel(lang);
  const validationLabel = getValidationLabel(lang);
  const aiConsoleLabel = getAiConsoleLabel(lang);
  const aiVsStatusLabel = getAiVsStatusLabel(lang);
  const terminalProtectedLabel = getTerminalProtectedLabel(lang);
  const chooseGpuLabel = getChooseGpuLabel(lang);
  const noGpuLabel = getNoGpuLabel(lang);
  const startTrainingLabel = getStartTrainingLabel(lang);
  const openAiConsoleLabel = getOpenAiConsoleLabel(lang);
  const hideAiConsoleLabel = getHideAiConsoleLabel(lang);

  function closeBot() {
    setWizardMode(false);
    setWizardType(null);
    setConversation([]);
    setIsOpen(false);
  }

  function explain(text, nextStep, options = [backLabel]) {
    addMessage('bot', text, { inputType: 'buttons', options, step: nextStep });
  }

  const datasetFlowText = getDatasetFlowText(state, lang);

  if (value === pageHelpLabel) {
    explain(
      lang === 'it'
        ? 'A sinistra imposti il training: identita, task, modello, release dataset e preset. A destra vedi il preflight con Name, Dataset e Model, poi Config Preview e Status.'
        : 'On the left you configure the training: identity, task, model, dataset release, and preset. On the right you see the Name, Dataset, and Model preflight, then Config Preview and Status.',
      'training-page-help'
    );
    return;
  }

  if (value === blockedHelpLabel) {
    explain(
      lang === 'it'
        ? 'Il training parte solo quando i tre controlli di preflight sono pronti: Name, Dataset e Model. Se anche uno solo manca, Start Training resta bloccato.'
        : 'Training starts only when the three preflight checks are ready: Name, Dataset, and Model. If even one is missing, Start Training stays blocked.',
      'training-blocked-help'
    );
    return;
  }

  if (value === userModeLabel) {
    explain(
      lang === 'it'
        ? 'User mode e il flusso semplice e sicuro. Ti lascia gestire solo le impostazioni piu importanti come preset, device, epochs, image size, batch size, AMP, early stop, resume e optimizer.'
        : 'User mode is the simpler and safer workflow. It exposes only the most important settings such as presets, device, epochs, image size, batch size, AMP, early stop, resume, and optimizer.',
      'training-user-mode-help'
    );
    return;
  }

  if (value === developerModeLabel) {
    explain(
      lang === 'it'
        ? 'Developer mode apre molti piu controlli: optimization, loss weights, augmentation, task-specific settings e validation. E pensato per chi sa perche sta cambiando questi gruppi.'
        : 'Developer mode opens many more controls: optimization, loss weights, augmentation, task-specific settings, and validation. It is meant for someone who knows why those groups are being changed.',
      'training-developer-mode-help'
    );
    return;
  }

  if (value === advancedApproachLabel) {
    explain(
      lang === 'it'
        ? 'Affronta le impostazioni avanzate un gruppo alla volta. Lascia i default se non hai una ragione precisa, modifica una sola area per volta e controlla sempre Config Preview prima di avviare il training.'
        : 'Approach the advanced settings one group at a time. Keep defaults unless you have a specific reason, change one area at a time, and always review Config Preview before starting training.',
      'training-advanced-approach-help',
      state.mode === 'developer'
        ? [optimizationLabel, lossWeightsLabel, augmentationLabel, taskSegLabel, validationLabel, backLabel]
        : [backLabel]
    );
    return;
  }

  if (value === datasetHelpLabel) {
    explain(
      `${lang === 'it'
        ? 'Il menu Release mostra le release di questo progetto compatibili con il task scelto. La release selezionata diventa la sorgente dati del training, non un dataset incompleto. '
        : 'The Release dropdown shows releases from this project that match the selected task. The selected release becomes the training data source, not unfinished raw data. '}${datasetFlowText}`,
      'training-dataset-help',
      [datasetAfterSelectLabel, backLabel]
    );
    return;
  }

  if (value === datasetAfterSelectLabel) {
    explain(
      lang === 'it'
        ? 'Dopo la scelta, la UI puo mostrarti tre fasi: ZIP selected quando la release zip e stata scelta, Extract quando va ancora preparata, ed Extracted quando la directory di training e pronta.'
        : 'After selection, the UI can show three stages: ZIP selected when the release zip is chosen, Extract when it still needs preparation, and Extracted when the training directory is ready.',
      'training-dataset-after-select-help'
    );
    return;
  }

  if (value === modelHelpLabel) {
    const yolo26Hint = state.yolo26ModelSelected
      ? (lang === 'it'
        ? ' In questo caso la UI ha anche riconosciuto un modello YOLO26.'
        : ' In this case the UI has also recognized a YOLO26 model.')
      : '';
    explain(
      `${lang === 'it'
        ? 'Il pretrained model deve essere compatibile con framework e task. In questa UI il training usa modelli trainable, in pratica soprattutto file .pt adatti al task selezionato.'
        : 'The pretrained model must be compatible with the framework and task. In this UI training uses trainable models, in practice mainly .pt files that fit the selected task.'}${yolo26Hint}`,
      'training-model-help',
      state.yolo26ModelSelected ? [yolo26Label, backLabel] : [backLabel]
    );
    return;
  }

  if (value === preflightHelpLabel) {
    explain(
      lang === 'it'
        ? 'Prima di partire controlla: training name chiaro, release corretta e gia pronta, pretrained model coerente col task, preset sensato, e Config Preview senza sorprese.'
        : 'Before starting, check that the training name is clear, the release is correct and prepared, the pretrained model matches the task, the preset is sensible, and Config Preview has no surprises.',
      'training-preflight-help',
      state.singleClassDataset && !state.singleClassEnabled ? [singleClassLabel, backLabel] : [backLabel]
    );
    return;
  }

  if (value === statusHelpLabel) {
    explain(
      lang === 'it'
        ? 'Status mostra la lettura operativa del training. Se il run e in corso vedi avanzamento, losses e metriche live; se non c e un run attivo, puo mostrare l ultimo risultato completato.'
        : 'Status shows the operational training view. If a run is active you see live progress, losses, and metrics; if no run is active it can still show the last completed result.',
      'training-status-help',
      state.showRunningDashboard ? [liveMetricsLabel, backLabel] : [resultsHelpLabel, backLabel]
    );
    return;
  }

  if (value === configPreviewLabel) {
    explain(
      lang === 'it'
        ? 'Config Preview mostra la configurazione effettiva che verra usata dal training. E il posto migliore per verificare se preset, optimizer, augmentation e validazione corrispondono davvero a cio che vuoi lanciare.'
        : 'Config Preview shows the effective configuration that training will use. It is the best place to verify that the preset, optimizer, augmentation, and validation settings really match what you want to launch.',
      'training-config-preview-help'
    );
    return;
  }

  if (value === liveMetricsLabel) {
    explain(
      lang === 'it'
        ? 'Leggi le metriche live in tre livelli: avanzamento dell epoch, losses durante il training e metriche di validazione. Per segmentation controlla anche i blocchi box e mask separatamente.'
        : 'Read the live metrics in three layers: epoch progress, training losses, and validation metrics. For segmentation, also watch the separate box and mask result blocks.',
      'training-live-metrics-help'
    );
    return;
  }

  if (value === resultsHelpLabel) {
    explain(
      lang === 'it'
        ? 'Qui stai leggendo un risultato gia completato. Precision, Recall e mAP aiutano a capire la qualita del modello; nelle run di segmentation devi leggere sia i risultati box sia quelli mask.'
        : 'Here you are reading a finished result. Precision, Recall, and mAP help describe model quality; in segmentation runs you should read both the box and mask results.',
      'training-results-help'
    );
    return;
  }

  if (value === initializingHelpLabel) {
    explain(
      lang === 'it'
        ? 'Il sistema sta ancora preparando modello, release e sessione di training. E normale non vedere subito metriche: compariranno appena le prime iterazioni del run saranno partite.'
        : 'The system is still preparing the model, release, and training session. It is normal not to see metrics immediately: they will appear once the first iterations of the run begin.',
      'training-initializing-help'
    );
    return;
  }

  if (value === failedCauseLabel) {
    explain(
      lang === 'it'
        ? 'Le cause comuni sono: release non pronta o non estratta, task incompatibile con il modello scelto, problemi di memoria GPU o impostazioni avanzate troppo aggressive.'
        : 'Common causes are: a release that is not ready or extracted, a task that does not match the chosen model, GPU memory issues, or advanced settings that are too aggressive.',
      'training-failed-cause-help'
    );
    return;
  }

  if (value === newTrainingLabel) {
    explain(
      lang === 'it'
        ? 'Per ripartire bene, correggi prima il problema, poi controlla Name, Dataset, Model e Config Preview. Dopo questo puoi avviare una nuova run senza riusare impostazioni sbagliate.'
        : 'To restart well, first correct the problem, then check Name, Dataset, Model, and Config Preview. After that you can launch a new run without reusing the wrong setup.',
      'training-new-training-help'
    );
    return;
  }

  if (value === singleClassLabel) {
    explain(
      lang === 'it'
        ? 'Se il dataset ha una sola classe, Single Class dovrebbe in genere essere attivo. Altrimenti il setup puo restare incoerente per un problema che in realta e one-class.'
        : 'If the dataset has only one class, Single Class should usually be enabled. Otherwise the setup can stay inconsistent for a problem that is really one-class.',
      'training-single-class-help'
    );
    return;
  }

  if (value === smartAutoLabel) {
    explain(
      lang === 'it'
        ? 'Smart Auto sceglie l optimizer in modo deterministico dalle condizioni reali del training, come device, batch size e contesto del modello selezionato. Serve a darti un default sensato senza tuning manuale.'
        : 'Smart Auto chooses the optimizer deterministically from the real training conditions, such as device, batch size, and the selected model context. It is meant to give you a sensible default without manual tuning.',
      'training-smart-auto-help'
    );
    return;
  }

  if (value === yolo26Label) {
    explain(
      lang === 'it'
        ? 'Quando scegli un modello YOLO26, la UI raccomanda MuSGD perche quella famiglia di modelli e progettata per lavorare meglio con quell optimizer.'
        : 'When you choose a YOLO26 model, the UI recommends MuSGD because that model family is designed to work best with that optimizer.',
      'training-yolo26-help'
    );
    return;
  }

  if (value === optimizationLabel) {
    explain(
      lang === 'it'
        ? 'Optimization controlla come il modello impara: optimizer, learning rate, momentum, weight decay, warmup e scheduler. Cambiare qui influisce direttamente sulla stabilita e velocita di apprendimento.'
        : 'Optimization controls how the model learns: optimizer, learning rate, momentum, weight decay, warmup, and scheduler. Changes here directly affect learning stability and speed.',
      'training-optimization-help',
      state.optimizerMode === 'smart-auto' ? [smartAutoLabel, backLabel] : [backLabel]
    );
    return;
  }

  if (value === lossWeightsLabel) {
    explain(
      lang === 'it'
        ? 'Loss Weights cambiano quanta importanza il training assegna a box, class prediction e quality terms. Sono potenti, ma non andrebbero cambiati senza sapere cosa si sta riequilibrando.'
        : 'Loss Weights change how much importance training gives to box, class prediction, and quality terms. They are powerful, but should not be changed unless you know what you are rebalancing.',
      'training-loss-weights-help'
    );
    return;
  }

  if (value === augmentationLabel) {
    explain(
      lang === 'it'
        ? 'Le impostazioni di Augmentation cambiano come le immagini vengono variate durante il training. Più augmentazione puo migliorare generalizzazione, ma puo anche rendere il run piu pesante o meno stabile.'
        : 'Augmentation settings change how images are varied during training. More augmentation can improve generalization, but it can also make the run heavier or less stable.',
      'training-augmentation-help'
    );
    return;
  }

  if (value === taskSegLabel) {
    explain(
      lang === 'it'
        ? 'Task & Segmentation raccoglie opzioni specifiche del task, come mask behavior e freeze layers. Queste impostazioni hanno senso solo se modello, release e task sono coerenti.'
        : 'Task & Segmentation groups task-specific options such as mask behavior and freeze layers. These settings only make sense if the model, release, and task are coherent.',
      'training-task-seg-help'
    );
    return;
  }

  if (value === validationLabel) {
    explain(
      lang === 'it'
        ? 'Validation controlla come il modello viene valutato durante il training: soglie, max detections e grafici. Questo influisce su quanto severe e leggibili saranno le metriche finali.'
        : 'Validation controls how the model is evaluated during training: thresholds, max detections, and plots. This affects how strict and readable the final metrics will be.',
      'training-validation-help'
    );
    return;
  }

  if (value === aiConsoleLabel) {
    explain(
      lang === 'it'
        ? 'AI Console e una vista tecnica live pensata per il developer workflow. Serve a leggere output piu grezzo e diagnostico rispetto alla normale scheda Status.'
        : 'AI Console is a live technical view intended for the developer workflow. It is for reading lower-level diagnostic output than the normal Status tab.',
      'training-ai-console-help'
    );
    return;
  }

  if (value === aiVsStatusLabel) {
    explain(
      lang === 'it'
        ? 'Status e la lettura piu guidata e orientata al risultato. AI Console e invece una vista piu tecnica e diagnostica, utile quando vuoi vedere il comportamento del training piu da vicino.'
        : 'Status is the more guided, result-oriented view. AI Console is the more technical diagnostic view, useful when you want to watch the training behavior more closely.',
      'training-ai-vs-status-help'
    );
    return;
  }

  if (value === terminalProtectedLabel) {
    explain(
      lang === 'it'
        ? 'L accesso al terminale e protetto per evitare uso tecnico accidentale. E una parte piu sensibile del workflow rispetto ai normali controlli visibili nella pagina.'
        : 'Terminal access is protected to avoid accidental technical misuse. It is a more sensitive part of the workflow than the normal controls shown on the page.',
      'training-terminal-protected-help'
    );
    return;
  }

  if (value === chooseGpuLabel) {
    explain(
      lang === 'it'
        ? 'Scegli una GPU disponibile se l hardware e stato rilevato. Quella GPU diventera il device usato da questo training specifico.'
        : 'Choose one available GPU if the hardware has been detected. That GPU becomes the device used by this specific training run.',
      'training-gpu-help'
    );
    return;
  }

  if (value === noGpuLabel) {
    explain(
      lang === 'it'
        ? 'Se non c e una GPU compatibile, il training resta su CPU. E piu lento, ma continua a essere una configurazione valida.'
        : 'If no compatible GPU is available, training stays on CPU. It is slower, but it is still a valid configuration.',
      'training-no-gpu-help'
    );
    return;
  }

  if (value === openAiConsoleLabel) {
    clickTrainingAction({ text: 'AI Console' });
    return;
  }

  if (value === hideAiConsoleLabel) {
    clickTrainingAction({ text: 'Hide' });
    return;
  }

  if (value === startTrainingLabel) {
    if (state.singleClassDataset && !state.singleClassEnabled && state.mode !== 'developer') {
      explain(
        lang === 'it'
          ? 'Prima di partire qui devi sistemare Single Class. Il dataset selezionato ha una sola classe e in User mode questa impostazione va attivata prima di Start Training.'
          : 'Before starting here, you need to fix Single Class. The selected dataset has only one class, and in User mode that setting should be enabled before Start Training.',
        'training-single-class-blocker-help',
        [singleClassLabel, backLabel]
      );
      return;
    }

    if (!state.startTrainingEnabled) {
      explain(
        lang === 'it'
          ? 'Start Training non e ancora disponibile. Controlla che Name, Dataset e Model siano tutti pronti prima di riprovare.'
          : 'Start Training is not available yet. Check that Name, Dataset, and Model are all ready before trying again.',
        'training-start-blocked-help'
      );
      return;
    }

    requestReopen();
    clickTrainingAction({ text: 'Start Training' });
    return;
  }

  if (value === backLabel) {
    applyFreshTrainingSnapshot(lang, refs, setters);
    return;
  }

  closeBot();
}
