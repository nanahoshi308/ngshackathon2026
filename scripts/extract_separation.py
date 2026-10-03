"""
長崎市 ごみ分別一覧表 PDF → JSON 変換スクリプト

入力: gomi_sep.pdf (ごみ分別一覧表)
出力: ../data/nagasaki/gomi.json (ごみ分別データ)

使い方:
  .venv/bin/python3 extract_separation.py <PDFパス>

表は罫線（ベクター）で行・列を決め、1文字ずつセルに振り分けて組み立てる（pdf_table.py）。
袋の色のアイコンは画像なので、色からごみの種類を判定する。
備考の中のアイコン（例: 「金属製は [青い袋]」）も「燃やせないごみ」に置き換える。
"""

import re
import sys
import json
from pathlib import Path

import pymupdf

from pdf_table import (
    horizontal_lines, vertical_lines, page_chars, page_images,
    image_color, build_cells, line_text, join_lines, clean,
)


# 列（左から）
COL_INDEX, COL_NAME, COL_BAG, COL_KIND, COL_NOTE = range(5)
HEADER = ["50音", "品名", "袋の色", "種類", "備考"]

# 袋のアイコンの色
# 色が表す種類の名前は版によって変わる（例: 黄色は「プラスチック製容器包装」→「プラスチックごみ」）ので、
# ページ下部の凡例から読み取る（bag_legend）
BAG_COLORS = {
    "red": (237, 35, 41),
    "blue": (7, 116, 190),
    "yellow": (253, 185, 24),
    "green": (7, 167, 85),
}


def classify_color(rgb):
    """いちばん近い袋の色。どれにも近くなければ None"""
    best, best_distance = None, None
    for name, ref in BAG_COLORS.items():
        distance = sum((a - b) ** 2 for a, b in zip(rgb, ref))
        if best_distance is None or distance < best_distance:
            best, best_distance = name, distance
    return best if best_distance < 60 ** 2 else None


def find_table(page):
    """見出し行（品名・袋の色…）がある表なら (列の x 座標, 縦線の y 範囲) を返す"""
    text = page.get_text()
    if "袋の色" not in text or "備" not in text:
        return None
    columns, y_range = vertical_lines(page, 0, page.rect.height)
    return (columns, y_range) if len(columns) == len(HEADER) + 1 else None


def extract_page(doc, page, page_number, bag_by_xref):
    table = find_table(page)
    if table is None:
        return []

    columns, y_range = table
    rows = horizontal_lines(page, columns[0], columns[-1], y_range=y_range)
    cells = build_cells(
        page_chars(page),
        page_images(page),
        rows,
        columns,
        image_text=lambda xref: bag_by_xref.get(xref),
    )

    records = []
    index_kana = ""
    for row_number, row in enumerate(cells):
        texts = ["".join(clean(line_text(line)) for line in cell) for cell in row]
        name = texts[COL_NAME]

        if row_number == 0 or not name or name.replace(" ", "") == "品名":
            continue

        if texts[COL_INDEX]:
            index_kana = texts[COL_INDEX]

        # 袋の色の列: アイコン（燃やせる…）、「−」、「×」のどれか
        bag = texts[COL_BAG]
        kind = texts[COL_KIND]

        records.append({
            "item": name,
            "index": index_kana,
            "bag": bag,
            "kind": kind,
            "category": normalize_kind(kind),
            "note": tidy_note(join_lines(row[COL_NOTE], columns[COL_NOTE + 1])),
            "page": page_number,
        })
    return records


def tidy_note(note):
    """アイコンを置き換えた「…」の前後に残った空白（アイコンの置き場所）を詰める"""
    note = re.sub(r"\s+(「[^」]*」)", r"\1", note)
    # 「…」のあとに文が続く場合（「燃やせないごみ」 でも可）の空白も詰める
    return re.sub(r"」\s+(?=でも|、|。|に|は|を|へ)", "」", note)


# 種類の欄が「−」の品目（たたみ、パソコンなど）は備考に出し方が書いてある
OTHER_CATEGORY = "その他（備考を参照）"


