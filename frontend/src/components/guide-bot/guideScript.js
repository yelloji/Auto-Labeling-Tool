/**
 * guideScript.js — Pre-designed decision tree for the Guide Bot.
 *
 * Structure:
 *   Each key is a route pattern.
 *   Each entry has:
 *     - message: { en, it } — what the bot says
 *     - options: array of { label: {en,it}, action }
 *
 * Action types:
 *   { type: 'navigate', path: '/some/path' }
 *   { type: 'click', selector: '.css-selector' }
 *   { type: 'message', key: 'some-script-key' }  — show a sub-message
 */

const guideScript = {

  // -------------------------------------------------------------------------
  // DASHBOARD  /
  // -------------------------------------------------------------------------
  '/': {
    message: {
      en: 'Welcome to Gevis AI Studio! Here you can see your overview — projects, models and labeled images.',
      it: 'Benvenuto in Gevis AI Studio! Qui puoi vedere il riepilogo — progetti, modelli e immagini etichettate.',
    },
    options: [
      {
        label: { en: 'What is this page?', it: "Cos'è questa pagina?" },
        action: { type: 'message', key: 'dashboard-page-explain' },
      },
      {
        label: { en: 'What is this app?', it: "Cos'è questa app?" },
        action: { type: 'message', key: 'dashboard-app-explain' },
      },
      {
        label: { en: 'Tell me about Models', it: 'Parlami dei Modelli' },
        action: { type: 'navigate', path: '/models' },
      },
      {
        label: { en: 'Go to my Projects', it: 'Vai ai miei Progetti' },
        action: { type: 'navigate', path: '/projects' },
      },
    ],
  },

  'dashboard-page-explain': {
    message: {
      en: 'This is your Dashboard. It shows how many models, projects and images you have. You can also see your recent projects and labeling progress here.',
      it: 'Questa è la tua Dashboard. Mostra quanti modelli, progetti e immagini hai. Puoi anche vedere i tuoi progetti recenti e il progresso di etichettatura.',
    },
    options: [
      {
        label: { en: 'Go to my Projects', it: 'Vai ai miei Progetti' },
        action: { type: 'navigate', path: '/projects' },
      },
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/' },
      },
    ],
  },

  'dashboard-app-explain': {
    message: {
      en: 'Gevis AI Studio helps you label images and train custom AI models. You upload images, draw boxes around objects using AI auto-labeling, train a custom model, and use our analysis tools to decide which model is ready for production — all inside this app.',
      it: "Gevis AI Studio ti aiuta a etichettare immagini e addestrare modelli AI personalizzati. Carichi immagini, disegni riquadri usando l'etichettatura automatica AI, addestri un modello personalizzato, e usi i nostri strumenti di analisi per decidere quale modello è pronto per la produzione — tutto dentro questa app.",
    },
    options: [
      {
        label: { en: 'Go to my Projects', it: 'Vai ai miei Progetti' },
        action: { type: 'navigate', path: '/projects' },
      },
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/' },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // PROJECTS  /projects
  // -------------------------------------------------------------------------
  '/projects': {
    message: {
      en: 'This is your Projects page. What would you like to do?',
      it: 'Questa è la pagina Progetti. Cosa vorresti fare?',
    },
    options: [
      {
        label: { en: 'Create a new project', it: 'Crea un nuovo progetto' },
        action: { type: 'wizard', wizard: 'create-project' },
      },
      {
        label: { en: 'Open an existing project', it: 'Apri un progetto esistente' },
        action: { type: 'message', key: 'projects-open-hint' },
      },
      {
        label: { en: 'What is a project?', it: "Cos'è un progetto?" },
        action: { type: 'message', key: 'projects-explain' },
      },
    ],
  },

  'projects-open-hint': {
    message: {
      en: 'Your projects are listed on this page. Each card shows the project name and image count. Click on any card to open it and start working.',
      it: 'I tuoi progetti sono elencati in questa pagina. Ogni scheda mostra il nome del progetto e il numero di immagini. Clicca su qualsiasi scheda per aprirlo e iniziare a lavorare.',
    },
    options: [
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/projects' },
      },
    ],
  },

  'projects-explain': {
    message: {
      en: 'A project is your complete workspace. Inside one project you upload images, label them, train your AI model, and analyse the results — all in one place. You can have multiple classes per project.',
      it: "Un progetto è il tuo spazio di lavoro completo. Dentro un progetto carichi immagini, le etichetti, addestri il tuo modello AI e analizzi i risultati — tutto in un posto. Puoi avere più classi per progetto.",
    },
    options: [
      {
        label: { en: 'Create a new project', it: 'Crea un nuovo progetto' },
        action: { type: 'wizard', wizard: 'create-project' },
      },
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/projects' },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // PROJECT WORKSPACE  /projects/:id/workspace
  // -------------------------------------------------------------------------
  '/projects/:id/workspace': {
    message: {
      en: 'You are inside your project. What would you like to do?',
      it: 'Sei nel tuo progetto. Cosa vorresti fare?',
    },
    options: [
      {
        label: { en: 'What should I do first?', it: 'Cosa devo fare prima?' },
        action: { type: 'message', key: 'workspace-first-step' },
      },
      {
        label: { en: 'Upload images or videos', it: 'Carica immagini o video' },
        action: { type: 'message', key: 'workspace-upload' },
      },
      {
        label: { en: 'Already uploaded your images? Go to Management', it: 'Immagini già caricate? Vai a Management' },
        action: { type: 'click', selector: ".ant-menu-item:has-text('Management')" },
      },
    ],
  },

  'workspace-first-step': {
    message: {
      en: 'Here is the full flow: 1. Upload your images here. 2. Go to Management to label them. 3. Go to Release to prepare your dataset. 4. Train your AI model. 5. Use Model Lab to explore and analyse your trained models. Start with uploading your images or videos.',
      it: 'Ecco il flusso completo: 1. Carica le tue immagini qui. 2. Vai su Management per etichettarle. 3. Vai su Release per preparare il dataset. 4. Addestra il tuo modello AI. 5. Usa il Model Lab per esplorare e analizzare i modelli addestrati. Inizia caricando le tue immagini o video.',
    },
    options: [
      {
        label: { en: 'Upload images or videos', it: 'Carica immagini o video' },
        action: { type: 'message', key: 'workspace-upload' },
      },
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/projects/:id/workspace' },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // UPLOAD  (Upload Data tab inside workspace)
  // -------------------------------------------------------------------------
  'workspace-upload': {
    message: {
      en: 'Choose how you want to upload your data:',
      it: 'Scegli come vuoi caricare i tuoi dati:',
    },
    options: [
      {
        label: { en: 'Pick individual image files', it: 'Seleziona singoli file immagine' },
        action: { type: 'wizard', wizard: 'upload-files' },
      },
      {
        label: { en: 'Pick a whole folder of images', it: 'Seleziona una cartella di immagini' },
        action: { type: 'wizard', wizard: 'upload-folder' },
      },
      {
        label: { en: 'Pick a folder that already has images + labels', it: 'Seleziona una cartella con immagini + etichette' },
        action: { type: 'wizard', wizard: 'upload-folder-labels' },
      },
      {
        label: { en: 'Pick video files (frames will be extracted)', it: 'Seleziona file video (i frame verranno estratti)' },
        action: { type: 'wizard', wizard: 'upload-video-files' },
      },
      {
        label: { en: 'Pick a folder of videos', it: 'Seleziona una cartella di video' },
        action: { type: 'wizard', wizard: 'upload-video-folder' },
      },
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/projects/:id/workspace' },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // MANAGEMENT  (Management tab inside workspace)
  // -------------------------------------------------------------------------
  'workspace-management': {
    message: {
      en: 'Here you can see all your datasets. What would you like to do?',
      it: 'Qui puoi vedere tutti i tuoi dataset. Cosa vorresti fare?',
    },
    options: [
      {
        label: { en: 'Start labeling images', it: 'Inizia a etichettare le immagini' },
        action: { type: 'message', key: 'management-annotate-hint' },
      },
      {
        label: { en: 'What is a dataset?', it: "Cos'è un dataset?" },
        action: { type: 'message', key: 'management-explain' },
      },
    ],
  },

  'management-annotate-hint': {
    message: {
      en: 'Click the "Annotate" button on any dataset card to start labeling the images inside it.',
      it: 'Clicca il pulsante "Annotate" su qualsiasi scheda dataset per iniziare a etichettare le immagini al suo interno.',
    },
    options: [
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: 'workspace-management' },
      },
    ],
  },

  'management-explain': {
    message: {
      en: 'A dataset is a batch of images grouped together. When you upload images, they are organized into datasets automatically.',
      it: 'Un dataset è un gruppo di immagini raggruppate insieme. Quando carichi immagini, vengono organizzate in dataset automaticamente.',
    },
    options: [
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: 'workspace-management' },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // ANNOTATE  /annotate/:datasetId/manual
  // -------------------------------------------------------------------------
  '/annotate': {
    message: {
      en: 'This is the labeling canvas. Draw boxes around the objects in the image.',
      it: "Questo è il canvas di etichettatura. Disegna riquadri attorno agli oggetti nell'immagine.",
    },
    options: [
      {
        label: { en: 'How do I draw a box?', it: 'Come disegno un riquadro?' },
        action: { type: 'message', key: 'annotate-draw' },
      },
      {
        label: { en: 'How do I save?', it: 'Come salvo?' },
        action: { type: 'message', key: 'annotate-save' },
      },
      {
        label: { en: 'Go to next image', it: "Vai all'immagine successiva" },
        action: { type: 'click', selector: "button:has-text('Next')" },
      },
    ],
  },

  'annotate-draw': {
    message: {
      en: 'Click the Rectangle tool, then click and drag on the image to draw a box. Release the mouse to finish. Then select the label for the object.',
      it: "Clicca lo strumento Rettangolo, poi clicca e trascina sull'immagine per disegnare un riquadro. Rilascia il mouse per finire. Poi seleziona l'etichetta per l'oggetto.",
    },
    options: [
      {
        label: { en: 'How do I save?', it: 'Come salvo?' },
        action: { type: 'message', key: 'annotate-save' },
      },
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/annotate' },
      },
    ],
  },

  'annotate-save': {
    message: {
      en: 'Click the Save button at the bottom to save your annotations for this image. Then click Next to go to the next image.',
      it: "Clicca il pulsante Salva in basso per salvare le tue annotazioni per questa immagine. Poi clicca Avanti per passare all'immagine successiva.",
    },
    options: [
      {
        label: { en: 'Save now', it: 'Salva adesso' },
        action: { type: 'click', selector: "button:has-text('Save')" },
      },
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/annotate' },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // ANNOTATION PROGRESS  /annotate-progress/:datasetId
  // -------------------------------------------------------------------------
  '/annotate-progress': {
    message: {
      en: 'All images are labeled! Now split them into Train, Validation and Test sets.',
      it: 'Tutte le immagini sono etichettate! Ora dividile in set Train, Validazione e Test.',
    },
    options: [
      {
        label: { en: 'What is Train/Val/Test?', it: 'Cosa sono Train/Val/Test?' },
        action: { type: 'message', key: 'progress-explain' },
      },
      {
        label: { en: 'Add to Dataset', it: 'Aggiungi al Dataset' },
        action: { type: 'click', selector: "button:has-text('Add to Dataset')" },
      },
    ],
  },

  'progress-explain': {
    message: {
      en: 'Train (60-70%): images the AI learns from. Validation (20-30%): images to check learning. Test (10%): final accuracy check. Use the slider to adjust.',
      it: "Train (60-70%): immagini da cui l'AI impara. Validazione (20-30%): immagini per verificare l'apprendimento. Test (10%): verifica finale dell'accuratezza.",
    },
    options: [
      {
        label: { en: 'Add to Dataset now', it: 'Aggiungi al Dataset adesso' },
        action: { type: 'click', selector: "button:has-text('Add to Dataset')" },
      },
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/annotate-progress' },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // RELEASE SECTION  (Release tab inside workspace)
  // -------------------------------------------------------------------------
  'workspace-release': {
    message: {
      en: 'This is the Release section. Here you manage your final datasets.',
      it: 'Questa è la sezione Release. Qui gestisci i tuoi dataset finali.',
    },
    options: [
      {
        label: { en: 'What is Rebalance?', it: "Cos'è il Ribilanciamento?" },
        action: { type: 'message', key: 'release-rebalance' },
      },
      {
        label: { en: 'Export my dataset', it: 'Esporta il mio dataset' },
        action: { type: 'message', key: 'release-export' },
      },
    ],
  },

  'release-rebalance': {
    message: {
      en: 'Rebalance redistributes your images between Train, Validation and Test sets. Use it if you want to change the split percentages.',
      it: 'Il ribilanciamento ridistribuisce le immagini tra i set Train, Validazione e Test. Usalo se vuoi cambiare le percentuali di suddivisione.',
    },
    options: [
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: 'workspace-release' },
      },
    ],
  },

  'release-export': {
    message: {
      en: 'Click the Export button on your dataset to download it in YOLO format, ready for training.',
      it: 'Clicca il pulsante Esporta sul tuo dataset per scaricarlo in formato YOLO, pronto per il training.',
    },
    options: [
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: 'workspace-release' },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // MODELS  /models
  // -------------------------------------------------------------------------
  '/models': {
    message: {
      en: 'This is the AI Models page. Here you can see all models available across your projects.',
      it: 'Questa è la pagina Modelli AI. Qui puoi vedere tutti i modelli disponibili per i tuoi progetti.',
    },
    options: [
      {
        label: { en: 'What are these models?', it: 'Cosa sono questi modelli?' },
        action: { type: 'message', key: 'models-what' },
      },
      {
        label: { en: 'What is Object Detection?', it: "Cos'è il rilevamento oggetti?" },
        action: { type: 'message', key: 'models-object-detection' },
      },
      {
        label: { en: 'What is Segmentation?', it: "Cos'è la segmentazione?" },
        action: { type: 'message', key: 'models-segmentation' },
      },
      {
        label: { en: 'How do I upload a model?', it: 'Come carico un modello?' },
        action: { type: 'message', key: 'models-upload' },
      },
      {
        label: { en: 'Go to my Projects', it: 'Vai ai miei Progetti' },
        action: { type: 'navigate', path: '/projects' },
      },
    ],
  },

  'models-what': {
    message: {
      en: 'These are AI models used for auto-labeling and training. The default models (YOLO11, YOLO26, SAM2) come pre-installed. You can also upload your own custom models to use across all your projects.',
      it: 'Questi sono modelli AI usati per l\'etichettatura automatica e il training. I modelli predefiniti (YOLO11, YOLO26, SAM2) sono pre-installati. Puoi anche caricare i tuoi modelli personalizzati da usare in tutti i tuoi progetti.',
    },
    options: [
      {
        label: { en: 'What is Object Detection?', it: "Cos'è il rilevamento oggetti?" },
        action: { type: 'message', key: 'models-object-detection' },
      },
      {
        label: { en: 'What is Segmentation?', it: "Cos'è la segmentazione?" },
        action: { type: 'message', key: 'models-segmentation' },
      },
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/models' },
      },
    ],
  },

  'models-object-detection': {
    message: {
      en: 'Object Detection finds objects in an image and draws a bounding box around them with a label. Example: detecting a car, a person, or a defect.',
      it: 'Il rilevamento oggetti trova gli oggetti in un\'immagine e disegna un riquadro con un\'etichetta. Esempio: rilevare un\'auto, una persona o un difetto.',
    },
    options: [
      {
        label: { en: 'What is Segmentation?', it: "Cos'è la segmentazione?" },
        action: { type: 'message', key: 'models-segmentation' },
      },
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/models' },
      },
    ],
  },

  'models-segmentation': {
    message: {
      en: 'Segmentation detects the exact pixel-level shape of an object, not just a bounding box. Useful when you need precise object boundaries.',
      it: 'La segmentazione rileva la forma esatta dell\'oggetto a livello di pixel, non solo un riquadro. Utile quando hai bisogno di contorni precisi.',
    },
    options: [
      {
        label: { en: 'What is Object Detection?', it: "Cos'è il rilevamento oggetti?" },
        action: { type: 'message', key: 'models-object-detection' },
      },
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/models' },
      },
    ],
  },

  'models-upload': {
    message: {
      en: 'Click Upload Model to add your own model. Supported formats are .pt and .onnx. For .pt files details are filled automatically. For .onnx you need to enter input size, classes and number of classes manually.',
      it: 'Clicca su Carica Modello per aggiungere il tuo modello. I formati supportati sono .pt e .onnx. Per i file .pt i dettagli vengono compilati automaticamente. Per .onnx devi inserire manualmente la dimensione di input, le classi e il numero di classi.',
    },
    options: [
      {
        label: { en: 'Guide me through Upload', it: 'Guidami nel caricamento' },
        action: { type: 'wizard', wizard: 'upload-model' },
      },
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/models' },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // FALLBACK — unknown page
  // -------------------------------------------------------------------------
  'fallback': {
    message: {
      en: 'Hi! I am your guide. Where would you like to go?',
      it: 'Ciao! Sono la tua guida. Dove vorresti andare?',
    },
    options: [
      {
        label: { en: 'Go to Dashboard', it: 'Vai alla Dashboard' },
        action: { type: 'navigate', path: '/' },
      },
      {
        label: { en: 'Go to Projects', it: 'Vai ai Progetti' },
        action: { type: 'navigate', path: '/projects' },
      },
    ],
  },
};

export default guideScript;
