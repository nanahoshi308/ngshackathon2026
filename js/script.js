// ========================================
// ながさきごみナビ
// 地域選択用 JavaScript
//
// 1画面に1項目ずつ聞いていく
//   1. 町名（長崎市・長与町をまとめて検索）
//   2. ごみステーションの曜日（必要な町のみ、グループごとに1画面）
//   3. 収集曜日の確認
// ========================================


// ========================================
// データ
// ========================================

// 全市町村の町名 [{ name, area, variantGroups, municipalityId, municipalityName }]
let allTowns = [];

// 選択中の町
let selectedTown = null;

// ステーションごとの曜日の選択 { グループ: 曜日 }
let selectedVariants = {};

// 画面の並び [{ type: "town" | "variant" | "confirm", group? }]
let steps = [{ type: "town" }];

// 表示中の画面
let stepIndex = 0;


// 一度に表示する検索結果の数
const MAX_RESULTS = 50;

// 現在地から出す町の候補の数
const GPS_MAX_SUGGESTIONS = 3;


// 国土地理院の逆ジオコーダ（緯度経度 → 市区町村コード・町字名）
const REVERSE_GEOCODER_URL =
    "https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress";

// 市区町村コード → 市町村ID
const MUNICIPALITY_CODES = {
    "42201": "nagasaki",
    "42307": "nagayo"
};


// ========================================
// HTMLの要素
// ========================================

const backButton =
    document.getElementById("back-button");

const wizardProgress =
    document.getElementById("wizard-progress");

const stepTown =
    document.getElementById("step-town");

const stepVariant =
    document.getElementById("step-variant");

const stepConfirm =
    document.getElementById("step-confirm");

const gpsButton =
    document.getElementById("gps-button");

const gpsButtonText =
    document.getElementById("gps-button-text");

const gpsMessage =
    document.getElementById("gps-message");

const suggestBox =
    document.getElementById("suggest-box");

const suggestLabel =
    document.getElementById("suggest-label");

const suggestList =
    document.getElementById("suggest-list");

const townSearch =
    document.getElementById("town-search");

const townCount =
    document.getElementById("town-count");

const townResults =
    document.getElementById("town-results");

const variantTown =
    document.getElementById("variant-town");

const variantTitle =
    document.getElementById("variant-title");

const variantOptions =
    document.getElementById("variant-options");

const confirmTown =
    document.getElementById("confirm-town");

const confirmList =
    document.getElementById("confirm-list");

const startButton =
    document.getElementById("start-button");

const fixVariantButton =
    document.getElementById("fix-variant-button");

const fixTownButton =
    document.getElementById("fix-town-button");


/*
 * 変更画面から来たか確認
 */
const params =
    new URLSearchParams(
        window.location.search
    );

const isChange =
    params.get("change") === "true";

const savedSelection =
    GomiData.getSelection();


/*
 * 「変更」ではない場合だけ
 * 保存されている地域を確認
 */
if (!isChange) {

    /*
     * 市町村と町が保存済みなら
     * main.htmlへ移動
     */
    if (
        savedSelection.municipalityId &&
        savedSelection.town
    ) {

        window.location.href =
            "main.html";

    }

}


// ========================================
// JSONを読み込む
// ========================================

async function loadData() {

    try {

        const municipalities =
            await GomiData.loadMunicipalities();


        const townLists =
            await Promise.all(
                municipalities.map(function(m) {
                    return GomiData.loadTowns(m.id);
                })
            );


        municipalities.forEach(function(m, index) {

            townLists[index].forEach(function(town) {

                town.municipalityId = m.id;

                town.municipalityName = m.name;

                allTowns.push(town);

            });

        });

    } catch (error) {

        console.error(
            "データの読み込みに失敗しました。",
            error
        );

        townCount.textContent =
            "町名を読み込めませんでした。時間をおいて再度お試しください。";

        return;

    }


    // ========================================
    // 「変更」のときは前回の町を候補に出す
    // ========================================

    const savedTown =
        findTown(
            savedSelection.municipalityId,
            savedSelection.town
        );

    if (savedTown) {

        showSuggestions(
            "前回の設定",
            [savedTown]
        );

    }


    renderTownResults();


    // 位置情報がすでに許可されていれば、そのまま現在地を調べる
    autoLocate();

}


