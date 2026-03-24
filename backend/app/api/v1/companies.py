from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import AdminUser, AuditLog, BillingRecord, Company, License, Worker, WorkerLicenseRequest
from ...schemas.company import CompanyCreate, CompanyUpdate, CompanyResponse, CompanyTree
from ...services.company_code import generate_company_code
from ...services.license import get_license_summary
from ...services import audit
from ..deps import get_current_user

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("/", response_model=list[CompanyResponse])
def list_companies(
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    """自社および配下企業の一覧"""
    # オーナーは全件、それ以外は自社以下（簡易実装）
    if current_user.company.level == 1:
        return db.query(Company).all()

    # 配下を再帰的に取得（実装は簡易版）
    return db.query(Company).filter(
        Company.company_code.like(f"{current_user.company.company_code}%")
    ).all()


@router.post("/", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
def create_company(
    body: CompanyCreate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    try:
        code = generate_company_code(db, body.parent_company_id, body.level)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    company = Company(
        **body.model_dump(),
        company_code=code,
    )
    db.add(company)
    db.flush()
    audit.log(db, "company.create", admin_user_id=current_user.id,
              company_id=current_user.company_id, target_type="company", target_id=company.id,
              detail={"code": code, "name": body.company_name})
    db.commit()
    db.refresh(company)
    return company


@router.get("/{company_id}", response_model=CompanyResponse)
def get_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="企業が見つかりません")
    return company


@router.patch("/{company_id}", response_model=CompanyResponse)
def update_company(
    company_id: int,
    body: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="企業が見つかりません")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(company, field, value)

    audit.log(db, "company.update", admin_user_id=current_user.id,
              company_id=current_user.company_id, target_type="company", target_id=company_id,
              detail=body.model_dump(exclude_unset=True))
    db.commit()
    db.refresh(company)
    return company


@router.delete("/{company_id}", status_code=204)
def delete_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="企業が見つかりません")
    if company_id == current_user.company_id:
        raise HTTPException(status_code=400, detail="自社は抹消できません")
    if not company.company_code.startswith(current_user.company.company_code):
        raise HTTPException(status_code=403, detail="配下企業のみ抹消できます")
    # 子会社があれば抹消不可
    if db.query(Company).filter(Company.parent_company_id == company_id).count() > 0:
        raise HTTPException(status_code=400, detail="配下に子会社があります。先に子会社を抹消してください。")
    # 管理者ユーザーがいれば抹消不可
    if db.query(AdminUser).filter(AdminUser.company_id == company_id).count() > 0:
        raise HTTPException(status_code=400, detail="管理者ユーザーが存在します。先に管理者を削除してください。")
    # 有効ライセンスがあれば抹消不可
    license_count = db.query(License).filter(
        License.company_id == company_id,
        License.status != "cancelled",
    ).count()
    if license_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"ライセンスが{license_count}件残っています。先にすべてのライセンスを解約してから抹消してください。",
        )
    # 関連レコードを削除
    worker_ids = [w.id for w in db.query(Worker.id).filter(Worker.company_id == company_id)]
    if worker_ids:
        db.query(WorkerLicenseRequest).filter(WorkerLicenseRequest.worker_id.in_(worker_ids)).delete(synchronize_session=False)
        db.query(Worker).filter(Worker.company_id == company_id).delete(synchronize_session=False)
    db.query(License).filter(License.company_id == company_id).delete(synchronize_session=False)
    db.query(BillingRecord).filter(BillingRecord.company_id == company_id).delete(synchronize_session=False)
    db.query(AuditLog).filter(AuditLog.company_id == company_id).update({"company_id": None}, synchronize_session=False)
    audit.log(db, "company.delete", admin_user_id=current_user.id,
              company_id=current_user.company_id, target_type="company", target_id=company_id,
              detail={"code": company.company_code, "name": company.company_name})
    db.delete(company)
    db.commit()


@router.get("/{company_id}/license-summary")
def license_summary(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    return get_license_summary(db, company_id)
