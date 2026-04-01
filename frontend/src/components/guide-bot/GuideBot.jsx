/**
 * GuideBot.jsx — Floating AI Guide Bot (main component)
 *
 * This file is intentionally thin — it owns state and render only.
 * All page-specific logic lives in pages/:
 *   uploadBot.js     — upload page wizards + snapshot check
 *   modelBot.js      — upload model wizard
 *   projectBot.js    — create project wizard
 *   managementBot.js — management page + bidirectional sync
 *
 * Two display modes:
 *   Script mode  — shows pre-written messages + option buttons per page
 *   Wizard mode  — scrollable conversation, fills form fields programmatically
 */

import React, { useState, useEffect, useRef } from 'react';
import Lottie from 'lottie-react';
import { useLocation, useNavigate } from 'react-router-dom';
import robotAnimation from '../../assets/robot-hello.json';
import guideScript from './guideScript';
import './GuideBot.css';

import { checkUploadPageState, startUploadFilesWizard, startUploadFolderWizard,
         startUploadFolderLabelsWizard, startUploadVideoWizard, handleUploadAnswer } from './pages/uploadBot';
import { startUploadModelWizard, handleModelAnswer } from './pages/modelBot';
import { startCreateProjectWizard, handleCreateProjectAnswer } from './pages/projectBot';
import { checkManagementPageState, handleManagementAnswer } from './pages/managementBot';
import { checkAnnotateProgressPageState, handleAnnotateProgressAnswer } from './pages/annotateProgressBot';
import { checkManualLabelingPageState, handleManualLabelingAnswer } from './pages/manualLabelingBot';


