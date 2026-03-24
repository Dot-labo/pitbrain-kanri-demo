"""
デモ用シードデータ投入スクリプト

会社階層:
  AB                          アバルト株式会社         (Level 1 オーナー)
  ├── AB-A01                  安全自動車株式会社        (Level 2 一次代理店)
  │   ├── AB-A01-B01          東日本商事株式会社        (Level 3 二次代理店)
  │   │   ├── AB-A01-B01-S01  山田自動車整備株式会社   (Level 5 整備会社)
  │   │   │   ├── AB-A01-B01-S01-P01  本店            (Level 6 支店)
  │   │   │   └── AB-A01-B01-S01-P02  横浜支店        (Level 6 支店)
  │   │   └── AB-A01-B01-S02  鈴木モータース          (Level 5 整備会社)
  │   └── AB-A01-S01          田中自動車工業株式会社   (Level 5 ※階層スキップ)
  └── AB-A02                  西日本オート株式会社      (Level 2 一次代理店)
      └── AB-A02-S01          佐藤整備工場              (Level 5 ※階層スキップ)

実行:
  cd backend
  python seed.py
"""

import sys, os, random, string
sys.stdout.reconfigure(encoding="utf-8")
from datetime import date, datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine
from app.models import Base, Company, AdminUser, Worker, WorkerLicenseRequest, License, BillingRecord, AuditLog
from app.core.security import hash_password

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# 既存データ全削除（冪等実行）
for model in [AuditLog, BillingRecord, License, WorkerLicenseRequest, Worker, AdminUser, Company]:
    db.query(model).delete()
db.commit()

now = datetime.now(timezone.utc)
today = date.today()


def make_company(code, name, kana, level, parent_id, **kwargs) -> Company:
    c = Company(
        company_code=code,
        company_name=name,
        company_name_kana=kana,
        level=level,
        parent_company_id=parent_id,
        status="active",
        **kwargs,
    )
    db.add(c)
    db.flush()
    return c


def make_admin(company: Company, name: str, email: str, password: str = "password123") -> AdminUser:
    u = AdminUser(
        company_id=company.id,
        name=name,
        email=email,
        password_hash=hash_password(password),
        status="active",
        activated_at=now,
    )
    db.add(u)
    db.flush()
    return u


def make_worker(company: Company, branch: Company | None, name: str, line_id: str,
                status: str = "active") -> Worker:
    w = Worker(
        company_id=company.id,
        branch_id=branch.id if branch else None,
        name=name,
        line_user_id=line_id,
        status=status,
    )
    db.add(w)
    db.flush()
    return w


def random_license_id() -> str:
    return "PB" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


def make_license(company: Company, applied_by: Company, worker: Worker | None = None,
                 branch: Company | None = None, days_ago: int = 30,
                 status: str = "in_use") -> License:
    start = date(today.year, today.month, 1)  # 当月1日
    month_end = (start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)

    lic = License(
        license_id=random_license_id(),
        company_id=company.id,
        branch_id=branch.id if branch else None,
        worker_id=worker.id if worker else None,
        applied_by_company_id=applied_by.id,
        status=status,
        applied_at=now - timedelta(days=days_ago),
        valid_from=start,
        valid_until=month_end,
    )
    db.add(lic)
    db.flush()
    return lic


def make_billing(company: Company, month: str, count: int,
                 status: str = "uninvoiced",
                 invoice_date: date | None = None,
                 payment_date: date | None = None):
    rec = BillingRecord(
        company_id=company.id,
        target_month=month,
        license_count=count,
        payment_status=status,
        invoice_date=invoice_date,
        payment_date=payment_date,
    )
    db.add(rec)
    db.flush()
    return rec


# ================================================================
# 企業データ
# ================================================================

owner = make_company(
    "AB", "アバルト株式会社", "アバルトカブシキガイシャ", 1, None,
    contact_person="システム管理者",
    email="admin@avarth.co.jp",
    phone="03-0000-0001",
    postal_code="100-0001",
    address="東京都千代田区丸の内1-1-1",
)

agency1 = make_company(
    "AB-A01", "安全自動車株式会社", "アンゼンジドウシャカブシキガイシャ", 2, owner.id,
    contact_person="佐々木 健一",
    email="sasaki@anzen-auto.co.jp",
    phone="03-1111-0001",
    postal_code="101-0001",
    address="東京都千代田区神田1-1-1",
)

