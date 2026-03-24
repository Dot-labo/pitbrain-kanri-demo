import json
from sqlalchemy.orm import Session
from ..models import AuditLog


def log(
    db: Session,
    action: str,
    *,
    admin_user_id: int | None = None,
    company_id: int | None = None,
    target_type: str | None = None,
    target_id: int | None = None,
    detail: dict | None = None,
) -> AuditLog:
    entry = AuditLog(
        admin_user_id=admin_user_id,
        company_id=company_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        detail=json.dumps(detail, ensure_ascii=False) if detail else None,
    )
    db.add(entry)
    db.flush()  # ID を取得するため（commit は呼び出し元）
    return entry
