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
   Cloudflare Worker
=========================== */

const WORKER_URL =
    "https://nagasaki-gomi-ai.nagasaki-gominavi.workers.dev";


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

    const municipalities =
        await GomiData.loadMunicipalities();


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


    const areasData =
        await GomiData.loadAreasData();


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

    /*
     * 指定場所は市町村単位
     */

    const data =
        await GomiData.loadKyoten(
            municipalityId
        );


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


    /*
     * localStorageに保存
     */

    localStorage.setItem(
        calendarLocationKey,
        JSON.stringify(
            locations
        )
    );


    /*
     * Push通知用の拠点を更新
     */

    syncNotificationKyoten();

}


/* ===========================
   通知用の拠点をWorkerへ同期
=========================== */

async function syncNotificationKyoten() {

    try {

        /*
         * Service Workerを取得
         */

        const registration =
            await navigator.serviceWorker.ready;


        /*
         * 現在のPush購読を取得
         */

        const subscription =
            await registration.pushManager
                .getSubscription();


        /*
         * Push通知を登録していない場合
         *
         * → D1には送らない
         */

        if (!subscription) {

            console.log(
                "Push通知が登録されていないため、拠点を同期しません。"
            );

            return;

        }


        /*
         * 現在のカレンダー登録場所を取得
         */

        const locations =
            getCalendarLocations();


        /*
         * 現在の市町村・地区だけを対象にする
         */

        const places =
            locations
                .filter(
                    function(item) {

                        return (
                            item.municipalityId ===
                                municipalityId &&

                            item.areaId ===
                                (areaId || "")
                        );

                    }
                )
                .map(
                    function(item) {

                        return item.name;

                    }
                );


        /*
         * 重複を削除
         */

        const uniquePlaces =
            [...new Set(places)];


        console.log(
            "通知用の拠点を同期します：",
            uniquePlaces
        );


        /*
         * Workerへ送信
         */

        const response =
            await fetch(
                WORKER_URL,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            type:
                                "update-kyoten",

                            endpoint:
                                subscription.endpoint,

                            places:
                                uniquePlaces

                        })

                    }
            );


        if (!response.ok) {

            throw new Error(
                "Workerへの送信に失敗しました。"
            );

        }


        const result =
            await response.json();


        console.log(
            "通知用の拠点を更新しました。",
            result
        );


    } catch (error) {

        console.error(
            "通知用の拠点同期に失敗しました。",
            error
        );

    }

}


/* ===========================
   開始
=========================== */

initialize();