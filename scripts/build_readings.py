"""
町名の読み（readings.json）生成スクリプト

入力:
  ../references/長崎バス_停留所辞書.txt  (TSV: stop_ruby, stop_name, 種別)
  ../references/translations.txt        (長崎県営バス GTFS の translations.txt)
  ../data/tables/{市町村}/towns.json, readings.json
  readings_overrides.json               (辞書で読めない・誤る町の読み。手で管理し、辞書より優先)
出力:
  ../data/tables/{市町村}/readings.json  (町の行に tokens を付けて全町分に)

使い方:
  python3 build_readings.py   (標準ライブラリのみ)

読みの決め方（上から順に）:
  1. readings_overrides.json
  2. バス停の辞書に町名・語幹（「○○町」「○○N丁目」を除いた部分）がそのまま載っている
  3. 語幹で始まるバス停（「本原教会前」など）の読みから、後ろの部分の読みを除いて多数決
  4. かなだけの部分はそのまま
  どれでも決まらない町、候補が割れた町は readings_report.txt に出す。

tokens は「漢字表記, 読み, (別の読み)」の配列の列。検索ではトークンの切れ目ごとに
どの表記で入力してもよい（例: 「もとはら1丁目」「本原いっちょうめ」）。
品目の行は kana だけで、そのまま残す。
"""

import csv
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).parent.parent
HERE = Path(__file__).parent
MUNICIPALITIES = ["nagasaki", "nagayo"]

KANJI_DIGITS = {"一": "1", "二": "2", "三": "3", "四": "4", "五": "5", "六": "6", "七": "7", "八": "8", "九": "9"}
# 「N丁目」の読み（バス停の辞書の「いっちょうめ」「よんちょうめ」に合わせる）
NUMBER_KANA = {"1": "いっ", "2": "に", "3": "さん", "4": "よん", "5": "ご",
               "6": "ろく", "7": "なな", "8": "はっ", "9": "きゅう", "10": "じゅっ"}

# バス停名の後ろによく付く部分の読み（語幹の読みを取り出すのに使う）
STOP_SUFFIXES = {
    "前": ["まえ"], "入口": ["いりぐち"], "口": ["ぐち", "くち"], "団地": ["だんち"],
    "公民館": ["こうみんかん"], "小学校": ["しょうがっこう"], "中学校": ["ちゅうがっこう"],
    "小": ["しょう"], "下": ["した"], "上": ["うえ"], "中央": ["ちゅうおう"], "公園": ["こうえん"],
    "橋": ["ばし", "はし"], "東": ["ひがし"], "西": ["にし"], "南": ["みなみ"], "北": ["きた"],
    "町": ["まち", "ちょう"], "教会": ["きょうかい"], "港": ["こう"], "桟橋": ["さんばし"],
    "住宅": ["じゅうたく"], "車庫": ["しゃこ"], "集会所": ["しゅうかいじょ"], "病院": ["びょういん"],
    "神社": ["じんじゃ"], "高部": ["こうぶ"], "通り": ["どおり"], "局": ["きょく"],
    "保育園": ["ほいくえん"], "保育所": ["ほいくしょ"], "幼稚園": ["ようちえん"],
    "郵便局": ["ゆうびんきょく"], "中部": ["ちゅうぶ"], "本村": ["ほんむら"], "登口": ["のぼりぐち"],
    "裏": ["うら"], "横": ["よこ"], "道": ["みち"], "農協": ["のうきょう"], "霊園": ["れいえん"],
    "地域センター": ["ちいきせんたー"], "センター": ["せんたー"], "ターミナル": ["たーみなる"],
    "アパート": ["あぱーと"], "ニュータウン": ["にゅーたうん"], "トンネル": ["とんねる"],
    "高校": ["こうこう"], "第一": ["だいいち"], "第二": ["だいに"], "第三": ["だいさん"],
    **{d + "丁目": [k + "ちょうめ"] for d, k in NUMBER_KANA.items()},
}