function findTown(municipalityId, name) {

    return allTowns.find(function(t) {

        return t.municipalityId === municipalityId &&
            t.name === name;

    }) || null;

}


// ========================================
// 画面の切り替え
// ========================================

function buildSteps() {

    steps = [{ type: "town" }];

    if (selectedTown) {

        selectedTown.variantGroups.forEach(function(group) {

            steps.push({ type: "variant", group: group });

        });

        steps.push({ type: "confirm" });

    }

}


/*
 * 進む画面はブラウザの履歴にも積み、
 * スマホの「戻る」でも1画面ずつ戻れるようにする
 */

function goTo(index) {

    if (index > stepIndex) {

        history.pushState(
            { step: index },
            ""
        );

        showStep(index);

    } else if (index < stepIndex) {

        history.go(index - stepIndex);

    }

}


window.addEventListener(
    "popstate",
    function(event) {

        const index =
            event.state && typeof event.state.step === "number" ?
                event.state.step :
                0;

        // 町が未選択のまま先の画面には進めない
        showStep(
            selectedTown ?
                Math.min(index, steps.length - 1) :
                0
        );

    }
);


function showStep(index) {

    stepIndex = index;

    const step =
        steps[index];


    stepTown.hidden =
        step.type !== "town";

    stepVariant.hidden =
        step.type !== "variant";

    stepConfirm.hidden =
        step.type !== "confirm";


    if (step.type === "variant") {

        renderVariant(step.group);

    }

    if (step.type === "confirm") {

        renderConfirm();

    }


    /*
     * 最初の画面の「戻る」は、
     * 変更で来たときだけ元の画面へ戻す
     */

    backButton.hidden =
        index === 0 &&
        !(isChange && savedSelection.town);


    renderProgress();

    window.scrollTo(0, 0);

}


function renderProgress() {

    wizardProgress.innerHTML = "";


    // 町を選ぶ前は、確認までの最短の数を出しておく
    const total =
        Math.max(steps.length, 2);


    for (let i = 0; i < total; i++) {

        const dot =
            document.createElement("li");

        dot.className =
            "wizard-dot" +
            (i < stepIndex ? " done" : "") +
            (i === stepIndex ? " current" : "");

        wizardProgress.appendChild(dot);

    }


    wizardProgress.setAttribute(
        "aria-label",
        "設定 " + (stepIndex + 1) + " / " + total
    );

}


backButton.addEventListener(
    "click",
    function() {

        if (stepIndex === 0) {

            window.location.href =
                "main.html";

            return;

        }

        history.back();

    }
);


// ========================================
// 検索用に文字をそろえる（data.js と共通）
// ========================================

const normalizeText =
    GomiData.normalizeText;


// ========================================
// 町名の候補ボタン
// ========================================

function createTownButton(town) {

    const item =
        document.createElement("li");

    const button =
        document.createElement("button");

    button.type = "button";

    button.className =
        "town-result";

    button.textContent =
        town.name;


    const municipality =
        document.createElement("span");

    municipality.className =
        "town-result-municipality";

    municipality.textContent =
        town.municipalityName;

    button.appendChild(municipality);


    button.addEventListener(
        "click",
        function() {

            selectTown(town);

        }
    );

    item.appendChild(button);

    return item;

}


// ========================================
// 町名の検索結果を表示
// ========================================

townSearch.addEventListener(
    "input",
    function() {

        renderTownResults();

    }
);


