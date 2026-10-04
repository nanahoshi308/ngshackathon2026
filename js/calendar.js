/* ========================================
   ながさきごみナビ
   calendar.html 用 JavaScript
======================================== */


/* ========================================
   HTML要素
======================================== */

const cityName =
    document.getElementById(
        "city-name"
    );

const areaName =
    document.getElementById(
        "area-name"
    );

const calendarAreaName =
    document.getElementById(
        "calendar-area-name"
    );

const monthTitle =
    document.getElementById(
        "month-title"
    );

const calendarDays =
    document.getElementById(
        "calendar-days"
    );

const garbageListElement =
    document.getElementById(
        "garbage-list"
    );

const locationListElement =
    document.getElementById(
        "calendar-location-list"
    );

const previousMonthButton =
    document.getElementById(
        "previous-month"
    );

const nextMonthButton =
    document.getElementById(
        "next-month"
    );


/* ========================================
   通知設定 HTML要素
======================================== */

const notificationButton =
    document.getElementById(
        "notification-button"
    );

const notificationPopup =
    document.getElementById(
        "notification-popup"
    );

const notificationClose =
    document.getElementById(
        "notification-close"
    );

const notificationTabs =
    document.querySelectorAll(
        ".notification-tab"
    );

const notificationEnabled =
    document.getElementById(
        "notification-enabled"
    );

const notificationHourPicker =
    document.getElementById(
        "notification-hour-picker"
    );

const notificationMinutePicker =
    document.getElementById(
        "notification-minute-picker"
    );

const notificationSelectedTime =
    document.getElementById(
        "notification-selected-time"
    );


/* ========================================
   選択中の地域
======================================== */

const municipalityId =
    localStorage.getItem(
        "municipality"
    );

const areaId =
    localStorage.getItem(
        "area"
    );


/* ========================================
   曜日
======================================== */

const weekDays = [

    "日曜日",
    "月曜日",
    "火曜日",
    "水曜日",
    "木曜日",
    "金曜日",
    "土曜日"

];


/* ========================================
   この個数以上のごみがある日は
   名前を省略して2列で表示
======================================== */

const COMPACT_EVENT_COUNT = 2;


/* ========================================
   現在表示している月
======================================== */

let currentDate =
    new Date();


/* ========================================
   ごみデータ
======================================== */

let calendarData = null;


/* ========================================
   通知設定
======================================== */

let notificationSettings = {

    /*
     * 前日の通知
     */

    previous: {

        enabled: false,

        time: "07:00"

    },


    /*
     * 当日の通知
     */

    today: {

        enabled: false,

        time: "07:00"

    }

};


/*
 * 現在選択しているタブ
 *
 * previous → 前日
 * today    → 当日
 */

let currentNotificationTab =
    "previous";


/* ========================================
   Web Push設定
======================================== */

/*
 * VAPID公開鍵
 *
 * 公開鍵なので
 * JavaScriptに書いてOKです。
 *
 * Private Keyは絶対にここへ
 * 書かないでください。
 */

const VAPID_PUBLIC_KEY =
    "BNur60E10zcbXrEYwSya15rAqmZPsXH57SA9kzc0P9aAoelpFjbncR3uF3seyjEja8HneNDls-gc3X_ZV4cbdrI";


/*
 * Cloudflare WorkerのURL
 */

const PUSH_WORKER_URL =
    "https://nagasaki-gomi-ai.nagasaki-gominavi.workers.dev";


/* ========================================
   初期処理
======================================== */

async function initialize() {

    /*
     * 市町村が選択されていない場合
     */

    if (!municipalityId) {

        window.location.href =
            "index.html";

        return;

    }


    /*
     * 通知設定を読み込む
     */

    loadNotificationSettings();


    try {

        /*
         * 市町村名を読み込む
         */

        await loadMunicipality();


        /*
         * 地区名を読み込む
         */

        await loadAreaName();


        /*
         * カレンダーデータを読み込む
         */

        await loadCalendarData();


        /*
         * カレンダーを表示
         */

        displayCalendar();


        /*
         * ごみ情報を表示
         */

        displayGarbageInformation();


        /*
         * 指定場所を表示
         */

        displayCalendarLocations();

    } catch (error) {

        console.error(
            "カレンダーの読み込みに失敗しました。",
            error
        );


        calendarDays.innerHTML = `

            <div class="calendar-error">

                カレンダー情報を
                読み込めませんでした。

            </div>

        `;

    }

}


/* ========================================
   市町村名
======================================== */

