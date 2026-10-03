/* ========================================
   ながさきごみナビ
   データ読み込み・選択中の地域（共通）

   正本は data/tables/ のフラットな表。
     municipalities.json        市町村一覧
     {市町村}/towns.json        町名
     {市町村}/schedules.json    町ごとの収集日
     {市町村}/categories.json   ごみの種類
     {市町村}/items.json        品目
     {市町村}/kyoten.json       拠点回収（なければ空配列）
     {市町村}/areas.json        地区の表示名（なければ空配列）

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

    function loadTable(path) {

        if (!cache[path]) {

            cache[path] =
                fetch(TABLE_DIR + path + ".json")
                    .then(function (response) {

                        if (!response.ok) {

                            throw new Error(
                                path + ".jsonが見つかりません"
                            );

                        }

                        return response.json();

                    });

        }

        return cache[path];

    }


    function loadMunicipalityTable(municipalityId, name) {

        return loadTable(
            municipalityId + "/" + name
        );

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


    /* ===========================
       市町村一覧
    =========================== */

    async function loadMunicipalities() {

        return loadTable("municipalities");

    }


    /* ===========================
       町名一覧
       [{ name, area, areaName,
          variantGroups: [{ group, options: [...] }] }]
       variantGroups は、ごみステーションによって
       曜日が異なる場合の選択肢
    =========================== */

    async function loadTowns(municipalityId) {

        const [towns, areas, schedules] =
            await Promise.all([
                loadMunicipalityTable(municipalityId, "towns"),
                loadMunicipalityTable(municipalityId, "areas"),
                loadMunicipalityTable(municipalityId, "schedules")
            ]);

        const groupsByTown = new Map();

        schedules.forEach(
            function (s) {

                if (s.variant_group === null) {
                    return;
                }

                if (!groupsByTown.has(s.town)) {
                    groupsByTown.set(s.town, new Map());
                }

                const groups =
                    groupsByTown.get(s.town);

                if (!groups.has(s.variant_group)) {
                    groups.set(s.variant_group, []);
                }

                const options =
                    groups.get(s.variant_group);

                if (!options.includes(s.variant)) {
                    options.push(s.variant);
                }

            }
        );

        return towns.map(
            function (t) {

                const area =
                    areas.find(function (a) {
                        return a.id === t.area;
                    });

                const groups =
                    groupsByTown.get(t.name) || new Map();

                return {
                    name: t.name,
                    area: t.area,
                    areaName: area ? area.name : null,
                    variantGroups:
                        Array.from(groups, function (entry) {
                            return { group: entry[0], options: entry[1] };
                        })
                };

            }
        );

    }


    /* ===========================
       areas.json 相当（互換用）
       { 市町村ID: { areas: [{ id, name, kana, syousai }] } }
    =========================== */

    async function loadAreasData() {

        const municipalities =
            await loadMunicipalities();

        const result = {};

        for (const m of municipalities) {

            const [areas, towns] =
                await Promise.all([
                    loadMunicipalityTable(m.id, "areas"),
                    loadMunicipalityTable(m.id, "towns")
                ]);

            result[m.id] = {

                areas:
                    areas.map(function (a) {

                        return {
                            id: a.id,
                            name: a.name,
                            kana: a.kana,
                            syousai:
                                towns
                                    .filter(function (t) {
                                        return t.area === a.id;
                                    })
                                    .map(function (t) {
                                        return t.name;
                                    })
                        };

                    })

            };

        }

        return result;

    }


    /* ===========================
       calendar.json 相当
       selection: { town, variants: { グループ: 選んだ曜日 } }
       { garbage: [{ name, img, schedule?, date?, separation?,
                     collectionPlace?, collectionPlaceUrl? }] }
    =========================== */

    async function loadCalendar(municipalityId, selection) {

        const [categories, schedules] =
            await Promise.all([
                loadMunicipalityTable(municipalityId, "categories"),
                loadMunicipalityTable(municipalityId, "schedules")
            ]);

        const variants =
            selection.variants || {};

        const townSchedules =
            schedules.filter(function (s) {

                if (s.town !== selection.town) {
                    return false;
                }

                return s.variant_group === null ||
                    variants[s.variant_group] === s.variant;

            });

        const garbage =
            categories.map(function (c) {

                const item = {
                    name: c.name,
                    img: c.img
                };

                const schedule =
                    townSchedules
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
    =========================== */

    async function loadGomi(municipalityId) {

        const [categories, items] =
            await Promise.all([
                loadMunicipalityTable(municipalityId, "categories"),
                loadMunicipalityTable(municipalityId, "items")
            ]);

        const groups = new Map();

        items.forEach(function (i) {

            if (!groups.has(i.category_id)) {
                groups.set(i.category_id, []);
            }

            groups.get(i.category_id).push(i.name);

        });

        const gomi = [];

        groups.forEach(function (names, categoryId) {

            const category =
                categories.find(function (c) {
                    return c.id === categoryId;
                });

            gomi.push({ name: category.name, items: names });

        });

        return { gomi: gomi };

    }


    /* ===========================
       読み（ひらがな）
       { 町名・品目名: { kana, tokens } }
       漢字の町名・品目をひらがなでも検索できるようにする。
       tokens は町だけ（matchTokens を参照）。
       readings.json がない市町村は空
    =========================== */

    async function loadReadings(municipalityId) {

        let rows = [];

        try {
            rows = await loadMunicipalityTable(municipalityId, "readings");
        } catch (error) {
            rows = [];
        }

        const readings = {};

        rows.forEach(function (r) {
            readings[r.name] = {
                kana: r.kana,
                tokens: r.tokens || null
            };
        });

        return readings;

    }


    /* ===========================
       kyoten.json 相当
       { kyoten: [{ jichikai, places: [{ name, date, day?, restriction? }] }] }
    =========================== */

    async function loadKyoten(municipalityId) {

        const rows =
            await loadMunicipalityTable(municipalityId, "kyoten");

        const groups = new Map();

        rows.forEach(function (r) {

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


    /* ===========================
       選択中の地域（localStorage）
         municipality: 市町村ID
         town:         町名
         variants:     { グループ: 選んだ曜日 } のJSON
         area:         地区ID（地区がある市町村のみ。
                       通知の登録などで従来どおり使う）
    =========================== */

    function getSelection() {

        let variants = {};

        try {
            variants =
                JSON.parse(localStorage.getItem("variants")) || {};
        } catch (error) {
            variants = {};
        }

        return {
            municipalityId: localStorage.getItem("municipality"),
            town: localStorage.getItem("town"),
            area: localStorage.getItem("area") || "",
            variants: variants
        };

    }


    function saveSelection(selection) {

        localStorage.setItem("municipality", selection.municipalityId);
        localStorage.setItem("town", selection.town);
        localStorage.setItem("area", selection.area || "");
        localStorage.setItem("variants", JSON.stringify(selection.variants || {}));

    }


    /*
     * 町が選択されていなければ地域選択へ
     * （地区だけ選んでいた以前のデータもここで選び直してもらう）
     */

    function ensureSelection() {

        const selection =
            getSelection();

        if (!selection.municipalityId || !selection.town) {

            window.location.href =
                "index.html?change=true";

            return false;

        }

        return true;

    }


    /*
     * 画面に表示する地域名
     * 例: 「皆前」「かき道５丁目（火・金／金）」
     * ごみステーションの曜日を選んだ場合はそれも添える
     */

    async function getSelectionLabel() {

        const selection =
            getSelection();

        if (!selection.town) {
            return "";
        }

        const towns =
            await loadTowns(selection.municipalityId);

        const town =
            towns.find(function (t) {
                return t.name === selection.town;
            });

        const notes = [];

        if (town) {
            town.variantGroups.forEach(function (group) {
                if (selection.variants[group.group]) {
                    notes.push(selection.variants[group.group]);
                }
            });
        }

        if (notes.length === 0) {
            return selection.town;
        }

        return selection.town + "（" + notes.join("／") + "）";

    }


    /*
     * 検索用に文字をそろえる
     * 全角/半角、大文字/小文字、カタカナ/ひらがな、空白の違いを無視
     */

    function normalizeText(text) {

        return String(text || "")
            .normalize("NFKC")
            .toLowerCase()
            .replace(/\s+/g, "")
            .replace(/[ァ-ヶ]/g, function (char) {
                return String.fromCharCode(
                    char.charCodeAt(0) - 0x60
                );
            });

    }


    /*
     * 町名のトークン（[["本原", "もとはら"], ["1丁目", "1ちょうめ", "いっちょうめ"]]）に
     * 漢字・かなを混ぜた入力が一致するか。トークンの切れ目ごとにどの表記で読んでもよい
     * 例: 「もとはら1丁」「本原いっちょう」
     * query は normalizeText 済みのもの
     */

    function matchTokens(tokens, query) {

        if (!tokens || query === "") {
            return false;
        }

        const forms = tokens.map(function (token) {
            return token.map(normalizeText);
        });

        function matchFrom(index, rest) {

            if (rest === "") {
                return true;
            }

            if (index >= forms.length) {
                return false;
            }

            return forms[index].some(function (form) {
                // 打ちかけ（「丁」→「丁目」）
                if (form.startsWith(rest)) {
                    return true;
                }
                return rest.startsWith(form) &&
                    matchFrom(index + 1, rest.slice(form.length));
            });

        }

        // 途中のトークンから打ってもよい（「1丁目」「小島」）
        return forms.some(function (_, index) {
            return matchFrom(index, query);
        });

    }


    return {
        normalizeText: normalizeText,
        matchTokens: matchTokens,
        loadTable: loadTable,
        loadMunicipalityTable: loadMunicipalityTable,
        loadMunicipalities: loadMunicipalities,
        loadTowns: loadTowns,
        loadAreasData: loadAreasData,
        loadCalendar: loadCalendar,
        loadGomi: loadGomi,
        loadKyoten: loadKyoten,
        loadReadings: loadReadings,
        getSelection: getSelection,
        saveSelection: saveSelection,
        ensureSelection: ensureSelection,
        getSelectionLabel: getSelectionLabel
    };

})();
