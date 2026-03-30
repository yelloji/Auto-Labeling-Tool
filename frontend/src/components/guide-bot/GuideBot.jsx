/**
 * GuideBot.jsx — Floating AI Guide Bot
 *
 * Two modes:
 * 1. Script mode  — shows pre-written messages + option buttons per page
 * 2. Wizard mode  — scrollable conversation, asks questions one by one,
 *                   fills form fields programmatically (e.g. Upload Model)
 */

import React, { useState, useEffect, useRef } from 'react';
import Lottie from 'lottie-react';
import { useLocation, useNavigate } from 'react-router-dom';
import robotAnimation from '../../assets/robot-hello.json';
import guideScript from './guideScript';
import './GuideBot.css';


// ---------------------------------------------------------------------------
// Route → script key mapping
// ---------------------------------------------------------------------------

function getScriptKey(pathname) {
  if (pathname === '/') return '/';
  if (pathname === '/projects') return '/projects';
  if (pathname === '/models') return '/models';
  if (pathname.startsWith('/projects/') && pathname.includes('/workspace')) {
    return '/projects/:id/workspace';
  }
  if (pathname.startsWith('/annotate-progress/')) return '/annotate-progress';
  if (pathname.startsWith('/annotate-launcher/')) return 'workspace-management';
  if (pathname.startsWith('/annotate/')) return '/annotate';
  return 'fallback';
}

// ---------------------------------------------------------------------------
// Upload Model wizard steps
// ---------------------------------------------------------------------------

