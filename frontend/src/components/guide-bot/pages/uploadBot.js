/**
 * uploadBot.js — All upload page logic for the guide bot.
 *
 * Exports:
 *   getUploadFilesWizardSteps(lang)
 *   startExtractionResultObserver(lang, refs, setters)
 *   checkUploadPageState(lang, refs, setters)       — snapshot-on-open
 *   startUploadFilesWizard(lang, setters)
 *   startUploadFolderWizard(lang, refs, setters)
 *   startUploadFolderLabelsWizard(lang, setters)
 *   startUploadVideoWizard(mode, lang, refs, setters)
 *   handleUploadAnswer(wizardType, step, value, lang, refs, setters)
 *
 * refs    = { observerRef, processingObserverRef }
 * setters = { setIsOpen, setWizardMode, setWizardType, setConversation,
 *             setWizardStep, setWizardData, setTextInput, addMessage }
 */

import { clickSidebarItem } from './botUtils';

// ---------------------------------------------------------------------------
// Upload Files wizard step definitions
// ---------------------------------------------------------------------------
export function getUploadFilesWizardSteps(lang) {
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
// Observer: watches for extraction result panel ("uploaded to") after video frames upload.
// Called from startUploadVideoWizard AND from checkUploadPageState (video-selected state).
// ---------------------------------------------------------------------------
export function startExtractionResultObserver(lang, refs, setters) {
  const { observerRef } = refs;
  const { setIsOpen, setConversation, setWizardStep } = setters;

  if (observerRef.current) observerRef.current.disconnect();

  const observer = new MutationObserver(() => {
    const uploadResultEl = Array.from(document.querySelectorAll('div, p, span'))
      .filter(el => el.textContent.includes('uploaded to') && el.textContent.length < 200)
      .sort((a, b) => a.textContent.length - b.textContent.length)[0];
    if (uploadResultEl) {
      observer.disconnect();
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

  observer.observe(document.body, { childList: true, subtree: true });
  observerRef.current = observer;
}

// ---------------------------------------------------------------------------
// Snapshot check — reads current Upload page DOM state when bot is opened.
// Returns a wizard state object { wizardType, conversation, step } or null.
// ---------------------------------------------------------------------------
export function checkUploadPageState(lang, refs, setters) {
  const { observerRef, processingObserverRef } = refs;
  const { setIsOpen, setConversation, setWizardStep } = setters;

  const explainMsg = lang === 'it'
    ? 'Vedo che hai già selezionato un video. Scegli FPS e formato, poi clicca Estrai Frame.'
    : 'I can see you have already selected a video. Choose your FPS and format, then click Extract Frames.';
  const toggleMsg = lang === 'it'
    ? 'Nota il toggle "Allow duplicate frames" sotto i menu a discesa. Di default è SPENTO — i frame identici vengono saltati automaticamente. Attivalo SOLO se vuoi salvare ogni singolo frame, anche quelli identici.'
    : 'Notice the "Allow duplicate frames" toggle below the dropdowns. By default it is OFF — identical frames are skipped automatically. Turn it ON only if you want every single frame stored, even if they look identical.';
  const extractLabel = lang === 'it' ? 'Estrai Frame' : 'Extract Frames';
  const goLabel      = lang === 'it' ? 'Vai a Management' : 'Go to Management';

  // State 1: Video is currently processing
  const processingBtn = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.includes('Processing'));
  if (processingBtn) {
    const msg = lang === 'it'
      ? 'Il tuo video è in elaborazione. Aspetta — ti avviserò quando è pronto.'
      : 'Your video is being processed. Please wait — I will let you know when it is done.';
    return {
      wizardType: 'upload-video-files',
      conversation: [{ role: 'bot', text: msg, inputType: 'none', step: 'uv-waiting' }],
      step: 'uv-waiting',
    };
  }

  // State 2: Upload result panel visible ("uploaded to")
  const uploadResultEl = Array.from(document.querySelectorAll('div, p, span'))
    .filter(el => el.textContent.includes('uploaded to') && el.textContent.length < 200)
    .sort((a, b) => a.textContent.length - b.textContent.length)[0];
  if (uploadResultEl) {
    const msg = lang === 'it'
      ? 'Upload completato! Vai su Management per vedere le tue immagini e iniziare ad etichettare.'
      : 'Upload complete! Go to Management to see your images and start labeling.';
    return {
      wizardType: 'upload-video-files',
      conversation: [{ role: 'bot', text: msg, inputType: 'buttons', options: [goLabel], step: 'uv-done' }],
      step: 'uv-done',
    };
  }

  // State 3: Import complete panel visible
  // Use innerText on body — avoids length filter failing when class names inflate textContent
  const importExists = document.body.innerText.includes('Import complete');
  if (importExists) {
    const msg = lang === 'it'
      ? 'Importazione completata! Vai su Management per vedere le tue immagini e le etichette.'
      : 'Import complete! Go to Management to see your images and labels.';
    return {
      wizardType: 'upload-folder-labels',
      conversation: [{ role: 'bot', text: msg, inputType: 'buttons', options: [goLabel], step: 'ufl-done' }],
      step: 'ufl-done',
    };
  }

  // State 4: Video selected, waiting for extraction settings
  const videoSelected = Array.from(document.querySelectorAll('div, span, p'))
    .some(el => el.textContent.includes('Selected Video:') || el.textContent.includes('videos selected'));
  if (videoSelected) {
    // Start result observer so bot catches extraction finish whether user clicks UI or bot button
    startExtractionResultObserver(lang, refs, setters);
    // Start processing observer — if user clicks Extract in UI, close bot
    if (processingObserverRef.current) processingObserverRef.current.disconnect();
    const procObs = new MutationObserver(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Processing'));
      if (btn) {
        procObs.disconnect();
        processingObserverRef.current = null;
        setIsOpen(false);
      }
    });
    procObs.observe(document.body, { childList: true, subtree: true });
    processingObserverRef.current = procObs;
    return {
      wizardType: 'upload-video-files',
      conversation: [
        { role: 'bot', text: explainMsg, inputType: 'none', step: 'uv-fps-info' },
        { role: 'bot', text: toggleMsg, inputType: 'buttons', options: [extractLabel], step: 'uv-extract' },
      ],
      step: 'uv-extract',
    };
  }

  return null; // Normal upload page state — open bot menu as usual
}

// ---------------------------------------------------------------------------
// Start Upload Files wizard
// ---------------------------------------------------------------------------
export function startUploadFilesWizard(lang, setters) {
  const { setWizardMode, setWizardType, setWizardData, setTextInput, setWizardStep, setConversation } = setters;

  setWizardMode(true);
  setWizardType('upload-files');
  setWizardData({});
  setTextInput('');

  const steps = getUploadFilesWizardSteps(lang);
  const firstStep = steps.find(s => s.step === 'uf-batch-name');
  setWizardStep('uf-batch-name');
  setConversation([{ role: 'bot', text: firstStep.text, inputType: firstStep.inputType, placeholder: firstStep.placeholder, step: 'uf-batch-name' }]);
}

// ---------------------------------------------------------------------------
// Start Upload Folder wizard (images only — no labels)
// Bot closes → folder picker opens → observer watches for result → bot reopens
// ---------------------------------------------------------------------------
export function startUploadFolderWizard(lang, refs, setters) {
  const { observerRef } = refs;
  const { setWizardMode, setWizardType, setIsOpen, setConversation, setWizardStep } = setters;

  setWizardMode(true);
  setWizardType('upload-folder');
  setConversation([]);

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

  setTimeout(() => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent.trim().includes('Select Folder') && !b.textContent.includes('images'));
    if (btn) btn.click();
  }, 200);
  setTimeout(() => setIsOpen(false), 400);
}

