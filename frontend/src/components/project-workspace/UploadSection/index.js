import { logInfo } from '../../../utils/professional_logger';

// Log module loading
logInfo('app.frontend.ui', 'upload_section_module_loaded', 'UploadSection module loaded', {
  timestamp: new Date().toISOString(),
  components: ['UploadSection']
});

export { default } from './UploadSection';