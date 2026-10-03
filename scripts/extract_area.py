"""
長崎市 町別収集曜日一覧 PDF → JSON 変換スクリプト

入力: gomi_area.pdf (町別収集曜日・収集担当一覧)
出力: ../data/nagasaki/towns.json (町別の収集曜日データ)

使い方:
  .venv/bin/python3 extract_area.py <PDFパス>

表は罫線（ベクター）で行・列を決め、1文字ずつセルに振り分けて組み立てる（pdf_table.py）。
「網掛けの箇所はごみステーションマップでお調べください」の網掛け（緑）は
塗りのパターンで描かれているので、ページを画像化してセルの色で判定する。
"""

import sys
import json
from pathlib import Path

import pymupdf

from pdf_table import (
    horizontal_lines, vertical_lines, page_chars, page_images,
    build_cells, line_text, clean,
)


# 列（左から）
COL_INDEX, COL_NAME, COL_MOERU, COL_OTHER, COL_COLLECTOR, COL_CENTER = range(6)
COLUMN_COUNT = 6

WEEKDAYS = {"月": "monday", "火": "tuesday", "水": "wednesday", "木": "thursday",
            "金": "friday", "土": "saturday", "日": "sunday"}

# PDF自体の誤記の修正（nagasaki_area_fixes.json）
FIXES_PATH = Path(__file__).parent / "nagasaki_area_fixes.json"

# 網掛けの判定に使う解像度と、セルの中の緑の画素の割合のしきい値
RENDER_ZOOM = 2
SHADE_RATIO = 0.3


def parse_days(text):
    """「月・木」「月・木/火・金」→ 曜日リスト"""
    return [WEEKDAYS[c] for c in text if c in WEEKDAYS]


def is_green(r, g, b):
    """網掛けの薄い緑（白や黒の文字は除く）"""
    return g > 200 and g - r > 15 and g - b > 15


class ShadeDetector:
    """ページを画像化し、セルが網掛けされているかを判定する"""

    def __init__(self, page):
        self.pix = page.get_pixmap(matrix=pymupdf.Matrix(RENDER_ZOOM, RENDER_ZOOM), alpha=False)

    def is_shaded(self, x0, y0, x1, y1):
        z = RENDER_ZOOM
        # 罫線を避けて少し内側だけ見る
        px0, py0 = int((x0 + 2) * z), int((y0 + 2) * z)
        px1, py1 = int((x1 - 2) * z), int((y1 - 2) * z)
        samples, n, stride = self.pix.samples, self.pix.n, self.pix.stride
        green = total = 0
        for py in range(py0, py1, 2):
            for px in range(px0, px1, 2):
                i = py * stride + px * n
                r, g, b = samples[i], samples[i + 1], samples[i + 2]
                if r + g + b < 300:
                    continue  # 文字
                total += 1
                if is_green(r, g, b):
                    green += 1
        return total > 0 and green / total >= SHADE_RATIO


def extract_page(page, page_number):
    columns, y_range = vertical_lines(page, 0, page.rect.height)
    if len(columns) != COLUMN_COUNT + 1:
        return []

    rows = horizontal_lines(page, columns[0], columns[-1], y_range=y_range)
    cells = build_cells(page_chars(page), page_images(page), rows, columns)
    shade = ShadeDetector(page)

    records = []
    for row_number, row in enumerate(cells):
        texts = ["".join(clean(line_text(line)) for line in cell) for cell in row]
        name = texts[COL_NAME].replace(" ", "")
        moeru = texts[COL_MOERU].replace(" ", "")
        other = texts[COL_OTHER].replace(" ", "")

        # 見出し行や空行は飛ばす
        if not name or "町名" in name or not parse_days(moeru):
            continue

        y0, y1 = rows[row_number], rows[row_number + 1]
        records.append({
            "town": name,
            "town_pdf": name,
            "moeru": moeru,
            "other": other,
            "moeru_shaded": shade.is_shaded(columns[COL_MOERU], y0, columns[COL_MOERU + 1], y1),
            "other_shaded": shade.is_shaded(columns[COL_OTHER], y0, columns[COL_OTHER + 1], y1),
            "collector": texts[COL_COLLECTOR],
            "center": texts[COL_CENTER],
            "page": page_number,
        })
    return records