def normalize_kind(kind):
    """「×市では収集しません」「古紙（新聞）」「−」などをカテゴリ名にそろえる"""
    kind = kind.lstrip("×✕ ").strip()
    if kind.startswith("古紙"):
        return "古紙"
    if kind in ("−", "ー", "-", "―", "－", ""):
        return OTHER_CATEGORY
    return kind


def bag_legend(doc, color_by_xref):
    """
    表の下の凡例（[赤]燃やせるごみ [青]燃やせないごみ …）から 色 → 種類名 を読み取る
    アイコンの右から、次のアイコンまでの文字を名前とする
    """
    legend = {}
    for page in doc:
        table = find_table(page)
        if table is None:
            continue
        _, (_, bottom) = table
        icons = sorted((
            (rect, color_by_xref[xref])
            for rect, xref in page_images(page)
            if xref in color_by_xref and rect.y0 > bottom
        ), key=lambda icon: icon[0].x0)
        words = page.get_text("words")
        for i, (rect, color) in enumerate(icons):
            right = icons[i + 1][0].x0 if i + 1 < len(icons) else rect.x1 + 150
            label = "".join(
                w[4] for w in sorted(words, key=lambda w: w[0])
                if rect.x1 - 1 <= w[0] < right and abs((w[1] + w[3]) / 2 - (rect.y0 + rect.y1) / 2) < rect.height
            )
            label = label.split("※")[0].strip()
            if label:
                legend.setdefault(color, label)
        if len(legend) == len(BAG_COLORS):
            break
    missing = set(BAG_COLORS) - set(legend)
    if missing:
        raise SystemExit(f"凡例から袋の色の名前を読み取れませんでした: {sorted(missing)}")
    return legend


def bag_icons(doc):
    """
    全ページの画像を色で分類し、袋のアイコンだけ xref → 「種類名」 にする
    戻り値: (xref → 「種類名」, 色 → 種類名)
    """
    color_by_xref = {}
    for page in doc:
        for _, xref in page_images(page):
            if xref not in color_by_xref:
                color = classify_color(image_color(doc, xref))
                if color:
                    color_by_xref[xref] = color
    legend = bag_legend(doc, color_by_xref)
    return {xref: "「" + legend[color] + "」" for xref, color in color_by_xref.items()}, legend


def main():
    if len(sys.argv) < 2:
        print(f"使い方: .venv/bin/python3 {sys.argv[0]} <gomi_sep.pdf>")
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
    if not pdf_path.exists():
        print(f"エラー: {pdf_path} が見つかりません")
        sys.exit(1)

    doc = pymupdf.open(pdf_path)
    bag_by_xref, legend = bag_icons(doc)
    print("袋の色の凡例:", legend)

    records = []
    for page_number, page in enumerate(doc, 1):
        records.extend(extract_page(doc, page, page_number, bag_by_xref))

    # 袋の色の列は種類の列と同じ意味なので、食い違いがあれば知らせる
    for r in records:
        bag = r["bag"].strip("「」")
        if bag in legend.values() and bag != r["category"]:
            print(f"警告: 袋の色と種類が違います p{r['page']} {r['item']}: {bag} / {r['kind']}")

    out_dir = Path(__file__).parent.parent / "data" / "nagasaki"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "gomi.json"

    output = [
        {k: v for k, v in {
            "item": r["item"],
            "category": r["category"],
            "kind": r["kind"] if r["kind"] != r["category"] else None,
            "note": r["note"] or None,
            "index": r["index"],
            "page": r["page"],
        }.items() if v is not None}
        for r in records
    ]
    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(output, f, ensure_ascii=False, indent=4)
        f.write("\n")

    from collections import Counter
    print(f"出力完了: {out_path}")
    print(f"レコード数: {len(output)}件")
    for category, count in sorted(Counter(r["category"] for r in output).items()):
        print(f"  {category}: {count}件")


if __name__ == "__main__":
    main()