async function loadMunicipality() {

    const municipalities =
        await GomiData.loadMunicipalities();


    const municipality =
        municipalities.find(
            function (item) {

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

}


/* ========================================
   地区名
======================================== */

async function loadAreaName() {

    const label =
        await GomiData.getSelectionLabel();


    areaName.textContent =
        label;


    calendarAreaName.textContent =
        "（" +
        cityName.textContent +
        (label ? " " + label : "") +
        "）";

}


/* ========================================
   calendar.jsonを読み込む
======================================== */

async function loadCalendarData() {

    calendarData =
        await GomiData.loadCalendar(
            municipalityId,
            GomiData.getSelection()
        );


    if (
        !calendarData ||
        !Array.isArray(
            calendarData.garbage
        )
    ) {

        throw new Error(
            "calendar.jsonにごみ情報がありません"
        );

    }

}


/* ========================================
   カレンダー表示
======================================== */

function displayCalendar() {

    const year =
        currentDate.getFullYear();

    const month =
        currentDate.getMonth();


    /*
     * 月タイトル
     */

    monthTitle.textContent =
        year +
        "年" +
        (month + 1) +
        "月";


    /*
     * カレンダーを空にする
     */

    calendarDays.innerHTML =
        "";


    /*
     * 月初の日付
     */

    const firstDay =
        new Date(
            year,
            month,
            1
        );


    /*
     * 月初の曜日
     */

    const firstWeekDay =
        firstDay.getDay();


    /*
     * 月末の日付
     */

    const lastDate =
        new Date(
            year,
            month + 1,
            0
        );


    const daysInMonth =
        lastDate.getDate();


    /*
     * 前月の最終日
     */

    const previousLastDate =
        new Date(
            year,
            month,
            0
        );


    const daysInPreviousMonth =
        previousLastDate.getDate();


    /*
     * 月末を含む週まで表示
     * （翌月だけの週がまるごと並ばないよう、月によって4〜6週）
     */

    const totalCells =
        Math.ceil(
            (firstWeekDay + daysInMonth) / 7
        ) * 7;

    for (
        let i = 0;
        i < totalCells;
        i++
    ) {

        const dayElement =
            document.createElement(
                "div"
            );


        dayElement.className =
            "calendar-day";


        let dayNumber;

        let date;


        /* ========================================
           前月
        ======================================== */

        if (
            i < firstWeekDay
        ) {

            dayNumber =
                daysInPreviousMonth -
                firstWeekDay +
                i +
                1;


            date =
                new Date(
                    year,
                    month - 1,
                    dayNumber
                );


            dayElement.classList.add(
                "other-month"
            );

        }


        /* ========================================
           今月
        ======================================== */

        else if (
            i <
            firstWeekDay +
            daysInMonth
        ) {

            dayNumber =
                i -
                firstWeekDay +
                1;


            date =
                new Date(
                    year,
                    month,
                    dayNumber
                );

        }


        /* ========================================
           翌月
        ======================================== */

        else {

            dayNumber =
                i -
                firstWeekDay -
                daysInMonth +
                1;


            date =
                new Date(
                    year,
                    month + 1,
                    dayNumber
                );


            dayElement.classList.add(
                "other-month"
            );

        }


        /*
         * 曜日を取得
         */

        const dayOfWeek =
            date.getDay();


        /* ========================================
           日曜日
        ======================================== */

        if (
            dayOfWeek === 0
        ) {

            dayElement.classList.add(
                "sunday"
            );

        }


        /* ========================================
           土曜日
        ======================================== */

        if (
            dayOfWeek === 6
        ) {

            dayElement.classList.add(
                "saturday"
            );

        }


        /* ========================================
           今日
        ======================================== */

        const today =
            new Date();


        if (
            date.getFullYear() ===
            today.getFullYear() &&

            date.getMonth() ===
            today.getMonth() &&

            date.getDate() ===
            today.getDate()
        ) {

            dayElement.classList.add(
                "today"
            );

        }


        /* ========================================
           日付番号
        ======================================== */

        const numberElement =
            document.createElement(
                "div"
            );


        numberElement.className =
            "calendar-day-number";


        numberElement.textContent =
            dayNumber;


        dayElement.appendChild(
            numberElement
        );


        /* ========================================
           今月の場合
        ======================================== */

        if (
            date.getMonth() ===
            month
        ) {

            /*
             * その日のごみを取得
             */

            const garbageList =
                findGarbageForDate(
                    date
                );


            /*
             * ごみ・指定場所の入れ物
             */

            const eventsElement =
                document.createElement(
                    "div"
                );


            eventsElement.className =
                "calendar-events";


            /*
             * ごみを表示
             */

            garbageList.forEach(
                function (garbage) {

                    createGarbageEvent(
                        eventsElement,
                        garbage
                    );

                }
            );


            /*
             * 指定場所を表示
             */

            createLocationEvents(
                eventsElement,
                date
            );


            /*
             * 2個以上ある日は
             * 名前を省略して2列で表示
             */

            const eventCount =
                eventsElement.querySelectorAll(
                    ".garbage-image"
                ).length;


            if (
                eventCount >=
                COMPACT_EVENT_COUNT
            ) {

                eventsElement.classList.add(
                    "compact"
                );

            }


            dayElement.appendChild(
                eventsElement
            );

        }


        calendarDays.appendChild(
            dayElement
        );

    }

}


/* ========================================
   指定日のごみを探す
======================================== */

function findGarbageForDate(
    date
) {

    const result = [];


    /*
     * 曜日
     */

    const day =
        weekDays[
            date.getDay()
        ];


    /*
     * 第何週か
     *
     * 1～7日   → 第1週
     * 8～14日  → 第2週
     * 15～21日 → 第3週
     * ...
     */

    const weekNumber =
        Math.ceil(
            date.getDate() / 7
        );


    /*
     * 配列は0から始まる
     */

    const index =
        weekNumber - 1;


    /*
     * データがない場合
     */

    if (
        !calendarData ||
        !Array.isArray(
            calendarData.garbage
        )
    ) {

        return result;

    }


    /*
     * 全ごみを確認
     */

    calendarData.garbage.forEach(
        function (garbage) {

            if (
                !Array.isArray(
                    garbage.schedule
                )
            ) {

                return;

            }


            /*
             * そのごみの収集曜日を確認
             */

            garbage.schedule.forEach(
                function (schedule) {

                    /*
                     * 曜日が違う
                     */

                    if (
                        schedule.day !==
                        day
                    ) {

                        return;

                    }


                    /*
                     * restrictionがない
                     */

                    if (
                        !Array.isArray(
                            schedule.restriction
                        )
                    ) {

                        return;

                    }


                    /*
                     * その週が収集対象か確認
                     */

                    if (
                        schedule.restriction[
                            index
                        ] === 1
                    ) {

                        /*
                         * まだ追加されていなければ追加
                         */

                        if (
                            !result.includes(
                                garbage
                            )
                        ) {

                            result.push(
                                garbage
                            );

                        }

                    }

                }
            );

        }
    );


    return result;

}


/* ========================================
   ごみをカレンダーに表示
======================================== */

function createGarbageEvent(
    dayElement,
    garbage
) {

    /*
     * ごみ画像
     */

    const image =
        document.createElement(
            "img"
        );


    image.className =
        "garbage-image";


    image.src =
        garbage.img;


    image.alt =
        garbage.name;


    /*
     * 名前を省略したときも
     * マウスを乗せると分かるように
     */

    image.title =
        garbage.name;


    /*
     * 画像クリック
     */

    image.addEventListener(
        "click",
        function () {

            const index =
                calendarData.garbage.indexOf(
                    garbage
                );


            const target =
                document.getElementById(
                    "garbage-item-" +
                    index
                );


            if (target) {

                scrollToElement(
                    target
                );

            }

        }
    );


    dayElement.appendChild(
        image
    );


    /*
     * ごみの名前
     */

    const name =
        document.createElement(
            "div"
        );


    name.className =
        "calendar-garbage-name";


    name.textContent =
        garbage.name;


    dayElement.appendChild(
        name
    );

}


/* ========================================
   カレンダーに追加した
   指定場所を取得
======================================== */

function getCalendarLocations() {

    const data =
        localStorage.getItem(
            "calendarLocations"
        );


    /*
     * データがない場合
     */

    if (!data) {

        return [];

    }


    try {

        const locations =
            JSON.parse(data);


        if (
            Array.isArray(
                locations
            )
        ) {

            return locations.filter(
                function (location) {

                    return (

                        location.municipalityId ===
                        municipalityId &&

                        location.areaId ===
                        (areaId || "")

                    );

                }
            );

        }

    } catch (error) {

        console.error(
            "指定場所の読み込みに失敗しました。",
            error
        );

    }


    return [];

}


/* ========================================
   指定場所がその日に
   回収されるか確認
======================================== */

function isLocationCollectionDay(
    location,
    date
) {

    /*
     * 曜日が違う
     */

    if (
        location.day !==
        weekDays[
            date.getDay()
        ]
    ) {

        return false;

    }


    /*
     * restrictionがない
     */

    if (
        !Array.isArray(
            location.restriction
        )
    ) {

        return false;

    }


    /*
     * 第何週か
     */

    const weekNumber =
        Math.ceil(
            date.getDate() / 7
        );


    const index =
        weekNumber - 1;


    /*
     * その週が回収日か
     */

    return (
        location.restriction[
            index
        ] === 1
    );

}


/* ========================================
   指定場所をカレンダーに表示
======================================== */

function createLocationEvents(
    dayElement,
    date
) {

    const locations =
        getCalendarLocations();


    locations.forEach(
        function (location) {

            /*
             * その日に回収されない場合
             */

            if (
                !isLocationCollectionDay(
                    location,
                    date
                )
            ) {

                return;

            }


            const event =
                document.createElement(
                    "div"
                );


            event.className =
                "calendar-location-event";


            /*
             * 指定場所アイコン
             */

            const image =
                document.createElement(
                    "img"
                );


            image.className =
                "garbage-image";


            image.src =
                "img/sitei.webp";


            image.alt =
                location.name;


            image.title =
                location.name;


            /*
             * 画像クリック
             */

            image.addEventListener(
                "click",
                function () {

                    const target =
                        findLocationInformation(
                            location
                        );


                    if (target) {

                        scrollToElement(
                            target
                        );

                    }

                }
            );


            event.appendChild(
                image
            );


            /*
             * 指定場所名
             */

            const name =
                document.createElement(
                    "div"
                );


            name.className =
                "calendar-garbage-name";


            name.textContent =
                location.name;


            event.appendChild(
                name
            );


            /*
             * 回収場所をクリック
             */

            event.addEventListener(
                "click",
                function () {

                    const target =
                        findLocationInformation(
                            location
                        );


                    if (target) {

                        scrollToElement(
                            target
                        );

                    }

                }
            );


            dayElement.appendChild(
                event
            );

        }
    );

}


/* ========================================
   指定場所の情報カードを探す
======================================== */

function findLocationInformation(
    location
) {

    const items =
        document.querySelectorAll(
            ".calendar-location-item"
        );


    let target = null;


    items.forEach(
        function (item) {

            if (target) {

                return;

            }


            const name =
                item.dataset.locationName;


            const jichikai =
                item.dataset.jichikai;


            if (
                name ===
                location.name &&

                jichikai ===
                location.jichikai
            ) {

                target =
                    item;

            }

        }
    );


    return target;

}


/* ========================================
   要素までスクロール
======================================== */

function scrollToElement(
    element
) {

    const top =
        element.getBoundingClientRect()
            .top +
        window.scrollY -
        30;


    window.scrollTo({

        top: top,

        behavior: "smooth"

    });

}


/* ========================================
   ごみ情報を表示
======================================== */

function displayGarbageInformation() {

    garbageListElement.innerHTML =
        "";


    /*
     * データがない場合
     */

    if (
        !calendarData ||
        !Array.isArray(
            calendarData.garbage
        )
    ) {

        return;

    }


    /*
     * ごみ情報を1つずつ表示
     */

    calendarData.garbage.forEach(
        function (garbage, index) {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "garbage-item";


            /*
             * カレンダーの画像から
             * このカードを特定するID
             */

            item.id =
                "garbage-item-" +
                index;


            /*
             * 収集曜日
             */

            let scheduleText =
                "";


            if (
                Array.isArray(
                    garbage.schedule
                )
            ) {

                garbage.schedule.forEach(
                    function (schedule) {

                        if (
                            scheduleText !== ""
                        ) {

                            scheduleText +=
                                "、";

                        }


                        scheduleText +=
                            schedule.day;

                    }
                );

            }


            /*
             * 収集場所
             */

            let collectionPlaceHTML =
                garbage.collectionPlace ||
                "";


            /*
             * URLが設定されている場合
             * リンクにする
             */

            if (garbage.collectionPlaceUrl) {

                collectionPlaceHTML =
                    `<a
                        href="${garbage.collectionPlaceUrl}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        ${garbage.collectionPlace || "詳細はこちら"}
                    </a>`;

            }


            /*
             * 情報のある項目だけ表示する
             * （「情報なし」が並ぶとページが長くなるだけなので）
             */

            const rows = [
                ["収集曜日", scheduleText],
                ["分別", garbage.separation],
                ["収集場所", collectionPlaceHTML]
            ].filter(function (row) {

                return row[1];

            });


            /*
             * どの項目も情報がない種類はカードごと出さない
             * （収集日がないのでカレンダーから参照されることもない）
             */

            if (rows.length === 0) {

                return;

            }


            item.innerHTML = `

                <div class="garbage-item-header">

                    <img
                        src="${garbage.img}"
                        alt="${garbage.name}"
                        class="garbage-item-icon"
                    >

                    <h3>
                        ${garbage.name}
                    </h3>

                </div>

                ${rows.map(function (row) {

                    return `
                        <p>
                            <strong>
                                ${row[0]}：
                            </strong>
                            ${row[1]}
                        </p>
                    `;

                }).join("")}

            `;


            garbageListElement.appendChild(
                item
            );

        }
    );

}


/* ========================================
   カレンダーに追加した
   指定場所を下部に表示
======================================== */

function displayCalendarLocations() {

    locationListElement.innerHTML =
        "";


    const locations =
        getCalendarLocations();


    /*
     * 登録なし
     */

    if (
        locations.length === 0
    ) {

        locationListElement.innerHTML = `

            <div class="no-calendar-location">

                カレンダーに追加した指定場所はありません。<br>
                「指定場所」ページから追加できます。

            </div>

        `;

        return;

    }


    /*
     * 登録された場所を表示
     */

    locations.forEach(
        function (location) {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "calendar-location-item";


            /*
             * 後から
             * 回収場所を特定するための
             * data属性
             */

            item.dataset.locationName =
                location.name;


            item.dataset.jichikai =
                location.jichikai;


            /*
             * 自治会
             */

            const jichikai =
                document.createElement(
                    "p"
                );


            jichikai.className =
                "calendar-location-jichikai";


            jichikai.textContent =
                location.jichikai;


            /*
             * 回収場所
             */

            const name =
                document.createElement(
                    "h3"
                );


            name.className =
                "calendar-location-name";


            name.innerHTML =
                ICONS.pin;

            name.append(
                " " +
                location.name
            );


            /*
             * 回収日時
             */

            const date =
                document.createElement(
                    "p"
                );


            date.className =
                "calendar-location-date";


            date.textContent =
                location.date ||
                "回収日時の情報がありません。";


            /*
             * カードに追加
             */

            item.appendChild(
                jichikai
            );


            item.appendChild(
                name
            );


            item.appendChild(
                date
            );


            locationListElement.appendChild(
                item
            );

        }
    );

}


/* ==================================================
   通知設定
================================================== */


/* ========================================
   通知設定の保存先キー
======================================== */

function getNotificationStorageKey() {

    return (
        "notificationSettings_" +
        municipalityId +
        "_" +
        (areaId || "all")
    );

}


/* ========================================
   通知設定を読み込む
======================================== */

function loadNotificationSettings() {

    /*
     * 市町村・地区ごとに
     * 保存場所を分ける
     */

    const key =
        getNotificationStorageKey();


    const data =
        localStorage.getItem(
            key
        );


    /*
     * 保存された設定がない場合
     *
     * 初期値のままにする
     */

    if (!data) {

        return;

    }


    try {

        const saved =
            JSON.parse(data);


        /*
         * 前日の設定
         */

        if (
            saved.previous
        ) {

            notificationSettings.previous = {

                enabled:
                    saved.previous.enabled === true,

                time:
                    saved.previous.time ||
                    "07:00"

            };

        }


        /*
         * 当日の設定
         */

        if (
            saved.today
        ) {

            notificationSettings.today = {

                enabled:
                    saved.today.enabled === true,

                time:
                    saved.today.time ||
                    "07:00"

            };

        }

    } catch (error) {

        console.error(
            "通知設定の読み込みに失敗しました。",
            error
        );

    }

}


/* ========================================
   通知設定を保存
======================================== */

function saveNotificationSettings() {

    const key =
        getNotificationStorageKey();


    localStorage.setItem(

        key,

        JSON.stringify(
            notificationSettings
        )

    );


    console.log(
        "通知設定を保存しました。",
        notificationSettings
    );

}


/* ========================================
   Base64URL → Uint8Array
======================================== */

function urlBase64ToUint8Array(
    base64String
) {

    const padding =
        "=".repeat(
            (
                4 -
                base64String.length % 4
            ) % 4
        );


    const base64 =
        (
            base64String +
            padding
        )
        .replace(
            /-/g,
            "+"
        )
        .replace(
            /_/g,
            "/"
        );


    const rawData =
        window.atob(
            base64
        );


    const outputArray =
        new Uint8Array(
            rawData.length
        );


    for (
        let i = 0;
        i < rawData.length;
        i++
    ) {

        outputArray[i] =
            rawData.charCodeAt(i);

    }


    return outputArray;

}


/* ========================================
   Service Workerを登録
======================================== */

async function registerServiceWorker() {

    /*
     * Service Workerに対応しているか
     */

    if (
        !("serviceWorker" in navigator)
    ) {

        throw new Error(
            "このブラウザはService Workerに対応していません。"
        );

    }


    /*
     * Service Workerを登録
     */

    const registration =
        await navigator.serviceWorker.register(
            "./service-worker.js"
        );


    console.log(
        "Service Workerを登録しました。",
        registration
    );


    /*
     * Service Workerの準備を待つ
     */

    const readyRegistration =
        await navigator.serviceWorker.ready;


    return readyRegistration;

}


/* ========================================
   Push購読を取得
======================================== */

async function getPushSubscription() {

    /*
     * Service Workerを登録
     */

    const registration =
        await registerServiceWorker();


    /*
     * すでに購読しているか確認
     */

    let subscription =
        await registration.pushManager.getSubscription();


    /*
     * まだ購読していない場合
     */

    if (!subscription) {

        subscription =
            await registration.pushManager.subscribe({

                userVisibleOnly: true,

                applicationServerKey:
                    urlBase64ToUint8Array(
                        VAPID_PUBLIC_KEY
                    )

            });

    }


    console.log(
        "Push購読を取得しました。",
        subscription
    );


    return subscription;

}


/* ========================================
   Cloudflare Workerへ
   Push設定を登録
======================================== */

async function sendPushRegistration(
    subscription
) {

    /*
     * Workerへ送るデータ
     */

    const data = {

        type:
            "register-push",

        subscription:
            subscription.toJSON(),

        municipalityId:
            municipalityId,

        areaId:
            areaId || "",

        previousEnabled:
            notificationSettings.previous.enabled,

        previousTime:
            notificationSettings.previous.time,

        todayEnabled:
            notificationSettings.today.enabled,

        todayTime:
            notificationSettings.today.time

    };


    console.log(
        "WorkerへPush設定を送信します。",
        data
    );


    /*
     * Workerへ送信
     */

    const response =
        await fetch(
            PUSH_WORKER_URL,
            {

                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify(
                        data
                    )

            }
        );


    /*
     * Workerからの返事
     */

    const result =
        await response.json();


    console.log(
        "WorkerからのPush登録結果：",
        result
    );


    /*
     * エラー
     */

    if (
        !response.ok ||
        !result.success
    ) {

        throw new Error(

            result.message ||
            "Push通知の登録に失敗しました。"

        );

    }


    return result;

}


/* ========================================
   通知用の指定場所をWorkerへ同期
======================================== */

/*
 * Push通知の登録が成功したあとに、
 * localStorageに保存されている
 * 「カレンダーに追加した指定場所」を
 * Cloudflare Workerへ送信します。
 *
 * これにより、
 *
 * 指定場所を追加
 *      ↓
 * あとから通知ON
 *      ↓
 * Push登録
 *      ↓
 * 指定場所もD1へ登録
 *
 * という流れになります。
 */

async function syncNotificationKyoten(
    subscription
) {

    try {

        /*
         * 現在選択されている
         * 指定場所を取得
         */

        const locations =
            getCalendarLocations();


        /*
         * 指定場所の名前だけ取り出す
         */

        const places =
            locations.map(
                function (location) {

                    return location.name;

                }
            );


        /*
         * 同じ名前が複数ある場合は
         * 1つにまとめる
         */

        const uniquePlaces =
            [...new Set(places)];


        console.log(
            "通知用の指定場所を同期します。",
            uniquePlaces
        );


        /*
         * Workerへ送信
         */

        const response =
            await fetch(
                PUSH_WORKER_URL,
                {

                    method:
                        "POST",

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


        /*
         * Workerの結果
         */

        const result =
            await response.json();


        console.log(
            "Workerからの指定場所同期結果：",
            result
        );


        /*
         * Worker側で失敗した場合
         */

        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(

                result.message ||
                "指定場所の同期に失敗しました。"

            );

        }


        console.log(
            "通知用の指定場所を同期しました。"
        );


        return true;

    } catch (error) {

        console.error(
            "通知用の指定場所同期に失敗しました。",
            error
        );


        return false;

    }

}


/* ========================================
   Push通知を登録
======================================== */

async function registerPushNotification() {

    try {

        /*
         * Notificationに対応しているか
         */

        if (
            !("Notification" in window)
        ) {

            alert(
                "このブラウザは通知に対応していません。"
            );

            return false;

        }


        /*
         * PushManagerに対応しているか
         */

        if (
            !("PushManager" in window)
        ) {

            alert(
                "このブラウザはPush通知に対応していません。"
            );

            return false;

        }


        /*
         * 通知許可を取得
         */

        let permission =
            Notification.permission;


        /*
         * まだ許可を聞いていない場合
         */

        if (
            permission ===
            "default"
        ) {

            permission =
                await Notification.requestPermission();

        }


        /*
         * 通知が拒否された場合
         */

        if (
            permission !==
            "granted"
        ) {

            alert(
                "通知が許可されていません。\n" +
                "ブラウザのサイト設定から通知を許可してください。"
            );

            return false;

        }


        /*
         * Push購読を取得
         */

        const subscription =
            await getPushSubscription();


        console.log(
            "Push endpoint:"
        );

        console.log(
            subscription.endpoint
        );


        /*
         * Cloudflare Workerへ
         * Push設定を送信
         */

        await sendPushRegistration(
            subscription
        );


        /*
         * ========================================
           ここを追加
         * ========================================
         *
         * Push通知の登録が成功したあと、
         * 現在カレンダーに追加されている
         * 指定場所をWorkerへ送信します。
         */

        const kyotenSyncSuccess =
            await syncNotificationKyoten(
                subscription
            );


        /*
         * 指定場所の同期に失敗した場合
         */

        if (
            !kyotenSyncSuccess
        ) {

            console.warn(
                "Push登録は成功しましたが、指定場所の同期に失敗しました。"
            );

        }


        console.log(
            "Push通知の登録が完了しました。"
        );


        return true;


    } catch (error) {

        console.error(
            "Push通知の登録に失敗しました。",
            error
        );


        alert(
            "通知設定に失敗しました。\n" +
            "ブラウザのコンソールを確認してください。"
        );


        return false;

    }

}


/* ========================================
   Push設定を更新
======================================== */

/*
 * すでにPush通知を登録している状態で
 * 時刻などを変更した場合に使用します。
 */

async function updatePushRegistration() {

    /*
     * 通知が一つもONでない場合
     *
     * Workerへ送る必要はない
     */

    if (
        !notificationSettings.previous.enabled &&
        !notificationSettings.today.enabled
    ) {

        return;

    }


    try {

        /*
         * 既存のPush購読を取得
         */

        const registration =
            await navigator.serviceWorker.ready;


        const subscription =
            await registration.pushManager.getSubscription();


        /*
         * 購読がない場合
         */

        if (!subscription) {

            console.log(
                "Push購読がありません。"
            );

            return;

        }


        /*
         * Workerへ設定を送る
         */

        await sendPushRegistration(
            subscription
        );


        console.log(
            "Push通知設定を更新しました。"
        );


    } catch (error) {

        console.error(
            "Push通知設定の更新に失敗しました。",
            error
        );

    }

}


/* ========================================
   Push通知の登録を解除
======================================== */

async function unregisterPushNotification() {

    console.log(
        "Push通知の登録解除処理を開始します。"
    );


    try {

        /*
         * Service Workerの登録を取得
         *
         * navigator.serviceWorker.ready ではなく
         * getRegistration()を使用する
         */

        const registration =
            await navigator.serviceWorker.getRegistration();


        /*
         * Service Workerがない場合
         */

        if (!registration) {

            console.error(
                "Service Workerが登録されていません。"
            );

            return false;

        }


        console.log(
            "Service Workerを取得しました。",
            registration
        );


        /*
         * 現在のPush購読を取得
         */

        const subscription =
            await registration.pushManager.getSubscription();


        /*
         * Push購読がない場合
         */

        if (!subscription) {

            console.warn(
                "ブラウザにPush購読がありません。"
            );


            /*
             * 現在はendpointが取得できないため
             * Worker側の削除はできない
             */

            return false;

        }


        /*
         * endpointを取得
         */

        const endpoint =
            subscription.endpoint;


        console.log(
            "Push通知の登録解除を開始します。",
            endpoint
        );


        /*
         * Cloudflare Workerへ
         * 登録解除を要求
         */

        const response =
            await fetch(
                PUSH_WORKER_URL,
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            type:
                                "unregister-push",

                            endpoint:
                                endpoint

                        })

                }
            );


        /*
         * Workerの結果を取得
         */

        const result =
            await response.json();


        console.log(
            "WorkerからのPush登録解除結果：",
            result
        );


        /*
         * Worker側で失敗した場合
         */

        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(

                result.message ||
                "Push通知の登録解除に失敗しました。"

            );

        }


        /*
         * ブラウザ側のPush購読も解除
         */

        const unsubscribed =
            await subscription.unsubscribe();


        console.log(
            "ブラウザのPush購読を解除しました。",
            unsubscribed
        );


        /*
         * 完了
         */

        console.log(
            "Push通知の登録解除が完了しました。"
        );


        return true;


    } catch (error) {

        console.error(
            "Push通知の登録解除に失敗しました。",
            error
        );


        return false;

    }

}