// ---------------------------------------------------------------------------
// Start Upload Folder (images + labels) wizard
// Shows explanation first → user clicks button → folder picker → result panel
// ---------------------------------------------------------------------------
export function startUploadFolderLabelsWizard(lang, setters) {
  const { setWizardMode, setWizardType, setConversation, setWizardStep } = setters;

  setWizardMode(true);
  setWizardType('upload-folder-labels');

  const explainMsg = lang === 'it'
    ? 'Usa questa opzione se la tua cartella contiene già immagini E file etichette. Formati supportati: YOLO (immagini + file .txt + data.yaml), COCO (immagini + file .json). Il nome della cartella verrà usato come nome batch.'
    : 'Use this if your folder already has images AND their label files. Supported: YOLO format (images + .txt label files + data.yaml), COCO format (images + .json file). The folder name will be used as batch name.';
  const btnLabel = lang === 'it' ? 'Seleziona Cartella' : 'Select Folder';

  setConversation([{ role: 'bot', text: explainMsg, inputType: 'buttons', options: [btnLabel], step: 'ufl-start' }]);
  setWizardStep('ufl-start');
}

// ---------------------------------------------------------------------------
// Start Upload Video wizard (files or folder mode)
// Bot closes → user picks video → observer detects "Selected Video:" →
// bot reopens with FPS/format info + Extract Frames button
// ---------------------------------------------------------------------------
export function startUploadVideoWizard(mode, lang, refs, setters) {
  const { observerRef, processingObserverRef } = refs;
  const { setWizardMode, setWizardType, setIsOpen, setConversation, setWizardStep } = setters;

  const wizType = mode === 'folder' ? 'upload-video-folder' : 'upload-video-files';
  setWizardMode(true);
  setWizardType(wizType);
  setConversation([]);

  const explainMsg = lang === 'it'
    ? 'Il tuo video è selezionato. Scegli quanti frame estrarre — per la maggior parte dei casi, 2-5 frame al secondo danno buona copertura. Formato: JPEG è più piccolo, PNG ha qualità migliore.'
    : 'Your video is selected. Choose how many frames to extract — for most cases, 2 to 5 frames per second gives good coverage. Format: JPEG is smaller, PNG has better quality.';
  const toggleMsg = lang === 'it'
    ? 'Nota il toggle "Allow duplicate frames" sotto i menu a discesa. Di default è SPENTO — i frame identici vengono saltati automaticamente (evita di etichettare la stessa immagine due volte). Attivalo SOLO se vuoi salvare ogni singolo frame, anche quelli identici.'
    : 'Notice the "Allow duplicate frames" toggle below the dropdowns. By default it is OFF — identical frames are skipped automatically (saves you labeling the same image twice). Turn it ON only if you want every single frame stored, even if they look identical.';
  const extractLabel = lang === 'it' ? 'Estrai Frame' : 'Extract Frames';

  // Observer 1 — watch for video selected (extraction settings panel appears)
  if (observerRef.current) observerRef.current.disconnect();
  const observer1 = new MutationObserver(() => {
    const found = Array.from(document.querySelectorAll('div, span, p'))
      .some(el => el.textContent.includes('Selected Video:') || (el.textContent.includes('Selected:') && el.textContent.includes('video')));
    if (found) {
      observer1.disconnect();
      // Start result observer — catches extraction result whether user clicks UI or bot button
      startExtractionResultObserver(lang, refs, setters);
      // Start processing observer — if user clicks Extract in UI, close bot
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
        setConversation([
          { role: 'bot', text: explainMsg, inputType: 'none', step: 'uv-fps-info' },
          { role: 'bot', text: toggleMsg, inputType: 'buttons', options: [extractLabel], step: 'uv-extract' },
        ]);
        setWizardStep('uv-extract');
      }, 400);
    }
  });
  observer1.observe(document.body, { childList: true, subtree: true });
  observerRef.current = observer1;

  setTimeout(() => {
    const btnText = mode === 'folder' ? 'Select Video Folder' : 'Select Video File(s)';
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent.trim().includes(btnText));
    if (btn) btn.click();
  }, 200);
  setTimeout(() => setIsOpen(false), 400);
}

