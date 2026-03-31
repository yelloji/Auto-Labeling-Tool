/**
 * projectBot.js — Create Project wizard for the guide bot.
 *
 * Exports:
 *   getCreateProjectWizardSteps(lang)
 *   startCreateProjectWizard(lang, setters)
 *   handleCreateProjectAnswer(step, value, lang, setters)
 *
 * All functions receive lang and setters as parameters — no closed-over React state.
 */

import { setReactInputValue } from './botUtils';

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
