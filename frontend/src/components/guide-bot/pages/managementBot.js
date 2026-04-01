/**
 * managementBot.js — Management page logic for the guide bot.
 *
 * Snapshot-on-open (5 states) + full bidirectional sync:
 *   Bot button → UI action applied
 *   User UI action → Bot detects and responds
 *
 * Exports:
 *   checkManagementPageState(lang, refs, setters)   — snapshot-on-open
 *   handleManagementAnswer(step, value, lang, refs, setters)
 *
 * Column layout (left to right):
 *   col[0] = Unassigned   col[1] = Annotating   col[2] = Dataset
 *
 * Priority order:
 *   0. All 3 columns populated → full overview of all columns + ⋮ menu explanation
 *   1. Annotating has items only → guide to open labeling tool
 *   2. Dataset has completed items (Annotating empty) → guide to Dataset section
 *   3. All columns empty → guide to Upload section
 *   4. Unassigned only → guide to start annotating + observer
 */

import { clickSidebarItem, clickColumnCard } from './botUtils';

// ---------------------------------------------------------------------------
// Observer: watches for Annotating column to become EMPTY.
// Called when bot is in Priority 0 or Priority 1 state.
// When user moves a card OUT of Annotating (via ⋮ menu), bot updates to new state.
// ---------------------------------------------------------------------------
function startManagementAnnotatingEmptyObserver(lang, refs, setters) {
  const { observerRef } = refs;
  const { setWizardType, setConversation, setWizardStep } = setters;

  if (observerRef.current) observerRef.current.disconnect();

  const obs = new MutationObserver(() => {
    // "Upload and assign images to an annotator." appears when Annotating becomes empty
    const annotatingNowEmpty = Array.from(document.querySelectorAll('div, span, p'))
      .some(el => el.textContent.trim() === 'Upload and assign images to an annotator.');
    if (annotatingNowEmpty) {
      obs.disconnect();
      observerRef.current = null;

      // Re-detect: Unassigned only, or all empty?
      const unassignedEmpty = Array.from(document.querySelectorAll('div, span, p'))
        .some(el => el.textContent.trim() === 'No unassigned datasets found.');

      if (unassignedEmpty) {
        const goUploadLabel = lang === 'it' ? 'Vai a Upload' : 'Go to Upload';
        const msg = lang === 'it'
          ? 'Nessun dataset ancora. Inizia caricando delle immagini — usa il pulsante qui sotto oppure vai alla sezione Upload.'
          : 'No datasets yet. Start by uploading images — use the button below or go to the Upload section.';
        setWizardType('management-empty');
        setConversation([{ role: 'bot', text: msg, inputType: 'buttons', options: [goUploadLabel], step: 'mgmt-empty' }]);
        setWizardStep('mgmt-empty');
      } else {
        startManagementAnnotatingObserver(lang, refs, setters);
        const startAnnotLabel = lang === 'it' ? 'Sposta in Annotating' : 'Send to Annotating';
        const msg = lang === 'it'
          ? 'Il dataset è tornato nella colonna Unassigned. Clicca su una scheda per iniziare — oppure usa il pulsante qui sotto.'
          : 'The dataset is back in the Unassigned column. Click any card to begin labeling — or use the button below.';
        setWizardType('management-unassigned');
        setConversation([{ role: 'bot', text: msg, inputType: 'buttons', options: [startAnnotLabel], step: 'mgmt-unassigned' }]);
        setWizardStep('mgmt-unassigned');
      }
    }
  });

  obs.observe(document.body, { childList: true, subtree: true });
  observerRef.current = obs;
}

