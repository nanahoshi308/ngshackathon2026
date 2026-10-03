# data/tables - ごみデータの正本

ごみデータはこのディレクトリのJSONを正本とし、フラットな表（1行 = 1レコード）で管理する。
画面（`js/data.js`）はここを読み、各ページで使う形に組み立てる。

## 編集の流れ

1. `data/tables/*.json` を編集する
2. `node scripts/build_legacy.js` を実行する（参照整合性の検査 + 互換JSONの生成）
3. 生成された `data/` 直下のJSONも一緒にコミットする

`data/municipalities.json`、`data/areas.json`、`data/{市町村}/{地区}/*.json` は **生成物なので直接編集しない**。
（Cloudflare Worker など外部から参照されている可能性があるため、互換用に残している）

## テーブル

| ファイル | 1行が表すもの | 列 |
|---|---|---|
| `municipalities.json` | 市町村 | `id, name, kana` |
| `areas.json` | 地区 | `municipality_id, id, name, kana` |
| `towns.json` | 町名（地区に属する） | `municipality_id, area_id, name` |
| `categories.json` | ごみの種類 | `municipality_id, id, name, img, separation, collection_place, collection_place_url, date_note` |
| `items.json` | 品目とその種類 | `municipality_id, name, category_id` |
| `schedules.json` | 収集日 | `municipality_id, area_id, town, category_id, weekday, weeks, needs_confirm` |
| `kyoten.json` | 拠点回収（自治会 × 場所） | `municipality_id, jichikai, place, weekday, weeks, label` |

- キーは `municipality_id` を含む複合キー（例: カテゴリは `municipality_id + id`）。
- 表どうしは名前ではなく ID でつなぐ（`items.category_id` → `categories.id` など）。
- 品目は種類ごとに1行。素材などで分かれる品目は、複数の種類に同じ名前で登録してよい。
- 収集日が決まっていない種類（拠点回収など）は `schedules` に行を作らない。
- 値のない列は `null`。

### 値の決まり

- `weekday`: `"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"`
- `weeks`: 第何週に収集するか（`[1, 3]` = 第1・第3）。毎週なら `[1, 2, 3, 4, 5]`
- `schedules.area_id`: 地区のない市町村は `null`
- `schedules.town`: 通常は `null`（地区単位）。町ごとに曜日が違う場合（長崎市など）は町名を入れる
- `schedules.needs_confirm`: ごみステーションによって曜日が異なり、利用者の確認が必要な場合 `true`（#4）
- `kyoten.label`: 画面に表示する日時の文言。`weekday` / `weeks` が決められない常設の回収場所は `null`
