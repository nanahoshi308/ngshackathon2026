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

## スクリプト一覧

### extract_area.py - 町別収集曜日の抽出

長崎市の「町別収集曜日日・収集担当一覧」PDFより、
各町の収集曜日を抽出してJSONに変換する。

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
├── nagasaki_to_tables.py # 抽出結果 → data/tables/nagasaki/
├── build_legacy.js       # 表の検査 + 互換JSONの生成
└── README.md
```
