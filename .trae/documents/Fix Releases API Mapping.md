Update frontend service so `releasesAPI.getProjectReleases(projectId)` returns the actual list from backend.

Change:

* In `frontend/src/services/api.js`, map: `return Array.isArray(response.data) ? response.data : (response.data?.releases || [])` instead of assuming `{releases: [...]}`.

Result:

* Dataset dropdown receives a non-empty array and enables properly.