/* ========================================
   時刻一覧を作成
======================================== */

function createNotificationTimePicker() {

    /*
     * ======================================
     * 時
     * ======================================
     *
     * 00 ～ 23
     */

    notificationHourPicker.innerHTML =
        "";


    for (
        let hour = 0;
        hour < 24;
        hour++
    ) {

        const time =
            String(hour).padStart(
                2,
                "0"
            );


        const item =
            document.createElement(
                "div"
            );


        item.className =
            "notification-time-item";


        item.textContent =
            time;


        item.dataset.value =
            time;


        /*
         * 時をクリック
         */

        item.addEventListener(
            "click",
            function () {

                setNotificationHour(
                    time
                );

            }
        );


        notificationHourPicker.appendChild(
            item
        );

    }


    /*
     * ======================================
     * 分
     * ======================================
     *
     * 00 ～ 59
     *
     * 1分刻み
     */

    notificationMinutePicker.innerHTML =
        "";


    for (
        let minute = 0;
        minute < 60;
        minute++
    ) {

        const time =
            String(minute).padStart(
                2,
                "0"
            );


        const item =
            document.createElement(
                "div"
            );


        item.className =
            "notification-time-item";


        item.textContent =
            time;


        item.dataset.value =
            time;


        /*
         * 分をクリック
         */

        item.addEventListener(
            "click",
            function () {

                setNotificationMinute(
                    time
                );

            }
        );


        notificationMinutePicker.appendChild(
            item
        );

    }

}


