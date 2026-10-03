/* ========================================
   data/tables/*.json（正本）を検査し、
   互換用のJSONを生成する

     data/municipalities.json
     data/areas.json
     data/{市町村}/{地区}/calendar.json, gomi.json, kyoten.json
     （地区がない市町村は data/{市町村}/ 直下）

   使い方: node scripts/build_legacy.js
   組み立て処理は js/data.js をそのまま使う。
======================================== */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];


/* ===========================
   js/data.js を読み込む
   （fetch をファイル読み込みに差し替え）
=========================== */

function loadGomiData() {

    const context = vm.createContext({
        fetch: async function (url) {
            const file = path.join(ROOT, url);
            return {
                ok: fs.existsSync(file),
                json: async function () {
                    return JSON.parse(fs.readFileSync(file, "utf8"));
                }
            };
        }
    });

    vm.runInContext(
        fs.readFileSync(path.join(ROOT, "js", "data.js"), "utf8"),
        context
    );

    return vm.runInContext("GomiData", context);

}


/* ===========================
   参照整合性の検査
=========================== */

function validate(t) {

    const errors = [];

    function check(cond, msg) {
        if (!cond) errors.push(msg);
    }

    function unique(rows, keyOf, label) {
        const seen = new Set();
        rows.forEach(function (r) {
            const key = keyOf(r);
            check(!seen.has(key), label + " が重複: " + key);
            seen.add(key);
        });
    }

    function validWeeks(weeks) {
        return Array.isArray(weeks) && weeks.length > 0 &&
            weeks.every(function (n) { return Number.isInteger(n) && n >= 1 && n <= 5; });
    }

    const muniIds = new Set(t.municipalities.map(function (m) { return m.id; }));
    const areaKeys = new Set(t.areas.map(function (a) { return a.municipality_id + "/" + a.id; }));
    const catKeys = new Set(t.categories.map(function (c) { return c.municipality_id + "/" + c.id; }));
    const townKeys = new Set(t.towns.map(function (tw) { return tw.municipality_id + "/" + tw.name; }));

    unique(t.municipalities, function (m) { return m.id; }, "municipalities.id");
    unique(t.areas, function (a) { return a.municipality_id + "/" + a.id; }, "areas.id");
    unique(t.towns, function (tw) { return tw.municipality_id + "/" + tw.name; }, "towns.name");
    unique(t.categories, function (c) { return c.municipality_id + "/" + c.id; }, "categories.id");
    unique(t.categories, function (c) { return c.municipality_id + "/" + c.name; }, "categories.name");
    unique(t.items, function (i) { return i.municipality_id + "/" + i.name + "/" + i.category_id; }, "items.name+category_id");

    t.areas.forEach(function (a) {
        check(muniIds.has(a.municipality_id), "areas: 市町村がない " + a.municipality_id);
    });

    t.towns.forEach(function (tw) {
        check(areaKeys.has(tw.municipality_id + "/" + tw.area_id), "towns: 地区がない " + tw.name);
    });

    t.categories.forEach(function (c) {
        check(muniIds.has(c.municipality_id), "categories: 市町村がない " + c.id);
        check(fs.existsSync(path.join(ROOT, c.img)), "categories: 画像がない " + c.img);
    });

    t.items.forEach(function (i) {
        check(catKeys.has(i.municipality_id + "/" + i.category_id), "items: カテゴリがない " + i.name + " → " + i.category_id);
    });

    t.schedules.forEach(function (s, n) {
        const label = "schedules[" + n + "]";
        check(catKeys.has(s.municipality_id + "/" + s.category_id), label + ": カテゴリがない " + s.category_id);
        check(s.area_id === null || areaKeys.has(s.municipality_id + "/" + s.area_id), label + ": 地区がない " + s.area_id);
        check(s.town === null || townKeys.has(s.municipality_id + "/" + s.town), label + ": 町がない " + s.town);
        check(WEEKDAYS.includes(s.weekday), label + ": 曜日が不正 " + s.weekday);
        check(validWeeks(s.weeks), label + ": weeks が不正");
        check(typeof s.needs_confirm === "boolean", label + ": needs_confirm が不正");
    });

    t.kyoten.forEach(function (k, n) {
        const label = "kyoten[" + n + "]";
        check(muniIds.has(k.municipality_id), label + ": 市町村がない");
        check((k.weekday === null) === (k.weeks === null), label + ": weekday と weeks は両方 null か両方あり");
        check(k.weekday === null || WEEKDAYS.includes(k.weekday), label + ": 曜日が不正 " + k.weekday);
        check(k.weeks === null || validWeeks(k.weeks), label + ": weeks が不正");
    });

    return errors;

}


/* ===========================
   書き出し
=========================== */

function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 4) + "\n", "utf8");
    console.log("  " + path.relative(ROOT, file));
}


async function main() {

    const GomiData = loadGomiData();

    const names = ["municipalities", "areas", "towns", "categories", "items", "schedules", "kyoten"];
    const tables = {};
    for (const name of names) {
        tables[name] = await GomiData.loadTable(name);
    }

    const errors = validate(tables);
    if (errors.length > 0) {
        console.error("data/tables の検査でエラー:");
        errors.forEach(function (e) { console.error("  " + e); });
        process.exit(1);
    }

    console.log("生成:");

    writeJson(path.join(DATA_DIR, "municipalities.json"), await GomiData.loadMunicipalities());

    const areasData = await GomiData.loadAreasData();
    writeJson(path.join(DATA_DIR, "areas.json"), areasData);

    for (const m of tables.municipalities) {

        const areaIds = areasData[m.id].areas.map(function (a) { return a.id; });
        const dirs = areaIds.length > 0 ? areaIds : [null];

        for (const areaId of dirs) {
            const dir = areaId ? path.join(DATA_DIR, m.id, areaId) : path.join(DATA_DIR, m.id);
            writeJson(path.join(dir, "calendar.json"), await GomiData.loadCalendar(m.id, areaId));
            writeJson(path.join(dir, "gomi.json"), await GomiData.loadGomi(m.id));
            writeJson(path.join(dir, "kyoten.json"), await GomiData.loadKyoten(m.id));
        }

    }

}


main();
