Issue
- Frontend calls `/projects/${projectId}/releases` but backend mounts releases router under `/api/v1`.
- Mismatch returns empty/404 → dropdown disabled.

Change (frontend only)
- Update `releasesAPI.getProjectReleases(projectId)` to use `/api/v1/projects/${projectId}/releases`.
- Keep the response mapping as: `Array.isArray(data) ? data : (data?.releases || [])`.

Result
- Dropdown fetches actual releases and enables, showing release names and using `.zip` model_path for value.

Proceed to update the path now?