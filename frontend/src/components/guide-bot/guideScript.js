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
  // WORKSPACE SECTIONS — one entry per sidebar tab
  // -------------------------------------------------------------------------

  // Upload Data tab
  '/workspace/upload': {
    message: {
      en: 'This is the Upload section. Here you can upload images, videos, or pre-labeled data to your project.',
      it: 'Questa è la sezione Upload. Qui puoi caricare immagini, video o dati già etichettati nel tuo progetto.',
    },
    options: [
      {
        label: { en: 'What should I do first?', it: 'Cosa devo fare prima?' },
        action: { type: 'message', key: 'workspace-first-step' },
      },
      {
        label: { en: 'Guide me through uploading', it: 'Guidami nel caricamento' },
        action: { type: 'message', key: 'upload-choose-type' },
      },
      {
        label: { en: 'Already uploaded? Go to Management', it: 'Già caricato? Vai a Management' },
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
        label: { en: 'Guide me through uploading', it: 'Guidami nel caricamento' },
        action: { type: 'message', key: 'upload-choose-type' },
      },
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/workspace/upload' },
      },
    ],
  },

  'upload-choose-type': {
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
        label: { en: 'Pick a folder with images + labels', it: 'Seleziona una cartella con immagini + etichette' },
        action: { type: 'wizard', wizard: 'upload-folder-labels' },
      },
      {
        label: { en: 'Pick video files (frames extracted)', it: 'Seleziona file video (frame estratti)' },
        action: { type: 'wizard', wizard: 'upload-video-files' },
      },
      {
        label: { en: 'Pick a folder of videos', it: 'Seleziona una cartella di video' },
        action: { type: 'wizard', wizard: 'upload-video-folder' },
      },
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/workspace/upload' },
      },
    ],
  },

  'upload-formats': {
    message: {
      en: 'Supported image formats: .jpg, .png, .bmp, .webp, .avif. Annotation formats: .json, .xml, .txt. Video formats: .mp4, .mov, .avi. Max image size is 20 MB and 16,000 pixels.',
      it: 'Formati immagine supportati: .jpg, .png, .bmp, .webp, .avif. Formati annotazione: .json, .xml, .txt. Formati video: .mp4, .mov, .avi. Dimensione massima immagine 20 MB e 16.000 pixel.',
    },
    options: [
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/workspace/upload' },
      },
    ],
  },

  // Management tab
  '/workspace/management': {
    message: {
      en: 'You have datasets in the Unassigned column. Click any card to move it to Annotating — then click it again in the Annotating column to open the labeling tool.',
      it: 'Hai dataset nella colonna Unassigned. Clicca su una scheda per spostarla in Annotating — poi clicca di nuovo nella colonna Annotating per aprire lo strumento di etichettatura.',
    },
    options: [
      {
        label: { en: 'What are the 3 columns?', it: 'Cosa sono le 3 colonne?' },
        action: { type: 'message', key: 'management-columns-explain' },
      },
      {
        label: { en: 'What is a dataset?', it: "Cos'è un dataset?" },
        action: { type: 'message', key: 'management-explain' },
      },
    ],
  },

  'management-columns-explain': {
    message: {
      en: 'Unassigned: freshly uploaded, not yet labeled — click a card to move it to Annotating. Annotating: click a card to open the labeling tool. Dataset: 100% labeled and ready. Each card has a ⋮ menu for Rename, Move, and Delete actions.',
      it: 'Unassigned: caricate di recente, non ancora etichettate — clicca una scheda per spostarla in Annotating. Annotating: clicca una scheda per aprire lo strumento di etichettatura. Dataset: 100% etichettato e pronto. Ogni scheda ha un menu ⋮ per Rinominare, Spostare ed Eliminare.',
    },
    options: [
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/workspace/management' },
      },
    ],
  },

  'management-explain': {
    message: {
      en: 'A dataset is a batch of images grouped together. Each time you upload images, they are stored as a named dataset so you can track and manage them separately.',
      it: 'Un dataset è un gruppo di immagini raggruppate insieme. Ogni volta che carichi immagini, vengono salvate come dataset con un nome, così puoi tracciarle e gestirle separatamente.',
    },
    options: [
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/workspace/management' },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // ANNOTATE LAUNCHER  /annotate-launcher/:datasetId
  // -------------------------------------------------------------------------
  '/annotate-launcher': {
    message: {
      en: 'Choose how you want to label this dataset. Manual Labeling gives you full control — draw boxes yourself. Auto Labeling uses AI to detect objects automatically, then you review and correct.',
      it: 'Scegli come vuoi etichettare questo dataset. Etichettatura Manuale ti dà pieno controllo — disegni i riquadri tu stesso. Etichettatura Automatica usa l\'AI per rilevare gli oggetti, poi rivedi e correggi.',
    },
    options: [
      {
        label: { en: 'What is Manual Labeling?', it: "Cos'è l'Etichettatura Manuale?" },
        action: { type: 'message', key: 'annotate-launcher-manual-explain' },
      },
      {
        label: { en: 'What is Auto Labeling?', it: "Cos'è l'Etichettatura Automatica?" },
        action: { type: 'message', key: 'annotate-launcher-auto-explain' },
      },
    ],
  },

  'annotate-launcher-manual-explain': {
    message: {
      en: 'Manual Labeling opens a canvas where you draw bounding boxes around objects yourself. Best for precise work, small datasets, or when AI accuracy is not enough yet. Click Start Manual Labeling → Annotation Progress page opens → shows labeled and remaining images → click any image to open the canvas and draw boxes.',
      it: "L'Etichettatura Manuale apre un canvas dove disegni i riquadri attorno agli oggetti tu stesso. Ideale per lavori precisi, dataset piccoli, o quando l'accuratezza AI non è ancora sufficiente. Clicca Inizia Etichettatura Manuale → si apre la pagina Avanzamento Annotazione → mostra le immagini etichettate e quelle rimanenti → clicca un'immagine per aprire il canvas e disegnare i riquadri.",
    },
    options: [
      {
        label: { en: 'Start Manual Labeling', it: 'Inizia Etichettatura Manuale' },
        action: { type: 'click', selector: "button:has-text('Start Manual Labeling')" },
      },
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/annotate-launcher' },
      },
    ],
  },

  'annotate-launcher-auto-explain': {
    message: {
      en: 'Auto Labeling is an upcoming feature. It will use an AI model to detect and label objects automatically — fast for large datasets. Stay tuned.',
      it: "L'Etichettatura Automatica è una funzionalità in arrivo. Userà un modello AI per rilevare e etichettare gli oggetti automaticamente — veloce per dataset grandi. Prossimamente.",
    },
    options: [
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/annotate-launcher' },
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

  // Dataset tab
  '/workspace/dataset': {
    message: {
      en: 'This is the Dataset section. Here you can see all your fully labeled images grouped by dataset.',
      it: 'Questa è la sezione Dataset. Qui puoi vedere tutte le immagini etichettate raggruppate per dataset.',
    },
    options: [
      {
        label: { en: 'What can I do here?', it: 'Cosa posso fare qui?' },
        action: { type: 'message', key: 'dataset-explain' },
      },
    ],
  },

  'dataset-explain': {
    message: {
      en: 'In the Dataset section you can browse all labeled images, view annotation details, and move images to the Release section when ready.',
      it: 'Nella sezione Dataset puoi sfogliare tutte le immagini etichettate, vedere i dettagli delle annotazioni e spostarle nella sezione Release quando sono pronte.',
    },
    options: [
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/workspace/dataset' },
      },
    ],
  },

  // Release tab
  '/workspace/versions': {
    message: {
      en: 'This is the Release section. Here you prepare versioned dataset releases, review release history, and export finished releases.',
      it: 'Questa e la sezione Release. Qui prepari release versionate del dataset, controlli la cronologia e scarichi le release completate.',
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
        action: { type: 'message', key: '/workspace/versions' },
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
        action: { type: 'message', key: '/workspace/versions' },
      },
    ],
  },

  // Analytics tab
  '/workspace/analytics': {
    message: {
      en: 'This is the Analytics section. Here you can see label distribution, class balance, and dataset statistics.',
      it: 'Questa è la sezione Analytics. Qui puoi vedere la distribuzione delle etichette, il bilanciamento delle classi e le statistiche del dataset.',
    },
    options: [
      {
        label: { en: 'What is class balance?', it: "Cos'è il bilanciamento delle classi?" },
        action: { type: 'message', key: 'analytics-class-balance' },
      },
    ],
  },

  'analytics-class-balance': {
    message: {
      en: 'Class balance shows how many labeled images you have per class. A balanced dataset — similar counts for each class — trains a more accurate AI model.',
      it: 'Il bilanciamento delle classi mostra quante immagini etichettate hai per ciascuna classe. Un dataset bilanciato — conteggi simili per ogni classe — addestra un modello AI più accurato.',
    },
    options: [
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/workspace/analytics' },
      },
    ],
  },

  // Models tab (within workspace)
  '/workspace/models': {
    message: {
      en: 'This is the Models section. Here you can see all AI models linked to this project and start a new training run.',
      it: 'Questa è la sezione Modelli. Qui puoi vedere tutti i modelli AI collegati a questo progetto e avviare un nuovo training.',
    },
    options: [
      {
        label: { en: 'How do I train a model?', it: 'Come addestro un modello?' },
        action: { type: 'message', key: 'workspace-models-train-hint' },
      },
    ],
  },

  'workspace-models-train-hint': {
    message: {
      en: 'Go to the Model Training section to start a new training run. Select a base model, set your epochs, and click Train. Your labeled dataset will be used automatically.',
      it: 'Vai alla sezione Model Training per avviare un nuovo training. Seleziona un modello base, imposta le epoche e clicca su Addestra. Il tuo dataset etichettato verrà usato automaticamente.',
    },
    options: [
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/workspace/models' },
      },
    ],
  },

  // Project Models tab (override fallback copy with project-scoped meaning)
  '/workspace/models': {
    message: {
      en: 'This is the project Models section. Here you can review the models available to this project, including local models and any global models you choose to show.',
      it: 'Questa Ã¨ la sezione Modelli del progetto. Qui puoi controllare i modelli disponibili per questo progetto, inclusi i modelli locali e quelli globali che scegli di mostrare.',
    },
    options: [
      {
        label: { en: 'What do local and global models mean?', it: 'Cosa significano modelli locali e globali?' },
        action: { type: 'message', key: 'workspace-models-scope-hint' },
      },
    ],
  },

  'workspace-models-scope-hint': {
    message: {
      en: 'Local models belong only to this project. Global models are shared across the app and can be shown here with the Include Global Models toggle. Trained models can also appear here after they are added from training.',
      it: 'I modelli locali appartengono solo a questo progetto. I modelli globali sono condivisi nell app e possono essere mostrati qui con il toggle Include Global Models. Anche i modelli addestrati possono apparire qui dopo essere stati aggiunti dal training.',
    },
    options: [
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/workspace/models' },
      },
    ],
  },

  // Model Training tab
  '/workspace/model-training': {
    message: {
      en: 'This is Model Training. Select a base model and configure your training run — then click Train to start.',
      it: 'Questo è il Model Training. Seleziona un modello base e configura il training — poi clicca su Addestra per iniziare.',
    },
    options: [
      {
        label: { en: 'What is an epoch?', it: "Cos'è un'epoca?" },
        action: { type: 'message', key: 'training-epoch-explain' },
      },
    ],
  },

  'training-epoch-explain': {
    message: {
      en: 'An epoch is one full pass through all your training images. More epochs = more learning, but too many can cause overfitting. Start with 50-100 epochs.',
      it: "Un'epoca è un passaggio completo attraverso tutte le immagini di training. Più epoche = più apprendimento, ma troppe possono causare overfitting. Inizia con 50-100 epoche.",
    },
    options: [
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/workspace/model-training' },
      },
    ],
  },

  // Model Lab tab
  '/workspace/model-lab': {
    message: {
      en: 'This is Model Lab. Here you can test your trained models on new images and compare their results.',
      it: 'Questo è il Model Lab. Qui puoi testare i tuoi modelli addestrati su nuove immagini e confrontare i risultati.',
    },
    options: [
      {
        label: { en: 'What can I do here?', it: 'Cosa posso fare qui?' },
        action: { type: 'message', key: 'model-lab-explain' },
      },
    ],
  },

  'model-lab-explain': {
    message: {
      en: 'Upload an image and run it through any of your trained models to see predictions. Use this to compare models and decide which one performs best before deploying.',
      it: 'Carica un\'immagine ed eseguila con uno qualsiasi dei tuoi modelli addestrati per vedere le previsioni. Usalo per confrontare i modelli e decidere quale funziona meglio prima del deploy.',
    },
    options: [
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/workspace/model-lab' },
      },
    ],
  },

  // Deployments tab
  '/workspace/deployments': {
    message: {
      en: 'This is the Deployments section. Here you can run your trained model as a live inference service.',
      it: 'Questa è la sezione Deployments. Qui puoi eseguire il tuo modello addestrato come servizio di inferenza live.',
    },
    options: [
      {
        label: { en: 'What is a deployment?', it: "Cos'è un deployment?" },
        action: { type: 'message', key: 'deployments-explain' },
      },
    ],
  },

  'deployments-explain': {
    message: {
      en: 'A deployment runs your trained model as a service so other applications can send images and receive predictions. Select a model, start the service, and use the API endpoint.',
      it: "Un deployment esegue il tuo modello addestrato come servizio in modo che altre applicazioni possano inviare immagini e ricevere previsioni. Seleziona un modello, avvia il servizio e usa l'endpoint API.",
    },
    options: [
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/workspace/deployments' },
      },
    ],
  },

  // Active Learning tab
  '/workspace/active-learning': {
    message: {
      en: 'This is Active Learning. It helps you improve your model by identifying the images that need labeling most.',
      it: "Questo è l'Active Learning. Ti aiuta a migliorare il tuo modello identificando le immagini che hanno più bisogno di essere etichettate.",
    },
    options: [
      {
        label: { en: 'How does Active Learning work?', it: "Come funziona l'Active Learning?" },
        action: { type: 'message', key: 'active-learning-explain' },
      },
    ],
  },

  'active-learning-explain': {
    message: {
      en: 'Active Learning runs your model on unlabeled images and finds the ones it is least confident about. Label those images first — it is the fastest way to improve model accuracy.',
      it: "L'Active Learning esegue il tuo modello su immagini non etichettate e trova quelle su cui è meno sicuro. Etichetta prima quelle immagini — è il modo più veloce per migliorare l'accuratezza del modello.",
    },
    options: [
      {
        label: { en: 'Go back', it: 'Torna indietro' },
        action: { type: 'message', key: '/workspace/active-learning' },
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
