/**
 * GuideBot.jsx — Floating AI Guide Bot
 *
 * Always visible on every page.
 * - Minimized: animated robot floats bottom-right
 * - Open: chat panel slides up, robot hides behind it
 *
 * Watches current URL → loads the correct script automatically.
 * All text is pre-scripted (no LLM). English + Italian.
 */

import React, { useState, useEffect } from 'react';
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
// Main component
// ---------------------------------------------------------------------------

const MAIN_PAGES = ['/', '/projects', '/models'];

const BUBBLE_TEXT = {
  en: {
    '/':        'Need help?',
    '/projects': 'Need help?',
    '/models':   'Explore Models',
    'default':   'Need help?',
  },
  it: {
    '/':        'Hai bisogno di aiuto?',
    '/projects': 'Hai bisogno di aiuto?',
    '/models':   'Esplora i Modelli',
    'default':   'Hai bisogno di aiuto?',
  },
};

export default function GuideBot() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMainPage = MAIN_PAGES.includes(location.pathname);

  const [isOpen, setIsOpen] = useState(false);
  const [lang, setLang] = useState('en');  // 'en' or 'it'
  const [scriptKey, setScriptKey] = useState('/');
  const [history, setHistory] = useState([]);  // for back navigation

  // When URL changes → update script key and reset to page root script
  useEffect(() => {
    const key = getScriptKey(location.pathname);
    setScriptKey(key);
    setHistory([]);
  }, [location.pathname]);

  const currentScript = guideScript[scriptKey] || guideScript['fallback'];

  // ---- Action handler ----
  function handleAction(action) {
    if (action.type === 'navigate') {
      navigate(action.path);
      setIsOpen(false);
    } else if (action.type === 'click') {
      // Try to click the element on the page
      try {
        const el = document.querySelector(action.selector);
        if (el) {
          el.click();
          setIsOpen(false);
        }
      } catch (e) {
        // Selector not found — just close
        setIsOpen(false);
      }
    } else if (action.type === 'message') {
      // Push current key to history then navigate to sub-message
      setHistory(prev => [...prev, scriptKey]);
      setScriptKey(action.key);
    }
  }

  // ---- Back button ----
  function handleBack() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setScriptKey(prev);
  }

  // ---- Text helper ----
  function t(textObj) {
    return textObj?.[lang] || textObj?.en || '';
  }

  return (
    <div className="guide-bot-wrapper">

      {/* CHAT PANEL — shown when open */}
      {isOpen && (
        <div className="guide-bot-panel">

          {/* Header */}
          <div className="guide-bot-header">
            <div className="guide-bot-header-left">
              <Lottie
                animationData={robotAnimation}
                loop={true}
                className="guide-bot-header-avatar"
              />
              <span className="guide-bot-header-title">Gevis Guide</span>
            </div>
            <div className="guide-bot-header-right">
              {/* Language toggle */}
              <div className="guide-bot-lang">
                <button
                  className={lang === 'en' ? 'active' : ''}
                  onClick={() => setLang('en')}
                >
                  EN
                </button>
                <button
                  className={lang === 'it' ? 'active' : ''}
                  onClick={() => setLang('it')}
                >
                  IT
                </button>
              </div>
              {/* Minimize */}
              <button
                className="guide-bot-minimize"
                onClick={() => setIsOpen(false)}
                title="Minimize"
              >
                &#8722;
              </button>
            </div>
          </div>

          {/* Message bubble */}
          <div className="guide-bot-message-area">
            <div className="guide-bot-bubble">
              {t(currentScript.message)}
            </div>
          </div>

          {/* Option buttons */}
          <div className="guide-bot-options">
            {currentScript.options.map((opt, i) => (
              <button
                key={i}
                className="guide-bot-option-btn"
                onClick={() => handleAction(opt.action)}
              >
                {t(opt.label)}
              </button>
            ))}
          </div>

          {/* Footer — back button */}
          {history.length > 0 && (
            <div className="guide-bot-footer">
              <button className="guide-bot-back-btn" onClick={handleBack}>
                &#8592; {lang === 'it' ? 'Indietro' : 'Back'}
              </button>
            </div>
          )}

        </div>
      )}

      {/* ROBOT — shown when minimized, hides when panel is open */}
      {!isOpen && (
        <div
          className={`guide-bot-robot-container${isMainPage ? ' guide-bot-large' : ''}`}
          onClick={() => setIsOpen(true)}
          title="Open Guide"
        >
          {/* Custom speech bubble — always visible on dark background */}
          <div className="guide-bot-hello-bubble">
            {(BUBBLE_TEXT[lang] || BUBBLE_TEXT['en'])[location.pathname] || (BUBBLE_TEXT[lang] || BUBBLE_TEXT['en'])['default']}
          </div>
          <div className="guide-bot-robot">
            <Lottie
              animationData={robotAnimation}
              loop={true}
            />
          </div>
        </div>
      )}

    </div>
  );
}
