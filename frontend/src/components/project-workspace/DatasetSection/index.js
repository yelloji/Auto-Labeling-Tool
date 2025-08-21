import { logInfo } from '../../../utils/professional_logger';

// Log module loading
logInfo('app.frontend.ui', 'dataset_section_module_loaded', 'DatasetSection module loaded', {
  timestamp: new Date().toISOString(),
  components: ['DatasetSection']
});

export { default } from './DatasetSection';