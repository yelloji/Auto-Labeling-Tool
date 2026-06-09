"""
Remote Training Nodes — registration, health check, GPU discovery.
Local app uses these endpoints to manage RunPod (or any GPU VM) connections.
"""

from datetime import datetime
from typing import Optional

import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.database import get_db
from database.models import RemoteTrainingNode
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()
router = APIRouter()

AGENT_TIMEOUT = 3  # seconds for ping / GPU info requests


# ── Schemas ───────────────────────────────────────────────────────────────────

class NodeCreate(BaseModel):
    name: str
    host: str
    port: int = 12000


class NodeResponse(BaseModel):
    id: int
    name: str
    host: str
    port: int
    status: str
    last_seen: Optional[str]
    created_at: Optional[str]
    gpus: list = []

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────────────────────

def _base_url(node: RemoteTrainingNode) -> str:
    host = node.host.strip()
    if host.startswith("http://") or host.startswith("https://"):
        return host.rstrip("/")
    return f"http://{host}:{node.port}"


def _ping_node(node: RemoteTrainingNode) -> dict:
    """Call /agent/info on the remote agent. Returns info dict or raises."""
    url = f"{_base_url(node)}/agent/info"
    resp = requests.get(url, timeout=AGENT_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def _serialize(node: RemoteTrainingNode, gpus: list = []) -> dict:
    return {
        "id": node.id,
        "name": node.name,
        "host": node.host,
        "port": node.port,
        "status": node.status,
        "last_seen": node.last_seen.isoformat() if node.last_seen else None,
        "created_at": node.created_at.isoformat() if node.created_at else None,
        "gpus": gpus,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/remote-nodes")
def list_nodes(db: Session = Depends(get_db)):
    """List all registered remote training nodes."""
    nodes = db.query(RemoteTrainingNode).order_by(RemoteTrainingNode.created_at).all()
    return [_serialize(n) for n in nodes]


@router.post("/remote-nodes")
def register_node(payload: NodeCreate, db: Session = Depends(get_db)):
    """Register a new remote GPU node."""
    node = RemoteTrainingNode(
        name=payload.name,
        host=payload.host,
        port=payload.port,
        status="unknown",
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    logger.info("app.backend", f"Registered remote node: {node.name} at {node.host}:{node.port}", "remote_node_registered", {
        "node_id": node.id, "host": node.host, "port": node.port
    })
    return _serialize(node)


@router.delete("/remote-nodes/{node_id}")
def delete_node(node_id: int, db: Session = Depends(get_db)):
    """Remove a registered remote node."""
    node = db.query(RemoteTrainingNode).filter(RemoteTrainingNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    db.delete(node)
    db.commit()
    return {"ok": True, "deleted": node_id}


@router.get("/remote-nodes/{node_id}/ping")
def ping_node(node_id: int, db: Session = Depends(get_db)):
    """
    Ping a remote node to check if it is online and get its GPU list.
    Updates node status in DB.
    """
    node = db.query(RemoteTrainingNode).filter(RemoteTrainingNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    try:
        info = _ping_node(node)
        node.status = "online"
        node.last_seen = datetime.utcnow()
        db.commit()
        gpus = info.get("gpus", [])
        return {
            "ok": True,
            "status": "online",
            "version": info.get("version"),
            "gpus": gpus,
            **_serialize(node, gpus),
        }
    except Exception as e:
        node.status = "offline"
        db.commit()
        logger.warning("errors.system", f"Remote node {node.name} ping failed: {e}", "remote_node_ping_failed", {
            "node_id": node_id, "error": str(e)
        })
        return {
            "ok": False,
            "status": "offline",
            "error": str(e),
            **_serialize(node),
        }


@router.get("/remote-nodes/all-gpus")
def all_remote_gpus(db: Session = Depends(get_db)):
    """
    Return GPU list from all online remote nodes.
    Used by the GPU selector in the Training UI to show remote options.
    """
    nodes = db.query(RemoteTrainingNode).all()
    result = []
    for node in nodes:
        try:
            info = _ping_node(node)
            node.status = "online"
            node.last_seen = datetime.utcnow()
            for gpu in info.get("gpus", []):
                result.append({
                    "node_id": node.id,
                    "node_name": node.name,
                    "gpu_index": gpu["index"],
                    "gpu_name": gpu["name"],
                    "vram_gb": gpu.get("vram_gb", 0),
                    "label": f"{node.name} — {gpu['name']} ({gpu.get('vram_gb', '?')} GB)",
                    "value": f"remote:{node.id}:{gpu['index']}",
                })
        except Exception:
            node.status = "offline"
    db.commit()
    return {"remote_gpus": result}
