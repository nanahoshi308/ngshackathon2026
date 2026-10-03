/* ========================================
   ながさきごみナビ
   データ読み込み（共通）

   正本は data/tables/*.json（フラットな表）。
   ここで各ページが使う形に組み立てて返す。
   scripts/build_legacy.js も同じ処理で
   data/ 直下の互換JSONを生成している。
======================================== */

const GomiData = (function () {

    const TABLE_DIR =
        "data/tables/";

    const WEEKDAY_NAMES = {
        mon: "月曜日",
        tue: "火曜日",
        wed: "水曜日",
        thu: "木曜日",
        fri: "金曜日",
        sat: "土曜日",
        sun: "日曜日"
    };

    const cache = {};


    /* ===========================
       テーブルを読み込む
    =========================== */

    function loadTable(name) {

        if (!cache[name]) {

            cache[name] =
                fetch(TABLE_DIR + name + ".json")
                    .then(function (response) {

                        if (!response.ok) {

                            throw new Error(
                                name + ".jsonが見つかりません"
                            );

                        }

                        return response.json();

                    });

        }

        return cache[name];

    }


    /*
     * 第n週の配列 [1, 3] を
     * 旧形式の restriction [1, 0, 1, 0, 0] に変換
     */

    function toRestriction(weeks) {

        return [1, 2, 3, 4, 5].map(
            function (n) {
                return weeks.includes(n) ? 1 : 0;
            }
        );

    }


    /*
     * 地区単位の行か
     * （地区がない市町村は area_id が null）
     */

    function matchArea(row, areaId) {

        return row.area_id === (areaId || null);

    }


    /* ===========================
       municipalities.json 相当
    =========================== */

    async function loadMunicipalities() {

        const municipalities =
            await loadTable("municipalities");

        return municipalities.map(
            function (m) {
                return { id: m.id, name: m.name, kana: m.kana };
            }
        );

    }


    /* ===========================
       areas.json 相当
       { 市町村ID: { areas: [{ id, name, kana, syousai }] } }
    =========================== */

    async function loadAreasData() {

        const [municipalities, areas, towns] =
            await Promise.all([
                loadTable("municipalities"),
                loadTable("areas"),
                loadTable("towns")
            ]);

        const result = {};

        municipalities.forEach(
            function (m) {

                result[m.id] = {

                    areas:
                        areas
                            .filter(function (a) {
                                return a.municipality_id === m.id;
                            })
                            .map(function (a) {

                                return {
                                    id: a.id,
                                    name: a.name,
                                    kana: a.kana,
                                    syousai:
                                        towns
                                            .filter(function (t) {
                                                return t.municipality_id === m.id &&
                                                    t.area_id === a.id;
                                            })
                                            .map(function (t) {
                                                return t.name;
                                            })
                                };

                            })

                };

            }
        );

        return result;

    }


    /* ===========================
       calendar.json 相当
       { garbage: [{ name, img, schedule?, date?, separation?,
                     collectionPlace?, collectionPlaceUrl? }] }
    =========================== */

    async function loadCalendar(municipalityId, areaId) {

        const [categories, schedules] =
            await Promise.all([
                loadTable("categories"),
                loadTable("schedules")
            ]);

        const areaSchedules =
            schedules.filter(function (s) {
                return s.municipality_id === municipalityId &&
                    matchArea(s, areaId) &&
                    s.town === null;
            });

        const garbage =
            categories
                .filter(function (c) {
                    return c.municipality_id === municipalityId;
                })
                .map(function (c) {

                    const item = {
                        name: c.name,
                        img: c.img
                    };

                    const schedule =
                        areaSchedules
                            .filter(function (s) {
                                return s.category_id === c.id;
                            })
                            .map(function (s) {
                                return {
                                    day: WEEKDAY_NAMES[s.weekday],
                                    restriction: toRestriction(s.weeks)
                                };
                            });

                    if (schedule.length > 0) item.schedule = schedule;
                    if (c.date_note !== null) item.date = c.date_note;
                    if (c.separation !== null) item.separation = c.separation;
                    if (c.collection_place !== null) item.collectionPlace = c.collection_place;
                    if (c.collection_place_url !== null) item.collectionPlaceUrl = c.collection_place_url;

                    return item;

                });

        return { garbage: garbage };

    }


    /* ===========================
       gomi.json 相当
       { gomi: [{ name: カテゴリ名, items: [品目] }] }
       ※ 品目は市町村単位なので areaId は使わない
    =========================== */

    async function loadGomi(municipalityId) {

        const [categories, items] =
            await Promise.all([
                loadTable("categories"),
                loadTable("items")
            ]);

        const groups = new Map();

        items
            .filter(function (i) {
                return i.municipality_id === municipalityId;
            })
            .forEach(function (i) {

                if (!groups.has(i.category_id)) {
                    groups.set(i.category_id, []);
                }

                groups.get(i.category_id).push(i.name);

            });

        const gomi = [];

        groups.forEach(function (names, categoryId) {

            const category =
                categories.find(function (c) {
                    return c.municipality_id === municipalityId &&
                        c.id === categoryId;
                });

            gomi.push({ name: category.name, items: names });

        });

        return { gomi: gomi };

    }


    /* ===========================
       kyoten.json 相当
       { kyoten: [{ jichikai, places: [{ name, date, day?, restriction? }] }] }
       ※ 拠点は市町村単位なので areaId は使わない
    =========================== */

    async function loadKyoten(municipalityId) {

        const rows =
            await loadTable("kyoten");

        const groups = new Map();

        rows
            .filter(function (r) {
                return r.municipality_id === municipalityId;
            })
            .forEach(function (r) {

                if (!groups.has(r.jichikai)) {
                    groups.set(r.jichikai, []);
                }

                const place = {
                    name: r.place,
                    date: r.label
                };

                if (r.weekday !== null) {
                    place.day = WEEKDAY_NAMES[r.weekday];
                    place.restriction = toRestriction(r.weeks);
                }

                groups.get(r.jichikai).push(place);

            });

        const kyoten = [];

        groups.forEach(function (places, jichikai) {
            kyoten.push({ jichikai: jichikai, places: places });
        });

        return { kyoten: kyoten };

    }


    return {
        loadTable: loadTable,
        loadMunicipalities: loadMunicipalities,
        loadAreasData: loadAreasData,
        loadCalendar: loadCalendar,
        loadGomi: loadGomi,
        loadKyoten: loadKyoten
    };

})();
