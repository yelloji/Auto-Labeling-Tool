import { logInfo } from '../../../utils/professional_logger';

// Log module loading
logInfo('app.frontend.ui', 'management_section_module_loaded', 'ManagementSection module loaded', {
  timestamp: new Date().toISOString(),
  components: ['ManagementSection']
});

export { default } from './ManagementSection.jsx';