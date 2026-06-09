# Remote Training Node — Feature Plan

## Problem
Local GPU (12GB VRAM) is insufficient for:
- Large tile-based training (e.g. 5×4 tiles at 1312px)
- Larger image sizes needed for small-crack detection
- Customer retraining workflows with big datasets

The entire workflow lives inside the app (labeling → release → training → validation → prediction).
Moving training outside the app is not a simple option.
Therefore remote GPU support must be built INTO the app.

## Core Concept

> A "Remote Training Node" is another machine that runs our same FastAPI backend.
> The local app connects to it via HTTP API — no SSH, no complex data transfer protocols.
> Training is dispatched there. Metrics stream back. Model downloads when done.

The user sees it as just another GPU option in the GPU selector.

---

## Architecture

```
Local App (Windows)                    Remote Node (Ubuntu VM)
─────────────────────                  ──────────────────────
Frontend (React)                       Same FastAPI backend
    │                                      │
    ▼                                      │
Local FastAPI Backend ─── HTTP ──────────► Remote FastAPI Backend
    │                                      │
    │  1. Register node                    │  - Accepts training jobs
    │  2. Upload release ZIP               │  - Uses local GPU (A100 etc.)
    │  3. Submit training config           │  - Streams metrics via API
    │  4. Poll metrics                     │  - Serves model files for download
    │  5. Download best.pt                 │
    ▼
Local DB + Model Files
```

---

## What the User Sees

### Settings — Remote Nodes page
- Add a remote node: Name + Host + Port
- Test connection button
- Shows: Online/Offline, GPU name, VRAM

### GPU Selector (Training)
```
Select GPU:
  ── Local ──
  ● NVIDIA RTX 3080 (12 GB)
  
  ── Valdi Cloud VM ──
  ○ NVIDIA A100 (40 GB)
  ○ NVIDIA A6000 (48 GB)
```

### Training Status
- Shows "Training on: Valdi Cloud VM" badge
- Live metrics stream exactly like local training
- No difference in user experience

---

## Phases

### Phase 1 — Node Registration + Health Check
**DB:**
- New table: `remote_training_nodes`
  - `id`, `name`, `host`, `port`, `api_key`, `status`, `last_seen`, `created_at`

**Local Backend — new file `backend/api/routes/remote_nodes.py`:**
- `GET /api/v1/remote-nodes` — list all nodes with status
- `POST /api/v1/remote-nodes` — register node (name, host, port)
- `DELETE /api/v1/remote-nodes/{id}` — remove node
- `GET /api/v1/remote-nodes/{id}/ping` — check if node is online
- `GET /api/v1/remote-nodes/{id}/gpus` — get GPU list from remote node

**Remote Node Backend — new endpoint:**
- `GET /api/v1/node/info` — returns: hostname, GPU list (name, VRAM), version
- (Added to existing backend so the same app works as a node)

**Frontend:**
- Settings page → new "Remote Nodes" tab
- Add / Remove / Test node UI

---

### Phase 2 — GPU Selector Update
**Frontend — GPU Selection Dialog:**
- Currently shows only local GPUs
- New: grouped list — Local section + one section per registered online node
- Selected GPU stored as: `{ type: 'local'|'remote', nodeId, gpuIndex }`

**Local Backend:**
- `GET /api/v1/training/available-gpus` — returns local + all remote node GPUs merged

---

### Phase 3 — Training Dispatch to Remote Node
**When user starts training with a remote GPU selected:**

1. Local backend finds the release ZIP path
2. Uploads release ZIP to remote node:
   - `POST /remote-node/api/v1/node/upload-release` (multipart)
   - Remote node extracts ZIP to its own `training_data/` area
3. Submits training config to remote node:
   - `POST /remote-node/api/v1/node/start-training`
   - Body: full training config (model, epochs, imgsz, batch, etc.)
   - Remote node starts YOLO training in background thread
   - Returns: `remote_job_id`
4. Local DB records training session with:
   - `remote_node_id`
   - `remote_job_id`
   - `status = 'running_remote'`

