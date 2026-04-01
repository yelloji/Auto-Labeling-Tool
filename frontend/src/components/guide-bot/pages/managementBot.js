/**
 * managementBot.js - Management page logic for the guide bot.
 *
 * Snapshot-on-open (5 states) + full bidirectional sync:
 *   Bot button -> UI action applied
 *   User UI action -> Bot detects and responds
 *
 * Exports:
 *   checkManagementPageState(lang, refs, setters) - snapshot-on-open
 *   handleManagementAnswer(step, value, lang, refs, setters)
 *
 * Column layout (left to right):
 *   col[0] = Unassigned   col[1] = Annotating   col[2] = Dataset
 *
 * Priority order:
 *   0. All 3 columns populated -> full overview of all columns + menu explanation
 *   1. Annotating has items only -> guide to open labeling tool
 *   2. Dataset has completed items (Annotating empty) -> guide to Dataset section
 *   3. All columns empty -> guide to Upload section
 *   4. Unassigned only -> guide to start annotating + observer
 */

import { clickSidebarItem, clickColumnCard } from './botUtils';

function getHowLabel(lang) {
  return lang === 'it' ? 'Come funziona?' : 'How does this work?';
}

function getColumnsLabel(lang) {
  return lang === 'it' ? 'Cosa sono le 3 colonne?' : 'What are the 3 columns?';
}

function getMenuLabel(lang) {
  return lang === 'it' ? 'Che cos e il menu ⋮?' : 'What is the ⋮ menu?';
}

function getBackLabel(lang) {
  return lang === 'it' ? 'Indietro' : 'Back';
}

function applyFreshManagementSnapshot(lang, refs, setters) {
  const { setIsOpen, setWizardMode, setWizardType, setConversation, setWizardStep } = setters;
  const state = checkManagementPageState(lang, refs, setters);
  if (!state) return;

  setIsOpen(true);
  setWizardMode(true);
  setWizardType(state.wizardType);
  setConversation(state.conversation);
  setWizardStep(state.step);
}

// ---------------------------------------------------------------------------
// Observer: watches for Annotating column to become EMPTY.
// Called when bot is in Priority 0 or Priority 1 state.
// When user moves a card OUT of Annotating (via menu), bot updates to new state.
// ---------------------------------------------------------------------------
function startManagementAnnotatingEmptyObserver(lang, refs, setters) {
  const { observerRef } = refs;
  const { setWizardType, setConversation, setWizardStep } = setters;

  if (observerRef.current) observerRef.current.disconnect();

  const obs = new MutationObserver(() => {
    const annotatingNowEmpty = Array.from(document.querySelectorAll('div, span, p'))
      .some(el => el.textContent.trim() === 'Upload and assign images to an annotator.');

    if (!annotatingNowEmpty) return;

    obs.disconnect();
    observerRef.current = null;

    const unassignedEmpty = Array.from(document.querySelectorAll('div, span, p'))
      .some(el => el.textContent.trim() === 'No unassigned datasets found.');

    if (unassignedEmpty) {
      const goUploadLabel = lang === 'it' ? 'Vai a Upload' : 'Go to Upload';
      const msg = lang === 'it'
        ? 'Nessun dataset ancora. Inizia caricando delle immagini - usa il pulsante qui sotto oppure vai alla sezione Upload.'
        : 'No datasets yet. Start by uploading images - use the button below or go to the Upload section.';
      setWizardType('management-empty');
      setConversation([{
        role: 'bot',
        text: msg,
        inputType: 'buttons',
        options: [goUploadLabel, getHowLabel(lang)],
        step: 'mgmt-empty',
      }]);
      setWizardStep('mgmt-empty');
      return;
    }

    startManagementAnnotatingObserver(lang, refs, setters);
    const startAnnotLabel = lang === 'it' ? 'Sposta in Annotating' : 'Send to Annotating';
    const msg = lang === 'it'
      ? 'Il dataset e tornato nella colonna Unassigned. Clicca su una scheda per iniziare - oppure usa il pulsante qui sotto.'
      : 'The dataset is back in the Unassigned column. Click any card to begin labeling - or use the button below.';
    setWizardType('management-unassigned');
    setConversation([{
      role: 'bot',
      text: msg,
      inputType: 'buttons',
      options: [startAnnotLabel, getHowLabel(lang)],
      step: 'mgmt-unassigned',
    }]);
    setWizardStep('mgmt-unassigned');
  });

  obs.observe(document.body, { childList: true, subtree: true });
  observerRef.current = obs;
}

