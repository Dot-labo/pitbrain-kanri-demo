from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
from ...database import get_db
from ...models import AdminUser, Company, Worker, License
from ...schemas.worker import LicenseApplyRequest, LicenseResponse, LicenseAssignRequest
from ...services.license import generate_license_id, get_month_start, get_month_end
from ...services import audit
from ..deps import get_current_user

router = APIRouter(prefix="/licenses", tags=["licenses"])


@router.post("", response_model=LicenseResponse, status_code=201)
def apply_license(body: LicenseApplyRequest, db=Depends(get_db), current_user=Depends(get_current_user)):
    """ライセンス申請（即時発行）"""
    today = date.today()
    license_id = generate_license_id(db)
    lic = License(
        license_id=license_id,
        company_id=body.company_id,
        branch_id=body.branch_id,
        applied_by_company_id=current_user.company_id,
        status="unassigned",
        valid_from=get_month_start(today),
        valid_until=get_month_end(today),
    )
    db.add(lic)
    audit.log(db, "license.apply", admin_user_id=current_user.id, company_id=current_user.company_id,
              target_type="license", target_id=None, detail={"license_id": license_id})
    db.commit()
    db.refresh(lic)
    return _to_response(db, lic)


@router.get("", response_model=list[LicenseResponse])
def list_licenses(db=Depends(get_db), current_user=Depends(get_current_user)):
    """自社配下のライセンス一覧"""
    my_code = current_user.company.company_code
    sub_ids = [r.id for r in db.query(Company.id).filter(Company.company_code.like(f"{my_code}%")).all()]
    lics = db.query(License).filter(License.company_id.in_(sub_ids)).order_by(License.id.desc()).all()
    return [_to_response(db, l) for l in lics]


@router.patch("/{license_id}/assign", response_model=LicenseResponse)
def assign_license(license_id: str, body: LicenseAssignRequest, db=Depends(get_db), current_user=Depends(get_current_user)):
    """支店・作業員への割当"""
    lic = db.query(License).filter(License.license_id == license_id).first()
    if not lic:
        raise HTTPException(404, "ライセンスが見つかりません")
    # 常に更新（null で明示的に解除も可能）
    lic.branch_id = body.branch_id
    lic.worker_id = body.worker_id
    # 割当操作をしたら unassigned / suspended → in_use（停止からの再開も含む）
    if lic.status in ("unassigned", "suspended"):
        lic.status = "in_use"
    db.commit()
    db.refresh(lic)
    return _to_response(db, lic)


@router.post("/{license_id}/suspend", response_model=LicenseResponse)
def suspend_license(license_id: str, db=Depends(get_db), current_user=Depends(get_current_user)):
    lic = db.query(License).filter(License.license_id == license_id).first()
    if not lic or lic.status in ("cancelled",):
        raise HTTPException(404, "ライセンスが見つかりません")
    lic.status = "suspended"
    db.commit()
    db.refresh(lic)
    return _to_response(db, lic)


@router.post("/{license_id}/cancel", response_model=LicenseResponse)
def cancel_license(license_id: str, db=Depends(get_db), current_user=Depends(get_current_user)):
    """解約申請：当月末で終了"""
    from datetime import datetime, timezone
    lic = db.query(License).filter(License.license_id == license_id).first()
    if not lic or lic.status == "cancelled":
        raise HTTPException(404, "ライセンスが見つかりません")
    now = datetime.now(timezone.utc)
    lic.cancellation_requested_at = now
    if lic.status == "unassigned":
        # 未割当は即時解約
        lic.status = "cancelled"
        lic.end_date = date.today()
    else:
        # 利用中・停止中は当月末で終了
        lic.status = "cancellation_scheduled"
        lic.end_date = get_month_end(date.today())
    db.commit()
    db.refresh(lic)
    return _to_response(db, lic)


def _to_response(db, lic: License) -> LicenseResponse:
    company = db.get(Company, lic.company_id)
    branch = db.get(Company, lic.branch_id) if lic.branch_id else None
    worker = db.get(Worker, lic.worker_id) if lic.worker_id else None
    applied_by = db.get(Company, lic.applied_by_company_id) if lic.applied_by_company_id else None
    return LicenseResponse(
        id=lic.id,
        license_id=lic.license_id,
        company_id=lic.company_id,
        company_name=company.company_name if company else "",
        company_code=company.company_code if company else "",
        branch_id=lic.branch_id,
        branch_name=branch.company_name if branch else None,
        worker_id=lic.worker_id,
        worker_name=worker.name if worker else None,
        applied_by_company_id=lic.applied_by_company_id,
        applied_by_company_name=applied_by.company_name if applied_by else None,
        status=lic.status,
        applied_at=lic.applied_at,
        valid_from=lic.valid_from,
        valid_until=lic.valid_until,
        cancellation_requested_at=lic.cancellation_requested_at,
        end_date=lic.end_date,
    )
