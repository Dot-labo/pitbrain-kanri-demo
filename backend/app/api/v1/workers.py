from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import AdminUser, Company, Worker, WorkerLicenseRequest
from ...schemas.worker import WorkerCreate, WorkerUpdate, WorkerResponse, LicenseRequestResponse, RejectRequest
from ...services import audit
from ..deps import get_current_user

router = APIRouter(prefix="/workers", tags=["workers"])


@router.get("/", response_model=list[WorkerResponse])
def list_workers(
    company_id: int | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    q = db.query(Worker)
    if company_id:
        q = q.filter(Worker.company_id == company_id)
    if status:
        q = q.filter(Worker.status == status)
    return q.all()


@router.get("/pending", response_model=list[LicenseRequestResponse])
def pending_requests(
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    """承認待ち申請一覧"""
    requests = (
        db.query(WorkerLicenseRequest)
        .join(Worker)
        .filter(
            WorkerLicenseRequest.status == "pending",
            Worker.company_id == current_user.company_id,
        )
        .all()
    )
    return [
        LicenseRequestResponse(
            id=r.id,
            worker_id=r.worker_id,
            worker_name=r.worker.name,
            company_id=r.worker.company_id,
            branch_id=r.worker.branch_id,
            requested_at=r.requested_at,
            status=r.status,
        )
        for r in requests
    ]


@router.post("/create", response_model=WorkerResponse, status_code=201)
def create_worker(
    body: WorkerCreate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    """管理画面から直接作業員を作成する"""
    worker = Worker(
        company_id=body.company_id,
        branch_id=body.branch_id,
        name=body.name,
        line_user_id=body.line_user_id,
        status="active",
    )
    db.add(worker)
    audit.log(db, "worker.create", admin_user_id=current_user.id,
              company_id=current_user.company_id, target_type="worker", detail={"name": body.name})
    db.commit()
    db.refresh(worker)
    return worker


@router.patch("/{worker_id}", response_model=WorkerResponse)
def update_worker(
    worker_id: int,
    body: WorkerUpdate,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    """作業員情報を更新する"""
    worker = db.get(Worker, worker_id)
    if not worker:
        raise HTTPException(status_code=404, detail="作業員が見つかりません")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(worker, field, value)
    audit.log(db, "worker.update", admin_user_id=current_user.id,
              company_id=current_user.company_id, target_type="worker", target_id=worker_id,
              detail=body.model_dump(exclude_unset=True))
    db.commit()
    db.refresh(worker)
    return worker


@router.post("/apply")
def apply_worker(
    body: WorkerCreate,
    db: Session = Depends(get_db),
):
    """
    LINE から呼ばれる申請エンドポイント（認証不要）
    worker 作成 → request 作成
    """
    worker = Worker(**body.model_dump())
    db.add(worker)
    db.flush()

    req = WorkerLicenseRequest(worker_id=worker.id)
    db.add(req)
    db.commit()
    db.refresh(worker)
    return {"worker_id": worker.id, "request_id": req.id}


@router.post("/requests/{request_id}/approve")
def approve_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    req = db.get(WorkerLicenseRequest, request_id)
    if not req or req.status != "pending":
        raise HTTPException(status_code=404, detail="申請が見つかりません")

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    req.status = "approved"
    req.reviewed_by = current_user.id
    req.reviewed_at = now

    req.worker.status = "active"

    audit.log(db, "worker.approve", admin_user_id=current_user.id,
              company_id=current_user.company_id, target_type="worker_license_request",
              target_id=request_id)
    db.commit()
    return {"message": "承認しました"}


@router.post("/requests/{request_id}/reject")
def reject_request(
    request_id: int,
    body: RejectRequest,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    req = db.get(WorkerLicenseRequest, request_id)
    if not req or req.status != "pending":
        raise HTTPException(status_code=404, detail="申請が見つかりません")

    from datetime import datetime, timezone
    req.status = "rejected"
    req.reviewed_by = current_user.id
    req.reviewed_at = datetime.now(timezone.utc)
    req.reject_reason = body.reason

    audit.log(db, "worker.reject", admin_user_id=current_user.id,
              company_id=current_user.company_id, target_type="worker_license_request",
              target_id=request_id, detail={"reason": body.reason})
    db.commit()
    return {"message": "却下しました"}


@router.post("/{worker_id}/deactivate")
def deactivate_worker(
    worker_id: int,
    db: Session = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    """作業員退職・無効化"""
    worker = db.get(Worker, worker_id)
    if not worker:
        raise HTTPException(status_code=404, detail="作業員が見つかりません")

    worker.status = "cancelled"

    # 紐付きライセンスを unassigned に戻す
    if worker.license and worker.license.status == "in_use":
        worker.license.status = "unassigned"
        worker.license.worker_id = None

    audit.log(db, "worker.deactivate", admin_user_id=current_user.id,
              company_id=current_user.company_id, target_type="worker", target_id=worker_id)
    db.commit()
    return {"message": "無効化しました"}