// ---------------------------------------------------------------------------
// Observer: watches for Annotating column to receive a dataset.
// Called when bot is in Priority 4 state (Unassigned only).
// When a card moves from Unassigned -> Annotating, bot reopens with Priority 1 message.
// ---------------------------------------------------------------------------
function startManagementAnnotatingObserver(lang, refs, setters) {
  const { observerRef } = refs;
  const { setIsOpen, setWizardMode, setWizardType, setConversation, setWizardStep } = setters;

  if (observerRef.current) observerRef.current.disconnect();

  let timeoutId = null;
  let cancelled = false;

  const obs = new MutationObserver(() => {
    if (cancelled) return;

    const annotatingStillEmpty = Array.from(document.querySelectorAll('div, span, p'))
      .some(el => el.textContent.trim() === 'Upload and assign images to an annotator.');

    if (annotatingStillEmpty) return;

    obs.disconnect();
    observerRef.current = null;

    const openLabelLabel = lang === 'it' ? 'Apri Strumento Etichettatura' : 'Open Labeling Tool';
    const goDatasetLabel = lang === 'it' ? 'Vai a Dataset' : 'Go to Dataset';
    const nextMsg = lang === 'it'
      ? 'Il tuo dataset e ora nella colonna Annotating. Clicca su di esso per aprire lo strumento di etichettatura - oppure usa il pulsante qui sotto.'
      : 'Your dataset is now in the Annotating column. Click it to open the labeling tool - or use the button below.';

    timeoutId = setTimeout(() => {
      if (cancelled) return;

      const datasetEmpty = Array.from(document.querySelectorAll('div, span, p'))
        .some(el => el.textContent.trim() === 'No completed datasets found.');
      const options = [openLabelLabel];
      if (!datasetEmpty) options.push(goDatasetLabel);
      options.push(getHowLabel(lang));

      setIsOpen(true);
      setWizardMode(true);
      setWizardType('management-annotating');
      setConversation([{
        role: 'bot',
        text: nextMsg,
        inputType: 'buttons',
        options,
        step: 'mgmt-annotating',
      }]);
      setWizardStep('mgmt-annotating');
    }, 600);
  });

  const disconnect = obs.disconnect.bind(obs);
  obs.disconnect = () => {
    cancelled = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    disconnect();
  };

  obs.observe(document.body, { childList: true, subtree: true });
  observerRef.current = obs;
}

