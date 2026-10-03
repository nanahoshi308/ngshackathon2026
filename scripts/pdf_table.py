"""
PDFの表を、ベクターの罫線と文字・画像の座標から組み立てる共通処理

画像化して線を検出するのではなく、PDFに入っている
  - 罫線（page.get_drawings() の線分）
  - 1文字ごとの座標（page.get_text("rawdict")）
  - 画像の配置（page.get_image_info()）
をそのまま使う。

結合セル（50音の見出しなど）は、罫線が途切れていても
「文字がどの行・列の範囲に入るか」で判定するので特別扱いしなくてよい。
"""

import pymupdf


def horizontal_lines(page, x0, x1, min_length=50, y_range=None):
    """
    表の範囲（x0〜x1）にかかる水平線の y 座標（重複を除いて昇順）
    y_range=(top, bottom) を渡すと、その範囲（縦線がある範囲）の線だけにする
    """
    ys = []
    for drawing in page.get_drawings():
        for item in drawing["items"]:
            if item[0] == "l":
                a, b = item[1], item[2]
                if abs(a.y - b.y) < 0.5 and abs(a.x - b.x) >= min_length and min(a.x, b.x) < x1 and max(a.x, b.x) > x0:
                    ys.append(a.y)
            elif item[0] == "re":
                r = item[1]
                if r.height < 1.5 and r.width >= min_length and r.x0 < x1 and r.x1 > x0:
                    ys.append((r.y0 + r.y1) / 2)
    if y_range is not None:
        top, bottom = y_range
        ys = [y for y in ys if top - 1 <= y <= bottom + 1]
    return merge_close(sorted(ys))


def vertical_lines(page, y0, y1, min_length=5, min_total=15):
    """
    表の範囲（y0〜y1）にある垂直線
    戻り値: (x 座標のリスト, 縦線がある y の範囲 (top, bottom))

    行ごとの短い線で描かれている表も、表全体を貫く1本の線で描かれている表もあるので、
    同じ x にある線の長さの合計が min_total 以上（おおよそ1行分以上）のものを列の境界とみなす
    （線分 'l' と、細い塗りの矩形 're' のどちらで描かれていてもよい）
    """
    segments = []
    for drawing in page.get_drawings():
        for item in drawing["items"]:
            if item[0] == "l":
                a, b = item[1], item[2]
                if abs(a.x - b.x) < 0.5:
                    segments.append((a.x, min(a.y, b.y), max(a.y, b.y)))
            elif item[0] == "re":
                r = item[1]
                if r.width < 1.5:
                    segments.append(((r.x0 + r.x1) / 2, r.y0, r.y1))

    totals = {}
    for x, top, bottom in segments:
        if bottom - top >= min_length and top < y1 and bottom > y0:
            key = round(x, 1)
            totals[key] = totals.get(key, 0) + (bottom - top)
    xs = merge_close(sorted(x for x, total in totals.items() if total >= min_total))

    kept = [(top, bottom) for x, top, bottom in segments
            if bottom - top >= min_length and any(abs(x - k) < 1.5 for k in xs)]
    if not kept:
        return xs, (None, None)
    return xs, (min(t for t, _ in kept), max(b for _, b in kept))


def merge_close(values, tolerance=1.5):
    merged = []
    for v in values:
        if merged and v - merged[-1] < tolerance:
            continue
        merged.append(v)
    return merged


def page_chars(page):
    """1文字ごとの (x0, y0, x1, y1, 文字, 文字色)"""
    chars = []
    for block in page.get_text("rawdict")["blocks"]:
        for line in block.get("lines", []):
            for span in line["spans"]:
                for ch in span["chars"]:
                    x0, y0, x1, y1 = ch["bbox"]
                    chars.append((x0, y0, x1, y1, ch["c"], span["color"]))
    return chars


def page_images(page):
    """画像の (bbox, xref)"""
    return [(pymupdf.Rect(info["bbox"]), info["xref"]) for info in page.get_image_info(xrefs=True)]


