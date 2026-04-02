/**
 * releaseBot.js - Release section logic for the guide bot.
 *
 * First pass scope:
 * - main release creation flow
 * - key release modals
 * - release details view
 * - explanation-first guidance with a few useful real actions
 */

function getPublishedState() {
  return window.__releaseGuideState || null;
}

function getReleaseContainer() {
  return document.querySelector('.release-section');
}

function isReleasePage() {
  const state = getPublishedState();
  if (state?.isReleasePage) return true;

  const container = getReleaseContainer();
  if (!container) return false;

  const heading = Array.from(container.querySelectorAll('h1, h2, h3'))
    .find(el => el.textContent?.trim() === 'Dataset Releases');
  return !!heading;
}

function findTextNode(pattern) {
  return Array.from(document.querySelectorAll('div, span, p, h1, h2, h3, h4, button'))
    .find(el => pattern.test((el.textContent || '').trim()));
}

function findButtonByText(text) {
  return Array.from(document.querySelectorAll('button'))
    .find(btn => btn.textContent?.trim() === text);
}

function clickButtonByText(text) {
  const btn = findButtonByText(text);
  if (btn) {
    btn.click();
    return true;
  }
  return false;
}

function getBackLabel(lang) {
  return lang === 'it' ? 'Indietro' : 'Back';
}

function getHowLabel(lang) {
  return lang === 'it' ? 'Come funziona questa pagina?' : 'How does this page work?';
}

function getDatasetsHelpLabel(lang) {
  return lang === 'it' ? 'Cosa significano i dataset disponibili?' : 'What do available datasets mean?';
}

function getRebalanceHelpLabel(lang) {
  return lang === 'it' ? 'Che cos e Rebalance?' : 'What is Rebalance?';
}

function getAddBasicLabel(lang) {
  return lang === 'it' ? 'Add Basic Transformation' : 'Add Basic Transformation';
}

function getTransformationsHelpLabel(lang) {
  return lang === 'it' ? 'Cosa fanno queste trasformazioni?' : 'What do these transformations do?';
}

function getImagesPerOriginalHelpLabel(lang) {
  return lang === 'it' ? 'Come funziona Images per Original?' : 'How does Images per Original work?';
}

function getHowManyImagesLabel(lang) {
  return lang === 'it' ? 'Quante immagini verranno create?' : 'How many images will this create?';
}

function getConfigHelpLabel(lang) {
  return lang === 'it' ? 'Cosa significa questa configurazione?' : 'What does this configuration mean?';
}

function getPreviewHelpLabel(lang) {
  return lang === 'it' ? 'Cosa sto controllando qui?' : 'What am I checking here?';
}

function getPreviewActionLabel(lang) {
  return lang === 'it' ? 'Preview Output' : 'Preview Output';
}

function getCreateReleaseLabel(lang) {
  return lang === 'it' ? 'Create Release' : 'Create Release';
}

function getDownloadZipLabel(lang) {
  return lang === 'it' ? 'Download ZIP File' : 'Download ZIP File';
}

function getDownloadHelpLabel(lang) {
  return lang === 'it' ? 'Cosa posso fare qui?' : 'What can I do here?';
}

function getContinueConfigLabel(lang) {
  return lang === 'it' ? 'Continue to Release Configuration' : 'Continue to Release Configuration';
}

function getDetailsHelpLabel(lang) {
  return lang === 'it' ? 'Come leggo questa pagina?' : 'How do I read this page?';
}

function getCreateNewReleaseLabel(lang) {
  return lang === 'it' ? 'Create New Release' : 'Create New Release';
}

function getBackToHistoryLabel(lang) {
  return lang === 'it' ? 'Back to Release History' : 'Back to Release History';
}

function getGoManagementLabel(lang) {
  return lang === 'it' ? 'Go to Management' : 'Go to Management';
}

function makeState(wizardType, text, options, step) {
  return {
    wizardType,
    conversation: [{ role: 'bot', text, inputType: 'buttons', options, step }],
    step,
  };
}

function applyFreshReleaseSnapshot(lang, refs, setters) {
  const { setIsOpen, setWizardMode, setWizardType, setConversation, setWizardStep } = setters;
  const state = checkReleasePageState(lang, refs, setters);
  if (!state) return;
  setIsOpen(true);
  setWizardMode(true);
  setWizardType(state.wizardType);
  setConversation(state.conversation);
  setWizardStep(state.step);
}

function isPreviewVisible() {
  return !!findTextNode(/Release Configuration Preview:/);
}

function isCreatingRelease() {
  return !!findTextNode(/Creating release\.\.\./);
}