// ---------------------------------------------------------------------------
// Snapshot check - reads current Management page DOM state when bot is opened.
// Returns a wizard state object { wizardType, conversation, step } or null.
// ---------------------------------------------------------------------------
export function checkManagementPageState(lang, refs, setters) {
  const uploadMoreBtn = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.trim() === 'Upload More Images');
  if (!uploadMoreBtn) return null;

  const openLabelLabel = lang === 'it' ? 'Apri Strumento Etichettatura' : 'Open Labeling Tool';
  const goDatasetLabel = lang === 'it' ? 'Vai a Dataset' : 'Go to Dataset';
  const goUploadLabel = lang === 'it' ? 'Vai a Upload' : 'Go to Upload';
  const startAnnotLabel = lang === 'it' ? 'Sposta in Annotating' : 'Send to Annotating';
  const howLabel = getHowLabel(lang);

  const annotatingEmpty = Array.from(document.querySelectorAll('div, span, p'))
    .some(el => el.textContent.trim() === 'Upload and assign images to an annotator.');
  const datasetEmpty = Array.from(document.querySelectorAll('div, span, p'))
    .some(el => el.textContent.trim() === 'No completed datasets found.');
  const unassignedEmpty = Array.from(document.querySelectorAll('div, span, p'))
    .some(el => el.textContent.trim() === 'No unassigned datasets found.');

  if (!annotatingEmpty && !datasetEmpty && !unassignedEmpty) {
    startManagementAnnotatingEmptyObserver(lang, refs, setters);

    const headerMsg = lang === 'it'
      ? 'Tutte e tre le colonne sono attive. Ecco cosa puoi fare da qui:'
      : 'All three columns are active. Here is what you can do:';
    const unassignedMsg = lang === 'it'
      ? "Unassigned: dataset in attesa. Clicca una scheda per spostarla in Annotating e iniziare l'etichettatura. Usa il menu ⋮ sulla scheda per Rinominare o Eliminare."
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
        { role: 'bot', text: headerMsg, inputType: 'none', step: 'mgmt-overview-header' },
        { role: 'bot', text: unassignedMsg, inputType: 'none', step: 'mgmt-overview-unassigned' },
        { role: 'bot', text: annotatingMsg, inputType: 'none', step: 'mgmt-overview-annotating' },
        {
          role: 'bot',
          text: datasetMsg,
          inputType: 'buttons',
          options: [openLabelLabel, goDatasetLabel, startAnnotLabel, howLabel],
          step: 'mgmt-overview-action',
        },
      ],
      step: 'mgmt-overview-action',
    };
  }

  if (!annotatingEmpty) {
    startManagementAnnotatingEmptyObserver(lang, refs, setters);

    const msg = unassignedEmpty
      ? (lang === 'it'
          ? 'Hai dataset nella colonna Annotating. La colonna Unassigned e vuota - puoi cliccare il pulsante "Upload More Images" su questa pagina oppure vai alla sezione Upload per aggiungere altri dati.'
          : 'You have datasets in the Annotating column. Unassigned is empty - click the "Upload More Images" button on this page or go to the Upload section to add more data.')
      : (lang === 'it'
          ? 'Hai dataset nella colonna Annotating. Clicca su una scheda per aprire lo strumento di etichettatura - oppure usa i pulsanti qui sotto.'
          : 'You have datasets in the Annotating column. Click any card to open the labeling tool - or use the buttons below.');

    const options = [openLabelLabel];
    if (!datasetEmpty) options.push(goDatasetLabel);
    if (!unassignedEmpty) options.push(startAnnotLabel);
    if (unassignedEmpty) options.push(goUploadLabel);
    options.push(howLabel);

    return {
      wizardType: 'management-annotating',
      conversation: [{ role: 'bot', text: msg, inputType: 'buttons', options, step: 'mgmt-annotating' }],
      step: 'mgmt-annotating',
    };
  }

  if (!datasetEmpty) {
    if (!unassignedEmpty) {
      startManagementAnnotatingObserver(lang, refs, setters);
      const msg = lang === 'it'
        ? 'Hai dataset completati nella colonna Dataset e dataset in attesa nella colonna Unassigned.'
        : 'You have completed datasets in the Dataset column and datasets waiting in Unassigned.';
      return {
        wizardType: 'management-completed',
        conversation: [{
          role: 'bot',
          text: msg,
          inputType: 'buttons',
          options: [goDatasetLabel, startAnnotLabel, howLabel],
          step: 'mgmt-completed',
        }],
        step: 'mgmt-completed',
      };
    }

    const msg = lang === 'it'
      ? 'Hai dataset completati pronti. Vai alla sezione Dataset per vedere tutte le immagini etichettate.'
      : 'You have completed datasets ready. Go to the Dataset section to view all your labeled images.';
    return {
      wizardType: 'management-completed',
      conversation: [{
        role: 'bot',
        text: msg,
        inputType: 'buttons',
        options: [goDatasetLabel, howLabel],
        step: 'mgmt-completed',
      }],
      step: 'mgmt-completed',
    };
  }

  if (unassignedEmpty) {
    const msg = lang === 'it'
      ? 'Nessun dataset ancora. Inizia caricando delle immagini - usa il pulsante qui sotto oppure vai alla sezione Upload.'
      : 'No datasets yet. Start by uploading images - use the button below or go to the Upload section.';
    return {
      wizardType: 'management-empty',
      conversation: [{
        role: 'bot',
        text: msg,
        inputType: 'buttons',
        options: [goUploadLabel, howLabel],
        step: 'mgmt-empty',
      }],
      step: 'mgmt-empty',
    };
  }

  startManagementAnnotatingObserver(lang, refs, setters);
  const msg = lang === 'it'
    ? 'Hai dataset nella colonna Unassigned. Clicca su una scheda per spostarla in Annotating e iniziare il processo di etichettatura - oppure usa il pulsante qui sotto.'
    : 'You have datasets in the Unassigned column. Click any card to move it to Annotating and begin labeling - or use the button below.';
  return {
    wizardType: 'management-unassigned',
    conversation: [{
      role: 'bot',
      text: msg,
      inputType: 'buttons',
      options: [startAnnotLabel, howLabel],
      step: 'mgmt-unassigned',
    }],
    step: 'mgmt-unassigned',
  };
}

