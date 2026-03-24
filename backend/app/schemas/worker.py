from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date


class WorkerCreate(BaseModel):
    company_id: int
    branch_id: Optional[int] = None
    name: str
    line_user_id: Optional[str] = None


class WorkerResponse(BaseModel):
    id: int
    company_id: int
    branch_id: Optional[int]
    name: str
    line_user_id: Optional[str]
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class LicenseRequestResponse(BaseModel):
    id: int
    worker_id: int
    worker_name: str
    company_id: int
    branch_id: Optional[int]
    requested_at: datetime
    status: str

    model_config = {"from_attributes": True}


class WorkerUpdate(BaseModel):
    name: Optional[str] = None
    branch_id: Optional[int] = None
    status: Optional[str] = None


class ApproveRequest(BaseModel):
    pass


class RejectRequest(BaseModel):
    reason: Optional[str] = None


class LicenseApplyRequest(BaseModel):
    company_id: int  # 整備会社ID
    branch_id: Optional[int] = None


class LicenseResponse(BaseModel):
    id: int
    license_id: str
    company_id: int
    company_name: str
    company_code: str
    branch_id: Optional[int]
    branch_name: Optional[str]
    worker_id: Optional[int]
    worker_name: Optional[str]
    applied_by_company_id: Optional[int]
    applied_by_company_name: Optional[str]
    status: str
    applied_at: datetime
    valid_from: date
    valid_until: date
    cancellation_requested_at: Optional[datetime]
    end_date: Optional[date]

    model_config = {"from_attributes": True}


class LicenseAssignRequest(BaseModel):
    branch_id: Optional[int] = None
    worker_id: Optional[int] = None
