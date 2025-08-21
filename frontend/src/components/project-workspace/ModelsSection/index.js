import { logInfo } from '../../../utils/professional_logger';

// Log module loading
logInfo('app.frontend.ui', 'models_section_module_loaded', 'ModelsSection module loaded', {
  timestamp: new Date().toISOString(),
  components: ['ModelsSection']
});

export { default } from './ModelsSection';