def apply_fixes(records):
    """
    PDF自体の誤記を修正表で直す
    修正表の各行は (ページ, 直前の町名, PDF上の町名) で対象の行を特定する
    """
    fixes = json.loads(FIXES_PATH.read_text(encoding="utf-8"))
    used = set()
    for i, r in enumerate(records):
        previous = records[i - 1]["town_pdf"] if i > 0 else None
        for n, fix in enumerate(fixes):
            if fix["page"] == r["page"] and fix["after"] == previous and fix["pdf_name"] == r["town"]:
                r["town"] = fix["town"]
                r["fixed"] = fix
                used.add(n)
    for n, fix in enumerate(fixes):
        if n not in used:
            print(f"警告: 修正表の行が見つかりませんでした（PDFが更新された可能性）: {fix}")


def build_output(records):
    output = []
    for r in records:
        moeru_branch = "/" in r["moeru"]
        other_branch = "/" in r["other"]
        fixed = r.get("fixed")
        output.append({
            "town": r["town"],
            # PDFの町名を修正した場合は元の表記と、確認済みかどうかを残す
            **({"town_pdf": r["town_pdf"], "town_verified": fixed["verified"]} if fixed else {}),
            "moeru": r["moeru"],
            "moeru_days": parse_days(r["moeru"]),
            "other": r["other"],
            "other_days": parse_days(r["other"]),
            # ごみステーションによって曜日が異なる（/ 区切り、PDFでは網掛け）
            "needs_confirm": moeru_branch or other_branch,
            "collector": r["collector"],
            "center": r["center"],
            "page": r["page"],
        })
    return output


def check(records):
    """抽出結果の検査。問題があれば警告を出す"""
    warnings = []
    seen = {}
    for r in records:
        if r["town"] in seen:
            warnings.append(f"町名が重複: {r['town']} (p{seen[r['town']]}, p{r['page']})")
        seen[r["town"]] = r["page"]
        for key in ("moeru", "other"):
            # 「/」で曜日が分かれているセルは網掛けのはず（逆も同じ）
            if ("/" in r[key]) != r[key + "_shaded"]:
                warnings.append(f"網掛けと / が一致しない: {r['town']} {key}={r[key]} 網掛け={r[key + '_shaded']} (p{r['page']})")
            for option in r[key].split("/"):
                if not parse_days(option) or len(parse_days(option)) != len(option.replace("・", "")):
                    warnings.append(f"曜日を読めない: {r['town']} {key}={r[key]} (p{r['page']})")
    return warnings


def main():
    if len(sys.argv) < 2:
        print(f"使い方: .venv/bin/python3 {sys.argv[0]} <gomi_area.pdf>")
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
    if not pdf_path.exists():
        print(f"エラー: {pdf_path} が見つかりません")
        sys.exit(1)

    print(f"PDFを読み込み中: {pdf_path}")
    doc = pymupdf.open(pdf_path)
    records = []
    for page_number, page in enumerate(doc, 1):
        records.extend(extract_page(page, page_number))

    apply_fixes(records)

    for warning in check(records):
        print("警告:", warning)

    output = build_output(records)

    out_dir = Path(__file__).parent.parent / "data" / "nagasaki"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "towns.json"
    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(output, f, ensure_ascii=False, indent=4)
        f.write("\n")

    print(f"出力完了: {out_path}")
    print(f"レコード数: {len(output)}件")
    print(f"曜日分岐あり: {sum(r['needs_confirm'] for r in output)}件")


if __name__ == "__main__":
    main()
