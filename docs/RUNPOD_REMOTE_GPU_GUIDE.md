# RunPod Remote GPU Training — Complete Guide

Train YOLO on a remote RunPod GPU directly from the app when the local GPU is too small.
This guide has every command, in order, with the exact settings that work.

> **Proven working setup:** RTX A6000 (48 GB) · workers=2 · batch=4 · imgsz=1312 · numpy<2.0 · cached data.

---

## How it works (the big picture)

```
Your PC (app)                         RunPod pod (Linux)
─────────────                         ──────────────────
Backend + Frontend                    agent.py  (one small file)
   │                                       │
   │  pick "Remote GPU" in Training        │
   │  ── create job ──────────────────────►│
   │  ── upload release ZIP (once) ────────►│ extracts to releases_cache/
   │  ── start training ──────────────────►│ runs YOLO on the A6000
   │  ◄── poll log every 1.5s ─────────────│ writes training.log
   │  ◄── download full output folder ─────│ best.pt, last.pt, plots, results
   ▼
projects/<proj>/model/training/<name>/   ← looks exactly like a local training
```

- **agent.py** = the only thing that runs on RunPod. It receives data, runs YOLO, serves logs + results.
- **Release cache** = uploaded data is kept on the pod, so repeat trainings of the same release skip the upload.
- The finished training folder downloads back and appears in **Model Lab** like any local training.

---

# PART 1 — First-Time Pod Setup (do once per new pod)

## Step 1 — Create the pod

runpod.io → **Pods** → **Deploy**

- **Template:** `Runpod Pytorch 2.2.0`
  (image `runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04`)
- **GPU:** RTX A6000 (48 GB) or RTX 6000 Ada (48 GB)
- **Storage:**
  - Container disk: `50 GB`
  - Volume disk: `20 GB` (this is `/workspace`, survives Stop)
- Click **"Set overrides"**:
  - Container start command: **leave EMPTY** (a start command stops Jupyter and the pod restarts in a loop)
  - **Expose HTTP ports:** `8888`
  - **Expose TCP ports:** `22,12000`   ← **12000 MUST be a TCP port, not HTTP** (HTTP proxy breaks large uploads with SSL errors)
- Click **Set overrides** → **Deploy**

## Step 2 — Get the connection address

Wait for the green dot → **Connect** tab → look at **Direct TCP ports**:
```
194.68.245.215:22186 → :22
194.68.245.215:22102 → :12000     ← THIS is what you need
```
Write down the **IP** (`194.68.245.215`) and the **port** mapped to `:12000` (`22102`).
This is what you enter in the app.

> The port changes every time you create a NEW pod. After just Stop/Start it usually stays.

## Step 3 — Open a terminal on the pod

Connect tab → click **Jupyter Lab** (port 8888) → in Jupyter click **Terminal**.
(Web terminal needs an SSH key; Jupyter terminal does not — use Jupyter.)

## Step 4 — Install the packages (CRITICAL: includes numpy<2.0)

```bash
pip install fastapi==0.104.1 "uvicorn[standard]==0.24.0" python-multipart==0.0.6 "ultralytics==8.4.23" PyYAML "numpy<2.0"
```

Then **force numpy below 2.0** (RunPod's torch 2.2.0 needs numpy 1.x — numpy 2.x causes
`RuntimeError: Numpy is not available` and training dies at the AMP check):
```bash
pip install "numpy<2.0" --force-reinstall
python -c "import numpy; print('numpy', numpy.__version__)"     # must print 1.26.x
```

## Step 5 — Put agent.py on the pod

The file is in the repo at: `backend/models/remote_training_agent/agent.py`

Option A — Jupyter upload: file browser → go into `/workspace` → upload `agent.py`.

Option B — paste via terminal (if upload misbehaves):
```bash
cat > /workspace/agent.py
# paste the FULL contents of agent.py, then press Ctrl+D
```

## Step 6 — Start the agent

```bash
nohup python /workspace/agent.py > /workspace/agent.log 2>&1 &
cat /workspace/agent.log
```

to watch uplaoding  us etshei 
-----   watch -n 2 "awk '/eth0/{printf \"Uploaded: %.2f GB of ~4.3 GB\\n\", \$2/1024/1024/1024}' /proc/net/dev"    -------

You should see:
```
Gevis Remote Training Agent v1.0.0
Listening on port 12000
  GPU 0: NVIDIA RTX A6000 (48.0 GB VRAM)
Uvicorn running on http://0.0.0.0:12000
```

## Step 7 — Register the node in the app (once)

App → Training section → click **GPU** → **Manage Remote Nodes** → add:
- **Name:** anything (e.g. `RunPod A6000`)
- **Host:** the IP from Step 2 (e.g. `194.68.245.215`)
- **Port:** the `:12000` mapped port from Step 2 (e.g. `22102`)

Click **Add** → **Ping** → should go green **online**.

> You can also enter the host as a full URL `http://IP:PORT`; the app handles both.

---

# PART 2 — Run a Training

1. App → Training section → click **GPU** → pick **`RunPod A6000 — ...`** under "Remote GPU".
2. **Set these params (important for 1312px segmentation on 48 GB):**
   - **Workers = 2**  (container RAM is capped ~50 GB; 8 workers = RAM OOM)
   - **Batch = 4**    (batch 8 trains but OOMs the GPU during validation; batch 4 fits both)
   - imgsz = 1312
3. Fill the training name, pick the release.
4. **Start Training.**