// ---------------------------------------------------------------------------
// Handle wizard button clicks for all management states
// ---------------------------------------------------------------------------
export function handleManagementAnswer(step, value, lang, refs, setters) {
  const { observerRef } = refs;
  const howLabel = getHowLabel(lang);
  const columnsLabel = getColumnsLabel(lang);
  const menuLabel = getMenuLabel(lang);
  const backLabel = getBackLabel(lang);
  const { requestReopen } = setters;

  if (
    (step === 'mgmt-overview-action' ||
      step === 'mgmt-annotating' ||
      step === 'mgmt-completed' ||
      step === 'mgmt-empty' ||
      step === 'mgmt-unassigned') &&
    value === howLabel
  ) {
    const msg = lang === 'it'
      ? 'Questa pagina ti aiuta a capire dove si trova ogni dataset e cosa puoi fare su ogni scheda.'
      : 'This page helps you understand where each dataset is and what you can do on each card.';
    setters.addMessage('bot', msg, {
      inputType: 'buttons',
      options: [columnsLabel, menuLabel],
      step: 'mgmt-how-choice',
    });
    return;
  }

  if (step === 'mgmt-how-choice') {
    if (value === columnsLabel) {
      const explain = lang === 'it'
        ? 'Le 3 colonne mostrano lo stato del dataset. Unassigned significa non ancora iniziato. Annotating significa in lavorazione. Dataset significa etichettatura completata.'
        : 'The 3 columns show the dataset status. Unassigned means not started yet. Annotating means work in progress. Dataset means labeling is completed.';
      setters.addMessage('bot', explain, {
        inputType: 'buttons',
        options: [backLabel],
        step: 'mgmt-how-back',
      });
      return;
    }

    const explain = lang === 'it'
      ? 'Il menu ⋮ su ogni scheda apre azioni rapide come rinominare, spostare il dataset tra colonne, o eliminarlo.'
      : 'The ⋮ menu on each card opens quick actions like renaming, moving the dataset between columns, or deleting it.';
    setters.addMessage('bot', explain, {
      inputType: 'buttons',
      options: [backLabel],
      step: 'mgmt-how-back',
    });
    return;
  }

  if (step === 'mgmt-how-back') {
    applyFreshManagementSnapshot(lang, refs, setters);
    return;
  }

  if (step === 'mgmt-overview-action') {
    const isLabel = value.includes('Labeling Tool') || value.includes('Etichettatura');
    const isAnnot = value.includes('Send to Annotating') || value.includes('Sposta in Annotating');

    if (isLabel) {
      requestReopen?.();
      setTimeout(() => clickColumnCard(1), 200);
    } else if (isAnnot) {
      requestReopen?.();
      setTimeout(() => clickColumnCard(0), 200);
    } else {
      requestReopen?.();
      setTimeout(() => clickSidebarItem('Dataset'), 200);
    }
    return;
  }

  if (step === 'mgmt-annotating') {
    const isSend = value.includes('Send to Annotating') || value.includes('Sposta in Annotating');
    const isDataset = value.includes('Dataset');
    const isUpload = value.includes('Upload');

    if (isSend) {
      requestReopen?.();
      setTimeout(() => clickColumnCard(0), 200);
    } else if (isDataset) {
      requestReopen?.();
      setTimeout(() => clickSidebarItem('Dataset'), 200);
    } else if (isUpload) {
      requestReopen?.();
      setTimeout(() => clickSidebarItem('Upload Data'), 200);
    } else {
      requestReopen?.();
      setTimeout(() => clickColumnCard(1), 200);
    }
    return;
  }

  if (step === 'mgmt-completed') {
    const isAnnotate = value.includes('Annotating') || value.includes('Annotazione');
    if (isAnnotate) {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      requestReopen?.();
      setTimeout(() => clickColumnCard(0), 200);
    } else {
      requestReopen?.();
      setTimeout(() => clickSidebarItem('Dataset'), 200);
    }
    return;
  }

  if (step === 'mgmt-empty') {
    requestReopen?.();
    setTimeout(() => clickSidebarItem('Upload Data'), 200);
    return;
  }

  if (step === 'mgmt-unassigned') {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    requestReopen?.();
    setTimeout(() => clickColumnCard(0), 200);
  }
}
