/* ========================================
   data/tables/*.json（正本）を検査し、
   互換用のJSONを生成する

     data/municipalities.json
     data/areas.json
     data/{市町村}/{地区}/calendar.json, gomi.json, kyoten.json
     （地区がある市町村のみ）

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
   参照整合性の検査（市町村ごと）
=========================== */

function validate(m, t) {

    const errors = [];

    function check(cond, msg) {
        if (!cond) errors.push(m + ": " + msg);
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

    const areaIds = new Set(t.areas.map(function (a) { return a.id; }));
    const townNames = new Set(t.towns.map(function (tw) { return tw.name; }));
    const categoryIds = new Set(t.categories.map(function (c) { return c.id; }));

    unique(t.areas, function (a) { return a.id; }, "areas.id");
    unique(t.towns, function (tw) { return tw.name; }, "towns.name");
    unique(t.categories, function (c) { return c.id; }, "categories.id");
    unique(t.categories, function (c) { return c.name; }, "categories.name");
    unique(t.items, function (i) { return i.name + "/" + i.category_id; }, "items.name+category_id");
    unique(t.schedules, function (s) {
        return [s.town, s.category_id, s.weekday, s.variant_group, s.variant].join("/");
    }, "schedules");

    t.towns.forEach(function (tw) {
        check(tw.area === null || areaIds.has(tw.area), "towns: 地区がない " + tw.name + " → " + tw.area);
        check(t.areas.length === 0 || tw.area !== null, "towns: 地区が未設定 " + tw.name);
    });

    t.categories.forEach(function (c) {
        check(fs.existsSync(path.join(ROOT, c.img)), "categories: 画像がない " + c.img);
    });

    t.items.forEach(function (i) {
        check(categoryIds.has(i.category_id), "items: カテゴリがない " + i.name + " → " + i.category_id);
    });

    t.schedules.forEach(function (s, n) {
        const label = "schedules[" + n + "]";
        check(townNames.has(s.town), label + ": 町がない " + s.town);
        check(categoryIds.has(s.category_id), label + ": カテゴリがない " + s.category_id);
        check(WEEKDAYS.includes(s.weekday), label + ": 曜日が不正 " + s.weekday);
        check(validWeeks(s.weeks), label + ": weeks が不正");
        check((s.variant_group === null) === (s.variant === null), label + ": variant_group と variant は両方 null か両方あり");
    });

    t.kyoten.forEach(function (k, n) {
        const label = "kyoten[" + n + "]";
        check((k.weekday === null) === (k.weeks === null), label + ": weekday と weeks は両方 null か両方あり");
        check(k.weekday === null || WEEKDAYS.includes(k.weekday), label + ": 曜日が不正 " + k.weekday);
        check(k.weeks === null || validWeeks(k.weeks), label + ": weeks が不正");
    });

    const itemNames = new Set(t.items.map(function (i) { return i.name; }));

    unique(t.readings, function (r) { return r.name; }, "readings.name");

    t.readings.forEach(function (r) {
        check(townNames.has(r.name) || itemNames.has(r.name), "readings: 町・品目がない " + r.name);
        check(/^[ぁ-ゖー0-9]+$/.test(r.kana), "readings: 読みはひらがな（と数字）で " + r.name + " → " + r.kana);

        if (!r.tokens) {
            return;
        }
        // トークンは [表記, 読み, (別の読み)]。表記をつなぐと町名、読みをつなぐと kana になる
        check(r.tokens.every(function (token) {
            return token.length >= 2 && token.slice(1).every(function (kana) {
                return /^[ぁ-ゖー0-9]+$/.test(kana);
            });
        }), "readings: tokens の形が不正 " + r.name);
        check(r.tokens.map(function (token) { return token[0]; }).join("") === r.name.normalize("NFKC"),
            "readings: tokens の表記が町名と合わない " + r.name);
        check(r.tokens.map(function (token) { return token[1]; }).join("") === r.kana,
            "readings: tokens の読みが kana と合わない " + r.name);
    });

    return errors;

}


/*
 * 地区単位の互換JSONを作るため、
 * 同じ地区の町はすべて同じ収集日であることを確認
 */

function scheduleKey(schedules, town) {
    return JSON.stringify(
        schedules
            .filter(function (s) { return s.town === town; })
            .map(function (s) { return [s.category_id, s.weekday, s.weeks, s.variant_group, s.variant]; })
            .sort()
    );
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

    const municipalities = await GomiData.loadMunicipalities();
    const tables = {};
    let errors = [];

    for (const m of municipalities) {
        const t = {};
        for (const name of ["areas", "towns", "schedules", "categories", "items", "kyoten", "readings"]) {
            t[name] = await GomiData.loadMunicipalityTable(m.id, name);
        }
        tables[m.id] = t;
        errors = errors.concat(validate(m.id, t));
    }

    if (errors.length > 0) {
        console.error("data/tables の検査でエラー:");
        errors.forEach(function (e) { console.error("  " + e); });
        process.exit(1);
    }

    console.log("生成:");

    writeJson(path.join(DATA_DIR, "municipalities.json"), municipalities);
    writeJson(path.join(DATA_DIR, "areas.json"), await GomiData.loadAreasData());

    /*
     * 地区がある市町村だけ、従来の地区単位のJSONを作る
     */

    for (const m of municipalities) {

        const t = tables[m.id];

        for (const area of t.areas) {

            const towns = t.towns.filter(function (tw) { return tw.area === area.id; });
            const keys = new Set(towns.map(function (tw) { return scheduleKey(t.schedules, tw.name); }));

            if (keys.size !== 1) {
                console.error(m.id + "/" + area.id + ": 地区内で収集日が異なる町があるため互換JSONを作れません");
                process.exit(1);
            }

            const dir = path.join(DATA_DIR, m.id, area.id);
            writeJson(path.join(dir, "calendar.json"), await GomiData.loadCalendar(m.id, { town: towns[0].name }));
            writeJson(path.join(dir, "gomi.json"), await GomiData.loadGomi(m.id));
            writeJson(path.join(dir, "kyoten.json"), await GomiData.loadKyoten(m.id));

        }

    }

}


main();