/* ========================================
   現在の通知設定を取得
======================================== */

function getCurrentNotificationSetting() {

    return notificationSettings[
        currentNotificationTab
    ];

}


/* ========================================
   時刻を「時」と「分」に分ける
======================================== */

function getHourAndMinute(
    time
) {

    const parts =
        time.split(":");


    return {

        hour:
            parts[0],

        minute:
            parts[1]

    };

}


/* ========================================
   通知ポップアップを更新
======================================== */

function updateNotificationPopup() {

    /*
     * 現在のタブの設定を取得
     */

    const setting =
        getCurrentNotificationSetting();


    /*
     * ON / OFF
     */

    notificationEnabled.checked =
        setting.enabled;


    /*
     * 設定時刻を表示
     */

    notificationSelectedTime.textContent =
        setting.time;


    /*
     * 時と分に分ける
     */

    const time =
        getHourAndMinute(
            setting.time
        );


    /* ========================================
       時を選択状態にする
    ======================================== */

    const hourItems =
        notificationHourPicker.querySelectorAll(
            ".notification-time-item"
        );


    hourItems.forEach(
        function (item) {

            if (
                item.dataset.value ===
                time.hour
            ) {

                /*
                 * 選択状態
                 */

                item.classList.add(
                    "selected"
                );


                /*
                 * 選択した時を
                 * 中央に移動
                 */

                item.scrollIntoView({

                    block: "center",

                    behavior: "auto"

                });

            } else {

                item.classList.remove(
                    "selected"
                );

            }

        }
    );


    /* ========================================
       分を選択状態にする
    ======================================== */

    const minuteItems =
        notificationMinutePicker.querySelectorAll(
            ".notification-time-item"
        );


    minuteItems.forEach(
        function (item) {

            if (
                item.dataset.value ===
                time.minute
            ) {

                /*
                 * 選択状態
                 */

                item.classList.add(
                    "selected"
                );


                /*
                 * 選択した分を
                 * 中央に移動
                 */

                item.scrollIntoView({

                    block: "center",

                    behavior: "auto"

                });

            } else {

                item.classList.remove(
                    "selected"
                );

            }

        }
    );


    /* ========================================
       タブの見た目
    ======================================== */

    notificationTabs.forEach(
        function (tab) {

            if (
                tab.dataset.tab ===
                currentNotificationTab
            ) {

                tab.classList.add(
                    "active"
                );

            } else {

                tab.classList.remove(
                    "active"
                );

            }

        }
    );

}