**First training of a release:** uploads the ZIP once (slow — depends on your upload speed; 4.4 GB ≈ 30+ min at ~18 Mbps). Watch it on the pod:
```bash
cat /proc/net/dev | grep eth0      # run twice; first number should grow ~67 MB / 30s
```

**Every training after** (same release): the app asks the agent "is this release cached?" → **yes** → **skips the upload** → starts in seconds.

When done, the full training folder downloads to:
```
projects/<project>/model/training/<name>/
   weights/best.pt, last.pt, args.yaml, results.csv/png, confusion_matrix, curves, batch jpgs
```
and appears in **Model Lab**.

---

# PART 3 — Stop / Reuse the Pod

When finished training for now:
- Click **Stop** on the pod (NOT Terminate).
  - GPU billing stops.
  - `/workspace` (agent.py + releases_cache) **survives** → next time skips upload.
- **Terminate** only if you want zero cost and don't mind losing the cached data + re-doing Part 1.

**Restarting a stopped pod:**
1. Start it → check the Connect page; if the `:12000` TCP port changed, update it in Manage Remote Nodes.
2. Re-install packages (pip installs live on container disk, wiped on Stop):
   ```bash
   pip install fastapi==0.104.1 "uvicorn[standard]==0.24.0" python-multipart==0.0.6 "ultralytics==8.4.23" PyYAML "numpy<2.0"
   pip install "numpy<2.0" --force-reinstall
   ```
3. Start the agent (agent.py is still in /workspace):
   ```bash
   nohup python /workspace/agent.py > /workspace/agent.log 2>&1 &
   ```

---

# Command Cheat-Sheet

| What | Command |
|------|---------|
| Install packages (+numpy fix) | `pip install fastapi==0.104.1 "uvicorn[standard]==0.24.0" python-multipart==0.0.6 "ultralytics==8.4.23" PyYAML "numpy<2.0"` then `pip install "numpy<2.0" --force-reinstall` |
| Check numpy version | `python -c "import numpy; print(numpy.__version__)"` (must be 1.26.x) |
| Start agent (background) | `nohup python /workspace/agent.py > /workspace/agent.log 2>&1 &` |
| Is the agent running? | `ps aux | grep agent.py | grep -v grep` |
| Read agent log | `cat /workspace/agent.log` (or `tail -f /workspace/agent.log`) |
| List jobs on agent | `curl -s http://localhost:12000/agent/jobs` |
| Check GPU usage | `nvidia-smi` |
| Check RAM | `free -h` |
| Watch upload arriving | `cat /proc/net/dev | grep eth0` (run twice, first number grows) |
| Stop the agent | `pkill -f agent.py` |
| Kill a stuck training (NOT the agent) | `pkill -f "yolo cfg="` |
| Remove old job folders (keep cache) | `rm -rf /workspace/jobs/*` |
| Confirm cache still present | `ls /workspace/releases_cache/` |

---

# Troubleshooting (every issue we hit, and the fix)

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Connection actively refused` / `Max retries exceeded` on `/agent/job/create` | Agent not running, or pod port changed | `ps aux | grep agent.py`; restart agent; check `:12000` TCP port on Connect page and update node in app |
| Upload fails with `SSLError / EOF` | Port 12000 was exposed as **HTTP** (proxy can't do big uploads) | Recreate pod with `12000` under **TCP ports**, not HTTP |
| Pod keeps restarting / Jupyter 404 | A **start command** was set in overrides | Clear the container start command; leave it empty |
| `RuntimeError: Numpy is not available` (dies at AMP check) | numpy 2.x installed | `pip install "numpy<2.0" --force-reinstall` |
| Training dies right after "Starting training", no traceback, RunPod shows **OOM (RAM)** | Too many dataloader workers for the ~50 GB container | Set **workers = 2** (or 4). Also kill orphan workers: `pkill -f "yolo cfg="` |
| `CUDA out of memory` **during validation** (training was fine) | Segmentation validation spikes VRAM higher than training | Lower **batch** (batch 4 for 1312px seg on 48 GB) |
| Stuck `yolo` processes after a crash (RAM stays high) | Crashed training left orphan workers | `pkill -f "yolo cfg="`, verify `ps aux | grep yolo` is empty |
| Re-uploading 4.4 GB every run | Release not cached / changed | First run uploads once; same release after = auto-skips. New/regenerated release = uploads once more |
| `OSError: [Errno 5] Input/output error` writing `results.csv` mid-training | `/workspace` is a **network filesystem** (MooseFS `mfs#...runpod.net`); YOLO's constant small writes (results.csv + checkpoints every epoch) hit a network glitch | Agent now writes job output to the **local disk `/jobs`** (not `/workspace`). Re-upload the updated `agent.py`, restart the agent, restart training. Disk being full is NOT the cause — check `df -h` (overlay `/` has plenty). |

---

# Known limitations / notes

- **Live card updates per-epoch, not per-batch** on remote (Linux pod buffers YOLO's progress bar to file differently than local Windows). Cosmetic only — all metrics, validation results, and the model are correct. Not worth chasing.
- **VRAM vs RAM are different limits:**
  - VRAM (48 GB GPU) → controlled by **batch**
  - System RAM (~50 GB container) → controlled by **workers**
- **Batch size barely affects final accuracy** — it mainly affects memory and stability. Use the largest that fits validation, or a safe value like 4.
- Cache key = `<release-zip-name>_<size-in-bytes>`. Change the release (new size) → new key → one fresh upload, then cached again.
- Memory split per run: validation **inference** = GPU; writing results (json/plots) = CPU/RAM. OOMs during validation are always the GPU side.
