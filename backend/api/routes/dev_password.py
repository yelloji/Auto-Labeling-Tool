from fastapi import APIRouter, Depends, HTTPException
from fastapi import Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
import hashlib

from database.database import get_db
from database.models import DevModeSetting
from logging_system.professional_logger import get_professional_logger

logger = get_professional_logger()
router = APIRouter()


class VerifyRequest(BaseModel):
    password: str


class ChangeRequest(BaseModel):
    current_password: str | None = None
    new_password: str


def _hash(p: str) -> str:
    return hashlib.sha256(p.encode("utf-8")).hexdigest()



@router.post("/dev/auth/verify")
async def verify_password(payload: VerifyRequest, db: Session = Depends(get_db)):
    pw = payload.password or ""
    if len(pw) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    row = db.query(DevModeSetting).order_by(DevModeSetting.id.asc()).first()
    if not row or not row.password_hash:
        raise HTTPException(status_code=404, detail="No developer password set")
    ok = row.password_hash == _hash(pw)
    logger.info("app.security", "dev_auth_verify", "dev_auth_verify", {"ok": ok})
    if not ok:
        raise HTTPException(status_code=401, detail="Invalid password")
    return {"ok": True}


@router.post("/dev/auth/change")
async def change_password(payload: ChangeRequest, db: Session = Depends(get_db)):
    npw = payload.new_password or ""
    if len(npw) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    row = db.query(DevModeSetting).order_by(DevModeSetting.id.asc()).first()
    if not row:
        row = DevModeSetting(password_hash=_hash(npw))
        db.add(row)
        db.commit()
        db.refresh(row)
        logger.info("app.security", "dev_auth_set_initial", "dev_auth_set_initial", {"id": row.id})
        return {"ok": True}
    if row.password_hash:
        cpw = payload.current_password or ""
        is_current = (row.password_hash == _hash(cpw))
        is_master = (row.master_password_hash and row.master_password_hash == _hash(cpw))
        if not (is_current or is_master):
            raise HTTPException(status_code=401, detail="Current password incorrect")
    row.password_hash = _hash(npw)
    db.add(row)
    db.commit()
    logger.info("app.security", "dev_auth_changed", "dev_auth_changed", {"id": row.id})
    return {"ok": True}