function renderTownResults() {

    townResults.innerHTML = "";


    const query =
        normalizeText(townSearch.value);


    // 何も入力していないときは候補を出さない
    if (query === "") {

        townCount.textContent = "";

        return;

    }


    const matches =
        allTowns.filter(function(town) {

            return normalizeText(town.name).includes(query);

        });


    // ========================================
    // 件数
    // ========================================

    if (matches.length === 0) {

        townCount.textContent =
            "該当する町名がありません。";

    } else if (matches.length > MAX_RESULTS) {

        townCount.textContent =
            matches.length +
            "件中 " +
            MAX_RESULTS +
            "件を表示しています。続けて入力して絞り込んでください。";

    } else {

        townCount.textContent =
            matches.length + "件";

    }


    // ========================================
    // 候補
    // ========================================

    matches
        .slice(0, MAX_RESULTS)
        .forEach(function(town) {

            townResults.appendChild(
                createTownButton(town)
            );

        });

}


function showSuggestions(label, towns) {

    suggestList.innerHTML = "";

    suggestLabel.textContent =
        label;

    towns.forEach(function(town) {

        suggestList.appendChild(
            createTownButton(town)
        );

    });

    suggestBox.hidden =
        towns.length === 0;

}


// ========================================
// 現在地から町名を推測
// ========================================

gpsButton.addEventListener(
    "click",
    function() {

        locate();

    }
);


async function autoLocate() {

    if (
        !navigator.permissions ||
        !navigator.geolocation
    ) {
        return;
    }

    try {

        const status =
            await navigator.permissions.query({
                name: "geolocation"
            });

        if (status.state === "granted") {

            locate();

        }

    } catch (error) {

        // 調べられないブラウザでは、ボタンを押してもらう

    }

}


function getPosition() {

    return new Promise(function(resolve, reject) {

        navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 60000
            }
        );

    });

}


function showGpsMessage(text) {

    gpsMessage.textContent =
        text;

    gpsMessage.hidden =
        text === "";

}


async function locate() {

    if (!navigator.geolocation) {

        showGpsMessage(
            "この端末では現在地を使えません。町名を入力してください。"
        );

        return;

    }


    gpsButton.disabled = true;

    gpsButtonText.textContent =
        "現在地を確認しています…";

    showGpsMessage("");


    try {

        const position =
            await getPosition();


        const addresses =
            await getNearbyAddresses(
                position.coords
            );

        suggestFromAddresses(
            addresses
        );

    } catch (error) {

        console.error(
            "現在地の取得に失敗しました。",
            error
        );

        showGpsMessage(
            error.code === 1 ?
                "位置情報の利用が許可されていません。町名を入力してください。" :
                "現在地を確認できませんでした。町名を入力してください。"
        );

    } finally {

        gpsButton.disabled = false;

        gpsButtonText.textContent =
            "現在地から探す";

    }

}


/*
 * 漢数字の丁目を算用数字にそろえる
 * 例: 上小島三丁目 → 上小島3丁目
 */

function kanjiChomeToNumber(name) {

    const digits = {
        "一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
        "六": 6, "七": 7, "八": 8, "九": 9
    };

    return name.replace(
        /([一二三四五六七八九十]+)丁目$/,
        function(match, kanji) {

            let number = 0;

            if (kanji.includes("十")) {

                const parts =
                    kanji.split("十");

                number =
                    (digits[parts[0]] || 1) * 10 +
                    (digits[parts[1]] || 0);

            } else {

                number =
                    digits[kanji];

            }

            return number + "丁目";

        }
    );

}


/*
 * 現在地とその周り8方向の住所を調べる
 * GPSの誤差や町境に近い場合に備えて、近くの町も候補に出す
 * 戻り値は現在地を先頭にした住所の配列
 */