function isReleaseDetailsView(state) {
  if (state?.showReleaseDetails) return true;
  return !!findButtonByText('Back to Release History');
}

function isDownloadModalOpen(state) {
  if (state?.downloadModalOpen) return true;
  return !!findTextNode(/^Download Release$/);
}

function isGlobalRebalanceOpen() {
  return !!findTextNode(/^Rebalance Train\/Test Split$/);
}

function isDatasetDetailsOpen(state) {
  if (state?.datasetDetailsModalVisible) return true;
  return !!findTextNode(/^Dataset Details:/);
}

function isDatasetRebalanceOpen(state) {
  if (state?.datasetRebalanceModalVisible) return true;
  return !!findTextNode(/^Rebalance Dataset:/);
}

function isRenameReleaseOpen() {
  return !!findTextNode(/^Rename Release$/);
}

function isDeleteReleaseOpen() {
  return !!findTextNode(/^Delete Release$/);
}

function hasToolModalOpen() {
  return !!findTextNode(/^Add Basic Transformation$/) || !!findTextNode(/^Add Advanced Transformation$/);
}

function hasToolConfigOpen() {
  return !!findTextNode(/^Back to Tools$/) && !!findButtonByText('Apply Transformation');
}

export function checkReleasePageState(lang, refs, setters) {
  if (!isReleasePage()) return null;

  const state = getPublishedState() || {};
  const {
    loading = false,
    hasCompletedDatasets = false,
    transformationsCount = 0,
    hasResize = false,
    showReleaseConfig = false,
    showReleaseDetails = false,
    downloadModalOpen = false,
    isCreating = false,
  } = state;

  if (loading && !showReleaseConfig && !hasCompletedDatasets) {
    const text = lang === 'it'
      ? 'Sto preparando la sezione Release. Tra poco potrai controllare dataset completati, trasformazioni e configurazione della release.'
      : 'I am preparing the Release section. In a moment you will be able to review completed datasets, transformations, and release configuration.';
    return makeState('release-loading', text, [], 'release-loading');
  }

  if (isDownloadModalOpen(state) || downloadModalOpen) {
    const text = lang === 'it'
      ? 'La release e pronta. Qui puoi scaricare il file ZIP oppure copiare il link di download prima di chiudere questa finestra.'
      : 'The release is ready. Here you can download the ZIP file or copy the download link before closing this window.';
    return makeState('release-download-modal', text, [getDownloadHelpLabel(lang), getDownloadZipLabel(lang), getBackLabel(lang)], 'release-download-modal');
  }

  if (isCreating || isCreatingRelease()) {
    const text = lang === 'it'
      ? 'Sto creando la release adesso. Le immagini e le annotazioni vengono preparate per l esportazione.'
      : 'I am creating the release now. The images and annotations are being prepared for export.';
    return makeState('release-creating', text, [], 'release-creating');
  }

  if (showReleaseDetails || isReleaseDetailsView(state)) {
    const text = lang === 'it'
      ? 'Questa e la vista completa di una release gia creata. Qui puoi controllare statistiche, trasformazioni applicate, classi e immagini finali prima di scaricarla o crearne una nuova.'
      : 'This is the full view of one created release. Here you can review the statistics, applied transformations, classes, and final images before downloading it or creating a new one.';
    return makeState('release-details-view', text, [getDetailsHelpLabel(lang), getDownloadZipLabel(lang), getCreateNewReleaseLabel(lang), getBackToHistoryLabel(lang)], 'release-details-view');
  }

  if (isDeleteReleaseOpen()) {
    const text = lang === 'it'
      ? 'Questa finestra conferma l eliminazione di una release salvata. E un azione distruttiva e non puo essere annullata.'
      : 'This window confirms deleting a saved release. It is a destructive action and cannot be undone.';
    return makeState('release-delete-modal', text, [getBackLabel(lang)], 'release-delete-modal');
  }

  if (isRenameReleaseOpen()) {
    const text = lang === 'it'
      ? 'Qui puoi rinominare una release gia salvata. Scegli un nome chiaro che ti aiuti a riconoscere questa versione in seguito.'
      : 'Here you can rename a saved release. Choose a clear name so this version stays easy to recognize later.';
    return makeState('release-rename-modal', text, [getBackLabel(lang)], 'release-rename-modal');
  }

  if (isDatasetRebalanceOpen(state)) {
    const text = lang === 'it'
      ? 'Questo rebalance cambia Train, Validation e Test solo dentro questo dataset completato. Non ribilancia tutti i dataset della release insieme.'
      : 'This rebalance changes Train, Validation, and Test only inside this completed dataset. It does not rebalance all release datasets together.';
    return makeState('release-dataset-rebalance', text, [getRebalanceHelpLabel(lang), getBackLabel(lang)], 'release-dataset-rebalance');
  }

  if (isDatasetDetailsOpen(state)) {
    const text = lang === 'it'
      ? 'Questa finestra mostra un dataset completato in dettaglio. Qui puoi controllare overview, distribuzione degli split e immagini di esempio.'
      : 'This window shows one completed dataset in detail. Here you can review the overview, split distribution, and sample images.';
    return makeState('release-dataset-details', text, [getDatasetsHelpLabel(lang), getRebalanceHelpLabel(lang), getBackLabel(lang)], 'release-dataset-details');
  }

  if (isGlobalRebalanceOpen()) {
    const text = lang === 'it'
      ? 'Questo rebalance ridistribuisce gli split Train, Validation e Test sull intero pool di dataset completati idonei alla release.'
      : 'This rebalance redistributes Train, Validation, and Test across the full eligible pool of completed datasets for the release.';
    return makeState('release-global-rebalance', text, [getRebalanceHelpLabel(lang), getBackLabel(lang)], 'release-global-rebalance');
  }

  if (hasToolConfigOpen()) {
    const text = lang === 'it'
      ? 'Qui configuri una trasformazione guardando anteprima, parametri e numero stimato di combinazioni prima di applicarla.'
      : 'Here you configure one transformation by checking the preview, the parameters, and the estimated combinations before applying it.';
    return makeState('release-tool-config', text, [getTransformationsHelpLabel(lang), getHowManyImagesLabel(lang), getBackLabel(lang)], 'release-tool-config');
  }

  if (hasToolModalOpen()) {
    const text = lang === 'it'
      ? 'Qui scegli quale trasformazione aggiungere alla pipeline della release. Gli strumenti base fanno modifiche comuni, quelli avanzati introducono variazioni piu forti.'
      : 'Here you choose which transformation to add to the release pipeline. Basic tools make common changes, while advanced tools introduce stronger variation.';
    return makeState('release-tool-picker', text, [getTransformationsHelpLabel(lang), getBackLabel(lang)], 'release-tool-picker');
  }

  if (showReleaseConfig) {
    if (isPreviewVisible()) {
      const text = lang === 'it'
        ? 'Questa anteprima riassume il contenuto finale della release. Controlla totali, split, dataset selezionati e trasformazioni prima di generarla.'
        : 'This preview summarizes the final release content. Check totals, splits, selected datasets, and transformations before generating it.';
      return makeState('release-preview-open', text, [getPreviewHelpLabel(lang), getCreateReleaseLabel(lang), getBackLabel(lang)], 'release-preview-open');
    }

    const text = lang === 'it'
      ? 'Ora scegli nome release, immagini per originale, formato immagine, task type e formato di esportazione. Poi controlla l anteprima finale.'
      : 'Now choose the release name, images per original, image format, task type, and export format. Then review the final preview.';
    return makeState('release-config-open', text, [getConfigHelpLabel(lang), getImagesPerOriginalHelpLabel(lang), getPreviewActionLabel(lang)], 'release-config-open');
  }

  if (!hasCompletedDatasets) {
    const text = lang === 'it'
      ? 'Qui non ci sono ancora dataset completati pronti per una release. Prima completa etichettatura e passaggio al Dataset.'
      : 'There are no completed datasets ready for a release here yet. First finish labeling and move them into the Dataset stage.';
    return makeState('release-empty', text, [lang === 'it' ? 'Perche qui non c e ancora nulla?' : 'Why is nothing here yet?', getGoManagementLabel(lang)], 'release-empty');
  }

  if (transformationsCount > 0 && hasResize) {
    const text = lang === 'it'
      ? 'Le trasformazioni sono pronte. Ora puoi continuare alla configurazione della release e decidere quanti output generare per ogni immagine originale.'
      : 'The transformations are ready. You can now continue to release configuration and decide how many outputs to generate for each original image.';
    return makeState('release-tools-added', text, [getTransformationsHelpLabel(lang), getContinueConfigLabel(lang), getHowManyImagesLabel(lang)], 'release-tools-added');
  }

  const text = lang === 'it'
    ? 'Questa pagina crea versioni esportabili del dataset. Prima scegli le trasformazioni: Resize e obbligatorio, poi potrai continuare alla configurazione della release.'
    : 'This page creates exportable dataset releases. First choose the transformations: Resize is required, then you can continue to release configuration.';
  return makeState('release-ready-no-tools', text, [getHowLabel(lang), getDatasetsHelpLabel(lang), getAddBasicLabel(lang), getRebalanceHelpLabel(lang)], 'release-ready-no-tools');
}