// ---------------------------------------------------------------------------
// Observer: watches for Annotating column to receive a dataset.
// Called when bot is in Priority 4 state (Unassigned only).
// When a card moves from Unassigned → Annotating, bot reopens with Priority 1 message.
// ---------------------------------------------------------------------------
function startManagementAnnotatingObserver(lang, refs, setters) {
  const { observerRef } = refs;
  const { setIsOpen, setWizardMode, setWizardType, setConversation, setWizardStep } = setters;

  if (observerRef.current) observerRef.current.disconnect();

  let timeoutId = null;

  const obs = new MutationObserver(() => {
    const annotatingStillEmpty = Array.from(document.querySelectorAll('div, span, p'))
      .some(el => el.textContent.trim() === 'Upload and assign images to an annotator.');
    if (!annotatingStillEmpty) {
      obs.disconnect();
      observerRef.current = null;
      const openLabelLabel = lang === 'it' ? 'Apri Strumento Etichettatura' : 'Open Labeling Tool';
      const nextMsg = lang === 'it'
        ? 'Il tuo dataset è ora nella colonna Annotating. Clicca su di esso per aprire lo strumento di etichettatura — oppure usa il pulsante qui sotto.'
        : 'Your dataset is now in the Annotating column. Click it to open the labeling tool — or use the button below.';
      timeoutId = setTimeout(() => {
        setIsOpen(true);
        setWizardMode(true);
        setWizardType('management-annotating');
        setConversation([{ role: 'bot', text: nextMsg, inputType: 'buttons', options: [openLabelLabel], step: 'mgmt-annotating' }]);
        setWizardStep('mgmt-annotating');
      }, 600);
    }
  });

  // Override disconnect so any pending reopen is cancelled when managementOperationDone cleans up
  const _disconnect = obs.disconnect.bind(obs);
  obs.disconnect = () => { if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; } _disconnect(); };

  obs.observe(document.body, { childList: true, subtree: true });
  observerRef.current = obs;
}

