/**
 * analyticsBot.js - Analytics section logic for the guide bot.
 *
 * First snapshot-based version:
 *   1. Loading
 *   2. No labels state
 *   3. Main analytics overview
 *   4. Label management modal open
 *
 * Main role:
 *   explain the page clearly, then guide the user into safe label management.
 */

function getAnalyticsContainer() {
  return Array.from(document.querySelectorAll('div'))
    .find(el => el.textContent.includes('Project Analytics') && el.textContent.includes('Project Overview'));
}

function isAnalyticsPage() {
  const title = Array.from(document.querySelectorAll('div, span, h1, h2, h3'))
    .find(el => el.textContent.trim() === 'Project Analytics');
  return !!title;
}

function isAnalyticsLoading() {
  const state = window.__analyticsGuideState;
  if (typeof state?.loading === 'boolean') {
    return state.loading;
  }

  return !!Array.from(document.querySelectorAll('div, span, p'))
    .find(el => el.textContent.trim() === 'Loading project analytics...');
}

function isLabelModalOpen() {
  const state = window.__analyticsGuideState;
  if (typeof state?.labelModalVisible === 'boolean') {
    return state.labelModalVisible;
  }

  return !!Array.from(document.querySelectorAll('.ant-modal-wrap'))
    .find(el => {
      const style = window.getComputedStyle(el);
      const visible = style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        !el.classList.contains('ant-modal-wrap-hidden');
      return visible && el.textContent.includes('Manage Project Labels');
    });
}

function hasLabelsOverview() {
  return !!Array.from(document.querySelectorAll('div, span, h1, h2, h3'))
    .find(el => el.textContent.trim() === 'Labels Overview');
}

function openLabelManagement() {
  const btn = Array.from(document.querySelectorAll('button'))
    .find(button => button.textContent.trim() === 'Create/Edit Labels');
  if (btn) btn.click();
}

function getHowLabel(lang) {
  return lang === 'it' ? 'Come leggo questa pagina?' : 'How do I read this page?';
}

function getLearnLabel(lang) {
  return lang === 'it' ? 'Cosa posso capire da qui?' : 'What can I learn from this page?';
}

function getManageLabelsLabel(lang) {
  return lang === 'it' ? 'Gestisci Etichette Progetto' : 'Manage Project Labels';
}

function getBackLabel(lang) {
  return lang === 'it' ? 'Indietro' : 'Back';
}

function getProjectOverviewLabel(lang) {
  return lang === 'it' ? 'Cosa significa Project Overview?' : 'What does Project Overview mean?';
}

function getLabelsOverviewLabel(lang) {
  return lang === 'it' ? 'Cosa significa Labels Overview?' : 'What does Labels Overview mean?';
}

function getDistributionLabel(lang) {
  return lang === 'it' ? 'Cos e Label Distribution?' : 'What is Label Distribution?';
}

function getDatasetsOverviewLabel(lang) {
  return lang === 'it' ? 'Cosa significa Datasets Overview?' : 'What does Datasets Overview mean?';
}

function getLabelsMatterLabel(lang) {
  return lang === 'it' ? 'Perche le etichette sono importanti?' : 'Why do labels matter?';
}

function getModalHelpLabel(lang) {
  return lang === 'it' ? 'Cosa posso fare qui?' : 'What can I do here?';
}

function getDeleteRuleLabel(lang) {
  return lang === 'it' ? 'Perche delete e disabilitato a volte?' : 'Why is delete disabled sometimes?';
}

function makeState(wizardType, text, options, step) {
  return {
    wizardType,
    conversation: [{ role: 'bot', text, inputType: 'buttons', options, step }],
    step,
  };
}

function applyFreshAnalyticsSnapshot(lang, refs, setters) {
  const { setIsOpen, setWizardMode, setWizardType, setConversation, setWizardStep } = setters;
  const state = checkAnalyticsPageState(lang, refs, setters);
  if (!state) return;

  setIsOpen(true);
  setWizardMode(true);
  setWizardType(state.wizardType);
  setConversation(state.conversation);
  setWizardStep(state.step);
}

