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

function getAddAdvancedLabel(lang) {
  return lang === 'it' ? 'Add Advanced Transformation' : 'Add Advanced Transformation';
}

function getTransformationsHelpLabel(lang) {
  return lang === 'it' ? 'Cosa fanno queste trasformazioni?' : 'What do these transformations do?';
}

function getToolUseHelpLabel(lang) {
  return lang === 'it' ? 'Come uso questo strumento?' : 'How do I use this tool?';
}

function getToolParamHelpLabel(lang) {
  return lang === 'it' ? 'Cosa significano questi parametri?' : 'What do these parameters mean?';
}

function getCombinationsHelpLabel(lang) {
  return lang === 'it' ? 'Che cos e Estimated Combinations?' : 'What is Estimated Combinations?';
}

function getApplyTransformationLabel(lang) {
  return lang === 'it' ? 'Apply Transformation' : 'Apply Transformation';
}

function getRenameHelpLabel(lang) {
  return lang === 'it' ? 'Che nome dovrei scrivere?' : 'What should I write here?';
}

function getDeleteHelpLabel(lang) {
  return lang === 'it' ? 'Cosa succede se la elimino?' : 'What happens if I delete it?';
}

function getRebalanceCountsHelpLabel(lang) {
  return lang === 'it' ? 'Come compilo questi numeri?' : 'How should I fill these counts?';
}

function normalizeToolName(toolName) {
  if (!toolName) return '';
  return String(toolName).trim().toLowerCase().replace(/_/g, ' ');
}

