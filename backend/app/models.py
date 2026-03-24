from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, DateTime, Date,
    ForeignKey, UniqueConstraint, CheckConstraint,
)
from sqlalchemy.orm import relationship, DeclarativeBase


class Base(DeclarativeBase):
    pass


class Company(Base):
    __tablename__ = "companies"
    __table_args__ = (
        CheckConstraint("level BETWEEN 1 AND 6", name="ck_companies_level"),
        CheckConstraint(
            "status IN ('active','suspended','cancellation_scheduled','cancelled')",
            name="ck_companies_status",
        ),
    )

    id                = Column(Integer, primary_key=True, autoincrement=True)
    company_code      = Column(String, nullable=False, unique=True)
    company_name      = Column(String, nullable=False)
    company_name_kana = Column(String)
    level             = Column(Integer, nullable=False)
    parent_company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    contact_person    = Column(String)
    phone             = Column(String)
    email             = Column(String)
    postal_code       = Column(String)
    address           = Column(String)
    notes             = Column(String)
    license_limit     = Column(Integer, nullable=True)   # 支店のみ
    status            = Column(String, nullable=False, default="active")
    created_at        = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at        = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    parent          = relationship("Company", remote_side="Company.id", foreign_keys="Company.parent_company_id", back_populates="children")
    children        = relationship("Company", foreign_keys="Company.parent_company_id", back_populates="parent")
    admin_user      = relationship("AdminUser", back_populates="company", uselist=False)
    workers         = relationship("Worker", foreign_keys="Worker.company_id", back_populates="company")
    branch_workers  = relationship("Worker", foreign_keys="Worker.branch_id", back_populates="branch")
    billing_records = relationship("BillingRecord", back_populates="company")


class AdminUser(Base):
    __tablename__ = "admin_users"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    company_id    = Column(Integer, ForeignKey("companies.id"), nullable=False, unique=True)
    name          = Column(String, nullable=False)
    email         = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=True)
    status        = Column(String, nullable=False, default="pending")
    activated_at  = Column(DateTime, nullable=True)
    created_at    = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at    = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    company              = relationship("Company", back_populates="admin_user")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="admin_user")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    admin_user_id = Column(Integer, ForeignKey("admin_users.id"), nullable=False)
    token         = Column(String, nullable=False, unique=True)
    expires_at    = Column(DateTime, nullable=False)
    used_at       = Column(DateTime, nullable=True)
    created_at    = Column(DateTime, nullable=False, default=datetime.utcnow)

    admin_user = relationship("AdminUser", back_populates="password_reset_tokens")


class Worker(Base):
    __tablename__ = "workers"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','active','suspended','cancelled')",
            name="ck_workers_status",
        ),
    )

    id           = Column(Integer, primary_key=True, autoincrement=True)
    company_id   = Column(Integer, ForeignKey("companies.id"), nullable=False)  # 整備会社
    branch_id    = Column(Integer, ForeignKey("companies.id"), nullable=True)   # 支店
    name         = Column(String, nullable=False)
    line_user_id = Column(String, unique=True, nullable=True)
    status       = Column(String, nullable=False, default="pending")
    created_at   = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at   = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    company          = relationship("Company", foreign_keys=[company_id], back_populates="workers")
    branch           = relationship("Company", foreign_keys=[branch_id], back_populates="branch_workers")
    license_requests = relationship("WorkerLicenseRequest", back_populates="worker")
    license          = relationship("License", back_populates="worker", uselist=False)


class WorkerLicenseRequest(Base):
    __tablename__ = "worker_license_requests"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','approved','rejected')",
            name="ck_wlr_status",
        ),
    )

    id           = Column(Integer, primary_key=True, autoincrement=True)
    worker_id    = Column(Integer, ForeignKey("workers.id"), nullable=False)
    requested_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    reviewed_by  = Column(Integer, ForeignKey("admin_users.id"), nullable=True)
    reviewed_at  = Column(DateTime, nullable=True)
    status       = Column(String, nullable=False, default="pending")
    reject_reason = Column(String, nullable=True)

    worker    = relationship("Worker", back_populates="license_requests")
    reviewer  = relationship("AdminUser")


class License(Base):
    __tablename__ = "licenses"
    __table_args__ = (
        CheckConstraint(
            "status IN ('unassigned','in_use','suspended','cancellation_scheduled','cancelled')",
            name="ck_license_status",
        ),
    )

    id                        = Column(Integer, primary_key=True, autoincrement=True)
    license_id                = Column(String, nullable=False, unique=True)  # PB{8chars}
    company_id                = Column(Integer, ForeignKey("companies.id"), nullable=False)  # 整備会社
    branch_id                 = Column(Integer, ForeignKey("companies.id"), nullable=True)   # 支店
    worker_id                 = Column(Integer, ForeignKey("workers.id"), nullable=True)     # 作業員
    applied_by_company_id     = Column(Integer, ForeignKey("companies.id"), nullable=True)   # 申請元会社
    status                    = Column(String, nullable=False, default="unassigned")
    applied_at                = Column(DateTime, nullable=False, default=datetime.utcnow)
    valid_from                = Column(Date, nullable=False)   # 申請月の1日
    valid_until               = Column(Date, nullable=False)   # 当月末（自動更新で延長）
    cancellation_requested_at = Column(DateTime, nullable=True)
    end_date                  = Column(Date, nullable=True)    # 実際の終了日（月末）
    created_at                = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at                = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    company            = relationship("Company", foreign_keys=[company_id])
    branch             = relationship("Company", foreign_keys=[branch_id])
    applied_by_company = relationship("Company", foreign_keys=[applied_by_company_id])
    worker  = relationship("Worker", back_populates="license")


class BillingRecord(Base):
    __tablename__ = "billing_records"
    __table_args__ = (
        UniqueConstraint("company_id", "target_month", name="uq_billing_company_month"),
        CheckConstraint(
            "payment_status IN ('uninvoiced','invoiced','payment_confirmed','unpaid')",
            name="ck_billing_status",
        ),
    )

    id             = Column(Integer, primary_key=True, autoincrement=True)
    company_id     = Column(Integer, ForeignKey("companies.id"), nullable=False)
    target_month   = Column(String, nullable=False)   # YYYY-MM
    license_count  = Column(Integer, nullable=False, default=0)
    invoice_date   = Column(Date, nullable=True)
    payment_date   = Column(Date, nullable=True)
    payment_status = Column(String, nullable=False, default="uninvoiced")
    notes          = Column(String, nullable=True)
    created_at     = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at     = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    company = relationship("Company", back_populates="billing_records")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    admin_user_id = Column(Integer, ForeignKey("admin_users.id"), nullable=True)
    company_id    = Column(Integer, ForeignKey("companies.id"), nullable=True)
    action        = Column(String, nullable=False)
    target_type   = Column(String, nullable=True)
    target_id     = Column(Integer, nullable=True)
    detail        = Column(String, nullable=True)   # JSON string
    created_at    = Column(DateTime, nullable=False, default=datetime.utcnow)

    admin_user = relationship("AdminUser")
    company    = relationship("Company")
