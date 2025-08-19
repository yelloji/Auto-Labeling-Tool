import { logInfo } from '../../../utils/professional_logger';

// Log module loading
logInfo('app.frontend.ui', 'visualize_section_module_loaded', 'VisualizeSection module loaded', {
  timestamp: new Date().toISOString(),
  components: ['VisualizeSection']
});

export { default } from './VisualizeSection';