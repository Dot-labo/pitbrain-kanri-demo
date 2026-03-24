from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date


class BillingRecordResponse(BaseModel):
    id: int
    company_id: int
    company_name: str
    target_month: str
    license_count: int
    invoice_date: Optional[date]
    payment_date: Optional[date]
    payment_status: str
    notes: Optional[str]
    updated_at: datetime

    model_config = {"from_attributes": True}


class BillingStatusUpdate(BaseModel):
    payment_status: str
    invoice_date: Optional[date] = None
    payment_date: Optional[date] = None
    notes: Optional[str] = None