function getToolSpecificGuidance(toolName, lang) {
  const name = normalizeToolName(toolName);

  if (name.includes('resize')) {
    return {
      use: lang === 'it'
        ? 'Resize e il primo strumento importante qui, perche sblocca la configurazione finale della release. Imposta larghezza e altezza pensando alla dimensione di training desiderata, poi scegli il resize mode che conserva meglio il contenuto.'
        : 'Resize is the key first tool here because it unlocks the final release configuration. Set width and height for the training size you want, then choose the resize mode that preserves the content best.',
      params: lang === 'it'
        ? 'Width e Height definiscono la dimensione finale. Resize Mode decide come l immagine entra nella nuova misura: stretch deforma, fit mantiene le proporzioni, mentre fill/crop gestiscono i bordi o il taglio.'
        : 'Width and Height define the final size. Resize Mode decides how the image fits the new size: stretch distorts, fit preserves proportions, while fill/crop modes manage borders or trimming.',
      combinations: lang === 'it'
        ? 'Con Resize di solito le combinazioni restano semplici, perche spesso usi una sola misura finale. Il suo ruolo principale qui e definire la base su cui lavorano le altre trasformazioni.'
        : 'Resize usually keeps combinations simple because you often choose one final size. Its main role here is defining the base that the other transformations work on.',
    };
  }

  if (name.includes('rotate')) {
    return {
      use: lang === 'it'
        ? 'Usa Rotate per aggiungere variazione di orientamento quando l oggetto puo apparire inclinato. Controlla sempre il preview, perche angoli troppo forti possono rendere l immagine poco realistica.'
        : 'Use Rotate to add orientation variation when the object can appear tilted. Always check the preview, because very strong angles can make the image unrealistic.',
      params: lang === 'it'
        ? 'Angle controlla la rotazione. Fill Color decide il colore degli angoli vuoti creati dalla rotazione: scegli un riempimento che non distragga o falsi troppo il contesto.'
        : 'Angle controls the rotation. Fill Color decides the color of the empty corners created by rotation: choose a fill that does not distract or distort the context too much.',
      combinations: lang === 'it'
        ? 'Con una sola rotazione la combinazione e semplice. Se combini Rotate con altri strumenti geometrici, il numero di varianti possibili cresce piu rapidamente.'
        : 'With a single rotation the combination stays simple. If you combine Rotate with other geometric tools, the number of possible variants grows faster.',
    };
  }

  if (name.includes('flip')) {
    return {
      use: lang === 'it'
        ? 'Usa Flip quando l oggetto puo apparire valido specchiato. E molto utile per aumentare rapidamente la variazione, ma evita di usarlo se il verso dell oggetto ha un significato fisso.'
        : 'Use Flip when the object can still be valid when mirrored. It is very useful for adding variation quickly, but avoid it if the object orientation has a fixed meaning.',
      params: lang === 'it'
        ? 'Horizontal e Vertical attivano i due tipi di flip. Orizzontale e di solito il piu sicuro; verticale puo essere piu aggressivo e va controllato con attenzione sul preview.'
        : 'Horizontal and Vertical enable the two flip directions. Horizontal is usually the safer one; vertical can be more aggressive and should be checked carefully in the preview.',
      combinations: lang === 'it'
        ? 'Le combinazioni restano basse se attivi una sola direzione. Se usi piu direzioni o lo combini con altri strumenti, il massimo Images per Original puo aumentare.'
        : 'Combinations stay low if you enable only one direction. If you use multiple directions or combine it with other tools, the Images per Original maximum can increase.',
    };
  }

  if (name.includes('crop')) {
    return {
      use: lang === 'it'
        ? 'Usa Crop per simulare inquadrature piu strette. E utile, ma troppo crop puo tagliare parti importanti dell oggetto o dell annotazione.'
        : 'Use Crop to simulate tighter framing. It is useful, but too much cropping can remove important parts of the object or annotation.',
      params: lang === 'it'
        ? 'Crop Percentage decide quanto dell immagine originale rimane. Crop Mode decide dove avviene il taglio: center e piu stabile, random o corner danno piu variazione ma piu rischio.'
        : 'Crop Percentage decides how much of the original image remains. Crop Mode decides where the trim happens: center is more stable, while random or corner modes give more variation but more risk.',
      combinations: lang === 'it'
        ? 'Con una sola percentuale e una sola modalita hai una combinazione semplice. Modalita piu variabili rendono il dataset piu diverso, ma richiedono piu attenzione al preview.'
        : 'With one percentage and one mode you have a simple combination. More variable modes make the dataset more diverse, but require more preview checking.',
    };
  }

  if (name.includes('brightness')) {
    return {
      use: lang === 'it'
        ? 'Usa Brightness per simulare condizioni di luce leggermente diverse. E meglio restare su valori moderati, per non rendere le immagini troppo scure o troppo forti.'
        : 'Use Brightness to simulate slightly different lighting conditions. It is best to stay with moderate values so the images do not become too dark or too strong.',
      params: lang === 'it'
        ? 'La percentuale controlla quanto l immagine diventa piu scura o piu luminosa. Valori aggressivi possono ridurre il dettaglio utile per il training.'
        : 'The percentage controls how much the image becomes darker or brighter. Aggressive values can reduce useful detail for training.',
      combinations: lang === 'it'
        ? 'Per strumenti di intensita come Brightness, lo schema puo generare varianti anche in base a valori opposti o combinati con altri strumenti, quindi il massimo finale puo crescere.'
        : 'For intensity tools like Brightness, the schema can generate variants from opposite values or in combination with other tools, so the final maximum can grow.',
    };
  }

  if (name.includes('contrast')) {
    return {
      use: lang === 'it'
        ? 'Contrast cambia la separazione tra zone chiare e scure. E utile per robustezza visiva, ma troppo contrasto puo far perdere sfumature o dettaglio fine.'
        : 'Contrast changes the separation between light and dark areas. It helps visual robustness, but too much contrast can remove gradients or fine detail.',
      params: lang === 'it'
        ? 'La percentuale controlla quanto il contrasto viene ridotto o aumentato. In genere valori piccoli o medi sono piu sicuri di cambi estremi.'
        : 'The percentage controls how much contrast is reduced or increased. Small or moderate values are usually safer than extreme changes.',
      combinations: lang === 'it'
        ? 'Come Brightness, anche Contrast puo contribuire a piu varianti quando il sistema considera direzioni opposte o combinazioni con altri strumenti.'
        : 'Like Brightness, Contrast can also contribute to multiple variants when the system considers opposite directions or combinations with other tools.',
    };
  }

  if (name.includes('blur')) {
    return {
      use: lang === 'it'
        ? 'Usa Blur per simulare messa a fuoco non perfetta o movimento. E utile con moderazione; troppo blur puo cancellare i dettagli necessari alle annotazioni.'
        : 'Use Blur to simulate imperfect focus or motion. It is useful in moderation; too much blur can remove the details needed for the annotations.',
      params: lang === 'it'
        ? 'Radius controlla la forza del blur. Blur Type cambia lo stile: Gaussian e il piu comune, Motion e piu specifico, Box e piu semplice ma spesso meno naturale.'
        : 'Radius controls blur strength. Blur Type changes the style: Gaussian is the most common, Motion is more specific, and Box is simpler but often less natural.',
      combinations: lang === 'it'
        ? 'Con un solo blur la combinazione resta semplice. Se lo combini con zoom, crop o rotate, la varietà aumenta ma il rischio di immagini troppo degradate cresce.'
        : 'With one blur the combination stays simple. If you combine it with zoom, crop, or rotate, variety increases but the risk of overly degraded images also grows.',
    };
  }

  if (name.includes('random zoom') || name.includes('zoom')) {
    return {
      use: lang === 'it'
        ? 'Usa Random Zoom per simulare oggetti un po piu vicini o piu lontani. E utile per robustezza di scala, ma controlla che l oggetto resti leggibile e ben inquadrato.'
        : 'Use Random Zoom to simulate objects being a bit closer or farther away. It helps scale robustness, but check that the object stays readable and properly framed.',
      params: lang === 'it'
        ? 'Zoom Factor usa 1.0 come dimensione originale. Sopra 1.0 zoomi in, sotto 1.0 zoomi out. Valori troppo forti possono tagliare contesto o rendere l oggetto troppo piccolo.'
        : 'Zoom Factor uses 1.0 as the original size. Above 1.0 you zoom in, below 1.0 you zoom out. Very strong values can cut context or make the object too small.',
      combinations: lang === 'it'
        ? 'Random Zoom da solo resta semplice, ma combinato con crop o affine puo alzare molto il numero di varianti e la forza della trasformazione finale.'
        : 'Random Zoom alone stays simple, but combined with crop or affine it can greatly increase both the number of variants and the strength of the final transformation.',
    };
  }

  if (name.includes('color jitter')) {
    return {
      use: lang === 'it'
        ? 'Color Jitter e uno strumento piu ricco: cambia colore, luminosita, contrasto e saturazione insieme. E potente, ma va usato con attenzione per non creare colori innaturali.'
        : 'Color Jitter is a richer tool: it changes color, brightness, contrast, and saturation together. It is powerful, but should be used carefully to avoid unnatural colors.',
      params: lang === 'it'
        ? 'Ogni parametro controlla una parte diversa della variazione colore. Piccoli valori su piu parametri spesso funzionano meglio di un solo valore troppo aggressivo.'
        : 'Each parameter controls a different part of the color variation. Small values across multiple parameters often work better than one overly aggressive value.',
      combinations: lang === 'it'
        ? 'Poiche ha piu parametri, Color Jitter puo aumentare rapidamente le varianti possibili. Per questo conviene controllare Estimated Combinations e il max Images per Original.'
        : 'Because it has multiple parameters, Color Jitter can raise the number of possible variants quickly. That is why it is worth checking Estimated Combinations and the Images per Original max.',
    };
  }

  if (name.includes('affine')) {
    return {
      use: lang === 'it'
        ? 'Affine Transform combina scala, rotazione e spostamento. E utile per una variazione geometrica forte, ma e uno degli strumenti da controllare con piu attenzione.'
        : 'Affine Transform combines scale, rotation, and shifting. It is useful for stronger geometric variation, but it is one of the tools that needs the most careful checking.',
      params: lang === 'it'
        ? 'Scale, rotation, horizontal shift e vertical shift agiscono insieme. Anche valori moderati possono cambiare molto il risultato finale quando vengono combinati.'
        : 'Scale, rotation, horizontal shift, and vertical shift work together. Even moderate values can change the final result a lot when they are combined.',
      combinations: lang === 'it'
        ? 'Con piu parametri geometrici, le combinazioni possono crescere rapidamente. Guarda Estimated Combinations e scegli Images per Original in modo coerente con il livello di variazione che vuoi.'
        : 'With multiple geometric parameters, combinations can grow quickly. Watch Estimated Combinations and choose Images per Original in line with the amount of variation you actually want.',
    };
  }

  return {
    use: lang === 'it'
      ? 'Confronta sempre Original e Preview prima di applicare lo strumento. L obiettivo e ottenere una variazione utile senza rendere l immagine poco realistica.'
      : 'Always compare Original and Preview before applying the tool. The goal is to get useful variation without making the image unrealistic.',
    params: lang === 'it'
      ? 'I parametri controllano intensita, direzione o stile della trasformazione. Cambi troppo forti possono danneggiare dettagli importanti o creare casi poco credibili.'
      : 'The parameters control the strength, direction, or style of the transformation. Changes that are too strong can damage important detail or create unrealistic cases.',
    combinations: lang === 'it'
      ? 'Estimated Combinations mostra quante varianti questa configurazione puo contribuire a generare. Questo influenza il massimo disponibile in Images per Original.'
      : 'Estimated Combinations shows how many variants this configuration can contribute to generating. This influences the available Images per Original maximum.',
  };
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
  const state = getPublishedState();
  if (typeof state?.globalRebalanceOpen === 'boolean') return state.globalRebalanceOpen;
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
  const state = getPublishedState();
  if (typeof state?.renameReleaseOpen === 'boolean') return state.renameReleaseOpen;
  return !!findTextNode(/^Rename Release$/);
}

