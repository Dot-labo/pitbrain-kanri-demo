"""
ライセンス管理サービス

設計:
  - ライセンスID: PB + 8文字 (ABCDEFGHJKLMNPQRSTUVWXYZ23456789)
  - 請求対象ライセンス数 = status IN ('in_use','suspended','cancellation_scheduled')
  - 上位企業のライセンス数 = 配下全整備会社の合計（再帰CTE）
  - ライセンス数の上限なし
"""

import calendar
import secrets
from datetime import date
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..models import Company, BillingRecord

# ライセンスIDに使用する文字（I, O, 0, 1 を除く）
_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


# ---------------------------------------------------------------------------
# ライセンスID生成
# ---------------------------------------------------------------------------

def generate_license_id(db: Session) -> str:
    """
    PB + 8文字のランダムなライセンスIDを生成して返す。
    衝突した場合は再試行する。
    """
    from ..models import License
    while True:
        candidate = "PB" + "".join(secrets.choice(_CHARSET) for _ in range(8))
        exists = db.query(License.id).filter(License.license_id == candidate).first()
        if not exists:
            return candidate


# ---------------------------------------------------------------------------
# 日付ユーティリティ
# ---------------------------------------------------------------------------

def get_month_start(d: date) -> date:
    """指定日が属する月の1日を返す"""
    return d.replace(day=1)


def get_month_end(d: date) -> date:
    """指定日が属する月の末日を返す"""
    _, last_day = calendar.monthrange(d.year, d.month)
    return d.replace(day=last_day)


# ---------------------------------------------------------------------------
# ライセンス数集計
# ---------------------------------------------------------------------------

def get_direct_active_license_count(db: Session, company_id: int) -> int:
    """自社のみ（配下を含まない）のアクティブライセンス数を返す。"""
    from ..models import License
    return db.query(License).filter(
        License.company_id == company_id,
        License.status.in_(["in_use", "suspended", "cancellation_scheduled"]),
    ).count()


def get_active_license_count(db: Session, company_id: int) -> int:
    """
    指定企業（およびその配下全体）の請求対象ライセンス数を返す。
    再帰 CTE で subtree を展開して licenses を COUNT する。
    請求対象: status IN ('in_use', 'suspended', 'cancellation_scheduled')
    """
    sql = text("""
        WITH RECURSIVE subtree(id) AS (
            SELECT id FROM companies WHERE id = :company_id
            UNION ALL
            SELECT c.id
            FROM companies c
            INNER JOIN subtree s ON c.parent_company_id = s.id
        )
        SELECT COUNT(l.id) AS cnt
        FROM licenses l
        JOIN subtree s ON l.company_id = s.id
        WHERE l.status IN ('in_use', 'suspended', 'cancellation_scheduled')
    """)
    row = db.execute(sql, {"company_id": company_id}).fetchone()
    return row.cnt if row else 0


def get_license_summary(db: Session, company_id: int) -> dict:
    """
    企業のライセンスサマリーを返す。

    Returns:
        {
            "company_id": int,
            "active_count": int,
        }
    """
    company = db.get(Company, company_id)
    if not company:
        raise ValueError(f"企業 id={company_id} が見つかりません")

    active_count = get_active_license_count(db, company_id)

    return {
        "company_id": company_id,
        "active_count": active_count,
    }


# ---------------------------------------------------------------------------
# 月次スナップショット（バッチ用）
# ---------------------------------------------------------------------------

def snapshot_billing(db: Session, target_month: str) -> int:
    """
    月次バッチ: 全企業（Level 2以上）の請求対象ライセンス数を
    billing_records にスナップショットする。

    Args:
        target_month: "YYYY-MM" 形式

    Returns:
        処理した企業数
    """
    companies = (
        db.query(Company)
        .filter(
            Company.level > 1,
            Company.status.in_(["active", "cancellation_scheduled"]),
        )
        .all()
    )

    count = 0
    for company in companies:
        license_count = get_active_license_count(db, company.id)

        record = (
            db.query(BillingRecord)
            .filter(
                BillingRecord.company_id == company.id,
                BillingRecord.target_month == target_month,
            )
            .first()
        )

        if record:
            record.license_count = license_count
        else:
            db.add(
                BillingRecord(
                    company_id=company.id,
                    target_month=target_month,
                    license_count=license_count,
                    payment_status="uninvoiced",
                )
            )
        count += 1

    db.commit()
    return count
