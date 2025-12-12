import { logInfo } from '../../utils/professional_logger';
import UploadSection from './UploadSection';
import ManagementSection from './ManagementSection';
import DatasetSection from './DatasetSection';
import ReleaseSection from './ReleaseSection';
import AnalyticsSection from './AnalyticsSection';
import ModelsSection from './ModelsSection';
import ModelTrainingSection from './ModelTrainingSection/ModelTrainingSection.jsx';
import ModelLabSection from './ModelLabSection/ModelLabSection';
import DeploymentsSection from './DeploymentsSection';
import ActiveLearningSection from './ActiveLearningSection';

// Log module loading
logInfo('app.frontend.ui', 'project_workspace_module_loaded', 'Project workspace module loaded', {
  timestamp: new Date().toISOString(),
  components: ['UploadSection', 'ManagementSection', 'DatasetSection', 'ReleaseSection', 'AnalyticsSection', 'ModelsSection', 'ModelTrainingSection', 'VisualizeSection', 'DeploymentsSection', 'ActiveLearningSection']
});

export {
  UploadSection,
  ManagementSection,
  DatasetSection,
  ReleaseSection,
  AnalyticsSection,
  ModelsSection,
  ModelTrainingSection,
  ModelLabSection,
  DeploymentsSection,
  ActiveLearningSection
};