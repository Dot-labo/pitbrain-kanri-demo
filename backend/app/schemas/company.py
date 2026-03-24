from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class CompanyBase(BaseModel):
    company_name: str
    company_name_kana: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    postal_code: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    license_limit: Optional[int] = None  # 支店のみ


class CompanyCreate(CompanyBase):
    level: int
    parent_company_id: Optional[int] = None


class CompanyUpdate(CompanyBase):
    company_name: Optional[str] = None
    status: Optional[str] = None


class CompanyResponse(CompanyBase):
    id: int
    company_code: str
    level: int
    parent_company_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CompanyTree(CompanyResponse):
    children: list["CompanyTree"] = []

    model_config = {"from_attributes": True}


CompanyTree.model_rebuild()
