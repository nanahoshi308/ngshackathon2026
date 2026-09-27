/* ===========================
   HTMLの要素
=========================== */

const cityName =
    document.getElementById(
        "city-name"
    );

const areaName =
    document.getElementById(
        "area-name"
    );

const municipalityName =
    document.getElementById(
        "municipality-name"
    );

const jichikaiList =
    document.getElementById(
        "jichikai-list"
    );


/* ===========================
   選択中の地域
=========================== */

const municipalityId =
    localStorage.getItem(
        "municipality"
    );

const areaId =
    localStorage.getItem(
        "area"
    );


/* ===========================
   カレンダー登録データ
=========================== */

const calendarLocationKey =
    "calendarLocations";


/* ===========================
   初期処理
=========================== */

async function initialize() {

    if (!municipalityId) {

        window.location.href =
            "index.html";

        return;

    }


    try {

        await loadMunicipality();

        await loadAreaName();

        await loadKyoten();

    } catch (error) {

        console.error(
            "指定場所の読み込みに失敗しました。",
            error
        );

        jichikaiList.innerHTML = `
            <div class="location-error">
                回収場所を読み込めませんでした。
            </div>
        `;

    }

}


/* ===========================
   市町村名
=========================== */

async function loadMunicipality() {

    const response =
        await fetch(
            "data/municipalities.json"
        );


    if (!response.ok) {

        throw new Error(
            "municipalities.jsonが見つかりません"
        );

    }


    const municipalities =
        await response.json();


    const municipality =
        municipalities.find(
            function(item) {

                return item.id ===
                    municipalityId;

            }
        );


    if (!municipality) {

        throw new Error(
            "市町村が見つかりません"
        );

    }


    cityName.textContent =
        municipality.name;

    municipalityName.textContent =
        municipality.name;

}


/* ===========================
   地区名
=========================== */

async function loadAreaName() {

    if (!areaId) {

        areaName.textContent =
            "";

        return;

    }


    const response =
        await fetch(
            "data/areas.json"
        );


    if (!response.ok) {

        throw new Error(
            "areas.jsonが見つかりません"
        );

    }


    const areasData =
        await response.json();


    const municipalityData =
        areasData[
            municipalityId
        ];


    if (
        !municipalityData ||
        !Array.isArray(
            municipalityData.areas
        )
    ) {

        return;

    }


    const area =
        municipalityData.areas.find(
            function(item) {

                return item.id ===
                    areaId;

            }
        );


    if (area) {

        areaName.textContent =
            area.name;

        municipalityName.textContent =
            cityName.textContent +
            " " +
            area.name;

    }

}


/* ===========================
   指定場所を読み込む
=========================== */

async function loadKyoten() {

    let path;


    if (areaId) {

        path =
            "data/" +
            municipalityId +
            "/" +
            areaId +
            "/kyoten.json";

    } else {

        path =
            "data/" +
            municipalityId +
            "/kyoten.json";

    }


    console.log(
        "読み込む指定場所：",
        path
    );


    const response =
        await fetch(path);


    if (!response.ok) {

        throw new Error(
            "kyoten.jsonが見つかりません"
        );

    }


    const data =
        await response.json();


    displayKyoten(data);

}


/* ===========================
   指定場所を表示
=========================== */

function displayKyoten(data) {

    jichikaiList.innerHTML = "";


    if (
        !data ||
        !Array.isArray(
            data.kyoten
        ) ||
        data.kyoten.length === 0
    ) {

        jichikaiList.innerHTML = `
            <div class="no-location">
                回収場所の情報がありません。
            </div>
        `;

        return;

    }


    data.kyoten.forEach(
        function(kyoten) {

            createJichikai(
                kyoten
            );

        }
    );

}


/* ===========================
   自治会を作成
=========================== */

