Goal
- Stop the dropdown from being disabled and show release names.

Steps (frontend only)
1) Sync projectId into form state
- In ModelTrainingSection.jsx, add a useEffect:
  useEffect(() => {
    if (projectId && projectId !== form.projectId) {
      setForm(prev => ({ ...prev, projectId }));
    }
  }, [projectId]);

2) Build options from Releases API
- DatasetSection.jsx already calls releasesAPI.getProjectReleases(projectId).
- Map options:
  - label = release.name || release.release_version
  - value = release.model_path
- Enable when releases.length > 0; disable non-zip options, but keep control enabled.

3) Service mapping
- Keep releasesAPI.getProjectReleases: return Array.isArray(response.data) ? response.data : (response.data?.releases || []).

Result
- Dropdown shows the project’s release names and is selectable; value is the ZIP path for training.

Proceed?