**Remote Node Backend — new endpoints:**
- `POST /api/v1/node/upload-release` — receive and extract release ZIP
- `POST /api/v1/node/start-training` — start training job, return job_id
- `GET /api/v1/node/training/{job_id}/metrics` — return latest metrics
- `GET /api/v1/node/training/{job_id}/status` — running/done/failed
- `GET /api/v1/node/training/{job_id}/download/best` — stream best.pt
- `GET /api/v1/node/training/{job_id}/download/last` — stream last.pt
- `POST /api/v1/node/training/{job_id}/stop` — stop training

---

### Phase 4 — Metrics Streaming
**Local backend polling loop:**
- When `status = 'running_remote'`, background thread polls remote node every 5s
- Fetches metrics from remote node
- Stores in existing `training_metrics` in-memory dict (same as local training)
- Frontend WebSocket/polling picks it up exactly as before
- Frontend shows live charts — no difference from local training

---

### Phase 5 — Results + Model Download
**When remote training completes:**
1. Local backend detects `status = done` from remote node
2. Downloads `best.pt` from remote node → saves to local project model folder
3. Downloads `last.pt` from remote node → saves to local project model folder
4. Updates local DB training session: `status = 'completed'`, paths saved
5. Training appears in Model Lab exactly like a local training

**Cleanup:**
- After successful download, local backend calls remote node to clean up job files
- `DELETE /api/v1/node/training/{job_id}` — remote node deletes extracted data + weights

---

### Phase 6 — Remote Node Setup Script
**Script: `remote_node_setup.sh`**
- Installs Python 3.11
- Installs CUDA requirements (`requirements-cuda121.txt`)
- Copies backend folder
- Creates systemd service or simple run script
- Sets `NODE_MODE=true` env var so backend knows it's a remote node

**When `NODE_MODE=true`:**
- Backend enables the `/api/v1/node/*` endpoints
- Backend disables project management endpoints (projects, labels, annotations etc.)
- Acts only as a training executor

---

## DB Changes

### New table: `remote_training_nodes`
```sql
CREATE TABLE remote_training_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 8000,
    api_key TEXT,
    status TEXT DEFAULT 'unknown',
    last_seen DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Updated: `training_sessions`
```sql
ALTER TABLE training_sessions ADD COLUMN remote_node_id INTEGER REFERENCES remote_training_nodes(id);
ALTER TABLE training_sessions ADD COLUMN remote_job_id TEXT;
```

---

## New Files to Create

### Backend
- `backend/api/routes/remote_nodes.py` — node registration/management endpoints
- `backend/api/routes/node_receiver.py` — endpoints that run on the remote node side
- `backend/api/services/remote_training_dispatcher.py` — dispatch + poll logic

### Frontend
- `frontend/src/components/settings/RemoteNodesSettings.jsx` — node management UI
- `frontend/src/api/remoteNodes.js` — API methods

### Scripts
- `remote_node_setup.sh` — Ubuntu setup script for remote node

---

## Implementation Order

| # | Phase | Effort |
|---|-------|--------|
| 1 | DB migration (2 new columns + 1 new table) | Small |
| 2 | Remote node info endpoint (`/api/v1/node/info`) | Small |
| 3 | Node registration backend + Settings UI | Medium |
| 4 | GPU selector update (local + remote merged) | Medium |
| 5 | Release ZIP upload + training dispatch | Large |
| 6 | Metrics polling proxy | Medium |
| 7 | Model download + local save on completion | Medium |
| 8 | Remote node setup script | Small |
| 9 | Stop training on remote node | Small |

---

## Key Rules
- Remote node runs the SAME backend codebase — no separate project
- `NODE_MODE=true` env var enables node-only endpoints, disables management endpoints
- No SSH — all communication is HTTP API
- Release ZIP is the only data that transfers (already exists from release creation)
- Model files (best.pt, last.pt) download to local project folder when done
- Local DB is the source of truth — remote node is stateless between jobs
- API key authentication between local and remote nodes (optional v1, required v2)

---

## Open Questions Before Coding
1. Should node communication use HTTPS or HTTP? (Local network = HTTP ok; public internet = HTTPS needed)
2. Should we add API key auth in v1 or leave it for v2?
3. Where in Settings should Remote Nodes appear? (New tab, or new sidebar item?)
4. Should we show remote node GPU metrics (temperature, utilization) in the training status view?
