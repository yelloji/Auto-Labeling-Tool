/**
 * managementBot.js — Management page logic for the guide bot.
 *
 * Snapshot-on-open (4 states) + full bidirectional sync:
 *   Bot button → UI action applied
 *   User UI action → Bot detects and responds
 *
 * Exports:
 *   checkManagementPageState(lang, refs, setters)   — snapshot-on-open
 *   handleManagementAnswer(step, value, lang, refs, setters)
 *
 * Column layout (left to right):
 *   col[0] = Unassigned   col[1] = Annotating   col[2] = Dataset
 */

import { clickSidebarItem, clickColumnCard } from './botUtils';

// ---------------------------------------------------------------------------
// Observer: watches for Annotating column to receive a dataset.
// Called when user is in the Unassigned-only state.
// When a card moves from Unassigned → Annotating, bot reopens with Priority 1 message.
// ---------------------------------------------------------------------------
function startManagementAnnotatingObserver(lang, refs, setters) {
  const { observerRef } = refs;
  const { setIsOpen, setWizardMode, setWizardType, setConversation, setWizardStep } = setters;

  if (observerRef.current) observerRef.current.disconnect();

  const obs = new MutationObserver(() => {
    // "Upload and assign images to an annotator." disappears when Annotating has a card
    const annotatingStillEmpty = Array.from(document.querySelectorAll('div, span, p'))
      .some(el => el.textContent.trim() === 'Upload and assign images to an annotator.');
    if (!annotatingStillEmpty) {
      obs.disconnect();
      observerRef.current = null;
      const openLabelLabel = lang === 'it' ? 'Apri Strumento Etichettatura' : 'Open Labeling Tool';
      const nextMsg = lang === 'it'
        ? 'Il tuo dataset è ora nella colonna Annotating. Clicca su di esso per aprire lo strumento di etichettatura — oppure usa il pulsante qui sotto.'
        : 'Your dataset is now in the Annotating column. Click it to open the labeling tool — or use the button below.';
      setTimeout(() => {
        setIsOpen(true);
        setWizardMode(true);
        setWizardType('management-annotating');
        setConversation([{
          role: 'bot',
          text: nextMsg,
          inputType: 'buttons',
          options: [openLabelLabel],
          step: 'mgmt-annotating',
        }]);
        setWizardStep('mgmt-annotating');
      }, 600);
    }
  });

  obs.observe(document.body, { childList: true, subtree: true });
  observerRef.current = obs;
}

// ---------------------------------------------------------------------------
// Snapshot check — reads current Management page DOM state when bot is opened.
// Returns a wizard state object { wizardType, conversation, step } or null.
//
// Priority order:
//   1. Annotating column has datasets  → guide to open labeling tool
//   2. Dataset column has completed datasets → guide to Dataset section
//   3. All columns empty → guide to Upload section
//   4. Unassigned only → show info + Start Annotating button + start observer
// ---------------------------------------------------------------------------
export function checkManagementPageState(lang, refs, setters) {
  // Detect Management tab — "Upload More Images" button is unique to this tab
  const uploadMoreBtn = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.trim() === 'Upload More Images');
  if (!uploadMoreBtn) return null; // Not on Management tab

  const openLabelLabel  = lang === 'it' ? 'Apri Strumento Etichettatura' : 'Open Labeling Tool';
  const goDatasetLabel  = lang === 'it' ? 'Vai a Dataset'  : 'Go to Dataset';
  const goUploadLabel   = lang === 'it' ? 'Vai a Upload'   : 'Go to Upload';
  const startAnnotLabel = lang === 'it' ? 'Inizia Annotazione' : 'Start Annotating';

  // ---- Priority 1: Annotating column has items ----
  // "Upload and assign images to an annotator." is absent → Annotating has cards
  const annotatingEmpty = Array.from(document.querySelectorAll('div, span, p'))
    .some(el => el.textContent.trim() === 'Upload and assign images to an annotator.');
  if (!annotatingEmpty) {
    const msg = lang === 'it'
      ? 'Hai dataset nella colonna Annotating. Clicca su una scheda per aprire lo strumento di etichettatura — oppure usa il pulsante qui sotto.'
      : 'You have datasets in the Annotating column. Click any card to open the labeling tool — or use the button below.';
    return {
      wizardType: 'management-annotating',
      conversation: [{ role: 'bot', text: msg, inputType: 'buttons', options: [openLabelLabel], step: 'mgmt-annotating' }],
      step: 'mgmt-annotating',
    };
  }

  // ---- Priority 2: Dataset column has completed items ----
  // "No completed datasets found." is absent → Dataset column has cards
  const datasetEmpty = Array.from(document.querySelectorAll('div, span, p'))
    .some(el => el.textContent.trim() === 'No completed datasets found.');
  if (!datasetEmpty) {
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
  // "No unassigned datasets found." is present (+ annotating empty from priority 1 check)
  const unassignedEmpty = Array.from(document.querySelectorAll('div, span, p'))
    .some(el => el.textContent.trim() === 'No unassigned datasets found.');
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
  // Datasets exist in Unassigned but Annotating is empty.
  // Start observer so bot reacts if user clicks a card directly in the UI.
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
// Handle wizard button clicks for management states
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

  // Annotating state — click first card in Annotating column (col index 1)
  if (step === 'mgmt-annotating') {
    setTimeout(() => clickColumnCard(1), 200);
    closeBot();
    return;
  }

  // Completed state — navigate to Dataset section via sidebar
  if (step === 'mgmt-completed') {
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
  // Stop the observer first (we are acting, no need to watch)
  if (step === 'mgmt-unassigned') {
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
    setTimeout(() => clickColumnCard(0), 200);
    closeBot();
    return;
  }
}
