"""
企業コード採番サービス

コード体系:
  Level 1 (オーナー) : AB
  Level 2 (一次代理店): AB-A{NN}
  Level 3 (二次代理店): {parent}-B{NN}
  Level 4 (三次代理店): {parent}-C{NN}
  Level 5 (整備会社)  : {parent}-S{NN}
  Level 6 (支店)      : {parent}-P{NN}

階層スキップ可: オーナー→整備会社 = AB-S01
番号は 01〜99
"""

import re
from sqlalchemy.orm import Session
from ..models import Company

LEVEL_CHAR: dict[int, str] = {
    2: "A",
    3: "B",
    4: "C",
    5: "S",
    6: "P",
}

MAX_CODE_NUM = 99
OWNER_CODE = "AB"


def generate_company_code(db: Session, parent_id: int | None, level: int) -> str:
    """
    新規企業コードを採番して返す。
    DBへの書き込みは行わない（呼び出し元が Company.company_code にセットして commit）。

    Args:
        db: SQLAlchemy セッション
        parent_id: 親企業 ID (Level 1 の場合 None)
        level: 作成する企業の階層 (1〜6)

    Returns:
        採番されたコード文字列

    Raises:
        ValueError: 上限超過・親企業未存在・不正レベルの場合
    """
    if level == 1:
        # オーナーは固定コード
        existing = db.query(Company).filter(Company.level == 1).first()
        if existing:
            raise ValueError("オーナーはすでに存在します")
        return OWNER_CODE

    if level not in LEVEL_CHAR:
        raise ValueError(f"不正なレベル: {level}")

    parent = db.get(Company, parent_id)
    if parent is None:
        raise ValueError(f"親企業 (id={parent_id}) が見つかりません")

    level_char = LEVEL_CHAR[level]
    prefix = f"{parent.company_code}-{level_char}"

    # 同一親・同一レベルの最大番号を取得
    max_num = _find_max_sibling_num(db, parent_id, level, level_char)

    next_num = max_num + 1
    if next_num > MAX_CODE_NUM:
        raise ValueError(
            f"採番上限 ({MAX_CODE_NUM}) に達しました "
            f"(parent={parent.company_code}, level={level})"
        )

    return f"{prefix}{next_num:02d}"


def _find_max_sibling_num(
    db: Session, parent_id: int, level: int, level_char: str
) -> int:
    """同一親・同一レベルの兄弟企業から最大番号を返す（存在しなければ 0）"""
    siblings = (
        db.query(Company)
        .filter(
            Company.parent_company_id == parent_id,
            Company.level == level,
        )
        .all()
    )

    max_num = 0
    pattern = re.compile(rf"{re.escape(level_char)}(\d+)$")

    for sibling in siblings:
        last_segment = sibling.company_code.rsplit("-", 1)[-1]
        match = pattern.match(last_segment)
        if match:
            num = int(match.group(1))
            max_num = max(max_num, num)

    return max_num


def parse_company_code(code: str) -> list[tuple[str, int]]:
    """
    コードを解析してセグメントリストを返す。

    例: "AB-A01-S02" -> [("AB", 1), ("A", 1), ("S", 2)]
    """
    segments = code.split("-")
    result: list[tuple[str, int]] = []

    char_to_level = {v: k for k, v in LEVEL_CHAR.items()}

    for seg in segments:
        if seg == OWNER_CODE:
            result.append(("AB", 1))
        elif len(seg) >= 2 and seg[0] in char_to_level:
            try:
                num = int(seg[1:])
                result.append((seg[0], num))
            except ValueError:
                pass

    return result


def get_level_from_code(code: str) -> int:
    """コード文字列から企業レベルを返す"""
    if code == OWNER_CODE:
        return 1
    segments = code.split("-")
    last = segments[-1]
    char_to_level = {v: k for k, v in LEVEL_CHAR.items()}
    if last[0] in char_to_level:
        return char_to_level[last[0]]
    raise ValueError(f"不正なコード: {code}")
