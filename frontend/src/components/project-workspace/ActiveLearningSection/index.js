import { logInfo } from '../../../utils/professional_logger';

// Log module loading
logInfo('app.frontend.ui', 'active_learning_section_module_loaded', 'ActiveLearningSection module loaded', {
  timestamp: new Date().toISOString(),
  components: ['ActiveLearningSection']
});

export { default } from './ActiveLearningSection';