# トークンとして切り出す前後の語（読みが合うときだけ切る）
TOKEN_PREFIXES = {"琴海": "きんかい", "神浦": "こうのうら", "野母崎": "のもざき",
                  "東": "ひがし", "西": "にし", "南": "みなみ", "北": "きた",
                  "上": "かみ", "下": "しも", "新": "しん"}
TOKEN_SUFFIXES = {"東": "ひがし", "西": "にし", "南": "みなみ", "北": "きた", "中央": "ちゅうおう",
                  "第一": "だいいち", "第二": "だいに", "西区": "にしく", "東区": "ひがしく",
                  "中央区": "ちゅうおうく", "アパート": "あぱーと"}


def nfkc(text):
    return unicodedata.normalize("NFKC", text)


def to_hiragana(text):
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in text)


def is_kana(text):
    return re.fullmatch(r"[ぁ-ゖァ-ヶー]+", text) is not None


def clean_stop(name):
    """括弧の注記を外し、漢数字の丁目を数字にする"""
    name = nfkc(re.sub(r"[(（].*?[)）]", "", name)).strip()
    return re.sub(r"([一二三四五六七八九])丁目", lambda m: KANJI_DIGITS[m.group(1)] + "丁目", name)


def clean_ruby(ruby):
    return to_hiragana(nfkc(re.sub(r"[(（].*?[)）]", "", ruby)).strip())


