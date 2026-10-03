# scripts/ - バッチ処理スクリプト

PDFからごみデータを抽出し、アプリ用JSONに変換するバッチ処理用スクリプト群。
アプリ本体(Webサーバにて配信する)とは独立して動作する。

## セットアップ
venvで隔離されたpythonにしているので、venv環境のactivateとかが必要。
```bash
cd scripts
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

ごみ出し情報のpdfを長崎市HPからdl

```bash
curl -o gomi_area.pdf https://www.city.nagasaki.lg.jp/uploaded/attachment/55253.pdf
```

```bash
curl -o gomi_sep.pdf https://www.city.nagasaki.lg.jp/uploaded/attachment/53682.pdf
```

※ 2026-10 時点で、分別一覧表は令和8年4月版（プラスチック製品も「プラスチックごみ」へ）、町別収集曜日一覧は2026-02 作成のもの。
PDF は版が変わると内容も変わるので、表紙の「令和○年○月版」を確認すること。

## 抽出の方式（pdf_table.py）

PDF を画像化して線を検出するのではなく、PDF に入っているベクターの情報をそのまま使う。

1. 罫線（`page.get_drawings()` の線分・細い矩形）から、行の境界（水平線）と列の境界（垂直線）を求める
2. 文字を1文字ずつ（`get_text("rawdict")`）座標でセルに振り分ける。結合セル（50音の見出しなど）も特別扱いは不要
3. セルの中で折り返した行は、右端まで埋まっていれば空白なしでつなぐ
4. 画像（袋の色のアイコン）は色で種類を判定し、その位置に「燃やせないごみ」などの文字として差し込む。色と種類名の対応は表の下の凡例から読む
5. 町別収集曜日一覧の網掛け（ステーションによって曜日が異なる箇所）は塗りのパターンなので、ページを画像化してセルの色で判定する

抽出時の検査:
- 分別一覧表: 袋の色（アイコン）と種類の列が食い違っていないか
- 町別収集曜日一覧: 「/」区切りのセルと網掛けのセルが一致しているか、町名の重複、曜日が読めるか

## スクリプト一覧

### extract_area.py - 町別収集曜日の抽出

長崎市の「町別収集曜日・収集担当一覧」PDFより、
各町の収集曜日を抽出してJSONに変換する。

PDF 自体の誤記（6か所で別の町名が「稲田町」になっている）は `nagasaki_area_fixes.json` で直す。
修正は50音順の前後関係と、一覧にない町名からの推定で、未確認（`verified: false`）。

```bash
.venv/bin/python3 extract_area.py <gomi_area.pdf>
```

**出力:**
- `../data/nagasaki/towns.json` - 町別の収集曜日（抽出結果そのまま）

### extract_separation.py - ごみ分別一覧の抽出

長崎市の「ごみ分別一覧表」PDFから、
品目ごとのごみカテゴリを抽出してJSONに変換する。

```bash
.venv/bin/python3 extract_separation.py <gomi_sep.pdf>
```

**出力:**
- `../data/nagasaki/gomi.json` - カテゴリ別ごみ分別データ

### nagasaki_to_tables.py - 抽出結果をアプリ用の表に変換

`extract_area.py` / `extract_separation.py` の出力を、アプリが読む `data/tables/nagasaki/` の形式に変換する。
標準ライブラリのみで動く。

```bash
python3 nagasaki_to_tables.py
```

**入力:** `../data/nagasaki/towns.json`, `../data/nagasaki/gomi.json`, `../data/tables/nagasaki/categories.json`（手で管理）

**出力:** `../data/tables/nagasaki/towns.json`, `schedules.json`, `items.json`

- 「月・木/火・金」のような `/` 区切りは、ごみステーションによって曜日が異なるものとして `variant_group` / `variant` に展開する
- 燃やせないごみ・資源ごみ・プラスチックは2列目の曜日に毎週、古紙は燃やせるごみの初めの曜日に毎週としている（要確認）

### build_legacy.js - 表の検査と互換JSONの生成

`data/tables/` の参照整合性を検査し、`data/` 直下の互換用JSONを生成する（Node.js）。
表を編集したら必ず実行する。

```bash
node build_legacy.js
```

## 長崎市データの更新手順

```bash
cd scripts
.venv/bin/python3 extract_area.py <gomi_area.pdf>
.venv/bin/python3 extract_separation.py <gomi_sep.pdf>
python3 nagasaki_to_tables.py
node build_legacy.js
```

## ディレクトリ構成

```
scripts/
├── .venv/              # Python仮想環境
├── requirements.txt    # 依存パッケージ
├── extract_area.py     # 町別収集曜日 PDF → JSON
├── extract_separation.py # ごみ分別一覧 PDF → JSON
├── pdf_table.py          # PDF の表を罫線・文字・画像の座標から組み立てる共通処理
├── nagasaki_area_fixes.json # 町別収集曜日一覧の誤記の修正表
├── nagasaki_to_tables.py # 抽出結果 → data/tables/nagasaki/
├── build_legacy.js       # 表の検査 + 互換JSONの生成
└── README.md
```