agency2 = make_company(
    "AB-A02", "西日本オート株式会社", "ニシニホンオートカブシキガイシャ", 2, owner.id,
    contact_person="山口 誠",
    email="yamaguchi@nishiauto.co.jp",
    phone="06-1111-0001",
    postal_code="530-0001",
    address="大阪府大阪市北区梅田1-1-1",
)

sub_agency = make_company(
    "AB-A01-B01", "東日本商事株式会社", "ヒガシニホンショウジカブシキガイシャ", 3, agency1.id,
    contact_person="鈴木 大輔",
    email="suzuki@higashi-shoji.co.jp",
    phone="045-1111-0001",
    postal_code="220-0001",
    address="神奈川県横浜市西区みなとみらい2-2-1",
)

yamada_auto = make_company(
    "AB-A01-B01-S01", "山田自動車整備株式会社", "ヤマダジドウシャセイビカブシキガイシャ", 5, sub_agency.id,
    contact_person="山田 太郎",
    email="yamada@yamada-auto.co.jp",
    phone="045-2222-0001",
    postal_code="220-0002",
    address="神奈川県横浜市神奈川区三ツ沢1-1-1",
)

suzuki_motors = make_company(
    "AB-A01-B01-S02", "鈴木モータース株式会社", "スズキモータースカブシキガイシャ", 5, sub_agency.id,
    contact_person="鈴木 一郎",
    email="suzuki@suzuki-motors.co.jp",
    phone="044-2222-0001",
    postal_code="210-0001",
    address="神奈川県川崎市川崎区駅前本町1-1-1",
)

tanaka_auto = make_company(
    "AB-A01-S01", "田中自動車工業株式会社", "タナカジドウシャコウギョウカブシキガイシャ", 5, agency1.id,
    contact_person="田中 次郎",
    email="tanaka@tanaka-auto.co.jp",
    phone="052-2222-0001",
    postal_code="450-0001",
    address="愛知県名古屋市中村区名駅1-1-1",
)

sato_garage = make_company(
    "AB-A02-S01", "佐藤整備工場", "サトウセイビコウジョウ", 5, agency2.id,
    contact_person="佐藤 健",
    email="sato@sato-garage.co.jp",
    phone="06-3333-0001",
    postal_code="530-0002",
    address="大阪府大阪市北区天神橋1-1-1",
)

yamada_honten = make_company(
    "AB-A01-B01-S01-P01", "山田自動車整備 本店", "ヤマダジドウシャセイビ ホンテン", 6, yamada_auto.id,
    license_limit=5,
    contact_person="山田 太郎",
    phone="045-2222-0001",
    postal_code="220-0002",
    address="神奈川県横浜市神奈川区三ツ沢1-1-1",
)

yamada_yokohama = make_company(
    "AB-A01-B01-S01-P02", "山田自動車整備 横浜支店", "ヤマダジドウシャセイビ ヨコハマシテン", 6, yamada_auto.id,
    license_limit=3,
    contact_person="山田 花子",
    phone="045-2222-0002",
    postal_code="221-0001",
    address="神奈川県横浜市神奈川区反町1-2-3",
)

# ================================================================
# 管理者アカウント（共通パスワード: password123）
# ================================================================

admin_owner    = make_admin(owner,        "管理者",     "admin@avarth.co.jp")
admin_agency1  = make_admin(agency1,      "佐々木 健一", "sasaki@anzen-auto.co.jp")
admin_agency2  = make_admin(agency2,      "山口 誠",    "yamaguchi@nishiauto.co.jp")
admin_sub      = make_admin(sub_agency,   "鈴木 大輔",  "suzuki@higashi-shoji.co.jp")
admin_yamada   = make_admin(yamada_auto,  "山田 太郎",  "yamada@yamada-auto.co.jp")
admin_suzuki   = make_admin(suzuki_motors,"鈴木 一郎",  "suzuki@suzuki-motors.co.jp")
admin_tanaka   = make_admin(tanaka_auto,  "田中 次郎",  "tanaka@tanaka-auto.co.jp")
admin_sato     = make_admin(sato_garage,  "佐藤 健",    "sato@sato-garage.co.jp")

# ================================================================
# 作業員
# ================================================================