async function getNearbyAddresses(coords) {

    // 誤差の大きさに合わせて、100〜300mの範囲で周りを調べる
    const radius =
        Math.min(
            Math.max(coords.accuracy || 0, 100),
            300
        );

    const latStep =
        radius / 111000;

    const lonStep =
        radius / (111000 * Math.cos(coords.latitude * Math.PI / 180));


    const points = [
        [0, 0],
        [1, 0], [0, 1], [-1, 0], [0, -1],
        [1, 1], [1, -1], [-1, 1], [-1, -1]
    ].map(function(offset) {

        const scale =
            offset[0] !== 0 && offset[1] !== 0 ?
                Math.SQRT1_2 :
                1;

        return {
            lat: coords.latitude + offset[0] * latStep * scale,
            lon: coords.longitude + offset[1] * lonStep * scale
        };

    });


    const results =
        await Promise.allSettled(
            points.map(fetchAddress)
        );


    if (results[0].status === "rejected") {

        throw results[0].reason;

    }


    return results
        .filter(function(result) {
            return result.status === "fulfilled" && result.value;
        })
        .map(function(result) {
            return result.value;
        });

}


async function fetchAddress(point) {

    const response =
        await fetch(
            REVERSE_GEOCODER_URL +
            "?lat=" + point.lat +
            "&lon=" + point.lon
        );

    if (!response.ok) {

        throw new Error(
            "住所を調べられませんでした。"
        );

    }


    const data =
        await response.json();

    return data.results || null;

}


/*
 * 住所に当てはまる町を探す
 * exact: 町名が一致したもの
 * partial: 丁目・町・郷を除いた名前を含むもの
 */

function findTownsForAddress(address) {

    const municipalityId =
        MUNICIPALITY_CODES[address.muniCd];

    const municipalityTowns =
        allTowns.filter(function(t) {
            return t.municipalityId === municipalityId;
        });


    const addressName =
        normalizeText(
            kanjiChomeToNumber(address.lv01Nm || "")
        );

    const exact =
        municipalityTowns.filter(function(t) {
            return normalizeText(t.name) === addressName;
        });


    const baseName =
        addressName.replace(/(\d+丁目|町|郷)$/, "");

    const partial =
        baseName === "" ?
            [] :
            municipalityTowns.filter(function(t) {
                return normalizeText(t.name).includes(baseName);
            });


    return {
        municipalityId: municipalityId,
        municipalityTowns: municipalityTowns,
        exact: exact,
        partial: partial
    };

}


function suggestFromAddresses(addresses) {

    const found =
        addresses.map(findTownsForAddress);

    const center =
        found[0];


    // 現在地の町 → 周りの町 → 名前の似た町 の順に並べる
    const candidates = [];

    found
        .map(function(f) { return f.exact; })
        .concat(found.map(function(f) { return f.partial; }))
        .forEach(function(towns) {

            towns.forEach(function(t) {

                if (!candidates.includes(t)) {
                    candidates.push(t);
                }

            });

        });


    if (!center.municipalityId && candidates.length === 0) {

        showGpsMessage(
            "現在地は長崎市・長与町の外のようです。町名を入力してください。"
        );

        return;

    }


    const place =
        (center.municipalityTowns.length > 0 ?
            center.municipalityTowns[0].municipalityName :
            "") +
        (addresses[0].lv01Nm || "");


    if (candidates.length > 0) {

        showGpsMessage("");

        showSuggestions(
            "現在地（" + place + "付近）の候補",
            candidates.slice(0, GPS_MAX_SUGGESTIONS)
        );

    } else if (center.municipalityId === "nagayo") {

        // 長与町は自治会名なので住所からは絞り込めないことが多い
        showGpsMessage("");

        showSuggestions(
            "現在地は" + place + "付近です。お住まいの自治会を選んでください",
            center.municipalityTowns
        );

    } else {

        showGpsMessage(
            "現在地は" + place + "付近ですが、町名の候補が見つかりませんでした。町名を入力してください。"
        );

    }

}


// ========================================
// 町を選択
// ========================================

function selectTown(town) {

    if (town !== selectedTown) {

        // 前回と同じ町なら、前回の曜日を初期値にする
        const isSaved =
            town.municipalityId === savedSelection.municipalityId &&
            town.name === savedSelection.town;

        selectedVariants =
            isSaved ?
                Object.assign({}, savedSelection.variants) :
                {};

    }

    selectedTown = town;

    buildSteps();

    goTo(1);

}


