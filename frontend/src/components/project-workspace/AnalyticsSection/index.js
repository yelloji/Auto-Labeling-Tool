import { logInfo } from '../../../utils/professional_logger';

// Log module loading
logInfo('app.frontend.ui', 'analytics_section_module_loaded', 'AnalyticsSection module loaded', {
  timestamp: new Date().toISOString(),
  components: ['AnalyticsSection', 'LabelManagementModal']
});

export { default } from './AnalyticsSection';