export function checkAnalyticsPageState(lang, refs, setters) {
  if (!isAnalyticsPage() && !isAnalyticsLoading()) return null;

  if (isAnalyticsLoading()) {
    const text = lang === 'it'
      ? 'Sto preparando le informazioni di analytics del progetto. Quando il caricamento finisce, qui vedrai progresso, etichette e stato dei dataset.'
      : 'I am preparing the project analytics information. When loading finishes, this page will show progress, labels, and dataset status.';
    return makeState('analytics-loading', text, [], 'analytics-loading');
  }

  if (isLabelModalOpen()) {
    const text = lang === 'it'
      ? 'Questa finestra ti aiuta a gestire le etichette del progetto. Qui puoi capire come creare, modificare e cancellare le etichette in modo sicuro.'
      : 'This window helps you manage the project labels. Here you can understand how to create, edit, and delete labels safely.';
    const options = [getModalHelpLabel(lang), getDeleteRuleLabel(lang)];
    return makeState('analytics-label-modal', text, options, 'analytics-label-modal');
  }

  if (!hasLabelsOverview()) {
    const text = lang === 'it'
      ? 'Questo progetto non ha ancora etichette. Le etichette servono per dare significato alle annotazioni e organizzare cio che il modello imparera.'
      : 'This project does not have labels yet. Labels are needed to give meaning to annotations and organize what the model will learn.';
    const options = [getLabelsMatterLabel(lang), getManageLabelsLabel(lang)];
    return makeState('analytics-no-labels', text, options, 'analytics-no-labels');
  }

  const text = lang === 'it'
    ? 'Questa pagina ti aiuta a capire la salute del progetto: progresso di etichettatura, uso delle etichette e stato dei dataset.'
    : 'This page helps you understand the health of the project: labeling progress, label usage, and dataset status.';
  const options = [getHowLabel(lang), getLearnLabel(lang), getManageLabelsLabel(lang)];
  return makeState('analytics-overview', text, options, 'analytics-overview');
}

