from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import AdminUser, BillingRecord, Company
from ...schemas.billing import BillingRecordResponse, BillingStatusUpdate
from ...services.license import snapshot_billing, get_active_license_count, get_direct_active_license_count
from ...services import audit
from ..deps import get_current_user

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/", response_model=list[BillingRecordResponse])
def list_billing(
    target_month: str | None = None,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    q = (
        db.query(BillingRecord)
        .join(Company)
        .filter(
            Company.company_code.like(f"{current_user.company.company_code}%")
        )
    )
    if target_month:
        q = q.filter(BillingRecord.target_month == target_month)
    records = q.all()
    return [
        BillingRecordResponse(
            **{c.name: getattr(r, c.name) for c in BillingRecord.__table__.columns},
            company_name=r.company.company_name,
        )
        for r in records
    ]


@router.get("/my", response_model=list[BillingRecordResponse])
def list_my_billing(
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    """自社の支払い実績一覧（当月レコードを自動作成）"""
    from datetime import datetime
    current_month = datetime.utcnow().strftime("%Y-%m")
    existing = db.query(BillingRecord).filter(
        BillingRecord.company_id == current_user.company_id,
        BillingRecord.target_month == current_month,
    ).first()
    current_count = get_active_license_count(db, current_user.company_id)
    if not existing:
        record = BillingRecord(
            company_id=current_user.company_id,
            target_month=current_month,
            license_count=current_count,
            payment_status="uninvoiced",
        )
        db.add(record)
        db.commit()
    else:
        existing.license_count = current_count
        db.commit()
    records = (
        db.query(BillingRecord)
        .filter(BillingRecord.company_id == current_user.company_id)
        .order_by(BillingRecord.target_month)
        .all()
    )
    return [
        BillingRecordResponse(
            **{c.name: getattr(r, c.name) for c in BillingRecord.__table__.columns},
            company_name=r.company.company_name,
        )
        for r in records
    ]


@router.post("/snapshot")
def take_snapshot(
    target_month: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    """月次スナップショット（バッチ or 手動実行）"""
    if current_user.company.level != 1:
        raise HTTPException(status_code=403, detail="オーナーのみ実行可能です")
    count = snapshot_billing(db, target_month)
    audit.log(db, "billing.snapshot", admin_user_id=current_user.id,
              company_id=current_user.company_id, detail={"target_month": target_month, "count": count})
    db.commit()
    return {"message": f"{count} 件スナップショットしました"}


@router.get("/live")
def get_live_counts(
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    """現在のリアルタイムライセンス数（スナップショットなし）"""
    companies = (
        db.query(Company)
        .filter(
            Company.company_code.like(f"{current_user.company.company_code}%"),
            Company.level > current_user.company.level,
        )
        .all()
    )
    return [
        {"company_id": c.id, "license_count": get_active_license_count(db, c.id)}
        for c in companies
    ]


@router.post("/ensure", response_model=BillingRecordResponse)
def ensure_billing_record(
    company_id: int,
    target_month: str,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    """指定企業・月の請求レコードが存在しなければ作成して返す"""
    record = (
        db.query(BillingRecord)
        .filter(BillingRecord.company_id == company_id, BillingRecord.target_month == target_month)
        .first()
    )
    if not record:
        company = db.get(Company, company_id)
        if not company:
            raise HTTPException(status_code=404, detail="企業が見つかりません")
        record = BillingRecord(
            company_id=company_id,
            target_month=target_month,
            license_count=get_active_license_count(db, company_id),
            payment_status="uninvoiced",
        )
        db.add(record)
        db.commit()
        db.refresh(record)
    return BillingRecordResponse(
        **{c.name: getattr(record, c.name) for c in BillingRecord.__table__.columns},
        company_name=record.company.company_name,
    )


@router.patch("/{record_id}", response_model=BillingRecordResponse)
def update_billing(
    record_id: int,
    body: BillingStatusUpdate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    record = db.get(BillingRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="請求レコードが見つかりません")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(record, field, value)

    audit.log(db, "billing.update", admin_user_id=current_user.id,
              company_id=current_user.company_id, target_type="billing_record", target_id=record_id,
              detail=body.model_dump(mode="json", exclude_unset=True))
    db.commit()
    db.refresh(record)
    return BillingRecordResponse(
        **{c.name: getattr(record, c.name) for c in BillingRecord.__table__.columns},
        company_name=record.company.company_name,
    )