function getUploadWizardSteps(lang) {
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

// Set value on a React-controlled input — bypasses React's synthetic event system
function setReactInputValue(input, value) {
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  nativeSetter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

// Click a button inside the modal by text
function clickModalButton(text) {
  const btn = Array.from(document.querySelectorAll('.ant-modal button, .ant-modal-body button'))
    .find(b => b.textContent.trim().includes(text));
  if (btn) btn.click();
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAIN_PAGES = ['/', '/projects', '/models'];

const BUBBLE_TEXT = {
  en: { '/': 'Need help?', '/projects': 'Need help?', '/models': 'Explore Models', default: 'Need help?' },
  it: { '/': 'Hai bisogno di aiuto?', '/projects': 'Hai bisogno di aiuto?', '/models': 'Esplora i Modelli', default: 'Hai bisogno di aiuto?' },
};


// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function GuideBot() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const scrollRef = useRef(null);
  const isMainPage = MAIN_PAGES.includes(location.pathname);

  const [isOpen,      setIsOpen]      = useState(false);
  const [lang,        setLang]        = useState('en');
  const [scriptKey,   setScriptKey]   = useState('/');
  const [history,     setHistory]     = useState([]);

  // Wizard state
  const [wizardMode,  setWizardMode]  = useState(false);
  const [conversation, setConversation] = useState([]);  // [{role, text, inputType, options, step}]
  const [wizardStep,  setWizardStep]  = useState(null);
  const [wizardData,  setWizardData]  = useState({});
  const [textInput,   setTextInput]   = useState('');
  const [isOnnx,      setIsOnnx]      = useState(false);

  // When URL changes → reset everything
  useEffect(() => {
    const key = getScriptKey(location.pathname);
    setScriptKey(key);
    setHistory([]);
    setWizardMode(false);
    setConversation([]);
    setWizardStep(null);
    setWizardData({});
  }, [location.pathname]);

  // Auto-scroll conversation to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation]);

  const currentScript = guideScript[scriptKey] || guideScript['fallback'];

  // ---- Text helper ----
  function t(textObj) {
    return textObj?.[lang] || textObj?.en || '';
  }

  // ---- Add message to conversation ----
  function addMessage(role, text, extra = {}) {
    setConversation(prev => [...prev, { role, text, ...extra }]);
  }

  // ---- Start Upload Model Wizard ----
  function startUploadWizard() {
    // Open the Upload Model modal first
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent.trim().includes('Upload Model'));
    if (btn) setTimeout(() => btn.click(), 100);

    setWizardMode(true);
    setWizardData({});
    setIsOnnx(false);
    setTextInput('');

    const steps = getUploadWizardSteps(lang);
    const firstStep = steps.find(s => s.step === 'name');
    setWizardStep('name');
    setConversation([{ role: 'bot', text: firstStep.text, inputType: firstStep.inputType, placeholder: firstStep.placeholder, step: 'name' }]);
  }

  // ---- Handle wizard answer ----
  function handleWizardAnswer(value, step) {
    const steps = getUploadWizardSteps(lang);
    addMessage('user', value);
    setTextInput('');

    if (step === 'name') {
      setTimeout(() => {
        const inputs = document.querySelectorAll('.ant-modal input');
        if (inputs[0]) setReactInputValue(inputs[0], value);
      }, 200);
      const next = steps.find(s => s.step === 'description');
      setTimeout(() => { setWizardStep('description'); addMessage('bot', next.text, { inputType: 'text-skip', placeholder: next.placeholder, step: 'description' }); }, 400);
    }

    else if (step === 'description') {
      // Fill description textarea if value given (skip if empty)
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
      setTimeout(() => { setWizardStep('type'); addMessage('bot', next.text, { inputType: 'buttons', options: next.options, step: 'type' }); }, 400);
    }

    else if (step === 'type') {
      // Select model type in the Ant Design select
      const isDetection = value.toLowerCase().includes('detection') || value.toLowerCase().includes('rilevamento');
      setTimeout(() => {
        const select = document.querySelector('.ant-modal .ant-select-selector');
        if (select) {
          // Ant Design Select opens on mousedown, not click
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
      setTimeout(() => { setWizardStep('file'); addMessage('bot', next.text, { inputType: 'file', step: 'file' }); }, 800);
    }

    else if (step === 'file-selected') {
      // value is the filename — detect .pt vs .onnx
      const onnx = value.toLowerCase().endsWith('.onnx');
      setIsOnnx(onnx);
      setWizardData(prev => ({ ...prev, fileName: value }));
      // Both .pt and .onnx need width/height — go there next
      const next = steps.find(s => s.step === 'width');
      setTimeout(() => { setWizardStep('width'); addMessage('bot', next.text, { inputType: 'text', placeholder: next.placeholder, step: 'width' }); }, 400);
    }

    else if (step === 'pt-done') {
      // Click the Upload Model submit button
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
      setTimeout(() => { setWizardStep('height'); addMessage('bot', next.text, { inputType: 'text', placeholder: next.placeholder, step: 'height' }); }, 500);
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
        // .pt — done after width/height
        const next = steps.find(s => s.step === 'pt-done');
        setTimeout(() => { setWizardStep('pt-done'); addMessage('bot', next.text, { inputType: 'buttons', options: next.options, step: 'pt-done' }); }, 400);
      } else {
        // .onnx — ask about YAML first, then classes
        const next = steps.find(s => s.step === 'yaml');
        setTimeout(() => { setWizardStep('yaml'); addMessage('bot', next.text, { inputType: 'buttons', options: next.options, step: 'yaml' }); }, 400);
      }
    }

    else if (step === 'yaml') {
      // YAML step — value is either 'skip' or 'upload'
      if (value.toLowerCase() === 'skip' || value === 'Salta') {
        const classesStep = getUploadWizardSteps(lang).find(s => s.step === 'classes');
        setTimeout(() => { setWizardStep('classes'); addMessage('bot', classesStep.text, { inputType: 'text', placeholder: classesStep.placeholder, step: 'classes' }); }, 400);
      } else {
        // Click the Select YAML button
        setTimeout(() => {
          const yamlBtn = Array.from(document.querySelectorAll('.ant-modal button')).find(b => b.textContent.includes('YAML'));
          if (yamlBtn) yamlBtn.click();
        }, 200);
      }
    }

    else if (step === 'classes') {
      setWizardData(prev => ({ ...prev, classes: value }));
      const nc = value.split(',').map(c => c.trim()).filter(Boolean).length;
      setWizardData(prev => ({ ...prev, nc }));

      // Fill classes field in form
      setTimeout(() => {
        const classesInput = Array.from(document.querySelectorAll('.ant-modal input')).find(i =>
          i.placeholder && (i.placeholder.toLowerCase().includes('person') || i.placeholder.toLowerCase().includes('persona'))
        );
        if (classesInput) setReactInputValue(classesInput, value);

        // Fill NC field
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
      setTimeout(() => { setWizardStep('nc'); addMessage('bot', confirmText, { inputType: 'buttons', options: [uploadLabel], step: 'nc' }); }, 600);
    }

    else if (step === 'nc') {
      setTimeout(() => clickModalButton('Upload Model'), 200);
      setWizardMode(false);
      setScriptKey('/models');
    }
  }

  // ---- Handle file selection in wizard ----
  function handleWizardFileClick() {
    const fileInput = document.querySelector('.ant-modal input[type="file"]');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleWizardAnswer(file.name, 'file-selected');
      }, { once: true });
      fileInput.click();
    }
  }

  // ---- Script mode action handler ----
  function handleAction(action) {
    if (action.type === 'navigate') {
      navigate(action.path);
      setIsOpen(false);
    } else if (action.type === 'wizard' && action.wizard === 'upload-model') {
      startUploadWizard();
    } else if (action.type === 'click') {
      try {
        const hasTextMatch = action.selector.match(/:has-text\(['"](.+?)['"]\)/);
        let el = null;
        if (hasTextMatch) {
          const text = hasTextMatch[1];
          const baseSelector = action.selector.split(':has-text')[0] || 'button';
          el = Array.from(document.querySelectorAll(baseSelector))
            .find(e => e.textContent.trim().includes(text));
        } else {
          el = document.querySelector(action.selector);
        }
        if (el) { setIsOpen(false); setTimeout(() => el.click(), 100); }
        else setIsOpen(false);
      } catch (e) { setIsOpen(false); }
    } else if (action.type === 'message') {
      setHistory(prev => [...prev, scriptKey]);
      setScriptKey(action.key);
    }
  }

  // ---- Back button ----
  function handleBack() {
    if (wizardMode) { setWizardMode(false); setConversation([]); return; }
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setScriptKey(prev);
  }

  // ---- Current wizard input step ----
  const currentWizardStep = wizardMode && conversation.length > 0
    ? conversation[conversation.length - 1]
    : null;

  return (
    <div className="guide-bot-wrapper">

      {/* CHAT PANEL */}
      {isOpen && (
        <div className="guide-bot-panel">

          {/* Header */}
          <div className="guide-bot-header">
            <div className="guide-bot-header-left">
              <Lottie animationData={robotAnimation} loop={true} className="guide-bot-header-avatar" />
              <span className="guide-bot-header-title">Gevis Guide</span>
            </div>
            <div className="guide-bot-header-right">
              <div className="guide-bot-lang">
                <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
                <button className={lang === 'it' ? 'active' : ''} onClick={() => setLang('it')}>IT</button>
              </div>
              <button className="guide-bot-minimize" onClick={() => setIsOpen(false)} title="Minimize">&#8722;</button>
            </div>
          </div>

          {/* ---- WIZARD MODE ---- */}
          {wizardMode ? (
            <>
              {/* Scrollable conversation */}
              <div className="guide-bot-conversation" ref={scrollRef}>
                {conversation.map((msg, i) => (
                  <div key={i} className={`guide-bot-msg guide-bot-msg--${msg.role}`}>
                    {msg.text}
                  </div>
                ))}
              </div>

              {/* Current input */}
              {currentWizardStep && (
                <div className="guide-bot-wizard-input">
                  {(currentWizardStep.inputType === 'text' || currentWizardStep.inputType === 'text-skip') && (
                    <div className="guide-bot-wizard-text-row">
                      <input
                        className="guide-bot-wizard-textinput"
                        placeholder={currentWizardStep.placeholder || ''}
                        value={textInput}
                        onChange={e => setTextInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && textInput.trim()) handleWizardAnswer(textInput.trim(), currentWizardStep.step); }}
                        autoFocus
                      />
                      <button
                        className="guide-bot-wizard-send"
                        onClick={() => { if (textInput.trim()) handleWizardAnswer(textInput.trim(), currentWizardStep.step); }}
                      >&#10148;</button>
                    </div>
                  )}
                  {currentWizardStep.inputType === 'text-skip' && (
                    <button
                      className="guide-bot-option-btn"
                      style={{ marginTop: '6px' }}
                      onClick={() => { setTextInput(''); handleWizardAnswer(lang === 'it' ? 'Salta' : 'Skip', currentWizardStep.step); }}
                    >
                      {lang === 'it' ? 'Salta' : 'Skip'}
                    </button>
                  )}
                  {currentWizardStep.inputType === 'buttons' && (
                    <div className="guide-bot-options">
                      {currentWizardStep.options.map((opt, i) => (
                        <button key={i} className="guide-bot-option-btn"
                          onClick={() => handleWizardAnswer(opt, currentWizardStep.step)}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                  {currentWizardStep.inputType === 'file' && (
                    <div className="guide-bot-options">
                      <button className="guide-bot-option-btn" onClick={handleWizardFileClick}>
                        {lang === 'it' ? 'Seleziona File Modello' : 'Select Model File'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Back */}
              <div className="guide-bot-footer">
                <button className="guide-bot-back-btn" onClick={handleBack}>
                  &#8592; {lang === 'it' ? 'Annulla' : 'Cancel'}
                </button>
              </div>
            </>
          ) : (
            /* ---- SCRIPT MODE ---- */
            <>
              <div className="guide-bot-message-area">
                <div className="guide-bot-bubble">{t(currentScript.message)}</div>
              </div>
              <div className="guide-bot-options">
                {currentScript.options.map((opt, i) => (
                  <button key={i} className="guide-bot-option-btn" onClick={() => handleAction(opt.action)}>
                    {t(opt.label)}
                  </button>
                ))}
              </div>
              {history.length > 0 && (
                <div className="guide-bot-footer">
                  <button className="guide-bot-back-btn" onClick={handleBack}>
                    &#8592; {lang === 'it' ? 'Indietro' : 'Back'}
                  </button>
                </div>
              )}
            </>
          )}

        </div>
      )}

      {/* ROBOT — minimized */}
      {!isOpen && (
        <div className={`guide-bot-robot-container${isMainPage ? ' guide-bot-large' : ''}`}
          onClick={() => setIsOpen(true)} title="Open Guide">
          <div className="guide-bot-hello-bubble">
            {(BUBBLE_TEXT[lang] || BUBBLE_TEXT['en'])[location.pathname] || (BUBBLE_TEXT[lang] || BUBBLE_TEXT['en'])['default']}
          </div>
          <div className="guide-bot-robot">
            <Lottie animationData={robotAnimation} loop={true} />
          </div>
        </div>
      )}

    </div>
  );
}