/* ========================================
   時を変更
======================================== */

async function setNotificationHour(
    hour
) {

    /*
     * 現在の通知設定
     */

    const setting =
        getCurrentNotificationSetting();


    /*
     * 現在の分を取得
     */

    const time =
        getHourAndMinute(
            setting.time
        );


    /*
     * 時だけ変更
     */

    setting.time =
        hour +
        ":" +
        time.minute;


    /*
     * 保存
     */

    saveNotificationSettings();


    /*
     * 画面を更新
     */

    updateNotificationPopup();


    /*
     * 通知がONなら
     * Worker側の設定も更新
     */

    await updatePushRegistration();

}


/* ========================================
   分を変更
======================================== */

async function setNotificationMinute(
    minute
) {

    /*
     * 現在の通知設定
     */

    const setting =
        getCurrentNotificationSetting();


    /*
     * 現在の時を取得
     */

    const time =
        getHourAndMinute(
            setting.time
        );


    /*
     * 分だけ変更
     */

    setting.time =
        time.hour +
        ":" +
        minute;


    /*
     * 保存
     */

    saveNotificationSettings();


    /*
     * 画面を更新
     */

    updateNotificationPopup();


    /*
     * 通知がONなら
     * Worker側の設定も更新
     */

    await updatePushRegistration();

}