def image_color(doc, xref):
    """画像の白以外の画素の平均色 (r, g, b)"""
    pix = pymupdf.Pixmap(doc, xref)
    if pix.colorspace is None or pix.colorspace.n != 3:
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    if pix.alpha:
        pix = pymupdf.Pixmap(pix, 0)
    samples, n = pix.samples, pix.n
    total, count = [0, 0, 0], 0
    for i in range(0, len(samples) - n + 1, n):
        r, g, b = samples[i], samples[i + 1], samples[i + 2]
        if r + g + b < 700:
            total[0] += r
            total[1] += g
            total[2] += b
            count += 1
    if count == 0:
        return (255, 255, 255)
    return tuple(t // count for t in total)


def find_index(boundaries, value):
    """boundaries の区間のうち value が入るものの番号（範囲外は None）"""
    for i in range(len(boundaries) - 1):
        if boundaries[i] <= value < boundaries[i + 1]:
            return i
    return None


def build_cells(chars, images, row_lines, col_lines, image_text=None):
    """
    文字と画像を行・列に振り分け、セルごとの文字列を作る

    image_text(xref) が文字列を返した画像は、その位置に文字として差し込む
    （例: 袋のアイコン → 「燃やせないごみ」）

    戻り値: cells[row][col] = セルの中の行（上から順）のリスト
    """
    tokens = {}

    def add(row, col, x0, y0, x1, y1, text, color):
        tokens.setdefault((row, col), []).append((x0, (y0 + y1) / 2, y1 - y0, x1, text, color))

    for x0, y0, x1, y1, c, color in chars:
        row = find_index(row_lines, (y0 + y1) / 2)
        col = find_index(col_lines, (x0 + x1) / 2)
        if row is not None and col is not None:
            add(row, col, x0, y0, x1, y1, c, color)

    if image_text:
        for rect, xref in images:
            text = image_text(xref)
            if text is None:
                continue
            row = find_index(row_lines, (rect.y0 + rect.y1) / 2)
            col = find_index(col_lines, (rect.x0 + rect.x1) / 2)
            if row is not None and col is not None:
                add(row, col, rect.x0, rect.y0, rect.x1, rect.y1, text, None)

    cells = [[[] for _ in range(len(col_lines) - 1)] for _ in range(len(row_lines) - 1)]
    for (row, col), items in tokens.items():
        cells[row][col] = group_lines(items)
    return cells


def group_lines(items):
    """セルの中の文字を、y が近いものどうしで1行にまとめる"""
    items.sort(key=lambda t: (t[1], t[0]))
    lines = []
    for x0, yc, h, x1, text, color in items:
        if lines and abs(yc - lines[-1]["y"]) < max(h, lines[-1]["h"]) * 0.5:
            lines[-1]["items"].append((x0, x1, text, color))
        else:
            lines.append({"y": yc, "h": h, "items": [(x0, x1, text, color)]})
    result = []
    for line in lines:
        line["items"].sort(key=lambda t: t[0])
        visible = [t for t in line["items"] if t[2].strip()]
        result.append({
            "chars": [(text, color) for _, _, text, color in line["items"]],
            "right": max(t[1] for t in visible) if visible else line["items"][0][0],
            "height": line["h"],
        })
    return result


def line_text(line):
    return "".join(text for text, _ in line["chars"])


def join_lines(lines, cell_right, wrap_margin=1.5):
    """
    セルの中の行をつなぐ
    右端近くまで埋まっている行は折り返しとみなして空白なしで、
    そうでない行（別の文）は空白をはさんでつなぐ
    wrap_margin は「何文字分あいていたら折り返しではないか」
    """
    text = ""
    for i, line in enumerate(lines):
        part = clean(line_text(line))
        if not part:
            continue
        if text:
            previous = lines[i - 1]
            wrapped = cell_right - previous["right"] < previous["height"] * wrap_margin
            text += part if wrapped else " " + part
        else:
            text = part
    return text


def clean(text):
    """全角スペースの並び（画像の置き場所）や余分な空白を詰める"""
    text = text.replace("　", " ")
    return " ".join(text.split())