function isDeleteReleaseOpen() {
  const state = getPublishedState();
  if (typeof state?.deleteReleaseOpen === 'boolean') return state.deleteReleaseOpen;
  return !!findTextNode(/^Delete Release$/);
}

function hasToolModalOpen() {
  const state = getPublishedState();
  if (typeof state?.transformationPickerVisible === 'boolean') return state.transformationPickerVisible;
  return !!findTextNode(/^Add Basic Transformation$/) || !!findTextNode(/^Add Advanced Transformation$/);
}

function hasToolConfigOpen() {
  const state = getPublishedState();
  if (typeof state?.transformationConfigVisible === 'boolean') return state.transformationConfigVisible;
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

  const transformationPickerType = state?.transformationPickerType || null;
  const transformationConfigTool = state?.transformationConfigTool || null;

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
    return makeState('release-delete-modal', text, [getDeleteHelpLabel(lang), getBackLabel(lang)], 'release-delete-modal');
  }

  if (isRenameReleaseOpen()) {
    const text = lang === 'it'
      ? 'Qui puoi rinominare una release gia salvata. Scegli un nome chiaro che ti aiuti a riconoscere questa versione in seguito.'
      : 'Here you can rename a saved release. Choose a clear name so this version stays easy to recognize later.';
    return makeState('release-rename-modal', text, [getRenameHelpLabel(lang), getBackLabel(lang)], 'release-rename-modal');
  }

  if (isDatasetRebalanceOpen(state)) {
    const text = lang === 'it'
      ? 'Questo rebalance cambia Train, Validation e Test solo dentro questo dataset completato. Non ribilancia tutti i dataset della release insieme.'
      : 'This rebalance changes Train, Validation, and Test only inside this completed dataset. It does not rebalance all release datasets together.';
    return makeState('release-dataset-rebalance', text, [getRebalanceCountsHelpLabel(lang), getBackLabel(lang)], 'release-dataset-rebalance');
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
    return makeState('release-global-rebalance', text, [getRebalanceHelpLabel(lang), getRebalanceCountsHelpLabel(lang), getBackLabel(lang)], 'release-global-rebalance');
  }

  if (hasToolConfigOpen()) {
    const toolName = transformationConfigTool
      ? transformationConfigTool.replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase())
      : (lang === 'it' ? 'questa trasformazione' : 'this transformation');
    const text = lang === 'it'
      ? `Qui configuri ${toolName} guardando anteprima, parametri e numero stimato di combinazioni prima di applicarla.`
      : `Here you configure ${toolName} by checking the preview, the parameters, and the estimated combinations before applying it.`;
    return makeState('release-tool-config', text, [getToolUseHelpLabel(lang), getToolParamHelpLabel(lang), getCombinationsHelpLabel(lang), getApplyTransformationLabel(lang), getBackLabel(lang)], 'release-tool-config');
  }

  if (hasToolModalOpen()) {
    const pickerLabel = transformationPickerType === 'advanced'
      ? (lang === 'it' ? 'trasformazione avanzata' : 'advanced transformation')
      : (lang === 'it' ? 'trasformazione base' : 'basic transformation');
    const text = lang === 'it'
      ? `Qui scegli quale ${pickerLabel} aggiungere alla pipeline della release. Gli strumenti base fanno modifiche comuni, quelli avanzati introducono variazioni piu forti.`
      : `Here you choose which ${pickerLabel} to add to the release pipeline. Basic tools make common changes, while advanced tools introduce stronger variation.`;
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
  const toolUseHelpLabel = getToolUseHelpLabel(lang);
  const toolParamHelpLabel = getToolParamHelpLabel(lang);
  const combinationsHelpLabel = getCombinationsHelpLabel(lang);
  const applyTransformationLabel = getApplyTransformationLabel(lang);
  const renameHelpLabel = getRenameHelpLabel(lang);
  const deleteHelpLabel = getDeleteHelpLabel(lang);
  const rebalanceCountsHelpLabel = getRebalanceCountsHelpLabel(lang);
  const imagesPerOriginalHelpLabel = getImagesPerOriginalHelpLabel(lang);
  const howManyImagesLabel = getHowManyImagesLabel(lang);
  const configHelpLabel = getConfigHelpLabel(lang);
  const previewHelpLabel = getPreviewHelpLabel(lang);
  const previewActionLabel = getPreviewActionLabel(lang);
  const createReleaseLabel = getCreateReleaseLabel(lang);
  const downloadZipLabel = getDownloadZipLabel(lang);
  const downloadHelpLabel = getDownloadHelpLabel(lang);
  const continueConfigLabel = getContinueConfigLabel(lang);
  const addAdvancedLabel = getAddAdvancedLabel(lang);
  const detailsHelpLabel = getDetailsHelpLabel(lang);
  const createNewReleaseLabel = getCreateNewReleaseLabel(lang);
  const backToHistoryLabel = getBackToHistoryLabel(lang);
  const goManagementLabel = getGoManagementLabel(lang);
  const toolGuidance = getToolSpecificGuidance(getPublishedState()?.transformationConfigTool, lang);

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

  if (step === 'release-page-help') {
    if (value === datasetsHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'I dataset disponibili qui sono solo quelli completati e gia pronti per la fase Dataset. In Release puoi usarli per creare una versione esportabile con trasformazioni e configurazione finale.'
          : 'The datasets shown here are only the completed ones already ready in the Dataset stage. In Release you use them to create an exportable version with transformations and final configuration.',
        { inputType: 'buttons', options: [backLabel], step: 'release-datasets-help' }
      );
      return;
    }
    if (value === rebalanceHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Il rebalance principale rimescola Train, Validation e Test sull intero pool dei dataset completati idonei alla release. Il rebalance di dataset invece lavora solo dentro un singolo dataset completato.'
          : 'The main rebalance reshuffles Train, Validation, and Test across the full pool of completed datasets eligible for the release. Dataset rebalance works only inside one completed dataset.',
        { inputType: 'buttons', options: [backLabel], step: 'release-rebalance-help' }
      );
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
        { inputType: 'buttons', options: [lang === 'it' ? 'Cosa mostrano queste statistiche?' : 'What do these statistics show?', lang === 'it' ? 'Cosa mostrano queste immagini?' : 'What do these images show?', backLabel], step: 'release-details-help' }
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

  if (step === 'release-details-help') {
    const statsHelp = lang === 'it' ? 'Cosa mostrano queste statistiche?' : 'What do these statistics show?';
    const imagesHelp = lang === 'it' ? 'Cosa mostrano queste immagini?' : 'What do these images show?';
    if (value === statsHelp) {
      addMessage('bot',
        lang === 'it'
          ? 'In alto vedi totale immagini, split finali, classi e formato della release. Sotto trovi le trasformazioni applicate, cosi puoi controllare esattamente come e stata costruita questa versione.'
          : 'At the top you see total images, final splits, classes, and the release format. Below that you see the applied transformations, so you can verify exactly how this version was built.',
        { inputType: 'buttons', options: [backLabel], step: 'release-details-stats-help' }
      );
      return;
    }
    if (value === imagesHelp) {
      addMessage('bot',
        lang === 'it'
          ? 'Queste sono le immagini finali generate dalla release. Qui puoi controllare anteprima, split assegnato e annotazioni risultanti prima di scaricare o riutilizzare la release.'
          : 'These are the final images generated for the release. Here you can review the preview, assigned split, and resulting annotations before downloading or reusing the release.',
        { inputType: 'buttons', options: [backLabel], step: 'release-details-images-help' }
      );
      return;
    }
  }

  if (step === 'release-rename-modal') {
    if (value === renameHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Usa un nome che ti aiuti a riconoscere velocemente questa versione: per esempio dataset, task, trasformazioni principali o data. Un nome chiaro rende piu facile confrontare release diverse.'
          : 'Use a name that helps you recognize this version quickly, for example the dataset, task, main transformations, or date. A clear name makes it easier to compare different releases later.',
        { inputType: 'buttons', options: [backLabel], step: 'release-rename-help' }
      );
      return;
    }
  }

  if (step === 'release-delete-modal') {
    if (value === deleteHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Eliminando una release rimuovi questa versione salvata dalla cronologia. Fallo solo se sei sicuro di non aver piu bisogno di consultarla o scaricarla di nuovo.'
          : 'Deleting a release removes this saved version from the history. Do it only if you are sure you no longer need to review it or download it again.',
        { inputType: 'buttons', options: [backLabel], step: 'release-delete-help' }
      );
      return;
    }
  }

  if (step === 'release-global-rebalance') {
    if (value === rebalanceHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Questo cambia la distribuzione degli split su tutti i dataset completati che entrano nella release. Train, Validation e Test devono sommare al totale mostrato prima di poter salvare.'
          : 'This changes split distribution across all completed datasets that enter the release. Train, Validation, and Test must add up to the shown total before you can save.',
        { inputType: 'buttons', options: [backLabel], step: 'release-global-rebalance-help' }
      );
      return;
    }
    if (value === rebalanceCountsHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Compila Train, Validation e Test in modo che la loro somma corrisponda al totale disponibile. Le percentuali si aggiornano da sole, quindi controlla il totale verde prima di salvare.'
          : 'Fill Train, Validation, and Test so their sum matches the available total. The percentages update automatically, so check the green total before saving.',
        { inputType: 'buttons', options: [backLabel], step: 'release-global-rebalance-counts-help' }
      );
      return;
    }
  }

  if (step === 'release-dataset-details') {
    if (value === datasetsHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Qui controlli overview del dataset, distribuzione Train/Val/Test e immagini di esempio. E utile per capire se questo singolo dataset e pronto per entrare nella release.'
          : 'Here you review the dataset overview, Train/Val/Test distribution, and sample images. It is useful for checking whether this one dataset is ready to enter the release.',
        { inputType: 'buttons', options: [backLabel], step: 'release-dataset-details-help' }
      );
      return;
    }
    if (value === rebalanceHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Il rebalance di dataset rimescola gli split solo dentro questo dataset completato. Non cambia la distribuzione sugli altri dataset della release.'
          : 'Dataset rebalance reshuffles splits only inside this completed dataset. It does not change distribution for the other release datasets.',
        { inputType: 'buttons', options: [backLabel], step: 'release-dataset-rebalance-help' }
      );
      return;
    }
  }

  if (step === 'release-dataset-rebalance') {
    if (value === rebalanceCountsHelpLabel) {
      addMessage('bot',
        lang === 'it'
          ? 'Qui compili Train, Validation e Test solo per questo dataset. Anche in questo caso la somma deve corrispondere al totale del dataset prima di poter salvare.'
          : 'Here you fill Train, Validation, and Test only for this dataset. Here too, the sum must match the dataset total before you can save.',
        { inputType: 'buttons', options: [backLabel], step: 'release-dataset-rebalance-counts-help' }
      );
      return;
    }
  }

  if (step === 'release-tool-picker') {
    if (value === transformationsHelpLabel) {
      const pickerType = getPublishedState()?.transformationPickerType;
      addMessage('bot',
        pickerType === 'advanced'
          ? (
            lang === 'it'
              ? 'Qui stai scegliendo uno strumento avanzato. Questi strumenti introducono variazioni piu forti come affine transform, color jitter e random zoom, quindi conviene controllare bene preview e combinazioni.'
              : 'Here you are choosing an advanced tool. These tools introduce stronger variation such as affine transform, color jitter, and random zoom, so it is worth checking the preview and combinations carefully.'
          )
          : (
            lang === 'it'
              ? 'Qui stai scegliendo uno strumento base. Gli strumenti base fanno modifiche comuni come resize, rotate, flip, crop, blur e brightness, e di solito sono il punto migliore da cui iniziare.'
              : 'Here you are choosing a basic tool. Basic tools make common changes like resize, rotate, flip, crop, blur, and brightness, and they are usually the best place to start.'
          ),
        { inputType: 'buttons', options: [backLabel], step: 'release-tool-picker-help' }
      );
      return;
    }
  }

  if (step === 'release-tool-config') {
    if (value === toolUseHelpLabel) {
      addMessage('bot',
        toolGuidance.use,
        { inputType: 'buttons', options: [backLabel], step: 'release-tool-use-help' }
      );
      return;
    }
    if (value === toolParamHelpLabel) {
      addMessage('bot',
        toolGuidance.params,
        { inputType: 'buttons', options: [backLabel], step: 'release-tool-params-help' }
      );
      return;
    }
    if (value === combinationsHelpLabel) {
      addMessage('bot',
        toolGuidance.combinations,
        { inputType: 'buttons', options: [backLabel], step: 'release-tool-combinations-help' }
      );
      return;
    }
    if (value === applyTransformationLabel) {
      requestReopen();
      clickButtonByText('Apply Transformation');
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
      'release-rename-help',
      'release-delete-help',
      'release-delete-modal',
      'release-rename-modal',
      'release-global-rebalance',
      'release-dataset-details',
      'release-dataset-rebalance',
      'release-tool-picker',
      'release-tool-config',
      'release-global-rebalance-help',
      'release-global-rebalance-counts-help',
      'release-dataset-details-help',
      'release-dataset-rebalance-counts-help',
      'release-details-stats-help',
      'release-details-images-help',
      'release-tool-picker-help',
      'release-tool-use-help',
      'release-tool-params-help',
      'release-tool-combinations-help',
      'release-empty-help',
    ].includes(step)
  ) {
    applyFreshReleaseSnapshot(lang, refs, setters);
  }
}