export function handleAnalyticsAnswer(step, value, lang, refs, setters) {
  const { addMessage, requestReopen, setWizardMode, setWizardType, setConversation, setIsOpen } = setters;

  const howLabel = getHowLabel(lang);
  const learnLabel = getLearnLabel(lang);
  const manageLabelsLabel = getManageLabelsLabel(lang);
  const backLabel = getBackLabel(lang);
  const projectOverviewLabel = getProjectOverviewLabel(lang);
  const labelsOverviewLabel = getLabelsOverviewLabel(lang);
  const distributionLabel = getDistributionLabel(lang);
  const datasetsOverviewLabel = getDatasetsOverviewLabel(lang);
  const labelsMatterLabel = getLabelsMatterLabel(lang);
  const modalHelpLabel = getModalHelpLabel(lang);
  const deleteRuleLabel = getDeleteRuleLabel(lang);

  function closeBot() {
    setWizardMode(false);
    setWizardType(null);
    setConversation([]);
    setIsOpen(false);
  }

  if ((step === 'analytics-overview' || step === 'analytics-no-labels') && value === manageLabelsLabel) {
    requestReopen?.();
    setTimeout(() => openLabelManagement(), 120);
    closeBot();
    return;
  }

  if (step === 'analytics-overview' && value === howLabel) {
    const intro = lang === 'it'
      ? 'Questa pagina e divisa in aree diverse. Ogni area ti spiega una parte della salute del progetto.'
      : 'This page is divided into different areas. Each area explains one part of the project health.';
    addMessage('bot', intro, {
      inputType: 'buttons',
      options: [projectOverviewLabel, labelsOverviewLabel, distributionLabel, datasetsOverviewLabel, backLabel],
      step: 'analytics-how-choice',
    });
    return;
  }

  if (step === 'analytics-overview' && value === learnLabel) {
    const text = lang === 'it'
      ? 'Da questa pagina puoi capire quante immagini sono state etichettate, quali etichette vengono usate di piu o di meno, e quali dataset hanno ancora bisogno di lavoro.'
      : 'From this page you can understand how many images have been labeled, which labels are used most or least, and which datasets still need more work.';
    addMessage('bot', text, {
      inputType: 'buttons',
      options: [backLabel],
      step: 'analytics-learn-back',
    });
    return;
  }

  if (step === 'analytics-no-labels' && value === labelsMatterLabel) {
    const text = lang === 'it'
      ? 'Le etichette definiscono cosa il progetto deve riconoscere. Se sono chiare e coerenti, anche annotazioni e training diventano piu affidabili.'
      : 'Labels define what the project needs to recognize. When they are clear and consistent, annotation and training become more reliable too.';
    addMessage('bot', text, {
      inputType: 'buttons',
      options: [backLabel],
      step: 'analytics-no-labels-back',
    });
    return;
  }

  if (step === 'analytics-how-choice') {
    if (value === backLabel) {
      applyFreshAnalyticsSnapshot(lang, refs, setters);
      return;
    }

    if (value === projectOverviewLabel) {
      const text = lang === 'it'
        ? 'Project Overview mostra i numeri principali del progetto: quanti dataset esistono, quante immagini hai, quante etichette hai creato, e quanto lavoro di annotazione e stato completato.'
        : 'Project Overview shows the main numbers of the project: how many datasets exist, how many images you have, how many labels you created, and how much annotation work is completed.';
      addMessage('bot', text, {
        inputType: 'buttons',
        options: [backLabel],
        step: 'analytics-topic-back',
      });
      return;
    }

    if (value === labelsOverviewLabel) {
      const text = lang === 'it'
        ? 'Labels Overview mostra il nome di ogni etichetta, il suo colore, quante volte viene usata e la sua percentuale nel progetto. Serve per controllare se alcune etichette sono troppo rare o troppo dominanti.'
        : 'Labels Overview shows each label name, its color, how often it is used, and its percentage in the project. This helps you see whether some labels are too rare or too dominant.';
      addMessage('bot', text, {
        inputType: 'buttons',
        options: [backLabel],
        step: 'analytics-topic-back',
      });
      return;
    }

    if (value === distributionLabel) {
      const text = lang === 'it'
        ? 'Label Distribution mostra come le annotazioni sono distribuite tra le etichette. Le fette piu grandi indicano etichette usate piu spesso. Passando sopra al grafico puoi vedere il conteggio reale.'
        : 'Label Distribution shows how annotations are distributed across labels. Larger slices mean labels used more often. When you hover the chart, you can see the real count.';
      addMessage('bot', text, {
        inputType: 'buttons',
        options: [backLabel],
        step: 'analytics-topic-back',
      });
      return;
    }

    const text = lang === 'it'
      ? 'Datasets Overview mostra dataset per dataset: immagini totali, immagini etichettate, immagini ancora da etichettare, progresso e stato. Questa area ti aiuta a capire quale dataset e pronto e quale ha ancora bisogno di lavoro.'
      : 'Datasets Overview shows each dataset with total images, labeled images, unlabeled images, progress, and status. This area helps you understand which dataset is ready and which one still needs work.';
    addMessage('bot', text, {
      inputType: 'buttons',
      options: [backLabel],
      step: 'analytics-topic-back',
    });
    return;
  }

  if (step === 'analytics-topic-back' && value === backLabel) {
    const intro = lang === 'it'
      ? 'Questa pagina e divisa in aree diverse. Ogni area ti spiega una parte della salute del progetto.'
      : 'This page is divided into different areas. Each area explains one part of the project health.';
    addMessage('bot', intro, {
      inputType: 'buttons',
      options: [projectOverviewLabel, labelsOverviewLabel, distributionLabel, datasetsOverviewLabel, backLabel],
      step: 'analytics-how-choice',
    });
    return;
  }

  if ((step === 'analytics-learn-back' || step === 'analytics-no-labels-back') && value === backLabel) {
    applyFreshAnalyticsSnapshot(lang, refs, setters);
    return;
  }

  if (step === 'analytics-label-modal' && value === modalHelpLabel) {
    const text = lang === 'it'
      ? 'Qui puoi creare nuove etichette, modificare etichette esistenti e controllare quante annotazioni le usano. Elimina solo etichette non usate.'
      : 'Here you can create new labels, edit existing labels, and check how many annotations use them. Delete only labels that are not used.';
    addMessage('bot', text, {
      inputType: 'buttons',
      options: [backLabel],
      step: 'analytics-modal-back',
    });
    return;
  }

  if (step === 'analytics-label-modal' && value === deleteRuleLabel) {
    const text = lang === 'it'
      ? 'Delete e disabilitato quando almeno una annotazione usa quella etichetta. Questo protegge il progetto da cancellazioni pericolose. Solo le etichette con uso zero possono essere eliminate.'
      : 'Delete is disabled when at least one annotation uses that label. This protects the project from dangerous deletions. Only labels with zero usage can be removed.';
    addMessage('bot', text, {
      inputType: 'buttons',
      options: [backLabel],
      step: 'analytics-modal-back',
    });
    return;
  }

  if (step === 'analytics-modal-back' && value === backLabel) {
    applyFreshAnalyticsSnapshot(lang, refs, setters);
  }
}
