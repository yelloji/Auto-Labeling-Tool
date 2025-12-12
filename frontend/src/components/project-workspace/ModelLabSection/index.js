import { logInfo } from '../../../utils/professional_logger';

// Log module loading
logInfo('app.frontend.ui', 'model_lab_section_module_loaded', 'ModelLabSection module loaded', {
  timestamp: new Date().toISOString(),
  components: ['ModelLabSection']
});

export { default } from './ModelLabSection';