import { logInfo } from '../../../utils/professional_logger';

// Log module loading
logInfo('app.frontend.ui', 'model_training_section_module_loaded', 'ModelTrainingSection module loaded', {
  timestamp: new Date().toISOString(),
  components: ['ModelTrainingSection']
});

export { default } from './ModelTrainingSection.jsx';