def load_stops():
    """{バス停名: Counter(読み)}"""
    stops = defaultdict(Counter)

    with open(ROOT / "references" / "長崎バス_停留所辞書.txt", encoding="utf-8") as f:
        for line in f.read().splitlines()[1:]:
            cols = line.split("\t")
            if len(cols) >= 2 and cols[0] and cols[1]:
                stops[clean_stop(cols[1])][clean_ruby(cols[0])] += 1

    with open(ROOT / "references" / "translations.txt", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if row["table_name"] == "stops" and row["language"] == "ja-Hrkt":
                stops[clean_stop(row["field_value"])][clean_ruby(row["translation"])] += 1

    return stops


def split_suffix(name):
    """町名 → (語幹, 後ろの部分, 後ろの部分の読み候補)"""
    m = re.fullmatch(r"(.+?)(\d+)丁目", name)
    if m:
        return m.group(1), m.group(2) + "丁目", [m.group(2) + "ちょうめ"]
    if len(name) > 1 and name.endswith("町"):
        return name[:-1], "町", ["まち", "ちょう"]
    return name, "", [""]


def suffix_readings(rest):
    """バス停名の語幹より後ろ（「教会前」など）の読みの候補"""
    if rest == "":
        return {""}
    results = set()
    for word, kanas in STOP_SUFFIXES.items():
        if rest.startswith(word):
            for tail in suffix_readings(rest[len(word):]):
                results.update(k + tail for k in kanas)
    return results


def stem_candidates(stem, stops):
    """語幹で始まるバス停から語幹の読みの候補を集める"""
    votes = Counter()
    for stop, rubies in stops.items():
        if not stop.startswith(stem):
            continue
        for tail in suffix_readings(stop[len(stem):]):
            for ruby, count in rubies.items():
                if ruby.endswith(tail) and len(ruby) > len(tail):
                    votes[ruby[:len(ruby) - len(tail)]] += count
    return votes


def chome_to_digits(kana):
    """辞書の「いっちょうめ」を readings の書き方「1ちょうめ」に"""
    for d, k in NUMBER_KANA.items():
        if kana.endswith(k + "ちょうめ"):
            return kana[: -len(k + "ちょうめ")] + d + "ちょうめ"
    return kana


def resolve(name, stops):
    """町名の読みを辞書から決める → (読み, 由来, 他の候補)"""
    stem, suffix, suffix_kanas = split_suffix(name)

    # 町名がそのまま載っている
    if name in stops:
        ruby = chome_to_digits(stops[name].most_common(1)[0][0])
        return ruby, "辞書(町名)", list(stops[name])

    if is_kana(stem):
        return to_hiragana(stem) + suffix_kanas[0], "かな", []

    # 語幹が載っている
    if stem in stops:
        rubies = stops[stem]
        return rubies.most_common(1)[0][0] + suffix_kanas[0], "辞書(語幹)", list(rubies)

    # 語幹で始まるバス停から
    votes = stem_candidates(stem, stops)
    if votes:
        best = votes.most_common(1)[0][0]
        return best + suffix_kanas[0], "推定(" + ",".join(f"{k}:{v}" for k, v in votes.most_common(3)) + ")", list(votes)

    return None, "未解決", []


def tokenize(name, kana):
    """町名と読みをトークンに分ける。読みが合わない切り方はしない"""
    tail_tokens = []

    m = re.fullmatch(r"(.+?)(\d+)丁目", name)
    if m and kana.endswith(m.group(2) + "ちょうめ"):
        d = m.group(2)
        name, kana = m.group(1), kana[: -len(d + "ちょうめ")]
        tail_tokens.insert(0, [d + "丁目", d + "ちょうめ", NUMBER_KANA.get(d, d) + "ちょうめ"])
    elif len(name) > 1 and name.endswith("町"):
        for k in ("まち", "ちょう"):
            if kana.endswith(k) and len(kana) > len(k):
                name, kana = name[:-1], kana[: -len(k)]
                tail_tokens.insert(0, ["町", k])
                break

    for word in sorted(TOKEN_SUFFIXES, key=len, reverse=True):
        k = TOKEN_SUFFIXES[word]
        if len(name) > len(word) and name.endswith(word) and kana.endswith(k) and len(kana) > len(k):
            name, kana = name[: -len(word)], kana[: -len(k)]
            tail_tokens.insert(0, [word, k])
            break

    head_tokens = []
    found = True
    while found:  # 「神浦」「下」「大中尾」のように重なることがある
        found = False
        for word, k in TOKEN_PREFIXES.items():
            if len(name) > len(word) and name.startswith(word) and kana.startswith(k) and len(kana) > len(k):
                head_tokens.append([word, k])
                name, kana = name[len(word):], kana[len(k):]
                found = True
                break

    return head_tokens + [[name, kana]] + tail_tokens


def load_json(path, default):
    if not path.exists():
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write(path, rows):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("[\n" + ",\n".join("  " + json.dumps(r, ensure_ascii=False) for r in rows) + "\n]\n")
    print(f"  {path.relative_to(ROOT)}: {len(rows)}件")


def main():
    stops = load_stops()
    overrides = load_json(HERE / "readings_overrides.json", {})
    report = []
    unresolved = 0

    for municipality in MUNICIPALITIES:
        table_dir = ROOT / "data" / "tables" / municipality
        towns = [t["name"] for t in load_json(table_dir / "towns.json", [])]
        old = {r["name"]: r for r in load_json(table_dir / "readings.json", [])}
        town_set = set(towns)

        rows = []
        for name in towns:
            key = nfkc(name)
            if name in overrides:
                kana, source = overrides[name], "上書き"
            else:
                kana, source, others = resolve(key, stops)
                if kana is None:
                    unresolved += 1
                    report.append(f"{municipality}\t{name}\t未解決")
                    continue
                if source.startswith("推定") or len(set(others)) > 1:
                    report.append(f"{municipality}\t{name}\t{kana}\t{source}\t候補: {' '.join(others)}")

            rows.append({"name": name, "kana": kana, "tokens": tokenize(key, kana)})

        # 品目の読みはそのまま残す
        rows += [r for n, r in old.items() if n not in town_set]
        write(table_dir / "readings.json", rows)

    with open(HERE / "readings_report.txt", "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(report) + "\n")
    print(f"  scripts/readings_report.txt: {len(report)}件（未解決 {unresolved}）")

    return 1 if unresolved else 0


if __name__ == "__main__":
    sys.exit(main())
