// Export all annotation-related pages
import AnnotateLauncher from './AnnotateLauncher';
import AnnotateProgress from './AnnotateProgress.jsx';
import ManualLabeling from './ManualLabeling.jsx';
import { logInfo } from '../../utils/professional_logger';

// Log module loading
logInfo('app.frontend.ui', 'annotation_pages_module_loaded', 'Annotation pages module loaded', {
  timestamp: new Date().toISOString(),
  components: ['AnnotateLauncher', 'AnnotateProgress', 'ManualLabeling']
});

export {
  AnnotateLauncher,
  AnnotateProgress,
  ManualLabeling
};