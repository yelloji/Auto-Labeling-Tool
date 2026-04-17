/**
 * projectBot.js — Projects page guide bot logic.
 *
 * Exports:
 *   checkProjectsPageState(lang, refs, setters)   — snapshot check for import modal / transfer states
 *   handleProjectAnswer(step, value, lang, setters) — handles project-* wizard answers
 *   getCreateProjectWizardSteps(lang)
 *   startCreateProjectWizard(lang, setters)
 *   handleCreateProjectAnswer(step, value, lang, setters)
 *
 * All functions receive lang and setters as parameters — no closed-over React state.
 */

import { setReactInputValue } from './botUtils';

// ---------------------------------------------------------------------------
// Projects page state check — import modal / transfer overlay
// ---------------------------------------------------------------------------
export function checkProjectsPageState(lang) {
  const state = window.__projectsGuideState || {};

  if (state.transferring) {
    const text = lang === 'it'
      ? 'Trasferimento progetto in corso. Non chiudere l\'app — attendi che l\'operazione si completi. Potrebbe richiedere qualche minuto per progetti grandi.'
      : 'Project transfer is in progress. Please do not close the app — wait until the operation completes. This may take a few minutes for large projects.';
    return {
      wizardType: 'project-transferring',
      step: 'project-transferring',
      conversation: [{ role: 'bot', text, inputType: 'buttons', options: ['OK, I will wait'], step: 'project-transferring' }],
    };
  }

  if (state.importModalVisible && state.nameConflict) {
    const projectName = state.importSummary?.project_name || 'this project';
    const text = lang === 'it'
      ? `Esiste già un progetto con il nome "${projectName}". Inserisci un nome diverso nel campo in basso, poi clicca Importa Progetto per continuare.`
      : `A project named "${projectName}" already exists on this PC. Enter a different name in the field below the summary, then click Import Project to continue.`;
    return {
      wizardType: 'project-import-conflict',
      step: 'project-import-conflict',
      conversation: [{ role: 'bot', text, inputType: 'buttons', options: ['Got it'], step: 'project-import-conflict' }],
    };
  }

  if (state.importModalVisible) {
    const summary = state.importSummary || {};
    const projectName = summary.project_name || 'this project';
    const images = summary.database_counts?.images || 0;
    const annotations = summary.database_counts?.annotations || 0;
    const files = summary.project_file_count || 0;
    const text = lang === 'it'
      ? `Questo pacchetto contiene il progetto "${projectName}" — ${images} immagini, ${annotations} annotazioni, ${files} file. Controlla il nome del progetto, poi clicca Importa Progetto.`
      : `This package contains project "${projectName}" — ${images} images, ${annotations} annotations, ${files} files. Confirm the project name below, then click Import Project to restore it.`;
    return {
      wizardType: 'project-import-modal',
      step: 'project-import-modal',
      conversation: [{ role: 'bot', text, inputType: 'buttons', options: ['Got it'], step: 'project-import-modal' }],
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Handle project-* wizard answers (all just close the wizard after acknowledge)
// ---------------------------------------------------------------------------
export function handleProjectAnswer(step, value, lang, setters) {
  const { setWizardMode, setWizardType, setWizardStep } = setters;
  setWizardMode(false);
  setWizardType(null);
  setWizardStep(null);
}

// ---------------------------------------------------------------------------
// Wizard step definitions
// ---------------------------------------------------------------------------
export function getCreateProjectWizardSteps(lang) {
  const s = {
    en: [
      { step: 'cp-name',        role: 'bot', text: 'What would you like to name your project?',         inputType: 'text',      placeholder: 'e.g. Cars Detection' },
      { step: 'cp-description', role: 'bot', text: 'Add a description (optional).',                     inputType: 'text-skip', placeholder: 'e.g. Detecting cars on road' },
      { step: 'cp-type',        role: 'bot', text: 'What type of project?',                              inputType: 'buttons',   options: ['Object Detection', 'Segmentation'] },
      { step: 'cp-confirm',     role: 'bot', text: 'All set! Ready to create your project?',             inputType: 'buttons',   options: ['Create Project'] },
    ],
    it: [
      { step: 'cp-name',        role: 'bot', text: 'Come vuoi chiamare il tuo progetto?',               inputType: 'text',      placeholder: 'es. Rilevamento Auto' },
      { step: 'cp-description', role: 'bot', text: 'Aggiungi una descrizione (opzionale).',             inputType: 'text-skip', placeholder: 'es. Rilevamento auto su strada' },
      { step: 'cp-type',        role: 'bot', text: 'Che tipo di progetto?',                             inputType: 'buttons',   options: ['Rilevamento Oggetti', 'Segmentazione'] },
      { step: 'cp-confirm',     role: 'bot', text: 'Tutto pronto! Pronto per creare il progetto?',      inputType: 'buttons',   options: ['Crea Progetto'] },
    ],
  };
  return s[lang] || s['en'];
}

// ---------------------------------------------------------------------------
// Start wizard — opens New Project modal then begins conversation
// ---------------------------------------------------------------------------
export function startCreateProjectWizard(lang, setters) {
  const { setWizardMode, setWizardType, setWizardData, setTextInput, setWizardStep, setConversation } = setters;

  const btn = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.trim().includes('New Project'));
  if (btn) setTimeout(() => btn.click(), 100);

  setWizardMode(true);
  setWizardType('create-project');
  setWizardData({});
  setTextInput('');

  const steps = getCreateProjectWizardSteps(lang);
  const firstStep = steps.find(s => s.step === 'cp-name');
  setWizardStep('cp-name');
  setConversation([{ role: 'bot', text: firstStep.text, inputType: firstStep.inputType, placeholder: firstStep.placeholder, step: 'cp-name' }]);
}

// ---------------------------------------------------------------------------
// Handle wizard answers step by step
// ---------------------------------------------------------------------------
export function handleCreateProjectAnswer(step, value, lang, setters) {
  const { setWizardMode, setWizardType, setWizardStep, addMessage } = setters;
  const steps = getCreateProjectWizardSteps(lang);

  if (step === 'cp-name') {
    setTimeout(() => {
      const input = document.querySelector('.ant-modal input[placeholder="Enter project name"], .ant-modal input');
      if (input) setReactInputValue(input, value);
    }, 300);
    const next = steps.find(s => s.step === 'cp-description');
    setTimeout(() => {
      setWizardStep('cp-description');
      addMessage('bot', next.text, { inputType: 'text-skip', placeholder: next.placeholder, step: 'cp-description' });
    }, 500);
  }

  else if (step === 'cp-description') {
    if (value && value !== 'Skip' && value !== 'Salta') {
      setTimeout(() => {
        const textarea = document.querySelector('.ant-modal textarea');
        if (textarea) {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
          nativeSetter.call(textarea, value);
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 200);
    }
    const next = steps.find(s => s.step === 'cp-type');
    setTimeout(() => {
      setWizardStep('cp-type');
      addMessage('bot', next.text, { inputType: 'buttons', options: next.options, step: 'cp-type' });
    }, 400);
  }

  else if (step === 'cp-type') {
    const isDetection = value.toLowerCase().includes('detection') || value.toLowerCase().includes('rilevamento');
    setTimeout(() => {
      const select = document.querySelector('.ant-modal .ant-select-selector');
      if (select) {
        select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        select.click();
        setTimeout(() => {
          const opts = Array.from(document.querySelectorAll('.ant-select-item-option'));
          const match = opts.find(o => isDetection
            ? o.textContent.toLowerCase().includes('object') || o.textContent.toLowerCase().includes('detection')
            : o.textContent.toLowerCase().includes('segment'));
          if (match) {
            match.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            match.click();
          }
        }, 800);
      }
    }, 300);
    const next = steps.find(s => s.step === 'cp-confirm');
    setTimeout(() => {
      setWizardStep('cp-confirm');
      addMessage('bot', next.text, { inputType: 'buttons', options: next.options, step: 'cp-confirm' });
    }, 1200);
  }

  else if (step === 'cp-confirm') {
    setTimeout(() => {
      const btn = Array.from(document.querySelectorAll('.ant-modal button'))
        .find(b => b.textContent.trim().includes('Create Project') || b.textContent.trim().includes('Crea Progetto'));
      if (btn) btn.click();
    }, 200);
    const doneText = lang === 'it'
      ? 'Progetto creato! Apertura del tuo workspace...'
      : 'Project created! Opening your workspace...';
    setTimeout(() => {
      addMessage('bot', doneText, { inputType: 'none', step: 'cp-done' });
      setWizardStep('cp-done');
    }, 600);
    setTimeout(() => { setWizardMode(false); setWizardType(null); }, 2500);
  }
}