// ---------------------------------------------------------------------------
// Handle wizard button clicks for all upload wizard types
// ---------------------------------------------------------------------------
export function handleUploadAnswer(wizardType, step, value, lang, refs, setters) {
  const { observerRef, processingObserverRef } = refs;
  const { setWizardMode, setWizardType, setIsOpen, setConversation, setWizardStep, addMessage, requestReopen } = setters;

  // ---- Upload Video wizard ----
  if (wizardType === 'upload-video-files' || wizardType === 'upload-video-folder') {
    if (step === 'uv-extract') {
      // User clicked bot button — stop processing observer (we are about to click ourselves)
      if (processingObserverRef.current) { processingObserverRef.current.disconnect(); processingObserverRef.current = null; }
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
      requestReopen?.();
      setTimeout(() => clickSidebarItem('Management'), 200);
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
      setTimeout(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => b.textContent.trim().includes('Select Folder (images + labels)'));
        if (btn) btn.click();
      }, 200);
      setTimeout(() => setIsOpen(false), 400);
    }
    else if (step === 'ufl-done') {
      requestReopen?.();
      setTimeout(() => clickSidebarItem('Management'), 200);
      setWizardMode(false);
      setWizardType(null);
      setIsOpen(false);
    }
    return;
  }

  // ---- Upload Folder (images only) wizard ----
  if (wizardType === 'upload-folder') {
    if (step === 'uf-done') {
      requestReopen?.();
      setTimeout(() => clickSidebarItem('Management'), 200);
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

      // Step 2 — fill batch name in modal, then click Continue
      setTimeout(() => {
        const modalInput = document.querySelector('.ant-modal input, [role="dialog"] input');
        if (modalInput) {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeSetter.call(modalInput, batchName);
          modalInput.dispatchEvent(new Event('input', { bubbles: true }));
          modalInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
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
      requestReopen?.();
      setTimeout(() => clickSidebarItem('Management'), 200);
      setWizardMode(false);
      setWizardType(null);
      setIsOpen(false);
    }
    return;
  }
}