// ---------------------------------------------------------------------------
// Snapshot check — reads current Management page DOM state when bot is opened.
// Returns a wizard state object { wizardType, conversation, step } or null.
// ---------------------------------------------------------------------------
export function checkManagementPageState(lang, refs, setters) {
  // Detect Management tab — "Upload More Images" button is unique to this tab
  const uploadMoreBtn = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.trim() === 'Upload More Images');
  if (!uploadMoreBtn) return null;

  const openLabelLabel  = lang === 'it' ? 'Apri Strumento Etichettatura' : 'Open Labeling Tool';
  const goDatasetLabel  = lang === 'it' ? 'Vai a Dataset'  : 'Go to Dataset';
  const goUploadLabel   = lang === 'it' ? 'Vai a Upload'   : 'Go to Upload';
  const startAnnotLabel = lang === 'it' ? 'Sposta in Annotating' : 'Send to Annotating';

  // Detect each column's state once — used across all priority checks
  const annotatingEmpty = Array.from(document.querySelectorAll('div, span, p'))
    .some(el => el.textContent.trim() === 'Upload and assign images to an annotator.');
  const datasetEmpty = Array.from(document.querySelectorAll('div, span, p'))
    .some(el => el.textContent.trim() === 'No completed datasets found.');
  const unassignedEmpty = Array.from(document.querySelectorAll('div, span, p'))
    .some(el => el.textContent.trim() === 'No unassigned datasets found.');

  // ---- Priority 0: All 3 columns have datasets ----
  // Show a full overview — what each column is, what the ⋮ menu does
  if (!annotatingEmpty && !datasetEmpty && !unassignedEmpty) {
    startManagementAnnotatingEmptyObserver(lang, refs, setters);

    const headerMsg = lang === 'it'
      ? 'Tutte e tre le colonne sono attive. Ecco cosa puoi fare da qui:'
      : 'All three columns are active. Here is what you can do:';

    const unassignedMsg = lang === 'it'
      ? 'Unassigned: dataset in attesa. Clicca una scheda per spostarla in Annotating e iniziare l\'etichettatura. Usa il menu ⋮ sulla scheda per Rinominare o Eliminare.'
      : 'Unassigned: datasets waiting to be labeled. Click a card to move it to Annotating. Use the ⋮ menu on the card to Rename or Delete.';

    const annotatingMsg = lang === 'it'
      ? 'Annotating: dataset in etichettatura. Clicca una scheda per aprire lo strumento di etichettatura. Usa ⋮ per Rinominare, spostare in Unassigned, o Eliminare.'
      : 'Annotating: datasets being labeled. Click a card to open the labeling tool. Use ⋮ to Rename, move back to Unassigned, or Delete.';

    const datasetMsg = lang === 'it'
      ? 'Dataset: dataset completamente etichettati (100%). Usa ⋮ per Rinominare, spostarli in Unassigned o Annotating, o Eliminarli.'
      : 'Dataset: fully labeled datasets (100% complete). Use ⋮ to Rename, move back to Unassigned or Annotating, or Delete.';

    return {
      wizardType: 'management-overview',
      conversation: [
        { role: 'bot', text: headerMsg,      inputType: 'none',    step: 'mgmt-overview-header' },
        { role: 'bot', text: unassignedMsg,  inputType: 'none',    step: 'mgmt-overview-unassigned' },
        { role: 'bot', text: annotatingMsg,  inputType: 'none',    step: 'mgmt-overview-annotating' },
        { role: 'bot', text: datasetMsg,     inputType: 'buttons', options: [openLabelLabel, goDatasetLabel, startAnnotLabel], step: 'mgmt-overview-action' },
      ],
      step: 'mgmt-overview-action',
    };
  }

  // ---- Priority 1: Annotating has items (not all 3 populated) ----
  if (!annotatingEmpty) {
    startManagementAnnotatingEmptyObserver(lang, refs, setters);
    const msg = unassignedEmpty
      ? (lang === 'it'
          ? 'Hai dataset nella colonna Annotating. La colonna Unassigned è vuota — puoi cliccare il pulsante "Upload More Images" su questa pagina oppure vai alla sezione Upload per aggiungere altri dati.'
          : 'You have datasets in the Annotating column. Unassigned is empty — click the "Upload More Images" button on this page or go to the Upload section to add more data.')
      : (lang === 'it'
          ? 'Hai dataset nella colonna Annotating. Clicca su una scheda per aprire lo strumento di etichettatura — oppure usa i pulsanti qui sotto.'
          : 'You have datasets in the Annotating column. Click any card to open the labeling tool — or use the buttons below.');
    const options = [openLabelLabel];
    if (!datasetEmpty)    options.push(goDatasetLabel);
    if (!unassignedEmpty) options.push(startAnnotLabel);
    if (unassignedEmpty)  options.push(goUploadLabel);
    return {
      wizardType: 'management-annotating',
      conversation: [{ role: 'bot', text: msg, inputType: 'buttons', options, step: 'mgmt-annotating' }],
      step: 'mgmt-annotating',
    };
  }

  // ---- Priority 2: Dataset has completed items (Annotating is empty) ----
  if (!datasetEmpty) {
    // If Unassigned also has datasets, offer both actions
    if (!unassignedEmpty) {
      startManagementAnnotatingObserver(lang, refs, setters);
      const msg = lang === 'it'
        ? 'Hai dataset completati nella colonna Dataset e dataset in attesa nella colonna Unassigned.'
        : 'You have completed datasets in the Dataset column and datasets waiting in Unassigned.';
      return {
        wizardType: 'management-completed',
        conversation: [{ role: 'bot', text: msg, inputType: 'buttons', options: [goDatasetLabel, startAnnotLabel], step: 'mgmt-completed' }],
        step: 'mgmt-completed',
      };
    }
    const msg = lang === 'it'
      ? 'Hai dataset completati pronti. Vai alla sezione Dataset per vedere tutte le immagini etichettate.'
      : 'You have completed datasets ready. Go to the Dataset section to view all your labeled images.';
    return {
      wizardType: 'management-completed',
      conversation: [{ role: 'bot', text: msg, inputType: 'buttons', options: [goDatasetLabel], step: 'mgmt-completed' }],
      step: 'mgmt-completed',
    };
  }

  // ---- Priority 3: All columns empty ----
  if (unassignedEmpty) {
    const msg = lang === 'it'
      ? 'Nessun dataset ancora. Inizia caricando delle immagini — usa il pulsante qui sotto oppure vai alla sezione Upload.'
      : 'No datasets yet. Start by uploading images — use the button below or go to the Upload section.';
    return {
      wizardType: 'management-empty',
      conversation: [{ role: 'bot', text: msg, inputType: 'buttons', options: [goUploadLabel], step: 'mgmt-empty' }],
      step: 'mgmt-empty',
    };
  }

  // ---- Priority 4: Unassigned only ----
  // Start forward observer — if user clicks a card in UI, bot detects it and updates
  startManagementAnnotatingObserver(lang, refs, setters);
  const msg = lang === 'it'
    ? 'Hai dataset nella colonna Unassigned. Clicca su una scheda per spostarla in Annotating e iniziare il processo di etichettatura — oppure usa il pulsante qui sotto.'
    : 'You have datasets in the Unassigned column. Click any card to move it to Annotating and begin labeling — or use the button below.';
  return {
    wizardType: 'management-unassigned',
    conversation: [{ role: 'bot', text: msg, inputType: 'buttons', options: [startAnnotLabel], step: 'mgmt-unassigned' }],
    step: 'mgmt-unassigned',
  };
}

