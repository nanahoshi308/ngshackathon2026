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
- `../data/nagasaki/areas.json` - 曜日別データ
- `../data/nagasaki/town_list.json` - 全町名の一覧

### extract_separation.py - ごみ分別一覧の抽出

長崎市の「ごみ分別一覧表」PDFから、
品目ごとのごみカテゴリを抽出してJSONに変換する。

```bash
.venv/bin/python3 extract_separation.py <gomi_sep.pdf>
```

**出力:**
- `../data/nagasaki/gomi.json` - カテゴリ別ごみ分別データ

## ディレクトリ構成

```
scripts/
├── .venv/              # Python仮想環境
├── requirements.txt    # 依存パッケージ
├── extract_area.py     # 町別収集曜日 PDF → JSON
├── extract_separation.py # ごみ分別一覧 PDF → JSON
└── README.md
```
