/**
 * modelBot.js — Upload Model wizard for the guide bot.
 *
 * Exports:
 *   getUploadWizardSteps(lang)
 *   startUploadModelWizard(lang, setters)
 *   handleModelAnswer(step, value, lang, setters, wizardData, setWizardData, isOnnx, setIsOnnx)
 */

import { setReactInputValue, clickModalButton } from './botUtils';

// ---------------------------------------------------------------------------
// Wizard step definitions
// ---------------------------------------------------------------------------
export function getUploadWizardSteps(lang) {
  const s = {
    en: [
      { step: 'name',        role: 'bot', text: 'What would you like to name your model?',                    inputType: 'text',    placeholder: 'e.g. My Detection Model' },
      { step: 'description', role: 'bot', text: 'Add a description for your model (optional).',              inputType: 'text-skip', placeholder: 'e.g. Trained on factory images' },
      { step: 'type',        role: 'bot', text: 'What type is it?',                                          inputType: 'buttons', options: ['Object Detection', 'Segmentation'] },
      { step: 'file',    role: 'bot', text: 'Now upload your model file. Click below to select (.pt or .onnx).', inputType: 'file' },
      { step: 'width',   role: 'bot', text: 'What is the model input width? This is the image size the model was trained on in its last training. (e.g. 640)', inputType: 'text', placeholder: 'e.g. 640' },
      { step: 'height',  role: 'bot', text: 'What is the model input height? This is the image size the model was trained on in its last training. (e.g. 640)', inputType: 'text', placeholder: 'e.g. 640' },
      { step: 'pt-done', role: 'bot', text: 'All details are set. Ready to upload?',                          inputType: 'buttons', options: ['Upload Now'] },
      { step: 'yaml',    role: 'bot', text: 'Do you have a YAML classes file? You can upload it to auto-fill classes, or skip to enter manually.', inputType: 'buttons', options: ['Upload YAML', 'Skip'] },
      { step: 'classes', role: 'bot', text: 'Enter your classes separated by commas (e.g. car, person, dog)',  inputType: 'text',    placeholder: 'e.g. car, person, dog' },
      { step: 'nc',      role: 'bot', text: '',                                                                 inputType: 'buttons', options: ['Upload Now'] },
    ],
    it: [
      { step: 'name',        role: 'bot', text: 'Come vuoi chiamare il tuo modello?',                        inputType: 'text',    placeholder: 'es. Il Mio Modello' },
      { step: 'description', role: 'bot', text: 'Aggiungi una descrizione per il tuo modello (opzionale).', inputType: 'text-skip', placeholder: 'es. Addestrato su immagini di fabbrica' },
      { step: 'type',        role: 'bot', text: 'Che tipo è?',                                               inputType: 'buttons', options: ['Rilevamento Oggetti', 'Segmentazione'] },
      { step: 'file',    role: 'bot', text: 'Ora carica il file del tuo modello. Clicca sotto per selezionarlo (.pt o .onnx).', inputType: 'file' },
      { step: 'width',   role: 'bot', text: "Qual è la larghezza di input del modello? È la dimensione delle immagini con cui il modello è stato addestrato nell'ultimo training. (es. 640)", inputType: 'text', placeholder: 'es. 640' },
      { step: 'height',  role: 'bot', text: "Qual è l'altezza di input del modello? È la dimensione delle immagini con cui il modello è stato addestrato nell'ultimo training. (es. 640)", inputType: 'text', placeholder: 'es. 640' },
      { step: 'pt-done', role: 'bot', text: 'Tutto impostato. Pronto per caricare?',                           inputType: 'buttons', options: ['Carica Adesso'] },
      { step: 'yaml',    role: 'bot', text: 'Hai un file YAML con le classi? Puoi caricarlo per compilare automaticamente, oppure saltare e inserire manualmente.', inputType: 'buttons', options: ['Carica YAML', 'Salta'] },
      { step: 'classes', role: 'bot', text: 'Inserisci le classi separate da virgole (es. auto, persona, cane)', inputType: 'text',  placeholder: 'es. auto, persona, cane' },
      { step: 'nc',      role: 'bot', text: '',                                                                 inputType: 'buttons', options: ['Carica Adesso'] },
    ],
  };
  return s[lang] || s['en'];
}

// ---------------------------------------------------------------------------
// Start wizard — opens Upload Model modal then begins conversation
// ---------------------------------------------------------------------------
export function startUploadModelWizard(lang, setters) {
  const { setWizardMode, setWizardType, setWizardData, setIsOnnx, setTextInput, setWizardStep, setConversation } = setters;

  const btn = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.trim().includes('Upload Model'));
  if (btn) setTimeout(() => btn.click(), 100);

  setWizardMode(true);
  setWizardType('upload-model');
  setWizardData({});
  setIsOnnx(false);
  setTextInput('');

  const steps = getUploadWizardSteps(lang);
  const firstStep = steps.find(s => s.step === 'name');
  setWizardStep('name');
  setConversation([{ role: 'bot', text: firstStep.text, inputType: firstStep.inputType, placeholder: firstStep.placeholder, step: 'name' }]);
}

