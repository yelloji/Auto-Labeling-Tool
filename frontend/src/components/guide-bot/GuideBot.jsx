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

// ---------------------------------------------------------------------------
// Upload Files wizard steps
// ---------------------------------------------------------------------------

function getUploadFilesWizardSteps(lang) {
  const s = {
    en: [
      { step: 'uf-batch-name', role: 'bot', text: 'A batch is a group of images you are uploading together. Give it a name so you can recognise it later — for example: "Factory Floor 1" or "Morning Inspection". What would you like to name this batch?', inputType: 'text', placeholder: 'e.g. Factory Floor 1' },
    ],
    it: [
      { step: 'uf-batch-name', role: 'bot', text: 'Un batch è un gruppo di immagini che stai caricando insieme. Dagli un nome per riconoscerlo in seguito — ad esempio: "Piano Fabbrica 1" o "Ispezione Mattina". Come vuoi chiamare questo batch?', inputType: 'text', placeholder: 'es. Piano Fabbrica 1' },
    ],
  };
  return s[lang] || s['en'];
}

// ---------------------------------------------------------------------------
// Create Project wizard steps
// ---------------------------------------------------------------------------

function getCreateProjectWizardSteps(lang) {
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
  const location      = useLocation();
  const navigate      = useNavigate();
  const scrollRef            = useRef(null);
  const observerRef          = useRef(null);
  const processingObserverRef = useRef(null);
  const isMainPage    = MAIN_PAGES.includes(location.pathname);

  const [isOpen,      setIsOpen]      = useState(false);
  const [lang,        setLang]        = useState('en');
  const [scriptKey,   setScriptKey]   = useState('/');
  const [history,     setHistory]     = useState([]);

  // Wizard state
  const [wizardMode,  setWizardMode]  = useState(false);
  const [wizardType,  setWizardType]  = useState(null);  // 'upload-model' | 'create-project'
  const [conversation, setConversation] = useState([]);  // [{role, text, inputType, options, step}]
  const [wizardStep,  setWizardStep]  = useState(null);
  const [wizardData,  setWizardData]  = useState({});
  const [textInput,   setTextInput]   = useState('');
  const [isOnnx,      setIsOnnx]      = useState(false);

  // When URL changes → reset everything
  useEffect(() => {
    const key = getScriptKey(location.pathname);
    setScriptKey(key);
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
    if (processingObserverRef.current) { processingObserverRef.current.disconnect(); processingObserverRef.current = null; }
    setHistory([]);
    setWizardMode(false);
    setWizardType(null);
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

  // ---- Start Create Project Wizard ----
  function startCreateProjectWizard() {
    // Open the New Project modal first
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

  // ---- Start Upload Folder Wizard ----
  // No batch name needed — folder picker opens directly.
  // Bot closes so user can pick folder, then reopens when upload result appears.
  function startUploadFolderWizard() {
    setWizardMode(true);
    setWizardType('upload-folder');
    setConversation([]);

    // Start observer BEFORE clicking — watches for upload result in background
    if (observerRef.current) observerRef.current.disconnect();
    const observer = new MutationObserver(() => {
      const allEls = Array.from(document.querySelectorAll('div, p, span, h3, h4'));
      const resultEl = allEls.find(el => el.textContent.includes('uploaded to'));
      if (resultEl) {
        observer.disconnect();
        observerRef.current = null;
        const text = resultEl.textContent.trim();
        const uploadedMatch = text.match(/(\d+)\s+image/);
        const skippedMatch  = text.match(/(\d+)\s+skipped/);
        const uploaded = uploadedMatch ? uploadedMatch[1] : '?';
        const skipped  = skippedMatch  ? skippedMatch[1]  : '0';
        const resultMsg = lang === 'it'
          ? `${uploaded} immagini caricate${skipped !== '0' ? `, ${skipped} saltate — esistevano già in questo progetto` : ''}. Vai su Management per iniziare ad etichettare.`
          : `${uploaded} image(s) uploaded${skipped !== '0' ? `, ${skipped} skipped — they already exist in this project` : ''}. Go to Management to start labeling.`;
        const goLabel = lang === 'it' ? 'Vai a Management' : 'Go to Management';
        setTimeout(() => {
          setIsOpen(true);
          setConversation([{ role: 'bot', text: resultMsg, inputType: 'buttons', options: [goLabel], step: 'uf-done' }]);
          setWizardStep('uf-done');
        }, 600);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    observerRef.current = observer;

    // Click Select Folder (not the images+labels one)
    setTimeout(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent.trim().includes('Select Folder') && !b.textContent.includes('images'));
      if (btn) btn.click();
    }, 200);

    // Close bot so folder picker is usable
    setTimeout(() => setIsOpen(false), 400);
  }

  // ---- Start Upload Folder (images + labels) Wizard ----
  // Shows explanation first with a button. User reads, clicks → bot closes, folder picker opens.
  // Reopens automatically when "Import complete" appears.
  function startUploadFolderLabelsWizard() {
    setWizardMode(true);
    setWizardType('upload-folder-labels');

    const explainMsg = lang === 'it'
      ? 'Usa questa opzione se la tua cartella contiene già immagini E file etichette. Formati supportati: YOLO (immagini + file .txt + data.yaml), COCO (immagini + file .json). Il nome della cartella verrà usato come nome batch.'
      : 'Use this if your folder already has images AND their label files. Supported: YOLO format (images + .txt label files + data.yaml), COCO format (images + .json file). The folder name will be used as batch name.';
    const btnLabel = lang === 'it' ? 'Seleziona Cartella' : 'Select Folder';

    setConversation([{ role: 'bot', text: explainMsg, inputType: 'buttons', options: [btnLabel], step: 'ufl-start' }]);
    setWizardStep('ufl-start');
  }

  // ---- Start Upload Video Wizard (files or folder) ----
  // Closes bot → user picks video → observer detects "Selected Video:" → bot reopens
  // with explanation + Extract Frames button → clicks it → shows result.
  function startUploadVideoWizard(mode) {
    const wizType = mode === 'folder' ? 'upload-video-folder' : 'upload-video-files';
    setWizardMode(true);
    setWizardType(wizType);
    setConversation([]);

    const explainMsg = lang === 'it'
      ? 'Il tuo video è selezionato. Scegli quanti frame estrarre — puoi impostare frame al secondo (FPS) oppure un totale per video. Per la maggior parte dei casi, 2-5 frame al secondo danno buona copertura. Formato: JPEG è più piccolo, PNG ha qualità migliore. Quando sei pronto, clicca qui sotto.'
      : 'Your video is selected. Choose how many frames to extract — either per second (FPS) or as a total per video. For most cases, 2 to 5 frames per second gives good coverage. Format: JPEG is smaller, PNG has better quality. When you are ready, click below.';
    const extractLabel = lang === 'it' ? 'Estrai Frame' : 'Extract Frames';

    // Helper — starts result observer.
    // Watches ONLY for the inline upload result panel ("uploaded to") which appears
    // once after ALL videos are fully processed and uploaded — not per-video toasts.
    function startExtractionResultObserver() {
      if (observerRef.current) observerRef.current.disconnect();
      const observer2 = new MutationObserver(() => {
        const uploadResultEl = Array.from(document.querySelectorAll('div, p, span'))
          .filter(el => el.textContent.includes('uploaded to') && el.textContent.length < 200)
          .sort((a, b) => a.textContent.length - b.textContent.length)[0];
        if (uploadResultEl) {
          observer2.disconnect();
          observerRef.current = null;
          const resultMsg = lang === 'it'
            ? 'Estrazione completata. Vai su Management per vedere le tue immagini e iniziare ad etichettare.'
            : 'Extraction complete. Go to Management to see your images and start labeling.';
          const goLabel = lang === 'it' ? 'Vai a Management' : 'Go to Management';
          setTimeout(() => {
            setIsOpen(true);
            setConversation([{ role: 'bot', text: resultMsg, inputType: 'buttons', options: [goLabel], step: 'uv-done' }]);
            setWizardStep('uv-done');
          }, 600);
        }
      });
      observer2.observe(document.body, { childList: true, subtree: true });
      observerRef.current = observer2;
    }

    // Observer 1 — watch for video selected (extraction settings panel appears)
    if (observerRef.current) observerRef.current.disconnect();
    const observer1 = new MutationObserver(() => {
      const found = Array.from(document.querySelectorAll('div, span, p'))
        .some(el => el.textContent.includes('Selected Video:') || (el.textContent.includes('Selected:') && el.textContent.includes('video')));
      if (found) {
        observer1.disconnect();
        // Start result observer immediately — catches result whether user clicks page button or bot button
        startExtractionResultObserver();
        // Start processing observer — if user clicks Extract on the UI, close bot automatically
        if (processingObserverRef.current) processingObserverRef.current.disconnect();
        const procObserver = new MutationObserver(() => {
          const processingBtn = Array.from(document.querySelectorAll('button'))
            .find(b => b.textContent.includes('Processing'));
          if (processingBtn) {
            procObserver.disconnect();
            processingObserverRef.current = null;
            setIsOpen(false);
          }
        });
        procObserver.observe(document.body, { childList: true, subtree: true });
        processingObserverRef.current = procObserver;
        setTimeout(() => {
          setIsOpen(true);
          setConversation([{ role: 'bot', text: explainMsg, inputType: 'buttons', options: [extractLabel], step: 'uv-extract' }]);
          setWizardStep('uv-extract');
        }, 400);
      }
    });
    observer1.observe(document.body, { childList: true, subtree: true });
    observerRef.current = observer1;

    // Click the correct button
    setTimeout(() => {
      const btnText = mode === 'folder' ? 'Select Video Folder' : 'Select Video File(s)';
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent.trim().includes(btnText));
      if (btn) btn.click();
    }, 200);

    // Close bot so file/folder picker is usable
    setTimeout(() => setIsOpen(false), 400);
  }

  // ---- Start Upload Files Wizard ----
  function startUploadFilesWizard() {
    setWizardMode(true);
    setWizardType('upload-files');
    setWizardData({});
    setTextInput('');

    const steps = getUploadFilesWizardSteps(lang);
    const firstStep = steps.find(s => s.step === 'uf-batch-name');
    setWizardStep('uf-batch-name');
    setConversation([{ role: 'bot', text: firstStep.text, inputType: firstStep.inputType, placeholder: firstStep.placeholder, step: 'uf-batch-name' }]);
  }

  // ---- Handle wizard answer ----
  function handleWizardAnswer(value, step) {
    addMessage('user', value);
    setTextInput('');

    // ---- Create Project wizard ----
    if (wizardType === 'create-project') {
      const steps = getCreateProjectWizardSteps(lang);

      if (step === 'cp-name') {
        setTimeout(() => {
          const input = document.querySelector('.ant-modal input[placeholder="Enter project name"], .ant-modal input');
          if (input) setReactInputValue(input, value);
        }, 300);
        const next = steps.find(s => s.step === 'cp-description');
        setTimeout(() => { setWizardStep('cp-description'); addMessage('bot', next.text, { inputType: 'text-skip', placeholder: next.placeholder, step: 'cp-description' }); }, 500);
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
        setTimeout(() => { setWizardStep('cp-type'); addMessage('bot', next.text, { inputType: 'buttons', options: next.options, step: 'cp-type' }); }, 400);
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
        setTimeout(() => { setWizardStep('cp-confirm'); addMessage('bot', next.text, { inputType: 'buttons', options: next.options, step: 'cp-confirm' }); }, 1200);
      }

      else if (step === 'cp-confirm') {
        // Click the Create Project button in the modal
        setTimeout(() => {
          const btn = Array.from(document.querySelectorAll('.ant-modal button'))
            .find(b => b.textContent.trim().includes('Create Project') || b.textContent.trim().includes('Crea Progetto'));
          if (btn) btn.click();
        }, 200);
        // Show success message then close
        const doneText = lang === 'it'
          ? 'Progetto creato! Apertura del tuo workspace...'
          : 'Project created! Opening your workspace...';
        setTimeout(() => {
          addMessage('bot', doneText, { inputType: 'none', step: 'cp-done' });
          setWizardStep('cp-done');
        }, 600);
        setTimeout(() => { setWizardMode(false); setWizardType(null); }, 2500);
      }

      return;
    }

    // ---- Upload Video wizard (files and folder share same steps) ----
    if (wizardType === 'upload-video-files' || wizardType === 'upload-video-folder') {
      if (step === 'uv-extract') {
        // User clicked bot button — stop processing observer (we're about to click ourselves)
        if (processingObserverRef.current) { processingObserverRef.current.disconnect(); processingObserverRef.current = null; }
        // Just click the button — result observer already running from startUploadVideoWizard
        setTimeout(() => {
          const btn = Array.from(document.querySelectorAll('button'))
            .find(b => b.textContent.trim().includes('Extract Frames'));
          if (btn) btn.click();
        }, 200);
        const waitMsg = lang === 'it'
          ? 'Estrazione in corso... Ti mostrerò il risultato qui.'
          : 'Extracting frames... I will show you the result here.';
        addMessage('bot', waitMsg, { inputType: 'none', step: 'uv-waiting' });
        setWizardStep('uv-waiting');
      }

      else if (step === 'uv-done') {
        setTimeout(() => {
          const mgmt = Array.from(document.querySelectorAll('li, a, span'))
            .find(el => el.textContent.trim() === 'Management');
          if (mgmt) mgmt.click();
        }, 200);
        setWizardMode(false);
        setWizardType(null);
        setIsOpen(false);
      }
      return;
    }

    // ---- Upload Folder (images + labels) wizard ----
    if (wizardType === 'upload-folder-labels') {
      if (step === 'ufl-start') {
        // Start observer — watch for "Import complete"
        if (observerRef.current) observerRef.current.disconnect();
        const observer = new MutationObserver(() => {
          // Find the most specific element — shortest textContent containing "Import complete"
          const matching = Array.from(document.querySelectorAll('div, p, span, h3, h4'))
            .filter(el => el.textContent.includes('Import complete'));
          const resultEl = matching.sort((a, b) => a.textContent.length - b.textContent.length)[0];
          if (resultEl) {
            observer.disconnect();
            observerRef.current = null;
            const text = resultEl.textContent.trim();
            const imagesMatch      = text.match(/(\d+)\s+image/);
            const annotationsMatch = text.match(/(\d+)\s+annotation/);
            const images      = imagesMatch      ? imagesMatch[1]      : '?';
            const annotations = annotationsMatch ? annotationsMatch[1] : '?';
            const resultMsg = lang === 'it'
              ? `Importazione completata — ${images} immagini, ${annotations} annotazioni importate. Vai su Management per iniziare a lavorare.`
              : `Import complete — ${images} images, ${annotations} annotations imported. Go to Management to start working.`;
            const goLabel = lang === 'it' ? 'Vai a Management' : 'Go to Management';
            setTimeout(() => {
              setIsOpen(true);
              setConversation([{ role: 'bot', text: resultMsg, inputType: 'buttons', options: [goLabel], step: 'ufl-done' }]);
              setWizardStep('ufl-done');
            }, 600);
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        observerRef.current = observer;
        // Click Select Folder (images + labels) button
        setTimeout(() => {
          const btn = Array.from(document.querySelectorAll('button'))
            .find(b => b.textContent.trim().includes('Select Folder (images + labels)'));
          if (btn) btn.click();
        }, 200);
        // Close bot so folder picker is usable
        setTimeout(() => setIsOpen(false), 400);
      }

      else if (step === 'ufl-done') {
        setTimeout(() => {
          const mgmt = Array.from(document.querySelectorAll('li, a, span'))
            .find(el => el.textContent.trim() === 'Management');
          if (mgmt) mgmt.click();
        }, 200);
        setWizardMode(false);
        setWizardType(null);
        setIsOpen(false);
      }
      return;
    }

    // ---- Upload Folder wizard (only uf-done needs handling — rest is automatic) ----
    if (wizardType === 'upload-folder') {
      if (step === 'uf-done') {
        setTimeout(() => {
          const mgmt = Array.from(document.querySelectorAll('li, a, span'))
            .find(el => el.textContent.trim() === 'Management');
          if (mgmt) mgmt.click();
        }, 200);
        setWizardMode(false);
        setWizardType(null);
        setIsOpen(false);
      }
      return;
    }

    // ---- Upload Files wizard ----
    if (wizardType === 'upload-files') {

      if (step === 'uf-batch-name') {
        const batchName = value;

        // Step 1 — click Select File(s) to open the Enter Batch Name modal
        setTimeout(() => {
          const btn = Array.from(document.querySelectorAll('button'))
            .find(b => b.textContent.trim().includes('Select File(s)'));
          if (btn) btn.click();
        }, 200);

        // Step 2 — fill batch name in the modal input, then click Continue
        setTimeout(() => {
          const modalInput = document.querySelector('.ant-modal input, [role="dialog"] input');
          if (modalInput) setReactInputValue(modalInput, batchName);
          setTimeout(() => {
            const continueBtn = Array.from(document.querySelectorAll('.ant-modal button, [role="dialog"] button'))
              .find(b => b.textContent.trim().includes('Continue'));
            if (continueBtn) continueBtn.click();
          }, 400);
        }, 700);

        // Step 3 — show waiting message
        const waitMsg = lang === 'it'
          ? 'Seleziona i file nella finestra. Ti mostrerò il risultato qui.'
          : 'Select your files in the dialog. I will show you the result here.';
        setTimeout(() => {
          addMessage('bot', waitMsg, { inputType: 'none', step: 'uf-waiting' });
          setWizardStep('uf-waiting');
        }, 1300);

        // Step 4 — MutationObserver: watch for upload result text in DOM
        if (observerRef.current) observerRef.current.disconnect();
        const observer = new MutationObserver(() => {
          const resultEl = Array.from(document.querySelectorAll('div, p, span, h3, h4'))
            .filter(el => el.textContent.includes('uploaded to'))
            .sort((a, b) => a.textContent.length - b.textContent.length)[0];
          if (resultEl) {
            observer.disconnect();
            observerRef.current = null;
            const text = resultEl.textContent.trim();
            const uploadedMatch = text.match(/(\d+)\s+image/);
            const skippedMatch  = text.match(/(\d+)\s+skipped/);
            const uploaded = uploadedMatch ? uploadedMatch[1] : '?';
            const skipped  = skippedMatch  ? skippedMatch[1]  : '0';
            const resultMsg = lang === 'it'
              ? `${uploaded} immagini caricate${skipped !== '0' ? `, ${skipped} saltate — esistevano già in questo progetto` : ''}. Vai su Management per iniziare ad etichettare.`
              : `${uploaded} image(s) uploaded${skipped !== '0' ? `, ${skipped} skipped — they already exist in this project` : ''}. Go to Management to start labeling.`;
            const goLabel = lang === 'it' ? 'Vai a Management' : 'Go to Management';
            setTimeout(() => {
              addMessage('bot', resultMsg, { inputType: 'buttons', options: [goLabel], step: 'uf-done' });
              setWizardStep('uf-done');
            }, 600);
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        observerRef.current = observer;
      }

      else if (step === 'uf-done') {
        setTimeout(() => {
          const mgmt = Array.from(document.querySelectorAll('li, a, span'))
            .find(el => el.textContent.trim() === 'Management');
          if (mgmt) mgmt.click();
        }, 200);
        setWizardMode(false);
        setWizardType(null);
        setIsOpen(false);
      }

      return;
    }

    // ---- Upload Model wizard ----
    const steps = getUploadWizardSteps(lang);

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
    } else if (action.type === 'wizard' && action.wizard === 'create-project') {
      startCreateProjectWizard();
    } else if (action.type === 'wizard' && action.wizard === 'upload-files') {
      startUploadFilesWizard();
    } else if (action.type === 'wizard' && action.wizard === 'upload-folder') {
      startUploadFolderWizard();
    } else if (action.type === 'wizard' && action.wizard === 'upload-folder-labels') {
      startUploadFolderLabelsWizard();
    } else if (action.type === 'wizard' && action.wizard === 'upload-video-files') {
      startUploadVideoWizard('files');
    } else if (action.type === 'wizard' && action.wizard === 'upload-video-folder') {
      startUploadVideoWizard('folder');
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
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
    if (processingObserverRef.current) { processingObserverRef.current.disconnect(); processingObserverRef.current = null; }
    if (wizardMode) { setWizardMode(false); setWizardType(null); setConversation([]); return; }
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