// ---------------------------------------------------------------------------
// Route → script key mapping
// ---------------------------------------------------------------------------
function getScriptKey(pathname) {
  if (pathname === '/') return '/';
  if (pathname === '/projects') return '/projects';
  if (pathname === '/models') return '/models';
  if (pathname.startsWith('/projects/') && pathname.includes('/workspace')) {
    return '/workspace/upload';
  }
  if (pathname.startsWith('/annotate-progress/')) return '/annotate-progress';
  if (pathname.startsWith('/annotate-launcher/')) return '/annotate-launcher';
  if (pathname.startsWith('/annotate/')) return '/annotate';
  return 'fallback';
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
  const location               = useLocation();
  const navigate               = useNavigate();
  const scrollRef              = useRef(null);
  const observerRef            = useRef(null);
  const processingObserverRef  = useRef(null);
  const isMainPage             = MAIN_PAGES.includes(location.pathname);

  const [isOpen,       setIsOpen]       = useState(false);
  const [lang,         setLang]         = useState('en');
  const [scriptKey,    setScriptKey]    = useState('/');
  const [history,      setHistory]      = useState([]);

  // Wizard state
  const [wizardMode,   setWizardMode]   = useState(false);
  const [wizardType,   setWizardType]   = useState(null);
  const [conversation, setConversation] = useState([]);
  const [wizardStep,   setWizardStep]   = useState(null);
  const [wizardData,   setWizardData]   = useState({});
  const [textInput,    setTextInput]    = useState('');
  const [isOnnx,       setIsOnnx]       = useState(false);

  // When workspace sidebar section changes → close bot
  // Section changes don't change the URL, so we listen for the custom event fired by ProjectWorkspace
  useEffect(() => {
    const SECTION_SCRIPT = {
      'upload':          '/workspace/upload',
      'management':      '/workspace/management',
      'dataset':         '/workspace/dataset',
      'versions':        '/workspace/versions',
      'analytics':       '/workspace/analytics',
      'models':          '/workspace/models',
      'model-training':  '/workspace/model-training',
      'model-lab':       '/workspace/model-lab',
      'deployments':     '/workspace/deployments',
      'active-learning': '/workspace/active-learning',
    };
    const handler = (e) => {
      if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
      if (processingObserverRef.current) { processingObserverRef.current.disconnect(); processingObserverRef.current = null; }
      setIsOpen(false);
      setWizardMode(false);
      setWizardType(null);
      setConversation([]);
      setWizardStep(null);
      const section = e.detail?.section;
      if (section && SECTION_SCRIPT[section]) setScriptKey(SECTION_SCRIPT[section]);
    };
    window.addEventListener('workspaceSectionChanged', handler);
    return () => window.removeEventListener('workspaceSectionChanged', handler);
  }, []);

  // When any upload completes via UI → open bot with result snapshot (bidirectional sync)
  useEffect(() => {
    const handler = () => {
      if (!location.pathname.includes('/workspace')) return;
      setTimeout(() => {
        const s = makeSetters();
        const r = makeRefs();
        const uploadState = checkUploadPageState(lang, r, s);
        if (uploadState) applyWizardState(uploadState);
      }, 400);
    };
    window.addEventListener('uploadComplete', handler);
    window.addEventListener('uploadImportComplete', handler);
    return () => {
      window.removeEventListener('uploadComplete', handler);
      window.removeEventListener('uploadImportComplete', handler);
    };
  }, [location.pathname, lang]);

  // When a Management column operation completes → close and auto-reopen with fresh snapshot if bot was open
  useEffect(() => {
    const handler = () => {
      if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
      if (processingObserverRef.current) { processingObserverRef.current.disconnect(); processingObserverRef.current = null; }
      const wasOpen = isOpen;
      setIsOpen(false);
      setWizardMode(false);
      setWizardType(null);
      setConversation([]);
      setWizardStep(null);
      if (wasOpen) {
        setTimeout(() => {
          const s = makeSetters();
          const r = makeRefs();
          const mgmtState = checkManagementPageState(lang, r, s);
          if (mgmtState) applyWizardState(mgmtState);
        }, 400);
      }
    };
    window.addEventListener('managementOperationDone', handler);
    return () => window.removeEventListener('managementOperationDone', handler);
  }, [isOpen, lang]);

  useEffect(() => {
    const handler = (e) => {
      if (!location.pathname.startsWith('/annotate/')) return;
      const forceRefresh = !!e.detail?.forceRefresh;
      if (!isOpen && !forceRefresh) return;

      if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
      if (processingObserverRef.current) { processingObserverRef.current.disconnect(); processingObserverRef.current = null; }
      setIsOpen(false);
      setWizardMode(false);
      setWizardType(null);
      setConversation([]);
      setWizardStep(null);

      setTimeout(() => {
        const s = makeSetters();
        const r = makeRefs();
        const manualLabelingState = checkManualLabelingPageState(lang, r, s);
        if (manualLabelingState) applyWizardState(manualLabelingState);
        else if (forceRefresh) setIsOpen(true);
      }, 180);
    };

    window.addEventListener('manualLabelingStateChanged', handler);
    window.addEventListener('manualLabelingGuideRefresh', handler);
    return () => {
      window.removeEventListener('manualLabelingStateChanged', handler);
      window.removeEventListener('manualLabelingGuideRefresh', handler);
    };
  }, [location.pathname, isOpen, lang]);

  // When URL changes → close bot and reset everything
  // Bot must be closed so the next open triggers a fresh snapshot check for the new page
  useEffect(() => {
    const key = getScriptKey(location.pathname);
    setScriptKey(key);
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
    if (processingObserverRef.current) { processingObserverRef.current.disconnect(); processingObserverRef.current = null; }
    setIsOpen(false);
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

  // ---- Build setters object — passed to all page handler functions ----
  function makeSetters() {
    return {
      setIsOpen, setWizardMode, setWizardType, setConversation,
      setWizardStep, setWizardData, setTextInput, setIsOnnx,
      setScriptKey, addMessage,
    };
  }

  // ---- Build refs object — passed to all page handler functions ----
  function makeRefs() {
    return { observerRef, processingObserverRef };
  }

  // ---- Apply a wizard state returned by a snapshot check ----
  function applyWizardState(state) {
    setWizardMode(true);
    setWizardType(state.wizardType);
    setConversation(state.conversation);
    setWizardStep(state.step);
    setIsOpen(true);
  }

  // ---- Detect active workspace section from sidebar DOM ----
  function detectWorkspaceSection() {
    const LABEL_MAP = {
      'Upload Data':      '/workspace/upload',
      'Management':       '/workspace/management',
      'Dataset':          '/workspace/dataset',
      'RELEASE':          '/workspace/versions',
      'Analytics':        '/workspace/analytics',
      'Models':           '/workspace/models',
      'Model Training':   '/workspace/model-training',
      'Model Lab':        '/workspace/model-lab',
      'Deployments':      '/workspace/deployments',
      'Active Learning':  '/workspace/active-learning',
    };
    const activeItem = document.querySelector('.ant-menu-item-selected');
    if (activeItem) {
      const text = activeItem.textContent.trim();
      if (LABEL_MAP[text]) return LABEL_MAP[text];
    }
    return '/workspace/upload';
  }

  // ---- Handle robot click — snapshot check first, then open ----
  function handleBotOpen() {
    if (location.pathname.includes('/workspace')) {
      // Sync scriptKey to the actual active section so Cancel shows the right script
      setScriptKey(detectWorkspaceSection());
      const s = makeSetters();
      const r = makeRefs();

      // Check Upload page state first
      const uploadState = checkUploadPageState(lang, r, s);
      if (uploadState) { applyWizardState(uploadState); return; }

      // Check Management page state
      const mgmtState = checkManagementPageState(lang, r, s);
      if (mgmtState) { applyWizardState(mgmtState); return; }
    }

    if (location.pathname.startsWith('/annotate-progress/')) {
      const s = makeSetters();
      const r = makeRefs();
      const progressState = checkAnnotateProgressPageState(lang, r, s);
      if (progressState) { applyWizardState(progressState); return; }
    }

    if (location.pathname.startsWith('/annotate/')) {
      const s = makeSetters();
      const r = makeRefs();
      const manualLabelingState = checkManualLabelingPageState(lang, r, s);
      if (manualLabelingState) { applyWizardState(manualLabelingState); return; }
    }

    setIsOpen(true);
  }

  // ---- Handle wizard button/text answers ----
  function handleWizardAnswer(value, step) {
    addMessage('user', value);
    setTextInput('');

    const s = makeSetters();
    const r = makeRefs();

    if (wizardType === 'create-project') {
      handleCreateProjectAnswer(step, value, lang, s);
      return;
    }

    if (wizardType === 'upload-model') {
      handleModelAnswer(step, value, lang, s, wizardData, setWizardData, isOnnx, setIsOnnx);
      return;
    }

    if (wizardType === 'upload-video-files' || wizardType === 'upload-video-folder' ||
        wizardType === 'upload-files'       || wizardType === 'upload-folder'       ||
        wizardType === 'upload-folder-labels') {
      handleUploadAnswer(wizardType, step, value, lang, r, s);
      return;
    }

    if (wizardType === 'management-overview'   || wizardType === 'management-annotating' ||
        wizardType === 'management-completed'  || wizardType === 'management-empty'      ||
        wizardType === 'management-unassigned') {
      handleManagementAnswer(step, value, lang, r, s);
      return;
    }

    if (wizardType === 'annotate-progress-complete' || wizardType === 'annotate-progress-incomplete' ||
        wizardType === 'annotate-progress-split') {
      handleAnnotateProgressAnswer(step, value, lang, r, s);
      return;
    }

    if (wizardType && wizardType.startsWith('manual-labeling-')) {
      handleManualLabelingAnswer(step, value, lang, r, s);
      return;
    }
  }

  // ---- Handle file selection in model upload wizard ----
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
    const s = makeSetters();
    const r = makeRefs();

    if (action.type === 'navigate') {
      navigate(action.path);
      setIsOpen(false);
    } else if (action.type === 'wizard') {
      switch (action.wizard) {
        case 'upload-model':         startUploadModelWizard(lang, s);              break;
        case 'create-project':       startCreateProjectWizard(lang, s);            break;
        case 'upload-files':         startUploadFilesWizard(lang, s);              break;
        case 'upload-folder':        startUploadFolderWizard(lang, r, s);          break;
        case 'upload-folder-labels': startUploadFolderLabelsWizard(lang, s);       break;
        case 'upload-video-files':   startUploadVideoWizard('files', lang, r, s);  break;
        case 'upload-video-folder':  startUploadVideoWizard('folder', lang, r, s); break;
        default: break;
      }
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

  // ---- Back / Cancel button ----
  function handleBack() {
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
    if (processingObserverRef.current) { processingObserverRef.current.disconnect(); processingObserverRef.current = null; }
    if (wizardMode) {
      if (wizardType === 'annotate-progress-complete' || wizardType === 'annotate-progress-incomplete' ||
          wizardType === 'annotate-progress-split' || (wizardType && wizardType.startsWith('manual-labeling-'))) {
        setWizardMode(false);
        setWizardType(null);
        setConversation([]);
        setIsOpen(false);
        return;
      }
      setWizardMode(false);
      setWizardType(null);
      setConversation([]);
      return;
    }
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

              {/* Back / Cancel */}
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
          onClick={handleBotOpen} title="Open Guide">
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