w_yamada1 = make_worker(yamada_auto, yamada_honten,   "青木 修",   "line_aoki")
w_yamada2 = make_worker(yamada_auto, yamada_yokohama, "木村 亮",   "line_kimura")
w_yamada3 = make_worker(yamada_auto, None,            "中村 健",   "line_nakamura")
w_suzuki1 = make_worker(suzuki_motors, None,          "伊藤 博",   "line_ito")
w_tanaka1 = make_worker(tanaka_auto,   None,          "渡辺 誠",   "line_watanabe")
w_sato1   = make_worker(sato_garage,   None,          "加藤 勇",   "line_kato")

# ================================================================
# ライセンス
# ================================================================

# 山田自動車整備 (本店・横浜)
lic1 = make_license(yamada_auto, yamada_auto, worker=w_yamada1, branch=yamada_honten,   days_ago=45, status="in_use")
lic2 = make_license(yamada_auto, yamada_auto, worker=w_yamada2, branch=yamada_yokohama, days_ago=30, status="in_use")
lic3 = make_license(yamada_auto, yamada_auto, worker=w_yamada3,                         days_ago=20, status="in_use")
lic4 = make_license(yamada_auto, agency1,                                               days_ago=10, status="unassigned")

# 鈴木モータース
lic5 = make_license(suzuki_motors, suzuki_motors, worker=w_suzuki1, days_ago=60, status="in_use")
lic6 = make_license(suzuki_motors, sub_agency,                      days_ago=5,  status="unassigned")

# 田中自動車工業
lic7 = make_license(tanaka_auto, tanaka_auto, worker=w_tanaka1, days_ago=90, status="in_use")

# 佐藤整備工場
lic8 = make_license(sato_garage, sato_garage, worker=w_sato1, days_ago=15, status="in_use")

# 解約済・解約予定サンプル
lic_cancelled = make_license(yamada_auto, yamada_auto, days_ago=120, status="cancelled")

# ================================================================
# 請求レコード（過去2ヶ月 + 当月）
# ================================================================

this_month  = today.strftime("%Y-%m")
last_month  = (today.replace(day=1) - timedelta(days=1)).strftime("%Y-%m")
two_months  = (today.replace(day=1) - timedelta(days=32)).strftime("%Y-%m")

inv_date  = (today.replace(day=1) - timedelta(days=1)).replace(day=10)
pay_date  = (today.replace(day=1) - timedelta(days=1)).replace(day=25)

# 山田自動車整備
make_billing(yamada_auto, two_months, 3, "payment_confirmed", inv_date, pay_date)
make_billing(yamada_auto, last_month, 4, "invoiced", inv_date)
make_billing(yamada_auto, this_month, 4, "uninvoiced")

# 鈴木モータース
make_billing(suzuki_motors, two_months, 1, "payment_confirmed", inv_date, pay_date)
make_billing(suzuki_motors, last_month, 2, "invoiced", inv_date)
make_billing(suzuki_motors, this_month, 2, "uninvoiced")

# 田中自動車工業
make_billing(tanaka_auto, two_months, 1, "payment_confirmed", inv_date, pay_date)
make_billing(tanaka_auto, last_month, 1, "payment_confirmed", inv_date, pay_date)
make_billing(tanaka_auto, this_month, 1, "uninvoiced")

# 佐藤整備工場
make_billing(sato_garage, last_month, 1, "invoiced", inv_date)
make_billing(sato_garage, this_month, 1, "uninvoiced")

db.commit()
db.close()

print("=" * 50)
print("デモデータ投入完了")
print("=" * 50)
print()
print("【ログインアカウント一覧】（パスワード共通: password123）")
print()
print(f"  オーナー        admin@avarth.co.jp")
print(f"  一次代理店      sasaki@anzen-auto.co.jp")
print(f"  一次代理店      yamaguchi@nishiauto.co.jp")
print(f"  二次代理店      suzuki@higashi-shoji.co.jp")
print(f"  整備会社        yamada@yamada-auto.co.jp")
print(f"  整備会社        suzuki@suzuki-motors.co.jp")
print(f"  整備会社        tanaka@tanaka-auto.co.jp")
print(f"  整備会社        sato@sato-garage.co.jp")
print()
print("フロントエンド: http://localhost:3001")
print("バックエンドAPI: http://localhost:8001")