/* ========================================
   通知 ON / OFF
======================================== */

notificationEnabled.addEventListener(
    "change",
    async function () {

        notificationSettings[
            currentNotificationTab
        ].enabled =
            notificationEnabled.checked;


        /*
         * 通知をONにした場合
         */

        if (
            notificationEnabled.checked
        ) {

            const success =
                await registerPushNotification();


            if (
                !success
            ) {

                notificationSettings[
                    currentNotificationTab
                ].enabled =
                    false;

                notificationEnabled.checked =
                    false;

            }

        }


        /*
         * 通知をOFFにした場合
         */

        else {

            /*
             * 前日・当日の両方がOFFなら
             * D1から端末を削除する
             */

            if (
                !notificationSettings.previous.enabled &&
                !notificationSettings.today.enabled
            ) {

                const success =
                    await unregisterPushNotification();


                if (
                    !success
                ) {

                    console.error(
                        "Push登録解除に失敗しました。"
                    );

                }

            }

            /*
             * どちらか一方がONなら
             * D1側の設定だけ更新する
             */

            else {

                await updatePushRegistration();

            }

        }


        /*
         * ローカルにも保存
         */

        saveNotificationSettings();

    }
);


/* ========================================
   前日 / 当日のタブ切り替え
======================================== */

notificationTabs.forEach(
    function (tab) {

        tab.addEventListener(
            "click",
            function () {

                /*
                 * 押されたタブを記録
                 */

                currentNotificationTab =
                    tab.dataset.tab;


                /*
                 * 設定を表示
                 */

                updateNotificationPopup();

            }
        );

    }
);


