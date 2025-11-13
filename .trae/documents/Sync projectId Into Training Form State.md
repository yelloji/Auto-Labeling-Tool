Issue
- form.projectId is initialized once and never updated when the prop projectId arrives asynchronously → DatasetSection sees empty projectId and skips fetching releases, leaving the dropdown disabled.

Fix
- In ModelTrainingSection.jsx, add a useEffect to sync form.projectId whenever the projectId prop changes:

useEffect(() => {
  if (projectId && projectId !== form.projectId) {
    setForm(prev => ({ ...prev, projectId }));
  }
}, [projectId]);

Result
- DatasetSection receives a valid projectId, calls Releases API, and the dropdown enables with release names.