"""
既存の企業コードを 4桁形式 → 2桁形式に変換するマイグレーションスクリプト。

変換例:
  AB-A0001          → AB-A01
  AB-A0001-B0002    → AB-A01-B02
  AB-A0001-S0001-P0003 → AB-A01-S01-P03

実行方法（backendディレクトリから）:
  python migrate_company_codes.py
"""

import re
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models import Company

OWNER_CODE = "AB"


def convert_segment(seg: str) -> str:
    """1セグメントを変換する。AB はそのまま、A0001 → A01 など"""
    if seg == OWNER_CODE:
        return seg
    m = re.match(r'^([A-Z])(\d+)$', seg)
    if m:
        letter = m.group(1)
        num = int(m.group(2))
        return f"{letter}{num:02d}"
    return seg


def convert_code(code: str) -> str:
    """企業コード全体を変換する"""
    segments = code.split("-")
    return "-".join(convert_segment(s) for s in segments)


def main():
    db = SessionLocal()
    try:
        companies = db.query(Company).order_by(Company.company_code).all()

        changes = []
        for c in companies:
            new_code = convert_code(c.company_code)
            if new_code != c.company_code:
                changes.append((c, c.company_code, new_code))

        if not changes:
            print("変換対象のコードがありません（すでに2桁形式です）")
            return

        print(f"変換対象: {len(changes)} 件")
        print()
        for c, old, new in changes:
            print(f"  {old:40s} → {new}")

        print()
        answer = input("上記を変換しますか？ [y/N]: ").strip().lower()
        if answer != "y":
            print("キャンセルしました")
            return

        # 長いコードから短いコードの順で更新（子→親の順）
        # LIKE '%old%' での衝突を防ぐため長い順に処理
        changes_sorted = sorted(changes, key=lambda x: len(x[1]), reverse=True)

        for c, old_code, new_code in changes_sorted:
            c.company_code = new_code

        db.commit()
        print(f"\n完了: {len(changes)} 件のコードを変換しました")

    except Exception as e:
        db.rollback()
        print(f"エラー: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
