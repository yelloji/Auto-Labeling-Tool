import { logInfo } from '../../../utils/professional_logger';

// Log module loading
logInfo('app.frontend.ui', 'deployments_section_module_loaded', 'DeploymentsSection module loaded', {
  timestamp: new Date().toISOString(),
  components: ['DeploymentsSection']
});

export { default } from './DeploymentsSection';