// ---------------------------------------------------------------------------
// Handle wizard answers step by step
// wizardData / setWizardData / isOnnx / setIsOnnx are passed separately
// because they are specific to this wizard's data tracking
// ---------------------------------------------------------------------------
export function handleModelAnswer(step, value, lang, setters, wizardData, setWizardData, isOnnx, setIsOnnx) {
  const { setWizardMode, setScriptKey, setWizardStep, addMessage } = setters;
  const steps = getUploadWizardSteps(lang);

  if (step === 'name') {
    setTimeout(() => {
      const inputs = document.querySelectorAll('.ant-modal input');
      if (inputs[0]) setReactInputValue(inputs[0], value);
    }, 200);
    const next = steps.find(s => s.step === 'description');
    setTimeout(() => {
      setWizardStep('description');
      addMessage('bot', next.text, { inputType: 'text-skip', placeholder: next.placeholder, step: 'description' });
    }, 400);
  }

  else if (step === 'description') {
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
    const next = steps.find(s => s.step === 'type');
    setTimeout(() => {
      setWizardStep('type');
      addMessage('bot', next.text, { inputType: 'buttons', options: next.options, step: 'type' });
    }, 400);
  }

  else if (step === 'type') {
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
    const next = steps.find(s => s.step === 'file');
    setTimeout(() => {
      setWizardStep('file');
      addMessage('bot', next.text, { inputType: 'file', step: 'file' });
    }, 800);
  }

  else if (step === 'file-selected') {
    const onnx = value.toLowerCase().endsWith('.onnx');
    setIsOnnx(onnx);
    setWizardData(prev => ({ ...prev, fileName: value }));
    const next = steps.find(s => s.step === 'width');
    setTimeout(() => {
      setWizardStep('width');
      addMessage('bot', next.text, { inputType: 'text', placeholder: next.placeholder, step: 'width' });
    }, 400);
  }

  else if (step === 'pt-done') {
    setTimeout(() => clickModalButton('Upload Model'), 200);
    setWizardMode(false);
    setScriptKey('/models');
  }

  else if (step === 'width') {
    setWizardData(prev => ({ ...prev, width: value }));
    setTimeout(() => {
      const inputs = Array.from(document.querySelectorAll('.ant-modal input')).filter(i =>
        i.placeholder && (i.placeholder.includes('640') || i.placeholder.includes('e.g'))
      );
      if (inputs[0]) setReactInputValue(inputs[0], value);
    }, 300);
    const next = steps.find(s => s.step === 'height');
    setTimeout(() => {
      setWizardStep('height');
      addMessage('bot', next.text, { inputType: 'text', placeholder: next.placeholder, step: 'height' });
    }, 500);
  }

  else if (step === 'height') {
    setWizardData(prev => ({ ...prev, height: value }));
    setTimeout(() => {
      const inputs = Array.from(document.querySelectorAll('.ant-modal input')).filter(i =>
        i.placeholder && (i.placeholder.includes('640') || i.placeholder.includes('e.g'))
      );
      if (inputs[1]) setReactInputValue(inputs[1], value);
    }, 300);
    if (!isOnnx) {
      const next = steps.find(s => s.step === 'pt-done');
      setTimeout(() => {
        setWizardStep('pt-done');
        addMessage('bot', next.text, { inputType: 'buttons', options: next.options, step: 'pt-done' });
      }, 400);
    } else {
      const next = steps.find(s => s.step === 'yaml');
      setTimeout(() => {
        setWizardStep('yaml');
        addMessage('bot', next.text, { inputType: 'buttons', options: next.options, step: 'yaml' });
      }, 400);
    }
  }

  else if (step === 'yaml') {
    if (value.toLowerCase() === 'skip' || value === 'Salta') {
      const classesStep = getUploadWizardSteps(lang).find(s => s.step === 'classes');
      setTimeout(() => {
        setWizardStep('classes');
        addMessage('bot', classesStep.text, { inputType: 'text', placeholder: classesStep.placeholder, step: 'classes' });
      }, 400);
    } else {
      setTimeout(() => {
        const yamlBtn = Array.from(document.querySelectorAll('.ant-modal button'))
          .find(b => b.textContent.includes('YAML'));
        if (yamlBtn) yamlBtn.click();
      }, 200);
    }
  }

  else if (step === 'classes') {
    setWizardData(prev => ({ ...prev, classes: value }));
    const nc = value.split(',').map(c => c.trim()).filter(Boolean).length;
    setWizardData(prev => ({ ...prev, nc }));
    setTimeout(() => {
      const classesInput = Array.from(document.querySelectorAll('.ant-modal input')).find(i =>
        i.placeholder && (i.placeholder.toLowerCase().includes('person') || i.placeholder.toLowerCase().includes('persona'))
      );
      if (classesInput) setReactInputValue(classesInput, value);
      setTimeout(() => {
        const ncInput = Array.from(document.querySelectorAll('.ant-modal input')).find(i =>
          i.placeholder && i.placeholder.includes('3')
        );
        if (ncInput) setReactInputValue(ncInput, String(nc));
      }, 200);
    }, 300);
    const confirmText = lang === 'it'
      ? `Ho contato ${nc} classi: ${value}. Pronti per caricare?`
      : `I counted ${nc} classes: ${value}. Ready to upload?`;
    const uploadLabel = lang === 'it' ? 'Carica Adesso' : 'Upload Now';
    setTimeout(() => {
      setWizardStep('nc');
      addMessage('bot', confirmText, { inputType: 'buttons', options: [uploadLabel], step: 'nc' });
    }, 600);
  }

  else if (step === 'nc') {
    setTimeout(() => clickModalButton('Upload Model'), 200);
    setWizardMode(false);
    setScriptKey('/models');
  }
}
