import { logInfo } from '../../utils/professional_logger';

// Log module loading
logInfo('app.frontend.ui', 'project_workspace_module_loaded', 'Project workspace module loaded', {
  timestamp: new Date().toISOString(),
  components: ['UploadSection', 'ManagementSection', 'DatasetSection', 'ReleaseSection', 'AnalyticsSection', 'ModelsSection', 'VisualizeSection', 'DeploymentsSection', 'ActiveLearningSection']
});

import UploadSection from './UploadSection';
import ManagementSection from './ManagementSection';
import DatasetSection from './DatasetSection';
import ReleaseSection from './ReleaseSection';
import AnalyticsSection from './AnalyticsSection';
import ModelsSection from './ModelsSection';
import VisualizeSection from './VisualizeSection';
import DeploymentsSection from './DeploymentsSection';
import ActiveLearningSection from './ActiveLearningSection';

export {
  UploadSection,
  ManagementSection,
  DatasetSection,
  ReleaseSection,
  AnalyticsSection,
  ModelsSection,
  VisualizeSection,
  DeploymentsSection,
  ActiveLearningSection
};