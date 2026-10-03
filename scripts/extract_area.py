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


def group_by_schedule(towns):
    """
    同一スケジュールの町をグループ化し、既存フォーマットに近い構造にする。

    グループキー: (燃やせるごみ曜日, その他曜日)
    """
    groups = {}
    for town in towns:
        key = (town["moeru"], town["other"])
        if key not in groups:
            groups[key] = {
                "moeru": town["moeru"],
                "moeru_days": town["moeru_days"],
                "other": town["other"],
                "other_days": town["other_days"],
                "towns": [],
            }
        groups[key]["towns"].append(town["name"])

    result = []
    for i, (key, group) in enumerate(sorted(groups.items())):
        result.append({
            "id": f"g{i+1:02d}",
            "name": f"燃やせる:{group['moeru']} / その他:{group['other']}",
            "moeru": group["moeru"],
            "moeru_days": group["moeru_days"],
            "other": group["other"],
            "other_days": group["other_days"],
            "towns": sorted(group["towns"]),
        })

    return result


def build_output(towns):
    """最終的なJSON出力を構築"""
    grouped = group_by_schedule(towns)

    return {
        "municipality": "nagasaki",
        "municipality_name": "長崎市",
        "total_towns": len(towns),
        "total_groups": len(grouped),
        "groups": grouped,
        "all_towns": sorted([t["name"] for t in towns]),
    }


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

    output = build_output(towns)
    print(f"スケジュールグループ数: {output['total_groups']}")

    out_dir = Path(__file__).parent.parent / "data" / "nagasaki"
    out_dir.mkdir(parents=True, exist_ok=True)

    out_path = out_dir / "areas.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=4)

    print(f"出力完了: {out_path}")

    town_list_path = out_dir / "town_list.json"
    town_list = []
    for town in towns:
        town_list.append({
            "name": town["name"],
            "moeru": town["moeru"],
            "other": town["other"],
        })
    town_list.sort(key=lambda x: x["name"])
    with open(town_list_path, "w", encoding="utf-8") as f:
        json.dump(town_list, f, ensure_ascii=False, indent=4)

    print(f"町名一覧出力: {town_list_path}")


if __name__ == "__main__":
    main()
