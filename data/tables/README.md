# data/tables - ごみデータの正本

ごみデータはこのディレクトリのJSONを正本とし、フラットな表（1行 = 1レコード）で管理する。
画面（`js/data.js`）はここを読み、各ページで使う形に組み立てる。

```
data/tables/
├── municipalities.json      市町村一覧
├── nagayo/                  長与町（手で管理）
└── nagasaki/                長崎市（categories.json 以外は scripts/nagasaki_to_tables.py が生成）
```

市町村ごとのディレクトリには、すべて同じ名前・同じ列の表を置く（データがなければ空配列 `[]`）。
分別（categories / items）は市町村ごとに異なるので、市町村をまたいで共有しない。

## 編集の流れ

1. `data/tables/` の表を編集する（長崎市は `scripts/README.md` の手順で再生成）
2. `node scripts/build_legacy.js` を実行する（参照整合性の検査 + 互換JSONの生成）
3. 生成された `data/` 直下のJSONも一緒にコミットする

`data/municipalities.json`、`data/areas.json`、`data/{市町村}/{地区}/*.json` は **生成物なので直接編集しない**。
（Cloudflare Worker など外部から参照されている可能性があるため、互換用に残している。地区がある市町村のみ）

## 表

| ファイル | 1行が表すもの | 列 |
|---|---|---|
| `municipalities.json` | 市町村 | `id, name, kana` |
| `{市町村}/areas.json` | 地区の表示名 | `id, name, kana` |
| `{市町村}/towns.json` | 町 | `name, area` |
| `{市町村}/schedules.json` | 町ごとの収集日 | `town, category_id, weekday, weeks, variant_group, variant` |
| `{市町村}/categories.json` | ごみの種類 | `id, name, img, separation, collection_place, collection_place_url, date_note` |
| `{市町村}/items.json` | 品目とその種類 | `name, category_id, note` |
| `{市町村}/kyoten.json` | 拠点回収（自治会 × 場所） | `jichikai, place, weekday, weeks, label` |

- 利用者が選ぶ単位は **町**。収集日は町ごとに持つ（同じ地区の町は同じ行が並ぶ）。
- 表どうしは名前の一致ではなく ID / 町名でつなぐ（`items.category_id` → `categories.id`、`schedules.town` → `towns.name`）。
- 品目は種類ごとに1行。素材などで分かれる品目は、複数の種類に同じ名前で登録してよい。
- 収集日が決まっていない種類（拠点回収など）は `schedules` に行を作らない。
- 値のない列は `null`。

### 値の決まり

- `towns.area`: 地区のある市町村（長与町の A地区 / B地区）は `areas.id`。ない市町村は `null`
- `weekday`: `"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"`
- `weeks`: 第何週に収集するか（`[1, 3]` = 第1・第3）。毎週なら `[1, 2, 3, 4, 5]`
- `variant_group` / `variant`: ごみステーションによって曜日が異なる場合（長崎市の「月・木/火・金」など）。
  - `variant_group` は選択肢のまとまり（例: `"燃やせるごみ・古紙"`）、`variant` はその中の1つ（例: `"火・金"`）
  - 利用者は町を選んだあと、グループごとに1つ選ぶ。選ばれた `variant` の行だけが使われる
  - 曜日が1通りなら両方 `null`
- `kyoten.label`: 画面に表示する日時の文言。`weekday` / `weeks` が決められない常設の回収場所は `null`
