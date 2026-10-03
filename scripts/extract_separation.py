"""
長崎市 ごみ分別一覧表 PDF → JSON 変換スクリプト

入力: gomi_sep.pdf (ごみ分別一覧表)
出力: ../data/nagasaki/gomi.json (ごみ分別データ)

使い方:
  .venv/bin/python3 extract_separation.py <PDFパス>
"""

import sys
import json
import re
import pdfplumber
from pathlib import Path


KNOWN_CATEGORIES = [
    "燃やせるごみ",
    "燃やせないごみ",
    "プラスチックごみ",
    "資源ごみ",
    "資源物等拠点回収",
    "粗大ごみ",
    "蛍光管",
    "乾電池",
    "ボタン電池",
]

KOSHIBETSU_CATEGORIES = {
    "古紙（雑がみ）": "古紙",
    "古紙(雑がみ)": "古紙",
    "古紙（新聞）": "古紙",
    "古紙(新聞)": "古紙",
    "古紙（段ボール）": "古紙",
    "古紙(段ボール)": "古紙",
}

NOT_COLLECTED = "市では収集しません"


def normalize(text):
    if text is None:
        return ""
    text = text.strip()
    text = re.sub(r"\s+", " ", text)
    return text


def detect_category(bag_color, kind):
    """袋の色セルと種類セルからカテゴリを判定"""
    bag = normalize(bag_color)
    kind_text = normalize(kind)

    if "市では収集しません" in bag:
        return NOT_COLLECTED
    if "資源物等拠点回収" in bag and (not kind_text or "資源物等拠点回収" in kind_text):
        return "資源物等拠点回収"

    target = kind_text if kind_text else bag

    for cat in KNOWN_CATEGORIES:
        if cat in target:
            return cat

    for pattern, cat in KOSHIBETSU_CATEGORIES.items():
        if pattern in target:
            return cat

    if "古紙" in target:
        return "古紙"

    return None


def find_columns(header_row):
    """ヘッダー行からカラムインデックスを特定"""
    name_idx = None
    bag_idx = None
    kind_idx = None
    note_idx = None

    for i, cell in enumerate(header_row):
        c = normalize(cell)
        if "品" in c and "名" in c:
            name_idx = i
        elif "袋の色" in c or "袋" in c:
            bag_idx = i
        elif "種" in c and "類" in c:
            kind_idx = i
        elif "備" in c and "考" in c:
            note_idx = i

    return name_idx, bag_idx, kind_idx, note_idx


def extract_separation(pdf_path):
    items = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_num in range(1, len(pdf.pages)):
            page = pdf.pages[page_num]
            tables = page.extract_tables()

            if not tables:
                continue

            for table in tables:
                if not table:
                    continue

                header = table[0]
                header_text = " ".join(normalize(c) for c in header)
                if "品" not in header_text and "名" not in header_text:
                    continue

                name_idx, bag_idx, kind_idx, note_idx = find_columns(header)
                if name_idx is None:
                    continue

                for row_num, row in enumerate(table[1:], 1):
                    if len(row) <= name_idx:
                        continue

                    parsed = _parse_row(row, name_idx, bag_idx, kind_idx, note_idx)
                    if parsed:
                        items.extend(parsed)

    return items


def _parse_row(row, name_idx, bag_idx, kind_idx, note_idx):
    """1行から品目リストを抽出（複数行対応）"""
    raw_name = normalize(row[name_idx]) if name_idx is not None and name_idx < len(row) else ""
    raw_bag = normalize(row[bag_idx]) if bag_idx is not None and bag_idx < len(row) else ""
    raw_kind = normalize(row[kind_idx]) if kind_idx is not None and kind_idx < len(row) else ""
    raw_note = normalize(row[note_idx]) if note_idx is not None and note_idx < len(row) else ""

    if not raw_name:
        return None

    if "品名" in raw_name or "品 名" in raw_name:
        return None

    name_lines = [n.strip() for n in raw_name.replace("\n", " ").split(" ") if n.strip()]
    name_lines = _resplit_names(raw_name)

    kind_lines = [k.strip() for k in raw_kind.replace("\n", " ").split(" ") if k.strip()] if raw_kind else []

    if len(name_lines) > 1 and len(kind_lines) == len(name_lines):
        results = []
        for i, name in enumerate(name_lines):
            cat = detect_category(raw_bag if i == 0 else "", kind_lines[i])
            if cat and _is_valid_name(name):
                results.append({
                    "name": name,
                    "category": cat,
                    "note": raw_note if i == 0 else "",
                })
        return results if results else None

    category = detect_category(raw_bag, raw_kind)
    if not category:
        return None

    if len(name_lines) > 1:
        results = []
        for i, name in enumerate(name_lines):
            if _is_valid_name(name):
                results.append({
                    "name": name,
                    "category": category,
                    "note": raw_note if i == 0 else "",
                })
        return results if results else None

    name = raw_name.replace("\n", "")
    if not _is_valid_name(name):
        return None

    return [{
        "name": name,
        "category": category,
        "note": raw_note,
    }]


def _resplit_names(text):
    """品名セルの複数アイテムを分割"""
    text = text.strip()
    parts = re.split(r"\n", text)
    parts = [p.strip() for p in parts if p.strip()]
    if len(parts) > 1:
        return parts
    return [text]


def _is_valid_name(name):
    """品名として有効か判定"""
    name = name.strip()
    if not name:
        return False
    if len(name) <= 1 and re.match(r"^[あ-ん]$", name):
        return False
    if "品名" in name or "品 名" in name:
        return False
    return True


def build_output(items):
    """正規化形式: 1行1レコードのフラットなリスト"""
    seen = set()
    records = []
    for item in items:
        key = (item["name"], item["category"])
        if key in seen:
            continue
        seen.add(key)

        record = {
            "item": item["name"],
            "category": item["category"],
        }
        if item.get("note"):
            record["note"] = item["note"]
        records.append(record)

    records.sort(key=lambda x: (x["category"], x["item"]))
    return records


def main():
    if len(sys.argv) < 2:
        print(f"使い方: .venv/bin/python3 {sys.argv[0]} <gomi_sep.pdf>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not Path(pdf_path).exists():
        print(f"エラー: {pdf_path} が見つかりません")
        sys.exit(1)

    print(f"PDFを読み込み中: {pdf_path}")
    items = extract_separation(pdf_path)
    print(f"抽出した品目数: {len(items)}")

    cats = set(item["category"] for item in items)
    print(f"カテゴリ: {', '.join(sorted(cats))}")

    records = build_output(items)

    out_dir = Path(__file__).parent.parent / "data" / "nagasaki"
    out_dir.mkdir(parents=True, exist_ok=True)

    out_path = out_dir / "gomi.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=4)

    print(f"\n出力完了: {out_path}")
    print(f"レコード数: {len(records)}件")

    from collections import Counter
    cat_counts = Counter(r["category"] for r in records)
    print("\n--- カテゴリ別品目数 ---")
    for cat, count in sorted(cat_counts.items()):
        print(f"  {cat}: {count}件")


if __name__ == "__main__":
    main()
