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
   通知ポップアップ HTML要素
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
   現在表示している月
======================================== */

let currentDate =
    new Date();


/* ========================================
   ごみデータ
======================================== */

let calendarData = null;


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
             * ごみを表示
             */

            garbageList.forEach(
                function (garbage) {

                    createGarbageEvent(
                        dayElement,
                        garbage
                    );

                }
            );


            /*
             * 指定場所を表示
             */

            createLocationEvents(
                dayElement,
                date
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
   通知ポップアップ
================================================== */


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
 * カレンダーなどを読み込む
 */

if (GomiData.ensureSelection()) {

    initialize();

}