/* ========================================
   通知設定を開く
======================================== */

notificationButton.addEventListener(
    "click",
    function (event) {

        /*
         * 外側クリック処理に
         * イベントが伝わらないようにする
         */

        event.stopPropagation();


        /*
         * 開く / 閉じる
         */

        notificationPopup.classList.toggle(
            "show"
        );


        /*
         * 開いたとき
         */

        if (
            notificationPopup.classList.contains(
                "show"
            )
        ) {

            updateNotificationPopup();

        }

    }
);


/* ========================================
   閉じるボタン
======================================== */

notificationClose.addEventListener(
    "click",
    function () {

        notificationPopup.classList.remove(
            "show"
        );

    }
);


/* ========================================
   ポップアップ内部をクリック
======================================== */

notificationPopup.addEventListener(
    "click",
    function (event) {

        /*
         * ポップアップ内をクリックしても
         * 外側クリック扱いにしない
         */

        event.stopPropagation();

    }
);


/* ========================================
   ポップアップ外をクリック
======================================== */

document.addEventListener(
    "click",
    function () {

        notificationPopup.classList.remove(
            "show"
        );

    }
);


/* ========================================
   カレンダー月変更
======================================== */


/*
 * 前の月
 */

previousMonthButton.addEventListener(
    "click",
    function () {

        currentDate.setMonth(
            currentDate.getMonth() - 1
        );

        displayCalendar();

    }
);


/*
 * 次の月
 */

nextMonthButton.addEventListener(
    "click",
    function () {

        currentDate.setMonth(
            currentDate.getMonth() + 1
        );

        displayCalendar();

    }
);


/* ========================================
   初期表示
======================================== */

/*
 * 通知時間ピッカーを作成
 */

createNotificationTimePicker();


/*
 * 通知設定を画面へ反映
 */

updateNotificationPopup();


/*
 * カレンダーなどを読み込む
 */

if (GomiData.ensureSelection()) {

    initialize();

}
