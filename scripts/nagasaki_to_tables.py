"""
長崎市の抽出結果 → data/tables/nagasaki/ 変換スクリプト

入力:
  ../data/nagasaki/towns.json  (extract_area.py の出力)
  ../data/nagasaki/gomi.json   (extract_separation.py の出力)
  ../data/tables/nagasaki/categories.json  (手で管理するカテゴリ表)
出力:
  ../data/tables/nagasaki/towns.json, schedules.json, items.json

使い方:
  python3 nagasaki_to_tables.py   (標準ライブラリのみ)

収集日の決まり（ごみ分別一覧表・町別収集曜日一覧より）:
  - 燃やせるごみ: 「燃やせるごみ」列の曜日、毎週
  - 古紙: 燃やせるごみ週2回のうち初めの曜日、毎週
  - 燃やせないごみ・資源ごみ・プラスチック製容器包装: 2列目の曜日、毎週（※要確認）
  - 「月・木/火・金」のような / 区切りはごみステーションによって異なる → variant として保持
"""

import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC = ROOT / "data" / "nagasaki"
OUT = ROOT / "data" / "tables" / "nagasaki"

WEEKDAYS = {"月": "mon", "火": "tue", "水": "wed", "木": "thu", "金": "fri", "土": "sat", "日": "sun"}
EVERY_WEEK = [1, 2, 3, 4, 5]

MOERU_GROUP = "燃やせるごみ・古紙"
OTHER_GROUP = "燃やせないごみ・資源ごみ・プラスチック"
OTHER_CATEGORIES = ["moenai", "shigen", "pura"]

# 抽出結果のカテゴリ名 → categories.json の id
CATEGORY_ALIASES = {
    "プラスチック製容器包装": "pura",  # 令和8年4月版より前の呼び方
    "市では収集しません": "atumenai",
}


def parse_days(text):
    return [WEEKDAYS[c] for c in text if c in WEEKDAYS]


def write(path, rows):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("[\n" + ",\n".join("  " + json.dumps(r, ensure_ascii=False) for r in rows) + "\n]\n")
    print(f"  {path.relative_to(ROOT)}: {len(rows)}件")


def merge_towns(records):
    """同じ町名の行をまとめ、曜日の候補（/ 区切り）を集める"""
    towns = {}
    for r in records:
        t = towns.setdefault(r["town"], {"moeru": [], "other": [], "rows": 0})
        t["rows"] += 1
        for key in ("moeru", "other"):
            for option in r[key].split("/"):
                option = option.strip()
                if option and option not in t[key]:
                    t[key].append(option)
    return towns


def build_schedules(towns):
    rows = []
    for name, t in towns.items():
        moeru_group = MOERU_GROUP if len(t["moeru"]) > 1 else None
        for option in t["moeru"]:
            variant = option if moeru_group else None
            days = parse_days(option)
            for day in days:
                rows.append(row(name, "moeru", day, moeru_group, variant))
            if days:
                rows.append(row(name, "koshi", days[0], moeru_group, variant))

        other_group = OTHER_GROUP if len(t["other"]) > 1 else None
        for option in t["other"]:
            variant = option if other_group else None
            for day in parse_days(option):
                for category_id in OTHER_CATEGORIES:
                    rows.append(row(name, category_id, day, other_group, variant))
    return rows


def row(town, category_id, weekday, variant_group, variant):
    return {"town": town, "category_id": category_id, "weekday": weekday, "weeks": EVERY_WEEK,
            "variant_group": variant_group, "variant": variant}


def item_note(record):
    """備考。種類が細かく分かれている場合（古紙（新聞）など）は先頭に付ける"""
    parts = [p for p in (record.get("kind"), record.get("note")) if p]
    return "。".join(parts) if parts else None


def build_items(records, categories):
    name_to_id = {c["name"]: c["id"] for c in categories}
    name_to_id.update(CATEGORY_ALIASES)
    rows, unknown = [], set()
    for r in records:
        category_id = name_to_id.get(r["category"])
        if category_id is None:
            unknown.add(r["category"])
            continue
        rows.append({"name": r["item"], "category_id": category_id, "note": item_note(r)})
    if unknown:
        raise SystemExit(f"categories.json にないカテゴリ: {sorted(unknown)}")
    return rows


def main():
    town_records = json.loads((SRC / "towns.json").read_text(encoding="utf-8"))
    item_records = json.loads((SRC / "gomi.json").read_text(encoding="utf-8"))
    categories = json.loads((OUT / "categories.json").read_text(encoding="utf-8"))

    towns = merge_towns(town_records)
    for name, t in towns.items():
        if t["rows"] > 1:
            print(f"警告: {name} が {t['rows']} 行あります（曜日の候補として統合）")

    print("出力:")
    write(OUT / "towns.json", [{"name": name, "area": None} for name in towns])
    write(OUT / "schedules.json", build_schedules(towns))
    write(OUT / "items.json", build_items(item_records, categories))


if __name__ == "__main__":
    main()