// ========================================
// ごみステーションの曜日を選ぶ
// ========================================

function townLabel() {

    return selectedTown.municipalityName +
        " " +
        selectedTown.name;

}


function renderVariant(group) {

    variantTown.textContent =
        townLabel();

    variantTitle.textContent =
        "「" + group.group + "」の収集日は？";


    variantOptions.innerHTML = "";

    group.options.forEach(function(option) {

        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            "choice-button" +
            (selectedVariants[group.group] === option ? " selected" : "");

        button.textContent =
            option + "曜日";


        button.addEventListener(
            "click",
            function() {

                selectedVariants[group.group] =
                    option;

                goTo(stepIndex + 1);

            }
        );

        variantOptions.appendChild(button);

    });

}


// ========================================
// 収集曜日の確認
// ========================================

/*
 * [{ day: "月曜日", restriction: [1,1,1,1,1] }, ...] を
 * 「毎週 月・木曜日」「第2・4 金曜日」のような文にする
 */

function formatSchedule(schedule) {

    const groups = new Map();

    schedule.forEach(function(s) {

        const key =
            s.restriction.join("");

        if (!groups.has(key)) {

            groups.set(key, {
                restriction: s.restriction,
                days: []
            });

        }

        groups.get(key).days.push(
            s.day.charAt(0)
        );

    });


    return Array.from(groups.values(), function(g) {

        const weeks =
            g.restriction.every(function(x) { return x === 1; }) ?
                "毎週" :
                "第" +
                g.restriction
                    .map(function(x, i) { return x ? i + 1 : null; })
                    .filter(Boolean)
                    .join("・");

        return weeks + " " + g.days.join("・") + "曜日";

    }).join("、");

}


async function renderConfirm() {

    confirmTown.textContent =
        townLabel();

    fixVariantButton.hidden =
        selectedTown.variantGroups.length === 0;

    confirmList.innerHTML = "";


    let calendar;

    try {

        calendar =
            await GomiData.loadCalendar(
                selectedTown.municipalityId,
                {
                    town: selectedTown.name,
                    variants: selectedVariants
                }
            );

    } catch (error) {

        console.error(
            "収集日の読み込みに失敗しました。",
            error
        );

        confirmList.innerHTML =
            '<li class="confirm-error">収集日を読み込めませんでした。</li>';

        return;

    }


    calendar.garbage
        .filter(function(g) {
            return g.schedule;
        })
        .forEach(function(g) {

            const item =
                document.createElement("li");

            item.className =
                "confirm-item";


            const icon =
                document.createElement("img");

            icon.className =
                "confirm-icon";

            icon.src = g.img;

            icon.alt = "";


            const name =
                document.createElement("span");

            name.className =
                "confirm-name";

            name.textContent =
                g.name;


            const days =
                document.createElement("span");

            days.className =
                "confirm-days";

            days.textContent =
                formatSchedule(g.schedule);


            item.appendChild(icon);

            item.appendChild(name);

            item.appendChild(days);

            confirmList.appendChild(item);

        });

}


fixVariantButton.addEventListener(
    "click",
    function() {

        goTo(1);

    }
);


fixTownButton.addEventListener(
    "click",
    function() {

        goTo(0);

    }
);


// ========================================
// 保存してごみ情報を見る
// ========================================

startButton.addEventListener(
    "click",
    function() {

        /*
         * 選択中の町に関係するグループだけ保存
         */

        const variants = {};

        selectedTown.variantGroups.forEach(
            function(group) {

                variants[group.group] =
                    selectedVariants[group.group];

            }
        );


        GomiData.saveSelection({
            municipalityId: selectedTown.municipalityId,
            town: selectedTown.name,
            area: selectedTown.area,
            variants: variants
        });


        // main.htmlへ
        window.location.href =
            "main.html";

    }
);


// ========================================
// 開始
// ========================================

history.replaceState(
    { step: 0 },
    ""
);

showStep(0);

loadData();
