"""
長崎市 町別収集曜日一覧 PDF → JSON 変換スクリプト

入力: gomi_area.pdf (町別収集曜日日・収集担当一覧)
出力: ../data/nagasaki/areas.json (町別の収集曜日データ)

使い方:
  .venv/bin/python3 extract_area.py <PDFパス>
"""

import sys
import json
import re
import pdfplumber
from pathlib import Path


DAY_MAP = {
    "月": "monday",
    "火": "tuesday",
    "水": "wednesday",
    "木": "thursday",
    "金": "friday",
    "土": "saturday",
    "日": "sunday",
}


def parse_days(text):
    """「月・木」「火・金」「月・木/火・金」→ 曜日リストに変換"""
    if not text:
        return []

    text = text.strip()
    days = []
    for char in text:
        if char in DAY_MAP:
            days.append(DAY_MAP[char])
    return days


def normalize(text):
    """セル値を正規化"""
    if text is None:
        return ""
    return re.sub(r"\s+", "", text.strip())


def extract_areas(pdf_path):
    """PDFから全町のデータを抽出"""
    towns = []
    current_section = None

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            tables = page.extract_tables()

            for table in tables:
                for row in table:
                    if row is None:
                        continue

                    cells = [normalize(c) for c in row]

                    if _is_header_row(cells):
                        section_label = cells[0] if cells[0] else None
                        if section_label and re.search(r"[旧]", section_label):
                            current_section = section_label
                        elif section_label and len(section_label) <= 10:
                            current_section = section_label
                        continue

                    town = _parse_town_row(cells, current_section)
                    if town:
                        towns.append(town)

    return towns


def _is_header_row(cells):
    """ヘッダー行か判定"""
    joined = "".join(cells)
    return "町名" in joined or "燃やせるごみ" in joined and "種類" not in joined


def _parse_town_row(cells, section):
    """行データから町情報を抽出"""
    if len(cells) < 4:
        return None

    first_nonempty = None
    for c in cells:
        if c:
            first_nonempty = c
            break

    if not first_nonempty:
        return None

    if "町名" in first_nonempty or "燃やせる" in first_nonempty:
        return None
    if "古紙リサイクルは" in first_nonempty:
        return None
    if "網掛け" in first_nonempty:
        return None
    if "年末年始" in first_nonempty:
        return None

    name = None
    moeru = None
    other = None
    syusyu = None
    center = None

    if len(cells) == 6:
        # 50音ラベル付きの行: [あ行ラベル, 町名, 燃やせる, 燃やせない等, 収集担当, 所管]
        name = cells[1] if cells[1] else cells[0]
        moeru = cells[2]
        other = cells[3]
        syusyu = cells[4]
        center = cells[5]
    elif len(cells) == 5:
        # ラベルなしの行: [町名, 燃やせる, 燃やせない等, 収集担当, 所管]
        name = cells[0]
        moeru = cells[1]
        other = cells[2]
        syusyu = cells[3]
        center = cells[4]
    elif len(cells) == 4:
        name = cells[0]
        moeru = cells[1]
        other = cells[2]
        syusyu = cells[3]
        center = ""
    else:
        return None

    if not name or not moeru:
        return None

    if "町名" in name or "燃やせる" in name:
        return None

    moeru_days = parse_days(moeru)
    other_days = parse_days(other)

    if not moeru_days:
        return None

    town = {
        "name": name,
        "moeru": moeru,
        "moeru_days": moeru_days,
        "other": other,
        "other_days": other_days,
    }

    if section:
        town["section"] = section

    return town


def build_output(towns):
    """正規化形式: 1行1レコードのフラットなリスト"""
    records = []
    for town in towns:
        needs_confirm = "/" in town["moeru"] or "/" in town["other"]
        record = {
            "town": town["name"],
            "moeru": town["moeru"],
            "moeru_days": town["moeru_days"],
            "other": town["other"],
            "other_days": town["other_days"],
            "needs_confirm": needs_confirm,
        }
        records.append(record)

    records.sort(key=lambda x: x["town"])
    return records


def main():
    if len(sys.argv) < 2:
        print(f"使い方: .venv/bin/python3 {sys.argv[0]} <gomi_area.pdf>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not Path(pdf_path).exists():
        print(f"エラー: {pdf_path} が見つかりません")
        sys.exit(1)

    print(f"PDFを読み込み中: {pdf_path}")
    towns = extract_areas(pdf_path)
    print(f"抽出した町数: {len(towns)}")

    records = build_output(towns)

    out_dir = Path(__file__).parent.parent / "data" / "nagasaki"
    out_dir.mkdir(parents=True, exist_ok=True)

    out_path = out_dir / "towns.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=4)

    print(f"出力完了: {out_path}")
    print(f"レコード数: {len(records)}件")

    slash_count = sum(1 for r in records if "/" in r["moeru"] or "/" in r["other"])
    print(f"曜日分岐あり: {slash_count}件")


if __name__ == "__main__":
    main()
