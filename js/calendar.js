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

    if (!municipalityId) {

        window.location.href =
            "index.html";

        return;

    }


    try {

        await loadMunicipality();

        await loadAreaName();

        await loadCalendarData();

        displayCalendar();

        displayGarbageInformation();

        displayCalendarLocations();

    } catch (error) {

        console.error(
            "カレンダーの読み込みに失敗しました。",
            error
        );


        calendarDays.innerHTML = `
            <div class="calendar-error">
                カレンダー情報を読み込めませんでした。
            </div>
        `;

    }

}


/* ========================================
   市町村名
======================================== */

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

}


/* ========================================
   地区名
======================================== */

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

    }

}


/* ========================================
   calendar.jsonを読み込む
======================================== */

async function loadCalendarData() {

    let path;


    if (areaId) {

        path =
            "data/" +
            municipalityId +
            "/" +
            areaId +
            "/calendar.json";

    } else {

        path =
            "data/" +
            municipalityId +
            "/calendar.json";

    }


    const response =
        await fetch(path);


    if (!response.ok) {

        throw new Error(
            "calendar.jsonが見つかりません"
        );

    }


    calendarData =
        await response.json();


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


    monthTitle.textContent =
        year +
        "年" +
        (month + 1) +
        "月";


    calendarDays.innerHTML =
        "";


    const firstDay =
        new Date(
            year,
            month,
            1
        );


    const firstWeekDay =
        firstDay.getDay();


    const lastDate =
        new Date(
            year,
            month + 1,
            0
        );


    const daysInMonth =
        lastDate.getDate();


    const previousLastDate =
        new Date(
            year,
            month,
            0
        );


    const daysInPreviousMonth =
        previousLastDate.getDate();


    /*
     * 6週間分
     */

    for (
        let i = 0;
        i < 42;
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


        /* 前月 */

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


        /* 今月 */

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


        /* 翌月 */

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


        const dayOfWeek =
            date.getDay();


        /* 日曜日 */

        if (
            dayOfWeek === 0
        ) {

            dayElement.classList.add(
                "sunday"
            );

        }


        /* 土曜日 */

        if (
            dayOfWeek === 6
        ) {

            dayElement.classList.add(
                "saturday"
            );

        }


        /* 今日 */

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


        /* 日付番号 */

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


        /*
         * 今月の場合だけ
         * ごみ・指定場所を表示
         */

        if (
            date.getMonth() ===
                month
        ) {

            const garbageList =
                findGarbageForDate(
                    date
                );


            garbageList.forEach(
                function(garbage) {

                    createGarbageEvent(
                        dayElement,
                        garbage
                    );

                }
            );


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


    const day =
        weekDays[
            date.getDay()
        ];


    const weekNumber =
        Math.ceil(
            date.getDate() / 7
        );


    const index =
        weekNumber - 1;


    if (
        !calendarData ||
        !Array.isArray(
            calendarData.garbage
        )
    ) {

        return result;

    }


    calendarData.garbage.forEach(
        function(garbage) {

            if (
                !Array.isArray(
                    garbage.schedule
                )
            ) {

                return;

            }


            garbage.schedule.forEach(
                function(schedule) {

                    if (
                        schedule.day !==
                        day
                    ) {

                        return;

                    }


                    if (
                        !Array.isArray(
                            schedule.restriction
                        )
                    ) {

                        return;

                    }


                    if (
                        schedule.restriction[
                            index
                        ] === 1
                    ) {

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
     * 画像
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
     * ごみ画像をクリック
     */

    image.addEventListener(
        "click",
        function() {

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
     * ごみ名
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
                function(location) {

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

    if (
        location.day !==
        weekDays[
            date.getDay()
        ]
    ) {

        return false;

    }


    if (
        !Array.isArray(
            location.restriction
        )
    ) {

        return false;

    }


    const weekNumber =
        Math.ceil(
            date.getDate() / 7
        );


    const index =
        weekNumber - 1;


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
        function(location) {

            if (
                isLocationCollectionDay(
                    location,
                    date
                )
            ) {

                const event =
                    document.createElement(
                        "div"
                    );


                event.className =
                    "calendar-location-event";


                event.textContent =
                    "📍 " +
                    location.name;


                /*
                 * 回収場所をクリック
                 */

                event.addEventListener(
                    "click",
                    function() {

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
        function(item) {

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


    if (
        !calendarData ||
        !Array.isArray(
            calendarData.garbage
        )
    ) {

        return;

    }


    calendarData.garbage.forEach(
        function(garbage, index) {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "garbage-item";


            /*
             * ごみ画像から
             * このカードを特定するためのID
             */

            item.id =
                "garbage-item-" +
                index;


            let scheduleText =
                "";


            if (
                Array.isArray(
                    garbage.schedule
                )
            ) {

                garbage.schedule.forEach(
                    function(schedule) {

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


            item.innerHTML = `

                <h3>
                    ${garbage.name}
                </h3>

                <p>
                    <strong>
                        収集曜日：
                    </strong>
                    ${scheduleText || "情報なし"}
                </p>

                <p>
                    <strong>
                        分別：
                    </strong>
                    ${garbage.separation || "情報なし"}
                </p>

                <p>
                    <strong>
                        収集場所：
                    </strong>
                    ${garbage.collectionPlace || "情報なし"}
                </p>

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

                カレンダーに追加した
                指定場所はありません。

                <br>

                「指定場所」ページから
                追加できます。

            </div>

        `;

        return;

    }


    /*
     * 登録された場所を表示
     */

    locations.forEach(
        function(location) {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "calendar-location-item";


            /*
             * 後から
             * 回収場所を特定するために
             * data属性を付ける
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


            name.textContent =
                "📍 " +
                location.name;


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


/* ========================================
   前の月
======================================== */

previousMonthButton.addEventListener(
    "click",
    function() {

        currentDate.setMonth(
            currentDate.getMonth() - 1
        );


        displayCalendar();

    }
);


/* ========================================
   次の月
======================================== */

nextMonthButton.addEventListener(
    "click",
    function() {

        currentDate.setMonth(
            currentDate.getMonth() + 1
        );


        displayCalendar();

    }
);


/* ========================================
   初期化
======================================== */

initialize();