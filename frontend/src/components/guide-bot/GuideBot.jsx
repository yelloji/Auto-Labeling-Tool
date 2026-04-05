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
import { checkDatasetPageState, handleDatasetAnswer } from './pages/datasetBot';
import { checkAnalyticsPageState, handleAnalyticsAnswer } from './pages/analyticsBot';
import { checkLocalModelPageState, handleLocalModelAnswer, startLocalUploadModelWizard } from './pages/localModelBot';
import { checkReleasePageState, handleReleaseAnswer } from './pages/releaseBot';
import { checkTrainingPageState, handleTrainingAnswer } from './pages/trainingBot';
import { checkModelLabPageState, handleModelLabAnswer } from './pages/modellabBot';


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
  const wrapperRef             = useRef(null);
  const panelRef               = useRef(null);
  const scrollRef              = useRef(null);
  const observerRef            = useRef(null);
  const processingObserverRef  = useRef(null);
  const isOpenRef              = useRef(false);
  const pendingReopenRef       = useRef(false);
  const wizardTypeRef          = useRef(null);
  const currentWorkspaceSectionRef = useRef('/workspace/upload');
  const dragStateRef           = useRef({ active: false, offsetX: 0, offsetY: 0, moved: false, startX: 0, startY: 0 });
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
  const [botPosition,  setBotPosition]  = useState(null);
  const [openPosition, setOpenPosition] = useState(null);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    wizardTypeRef.current = wizardType;
  }, [wizardType]);

  useEffect(() => {
    if (!isOpen) {
      setOpenPosition(null);
      return;
    }

    const adjustOpenPosition = () => {
      const wrapperEl = wrapperRef.current;
      const panelEl = panelRef.current;
      if (!wrapperEl || !panelEl) return;

      const wrapperRect = wrapperEl.getBoundingClientRect();
      const panelRect = panelEl.getBoundingClientRect();
      const currentX = botPosition?.x ?? wrapperRect.left;
      const currentY = botPosition?.y ?? wrapperRect.top;
      const padding = 16;

      const maxX = Math.max(padding, window.innerWidth - panelRect.width - padding);
      const maxY = Math.max(padding, window.innerHeight - panelRect.height - padding);

      const nextX = Math.min(Math.max(padding, currentX), maxX);
      const nextY = Math.min(Math.max(padding, currentY), maxY);

      setOpenPosition({ x: nextX, y: nextY });
    };

    adjustOpenPosition();
    const resizeObserver = new ResizeObserver(() => {
      adjustOpenPosition();
    });
    if (panelRef.current) resizeObserver.observe(panelRef.current);
    window.addEventListener('resize', adjustOpenPosition);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', adjustOpenPosition);
    };
  }, [isOpen, botPosition]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const drag = dragStateRef.current;
      if (!drag.active || isOpenRef.current) return;

      const wrapperEl = wrapperRef.current;
      if (!wrapperEl) return;

      const wrapperRect = wrapperEl.getBoundingClientRect();
      const nextX = e.clientX - drag.offsetX;
      const nextY = e.clientY - drag.offsetY;
      const maxX = Math.max(16, window.innerWidth - wrapperRect.width - 16);
      const maxY = Math.max(16, window.innerHeight - wrapperRect.height - 16);

      const boundedX = Math.min(Math.max(16, nextX), maxX);
      const boundedY = Math.min(Math.max(16, nextY), maxY);

      if (Math.abs(e.clientX - drag.startX) > 6 || Math.abs(e.clientY - drag.startY) > 6) {
        drag.moved = true;
      }

      setBotPosition({ x: boundedX, y: boundedY });
    };

    const handleMouseUp = () => {
      if (!dragStateRef.current.active) return;
      dragStateRef.current.active = false;
      setTimeout(() => {
        dragStateRef.current.moved = false;
      }, 0);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

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
      const shouldReopen = isOpenRef.current || pendingReopenRef.current;
      if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
      if (processingObserverRef.current) { processingObserverRef.current.disconnect(); processingObserverRef.current = null; }
      // Update ref immediately — do not wait for React state effect.
      // This prevents race conditions where mounted section components fire
      // state events before setIsOpen(false) has propagated to isOpenRef.
      isOpenRef.current = false;
      pendingReopenRef.current = false;
      wizardTypeRef.current = null;
      setIsOpen(false);
      setWizardMode(false);
      setWizardType(null);
      setConversation([]);
      setWizardStep(null);
      const section = e.detail?.section;
      if (section && SECTION_SCRIPT[section]) {
        currentWorkspaceSectionRef.current = SECTION_SCRIPT[section];
      }
      if (section !== 'model-training') window.__trainingGuideState = undefined;
      if (section !== 'model-lab') window.__modellabGuideState = undefined;
      if (section && SECTION_SCRIPT[section]) setScriptKey(SECTION_SCRIPT[section]);
      // Reopen only if the bot was already open before the section switch.
      // Closed bots must stay closed; open bots should follow the user into the new section.
      if (shouldReopen) {
        pendingReopenRef.current = false;
        setTimeout(() => reopenForCurrentContext(location.pathname, section), 200);
      }
    };
    window.addEventListener('workspaceSectionChanged', handler);
    return () => window.removeEventListener('workspaceSectionChanged', handler);
  }, [location.pathname, lang]);

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
        }, 200);
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

  useEffect(() => {
    const handler = (e) => {
      if (!location.pathname.includes('/workspace')) return;
      if (detectWorkspaceSection() !== '/workspace/analytics') return;

      const forceRefresh = !!e.detail?.forceRefresh;
      const shouldRefresh = isOpenRef.current || pendingReopenRef.current || forceRefresh;
      if (!shouldRefresh) return;

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
        const analyticsState = checkAnalyticsPageState(lang, r, s);
        if (analyticsState) {
          pendingReopenRef.current = false;
          applyWizardState(analyticsState);
        } else if (forceRefresh) {
          pendingReopenRef.current = false;
          setIsOpen(true);
        }
      }, 180);
    };

    window.addEventListener('analyticsGuideStateChanged', handler);
    return () => window.removeEventListener('analyticsGuideStateChanged', handler);
  }, [location.pathname, lang]);

  useEffect(() => {
    const handler = (e) => {
      if (!location.pathname.includes('/workspace')) return;
      if (detectWorkspaceSection() !== '/workspace/models') return;

      const localModelsGuideState = window.__localModelsGuideState || {};
      if (wizardType === 'local-upload-model' && localModelsGuideState.uploadModalVisible && !e.detail?.forceRefresh) return;

      const forceRefresh = !!e.detail?.forceRefresh;
      const shouldRefresh = isOpenRef.current || pendingReopenRef.current || forceRefresh;
      if (!shouldRefresh) return;

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
        const localModelsState = checkLocalModelPageState(lang, r, s);
        if (localModelsState) {
          pendingReopenRef.current = false;
          applyWizardState(localModelsState);
        } else if (forceRefresh) {
          pendingReopenRef.current = false;
          setIsOpen(true);
        }
      }, 180);
    };

    window.addEventListener('localModelsGuideStateChanged', handler);
    return () => window.removeEventListener('localModelsGuideStateChanged', handler);
  }, [location.pathname, lang, wizardType]);

  useEffect(() => {
    const handler = (e) => {
      if (!location.pathname.includes('/workspace')) return;
      if (detectWorkspaceSection() !== '/workspace/versions') return;

      const forceRefresh = !!e.detail?.forceRefresh;
      const shouldRefresh = isOpenRef.current || pendingReopenRef.current || forceRefresh;
      if (!shouldRefresh) return;

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
        const releaseState = checkReleasePageState(lang, r, s);
        if (releaseState) {
          pendingReopenRef.current = false;
          applyWizardState(releaseState);
        } else if (forceRefresh) {
          pendingReopenRef.current = false;
          setIsOpen(true);
        }
      }, 180);
    };

    window.addEventListener('releaseGuideStateChanged', handler);
    return () => window.removeEventListener('releaseGuideStateChanged', handler);
  }, [location.pathname, lang]);

  useEffect(() => {
    const handler = (e) => {
      if (!location.pathname.includes('/workspace')) return;
      if (getActiveWorkspaceSection() !== '/workspace/model-training') return;

      const forceRefresh = !!e.detail?.forceRefresh;
      const shouldRefresh = isOpenRef.current || pendingReopenRef.current || forceRefresh;
      if (!shouldRefresh) return;

      const s = makeSetters();
      const r = makeRefs();
      const trainingState = checkTrainingPageState(lang, r, s);

      if (isOpenRef.current && trainingState) {
        pendingReopenRef.current = false;
        const typeChanged = trainingState.wizardType !== wizardTypeRef.current;
        if (forceRefresh || typeChanged) {
          setWizardMode(true);
          setWizardType(trainingState.wizardType);
          setConversation(trainingState.conversation);
          setWizardStep(trainingState.step);
        }
        return;
      }

      if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
      if (processingObserverRef.current) { processingObserverRef.current.disconnect(); processingObserverRef.current = null; }
      setIsOpen(false);
      setWizardMode(false);
      setWizardType(null);
      setConversation([]);
      setWizardStep(null);

      setTimeout(() => {
        if (trainingState) {
          pendingReopenRef.current = false;
          applyWizardState(trainingState);
        } else if (forceRefresh) {
          pendingReopenRef.current = false;
          setIsOpen(true);
        }
      }, 180);
    };

    window.addEventListener('trainingGuideStateChanged', handler);
    return () => window.removeEventListener('trainingGuideStateChanged', handler);
  }, [location.pathname, lang]);

  useEffect(() => {
    const handler = (e) => {
      if (!location.pathname.includes('/workspace')) return;
      if (getActiveWorkspaceSection() !== '/workspace/model-lab') return;

      const forceRefresh = !!e.detail?.forceRefresh;
      // Model Lab should not auto-open from a stale cross-section reopen flag.
      // It should refresh only when already open or when the page explicitly forces it.
      if (pendingReopenRef.current && !isOpenRef.current && !forceRefresh) {
        pendingReopenRef.current = false;
      }
      const shouldRefresh = isOpenRef.current || forceRefresh;
      if (!shouldRefresh) return;

      const s = makeSetters();
      const r = makeRefs();
      const modelLabState = checkModelLabPageState(lang, r, s);

      if (isOpenRef.current && modelLabState) {
        pendingReopenRef.current = false;
        const typeChanged = modelLabState.wizardType !== wizardTypeRef.current;
        if (forceRefresh || typeChanged) {
          setWizardMode(true);
          setWizardType(modelLabState.wizardType);
          setConversation(modelLabState.conversation);
          setWizardStep(modelLabState.step);
        }
        return;
      }

      if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
      if (processingObserverRef.current) { processingObserverRef.current.disconnect(); processingObserverRef.current = null; }
      setIsOpen(false);
      setWizardMode(false);
      setWizardType(null);
      setConversation([]);
      setWizardStep(null);

      setTimeout(() => {
        if (modelLabState) {
          pendingReopenRef.current = false;
          applyWizardState(modelLabState);
        } else if (forceRefresh) {
          pendingReopenRef.current = false;
          setIsOpen(true);
        }
      }, 180);
    };

    window.addEventListener('modellabGuideStateChanged', handler);
    return () => window.removeEventListener('modellabGuideStateChanged', handler);
  }, [location.pathname, lang]);

  // When URL changes → close bot and reset everything
  // Bot must be closed so the next open triggers a fresh snapshot check for the new page
  useEffect(() => {
    const key = getScriptKey(location.pathname);
    const shouldReopen = isOpenRef.current || pendingReopenRef.current;
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
    if (shouldReopen) {
      pendingReopenRef.current = false;
      setTimeout(() => reopenForCurrentContext(location.pathname), 220);
    }
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
      requestReopen: () => { pendingReopenRef.current = true; },
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

  function closeBotManually() {
    pendingReopenRef.current = false;
    isOpenRef.current = false;
    setIsOpen(false);
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

  function getActiveWorkspaceSection() {
    return currentWorkspaceSectionRef.current || detectWorkspaceSection();
  }

  function applyWorkspaceSnapshotForSection(section, lang, refs, setters) {
    if (section === '/workspace/upload') {
      const uploadState = checkUploadPageState(lang, refs, setters);
      if (uploadState) { applyWizardState(uploadState); return true; }
      return false;
    }

    if (section === '/workspace/management') {
      const mgmtState = checkManagementPageState(lang, refs, setters);
      if (mgmtState) { applyWizardState(mgmtState); return true; }
      return false;
    }

    if (section === '/workspace/dataset') {
      const datasetState = checkDatasetPageState(lang, refs, setters);
      if (datasetState) { applyWizardState(datasetState); return true; }
      return false;
    }

    if (section === '/workspace/analytics') {
      const analyticsState = checkAnalyticsPageState(lang, refs, setters);
      if (analyticsState) { applyWizardState(analyticsState); return true; }
      return false;
    }

    if (section === '/workspace/models') {
      const localModelsState = checkLocalModelPageState(lang, refs, setters);
      if (localModelsState) { applyWizardState(localModelsState); return true; }
      return false;
    }

    if (section === '/workspace/versions') {
      const releaseState = checkReleasePageState(lang, refs, setters);
      if (releaseState) { applyWizardState(releaseState); return true; }
      return false;
    }

    if (section === '/workspace/model-training') {
      const trainingState = checkTrainingPageState(lang, refs, setters);
      if (trainingState) { applyWizardState(trainingState); return true; }
      return false;
    }

    if (section === '/workspace/model-lab') {
      const modelLabState = checkModelLabPageState(lang, refs, setters);
      if (modelLabState) { applyWizardState(modelLabState); return true; }
      return false;
    }

    return false;
  }

  function reopenForCurrentContext(pathname = location.pathname, sectionOverride = null) {
    const s = makeSetters();
    const r = makeRefs();

    if (pathname.includes('/workspace')) {
      const sectionMap = {
        'upload': '/workspace/upload',
        'management': '/workspace/management',
        'dataset': '/workspace/dataset',
        'versions': '/workspace/versions',
        'analytics': '/workspace/analytics',
        'models': '/workspace/models',
        'model-training': '/workspace/model-training',
        'model-lab': '/workspace/model-lab',
        'deployments': '/workspace/deployments',
        'active-learning': '/workspace/active-learning',
      };

      const nextScriptKey = sectionOverride
        ? (sectionMap[sectionOverride] || '/workspace/upload')
        : getActiveWorkspaceSection();

      setScriptKey(nextScriptKey);
      if (applyWorkspaceSnapshotForSection(nextScriptKey, lang, r, s)) return;

      setIsOpen(true);
      return;
    }

    if (pathname.startsWith('/annotate-progress/')) {
      const progressState = checkAnnotateProgressPageState(lang, r, s);
      if (progressState) { applyWizardState(progressState); return; }
      setIsOpen(true);
      return;
    }

    if (pathname.startsWith('/annotate-launcher/')) {
      setScriptKey('/annotate-launcher');
      setIsOpen(true);
      return;
    }

    if (pathname.startsWith('/annotate/')) {
      const manualLabelingState = checkManualLabelingPageState(lang, r, s);
      if (manualLabelingState) { applyWizardState(manualLabelingState); return; }
      setIsOpen(true);
      return;
    }

    setScriptKey(getScriptKey(pathname));
    setIsOpen(true);
  }

  // ---- Handle robot click — snapshot check first, then open ----
  function handleBotOpen() {
    if (dragStateRef.current.moved) return;

    if (location.pathname.includes('/workspace')) {
      // Sync scriptKey to the actual active section so Cancel shows the right script
      const activeSection = getActiveWorkspaceSection();
      setScriptKey(activeSection);
      const s = makeSetters();
      const r = makeRefs();
      if (applyWorkspaceSnapshotForSection(activeSection, lang, r, s)) return;
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

  function handleRobotMouseDown(e) {
    if (isOpen || e.button !== 0) return;

    const wrapperEl = wrapperRef.current;
    if (!wrapperEl) return;

    const wrapperRect = wrapperEl.getBoundingClientRect();
    dragStateRef.current = {
      active: true,
      offsetX: e.clientX - wrapperRect.left,
      offsetY: e.clientY - wrapperRect.top,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
    };

    if (!botPosition) {
      setBotPosition({
        x: wrapperRect.left,
        y: wrapperRect.top,
      });
    }
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

    if (wizardType && wizardType.startsWith('dataset-')) {
      handleDatasetAnswer(step, value, lang, r, s);
      return;
    }

    if (wizardType && wizardType.startsWith('analytics-')) {
      handleAnalyticsAnswer(step, value, lang, r, s);
      return;
    }

    if (wizardType && wizardType.startsWith('local-models-')) {
      handleLocalModelAnswer(step, value, lang, r, s, wizardData, setWizardData, isOnnx, setIsOnnx);
      return;
    }

    if (wizardType && wizardType.startsWith('release-')) {
      handleReleaseAnswer(step, value, lang, r, s);
      return;
    }

    if (wizardType && wizardType.startsWith('training-')) {
      handleTrainingAnswer(step, value, lang, r, s);
      return;
    }

    if (wizardType && wizardType.startsWith('modellab-')) {
      handleModelLabAnswer(step, value, lang, r, s);
      return;
    }

    if (wizardType === 'local-upload-model') {
      handleLocalModelAnswer(step, value, lang, r, s, wizardData, setWizardData, isOnnx, setIsOnnx);
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
      pendingReopenRef.current = true;
      navigate(action.path);
      setIsOpen(false);
    } else if (action.type === 'wizard') {
      switch (action.wizard) {
        case 'upload-model':         startUploadModelWizard(lang, s);              break;
        case 'local-upload-model':   startLocalUploadModelWizard(lang, s);         break;
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
        pendingReopenRef.current = true;
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
        else {
          pendingReopenRef.current = false;
          setIsOpen(false);
        }
      } catch (e) {
        pendingReopenRef.current = false;
        setIsOpen(false);
      }
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
          wizardType === 'annotate-progress-split' ||
          wizardType === 'management-overview' || wizardType === 'management-annotating' ||
          wizardType === 'management-completed' || wizardType === 'management-empty' ||
          wizardType === 'management-unassigned' ||
          (wizardType && wizardType.startsWith('dataset-')) ||
          (wizardType && wizardType.startsWith('analytics-')) ||
          (wizardType && wizardType.startsWith('local-models-')) ||
          (wizardType && wizardType.startsWith('release-')) ||
          (wizardType && wizardType.startsWith('training-')) ||
          (wizardType && wizardType.startsWith('modellab-')) ||
          wizardType === 'local-upload-model' ||
          (wizardType && wizardType.startsWith('manual-labeling-'))) {
        pendingReopenRef.current = false;
        isOpenRef.current = false;
        wizardTypeRef.current = null;
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

  const wrapperPositionStyle = isOpen
    ? (openPosition ? { top: openPosition.y, left: openPosition.x, right: 'auto', bottom: 'auto' } : undefined)
    : (botPosition ? { top: botPosition.y, left: botPosition.x, right: 'auto', bottom: 'auto' } : undefined);

  return (
    <div
      ref={wrapperRef}
      className="guide-bot-wrapper"
      style={wrapperPositionStyle}
    >

      {/* CHAT PANEL */}
      {isOpen && (
        <div ref={panelRef} className="guide-bot-panel">

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
              <button className="guide-bot-minimize" onClick={closeBotManually} title="Minimize">&#8722;</button>
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
          onMouseDown={handleRobotMouseDown}
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