function createJichikai(
    kyoten
) {

    const item =
        document.createElement(
            "div"
        );

    item.className =
        "jichikai-item";


    const button =
        document.createElement(
            "button"
        );

    button.type =
        "button";

    button.className =
        "jichikai-button";


    button.innerHTML = `
        <span>
            ${kyoten.jichikai}
        </span>

        <span class="jichikai-arrow">
            ▼
        </span>
    `;


    const content =
        document.createElement(
            "div"
        );

    content.className =
        "jichikai-content";


    item.appendChild(
        button
    );

    item.appendChild(
        content
    );

    jichikaiList.appendChild(
        item
    );


    button.addEventListener(
        "click",
        function() {

            item.classList.toggle(
                "open"
            );

        }
    );


    if (
        !Array.isArray(
            kyoten.places
        ) ||
        kyoten.places.length === 0
    ) {

        content.innerHTML = `
            <div class="no-location">
                回収場所の情報がありません。
            </div>
        `;

        return;

    }


    kyoten.places.forEach(
        function(place) {

            createCollectionPlace(
                kyoten.jichikai,
                place,
                content
            );

        }
    );

}


/* ===========================
   回収場所を作成
=========================== */

function createCollectionPlace(
    jichikai,
    place,
    content
) {

    const placeElement =
        document.createElement(
            "div"
        );

    placeElement.className =
        "collection-place";


    let date =
        place.date;


    if (!date) {

        date =
            "回収日時の情報がありません。";

    }


    /*
     * カレンダーに追加されているか確認
     */

    const added =
        isCalendarLocationAdded(
            jichikai,
            place
        );


    placeElement.innerHTML = `

        <div class="collection-place-header">

            <h3 class="collection-place-name">
                ・${place.name}
            </h3>

            <button
                type="button"
                class="calendar-add-button
                ${added ? "added" : ""}"
            >
                ${added
                    ? "カレンダーから解除"
                    : "カレンダーに追加"}
            </button>

        </div>


        <div class="collection-date">

            <span class="collection-date-label">
                回収日時
            </span>

            <p class="collection-date-value">
                ${date}
            </p>

        </div>

    `;


    content.appendChild(
        placeElement
    );


    /*
     * カレンダー追加ボタン
     */

    const calendarButton =
        placeElement.querySelector(
            ".calendar-add-button"
        );


    calendarButton.addEventListener(
        "click",
        function(event) {

            /*
             * 自治会の開閉を
             * 同時に発生させない
             */

            event.stopPropagation();


            toggleCalendarLocation(
                jichikai,
                place,
                calendarButton
            );

        }
    );

}


/* ===========================
   カレンダー登録済みか確認
=========================== */

function isCalendarLocationAdded(
    jichikai,
    place
) {

    const locations =
        getCalendarLocations();


    return locations.some(
        function(item) {

            return (
                item.municipalityId ===
                    municipalityId &&

                item.areaId ===
                    (areaId || "") &&

                item.jichikai ===
                    jichikai &&

                item.name ===
                    place.name
            );

        }
    );

}


/* ===========================
   登録データを取得
=========================== */

function getCalendarLocations() {

    const data =
        localStorage.getItem(
            calendarLocationKey
        );


    if (!data) {

        return [];

    }


    try {

        const locations =
            JSON.parse(data);


        if (
            Array.isArray(locations)
        ) {

            return locations;

        }

    } catch (error) {

        console.error(
            "カレンダー登録情報の読み込みに失敗しました。",
            error
        );

    }


    return [];

}


/* ===========================
   カレンダー登録・解除
=========================== */

function toggleCalendarLocation(
    jichikai,
    place,
    button
) {

    let locations =
        getCalendarLocations();


    const index =
        locations.findIndex(
            function(item) {

                return (
                    item.municipalityId ===
                        municipalityId &&

                    item.areaId ===
                        (areaId || "") &&

                    item.jichikai ===
                        jichikai &&

                    item.name ===
                        place.name
                );

            }
        );


    /*
     * すでに登録されている
     * → 解除
     */

    if (index !== -1) {

        locations.splice(
            index,
            1
        );


        button.textContent =
            "カレンダーに追加";

        button.classList.remove(
            "added"
        );

    }


    /*
     * 登録されていない
     * → 追加
     */

    else {

        locations.push({

            municipalityId:
                municipalityId,

            areaId:
                areaId || "",

            jichikai:
                jichikai,

            name:
                place.name,

            date:
                place.date,

            day:
                place.day,

            restriction:
                place.restriction

        });


        button.textContent =
            "カレンダーから解除";

        button.classList.add(
            "added"
        );

    }


    localStorage.setItem(
        calendarLocationKey,
        JSON.stringify(
            locations
        )
    );

}


initialize();