export function handleReleaseAnswer(step, value, lang, refs, setters) {
  const { addMessage, setWizardMode, setWizardType, setConversation, setIsOpen, requestReopen } = setters;

  const backLabel = getBackLabel(lang);
  const howLabel = getHowLabel(lang);
  const datasetsHelpLabel = getDatasetsHelpLabel(lang);
  const rebalanceHelpLabel = getRebalanceHelpLabel(lang);
  const addBasicLabel = getAddBasicLabel(lang);
  const transformationsHelpLabel = getTransformationsHelpLabel(lang);
  const imagesPerOriginalHelpLabel = getImagesPerOriginalHelpLabel(lang);
  const howManyImagesLabel = getHowManyImagesLabel(lang);
  const configHelpLabel = getConfigHelpLabel(lang);
  const previewHelpLabel = getPreviewHelpLabel(lang);
  const previewActionLabel = getPreviewActionLabel(lang);
  const createReleaseLabel = getCreateReleaseLabel(lang);
  const downloadZipLabel = getDownloadZipLabel(lang);
  const downloadHelpLabel = getDownloadHelpLabel(lang);
  const continueConfigLabel = getContinueConfigLabel(lang);
  const detailsHelpLabel = getDetailsHelpLabel(lang);
  const createNewReleaseLabel = getCreateNewReleaseLabel(lang);
  const backToHistoryLabel = getBackToHistoryLabel(lang);
  const goManagementLabel = getGoManagementLabel(lang);

  function closeBot() {
    setWizardMode(false);
    setWizardType(null);
    setConversation([]);
    setIsOpen(false);
  }

  if (step === 'release-ready-no-tools') {
    if (value === howLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Questa pagina ti aiuta a creare una release versionata del dataset. A sinistra vedi la cronologia release, mentre a destra prepari una nuova release scegliendo dataset, trasformazioni e configurazione finale.'
          : 'This page helps you create a versioned dataset release. On the left you see release history, and on the right you prepare a new release by choosing datasets, transformations, and the final configuration.',
        { inputType: 'buttons', options: [datasetsHelpLabel, rebalanceHelpLabel, backLabel], step: 'release-page-help' }
      );
      return;
    }
    if (value === datasetsHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Qui compaiono solo i dataset completati e gia pronti per la fase Dataset. Sono gli unici batch idonei a entrare in una release.'
          : 'Only completed datasets that are already ready in the Dataset stage appear here. Those are the only batches eligible to enter a release.',
        { inputType: 'buttons', options: [backLabel], step: 'release-datasets-help' }
      );
      return;
    }
    if (value === rebalanceHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Rebalance cambia come le immagini vengono distribuite tra Train, Validation e Test. Il rebalance principale lavora sull intero pool della release, mentre il rebalance di dataset lavora solo dentro un dataset completato.'
          : 'Rebalance changes how images are distributed between Train, Validation, and Test. The main rebalance works across the whole release pool, while dataset rebalance works only inside one completed dataset.',
        { inputType: 'buttons', options: [backLabel], step: 'release-rebalance-help' }
      );
      return;
    }
    if (value === addBasicLabel) {
      requestReopen();
      clickButtonByText('Add Basic Transformation');
      closeBot();
      return;
    }
  }

  if (step === 'release-tools-added') {
    if (value === transformationsHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Le trasformazioni definiscono come il dataset verra aumentato prima dell export. Gli strumenti base fanno modifiche comuni come resize, crop, rotate e flip; quelli avanzati introducono variazioni piu forti.'
          : 'Transformations define how the dataset will be augmented before export. Basic tools make common changes like resize, crop, rotate, and flip, while advanced tools introduce stronger variation.',
        { inputType: 'buttons', options: [backLabel], step: 'release-transformations-help' }
      );
      return;
    }
    if (value === howManyImagesLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Il numero finale dipende dagli strumenti selezionati e dal valore Images per Original. Il massimo mostrato dal sistema viene calcolato dinamicamente dallo schema delle trasformazioni.'
          : 'The final image count depends on the selected tools and the Images per Original value. The maximum shown by the system is calculated dynamically from the transformation schema.',
        { inputType: 'buttons', options: [backLabel], step: 'release-images-count-help' }
      );
      return;
    }
    if (value === continueConfigLabel) {
      requestReopen();
      clickButtonByText('Continue to Release Configuration');
      closeBot();
      return;
    }
  }

  if (step === 'release-config-open') {
    if (value === configHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Qui scegli il nome della release, quante immagini produrre per ogni originale, il formato immagine, il task type e il formato di export. Task type ed export devono avere senso insieme.'
          : 'Here you choose the release name, how many images to produce per original, the image format, the task type, and the export format. Task type and export format must make sense together.',
        { inputType: 'buttons', options: [backLabel], step: 'release-config-help' }
      );
      return;
    }
    if (value === imagesPerOriginalHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Images per Original puo essere qualsiasi numero da 1 al massimo mostrato. 1 mantiene solo l originale; valori piu alti aggiungono immagini augmentate fino al limite calcolato dal sistema.'
          : 'Images per Original can be any number from 1 to the shown maximum. 1 keeps only the original, while higher values add augmented images up to the limit calculated by the system.',
        { inputType: 'buttons', options: [backLabel], step: 'release-images-per-original-help' }
      );
      return;
    }
    if (value === previewActionLabel) {
      requestReopen();
      clickButtonByText('Preview Output');
      closeBot();
      return;
    }
  }

  if (step === 'release-preview-open') {
    if (value === previewHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Questa anteprima ti mostra il risultato finale: totale immagini, immagini base, classi, moltiplicatore, split originali e augmentati, dataset scelti e trasformazioni applicate.'
          : 'This preview shows the final result: total images, base images, classes, multiplier, original and augmented splits, selected datasets, and applied transformations.',
        { inputType: 'buttons', options: [backLabel], step: 'release-preview-help' }
      );
      return;
    }
    if (value === createReleaseLabel) {
      requestReopen();
      clickButtonByText('Create Release');
      closeBot();
      return;
    }
  }

  if (step === 'release-download-modal') {
    if (value === downloadHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Qui puoi scaricare subito il file ZIP della release o copiare il link di download. Chiudendo questa finestra la sezione torna pronta per creare una nuova release.'
          : 'Here you can download the release ZIP immediately or copy the download link. Closing this window returns the section to a fresh state for the next release.',
        { inputType: 'buttons', options: [backLabel], step: 'release-download-help' }
      );
      return;
    }
    if (value === downloadZipLabel) {
      clickButtonByText('Download ZIP File');
      return;
    }
  }

  if (step === 'release-details-view') {
    if (value === detailsHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Questa vista mostra tutti i dettagli di una release creata: statistiche finali, trasformazioni usate, classi, formato e immagini generate. Serve come pagina di controllo e audit della release.'
          : 'This view shows all details of one created release: final statistics, transformations used, classes, format, and generated images. It works as the review and audit page for that release.',
        { inputType: 'buttons', options: [backLabel], step: 'release-details-help' }
      );
      return;
    }
    if (value === downloadZipLabel) {
      clickButtonByText('Download ZIP');
      return;
    }
    if (value === createNewReleaseLabel) {
      requestReopen();
      clickButtonByText('Create New Release');
      closeBot();
      return;
    }
    if (value === backToHistoryLabel) {
      requestReopen();
      clickButtonByText('Back to Release History');
      closeBot();
      return;
    }
  }

  if (step === 'release-empty') {
    const emptyHelpLabel = lang === 'it' ? 'Perche qui non c e ancora nulla?' : 'Why is nothing here yet?';
    if (value === emptyHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Release usa solo dataset gia completati. Se un dataset non ha ancora finito etichettatura o non e ancora entrato nella fase Dataset, qui non comparira.'
          : 'Release uses only completed datasets. If a dataset has not finished labeling or has not yet reached the Dataset stage, it will not appear here.',
        { inputType: 'buttons', options: [backLabel], step: 'release-empty-help' }
      );
      return;
    }
    if (value === goManagementLabel) {
      requestReopen();
      const nav = Array.from(document.querySelectorAll('.ant-menu-item, a, button, span'))
        .find(el => (el.textContent || '').trim() === 'Management');
      nav?.click?.();
      closeBot();
      return;
    }
  }

  if (
    value === backLabel &&
    [
      'release-page-help',
      'release-datasets-help',
      'release-rebalance-help',
      'release-transformations-help',
      'release-images-count-help',
      'release-config-help',
      'release-images-per-original-help',
      'release-preview-help',
      'release-download-help',
      'release-details-help',
      'release-delete-modal',
      'release-rename-modal',
      'release-global-rebalance',
      'release-dataset-details',
      'release-dataset-rebalance',
      'release-tool-picker',
      'release-tool-config',
      'release-empty-help',
    ].includes(step)
  ) {
    applyFreshReleaseSnapshot(lang, refs, setters);
  }
}