// ---------------------------------------------------------------------------
// Handle wizard button clicks for all management states
// ---------------------------------------------------------------------------
export function handleManagementAnswer(step, value, lang, refs, setters) {
  const { observerRef } = refs;
  const { setIsOpen, setWizardMode, setWizardType, setConversation } = setters;

  function closeBot() {
    setWizardMode(false);
    setWizardType(null);
    setConversation([]);
    setIsOpen(false);
  }

  // Overview state (all 3 populated) — three action buttons
  if (step === 'mgmt-overview-action') {
    const isLabel  = value.includes('Labeling Tool') || value.includes('Etichettatura');
    const isAnnot  = value.includes('Send to Annotating') || value.includes('Sposta in Annotating');
    if (isLabel) {
      setTimeout(() => clickColumnCard(1), 200); // click first card in Annotating column
    } else if (isAnnot) {
      setTimeout(() => clickColumnCard(0), 200); // click first card in Unassigned column
    } else {
      setTimeout(() => clickSidebarItem('Dataset'), 200);
    }
    closeBot();
    return;
  }

  // Annotating state — multiple possible buttons
  if (step === 'mgmt-annotating') {
    const isSend    = value.includes('Send to Annotating') || value.includes('Sposta in Annotating');
    const isDataset = value.includes('Dataset');
    const isUpload  = value.includes('Upload');
    if (isSend) {
      setTimeout(() => clickColumnCard(0), 200);
    } else if (isDataset) {
      setTimeout(() => clickSidebarItem('Dataset'), 200);
    } else if (isUpload) {
      setTimeout(() => clickSidebarItem('Upload Data'), 200);
    } else {
      setTimeout(() => clickColumnCard(1), 200); // Open Labeling Tool
    }
    closeBot();
    return;
  }

  // Completed state — Go to Dataset or Send to Annotating (when Unassigned also has items)
  if (step === 'mgmt-completed') {
    const isAnnotate = value.includes('Annotating') || value.includes('Annotazione');
    if (isAnnotate) {
      if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
      setTimeout(() => clickColumnCard(0), 200);
      closeBot();
      return;
    }
    setTimeout(() => clickSidebarItem('Dataset'), 200);
    closeBot();
    return;
  }

  // Empty state — navigate to Upload section via sidebar
  if (step === 'mgmt-empty') {
    setTimeout(() => clickSidebarItem('Upload Data'), 200);
    closeBot();
    return;
  }

  // Unassigned state — click first card in Unassigned column (col index 0)
  // Disconnect observer first (we are acting ourselves)
  if (step === 'mgmt-unassigned') {
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
    setTimeout(() => clickColumnCard(0), 200);
    closeBot();
    return;
  }
}
