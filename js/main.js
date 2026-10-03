/* ========================================
   ながさきごみナビ
   main.html 用 JavaScript
======================================== */


/* ========================================
   HTML要素
======================================== */

const cityName =
    document.getElementById("city-name");

const areaName =
    document.getElementById("area-name");

const welcomeCity =
    document.getElementById("welcome-city");

const todayDate =
    document.getElementById("today-date");

const todayContent =
    document.getElementById("today-content");

const nextDate =
    document.getElementById("next-date");

const nextContent =
    document.getElementById("next-content");


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
   ページ読み込み
======================================== */

async function initialize() {

    /*
     * index.htmlで選択した
     * 市町村ID・地区IDを取得
     */

    const municipalityId =
        localStorage.getItem("municipality");

    const areaId =
        localStorage.getItem("area");


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
         * 市町村データを読み込む
         */

        const municipalities =
            await GomiData.loadMunicipalities();


        /*
         * 選択した市町村を探す
         */

        const municipality =
            municipalities.find(
                function(item) {

                    return item.id ===
                        municipalityId;

                }
            );


        /*
         * 市町村名を表示
         */

        if (municipality) {

            cityName.textContent =
                municipality.name;

            welcomeCity.textContent =
                municipality.name;

        }


        /*
         * 地区名を表示
         */

        await loadAreaName(
            municipalityId,
            areaId
        );


        /*
         * 今日の日付
         */

        displayTodayDate();


        /*
         * 今日のごみと
         * 次のごみを読み込む
         */

        await loadGarbageData(
            municipalityId,
            areaId
        );


    } catch (error) {

        console.error(
            "データの読み込みに失敗しました。",
            error
        );


        todayContent.innerHTML = `
            <div class="garbage-error">
                ごみ情報を読み込めませんでした。
            </div>
        `;


        nextContent.innerHTML = `
            <div class="garbage-error">
                ごみ情報を読み込めませんでした。
            </div>
        `;

    }

}


/* ========================================
   地区名を表示
======================================== */

async function loadAreaName(
    municipalityId,
    areaId
) {

    try {

        areaName.textContent =
            await GomiData.getSelectionLabel();

    } catch (error) {

        console.error(
            "地区情報の読み込みに失敗しました。",
            error
        );

    }

}


/* ========================================
   今日の日付を表示
======================================== */

function displayTodayDate() {

    const today =
        new Date();


    const month =
        today.getMonth() + 1;


    const date =
        today.getDate();


    todayDate.textContent =
        month + "月" + date + "日";

}


/* ========================================
   ごみデータを読み込む
======================================== */

async function loadGarbageData(
    municipalityId,
    areaId
) {

    try {

        const calendarData =
            await GomiData.loadCalendar(
                municipalityId,
                GomiData.getSelection()
            );


        /*
         * 今日のごみを検索
         */

        const todayGarbage =
            findTodayGarbage(
                calendarData
            );


        /*
         * 今日のごみを表示
         */

        displayTodayGarbage(
            todayGarbage
        );


        /*
         * 次のごみを検索
         */

        const nextGarbage =
            findNextGarbage(
                calendarData
            );


        /*
         * 次のごみを表示
         */

        displayNextGarbage(
            nextGarbage
        );


    } catch (error) {

        console.error(error);


        todayContent.innerHTML = `
            <div class="garbage-error">
                ごみ情報を読み込めませんでした。
            </div>
        `;


        nextContent.innerHTML = `
            <div class="garbage-error">
                ごみ情報を読み込めませんでした。
            </div>
        `;

    }

}


/* ========================================
   今日のごみを探す
======================================== */

function findTodayGarbage(
    calendarData
) {

    const result = [];

    const today =
        new Date();


    /*
     * 今日の曜日
     */

    const todayDay =
        weekDays[
            today.getDay()
        ];


    /*
     * 今日が何週目か
     */

    const weekNumber =
        Math.ceil(
            today.getDate() / 7
        );


    if (
        !calendarData ||
        !Array.isArray(
            calendarData.garbage
        )
    ) {

        return result;

    }


    /*
     * ごみを1つずつ確認
     */

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

                    /*
                     * 曜日が違う
                     */

                    if (
                        schedule.day !==
                        todayDay
                    ) {

                        return;

                    }


                    /*
                     * restrictionを確認
                     */

                    if (
                        !Array.isArray(
                            schedule.restriction
                        )
                    ) {

                        return;

                    }


                    const index =
                        weekNumber - 1;


                    /*
                     * その週が収集日なら追加
                     */

                    if (
                        schedule.restriction[
                            index
                        ] === 1
                    ) {

                        /*
                         * 同じごみを
                         * 重複して追加しない
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
   次のごみを探す
======================================== */

function findNextGarbage(
    calendarData
) {

    /*
     * データがない場合
     */

    if (
        !calendarData ||
        !Array.isArray(
            calendarData.garbage
        )
    ) {

        return null;

    }


    /*
     * 今日
     */

    const today =
        new Date();


    /*
     * 今日の翌日から検索する
     */

    const searchDate =
        new Date(today);


    searchDate.setDate(
        searchDate.getDate() + 1
    );


    /*
     * 最大1年間調べる
     */

    for (
        let i = 0;
        i < 366;
        i++
    ) {

        /*
         * その日のごみを探す
         */

        const garbageList =
            findGarbageForDate(
                searchDate,
                calendarData
            );


        /*
         * ごみが見つかった場合
         */

        if (
            garbageList.length > 0
        ) {

            return {

                date:
                    new Date(searchDate),

                garbage:
                    garbageList

            };

        }


        /*
         * 次の日へ
         */

        searchDate.setDate(
            searchDate.getDate() + 1
        );

    }


    /*
     * 見つからなかった場合
     */

    return null;

}


/* ========================================
   指定した日のごみを探す
======================================== */

function findGarbageForDate(
    date,
    calendarData
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
     * 何週目か
     */

    const weekNumber =
        Math.ceil(
            date.getDate() / 7
        );


    /*
     * ごみデータを確認
     */

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


                    const index =
                        weekNumber - 1;


                    /*
                     * その週が収集日か確認
                     */

                    if (
                        schedule.restriction[
                            index
                        ] === 1
                    ) {

                        /*
                         * 重複を防ぐ
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
   今日のごみを表示
======================================== */

function displayTodayGarbage(
    garbageList
) {

    /*
     * ごみがない
     */

    if (
        garbageList.length === 0
    ) {

        todayContent.innerHTML = `

            <div class="no-garbage">

                <div class="no-garbage-icon">
                    ${ICONS.smile}
                </div>

                <p>
                    本日の収集はありません
                </p>

            </div>

        `;

        return;

    }


    /*
     * 1種類
     */

    if (
        garbageList.length === 1
    ) {

        const garbage =
            garbageList[0];


        todayContent.innerHTML = `

            <div class="garbage-icon">
                ${ICONS.trash}
            </div>

            <div>

                <p class="garbage-label">
                    本日の収集
                </p>

                <h2>
                    ${garbage.name}
                </h2>

            </div>

        `;

        return;

    }


    /*
     * 複数種類
     */

    let html = `
        <div class="today-garbage-list">
    `;


    garbageList.forEach(
        function(garbage) {

            html += `

                <div class="today-garbage-item">

                    <div class="garbage-icon">
                        ${ICONS.trash}
                    </div>

                    <span>
                        ${garbage.name}
                    </span>

                </div>

            `;

        }
    );


    html += `
        </div>
    `;


    todayContent.innerHTML =
        html;

}


/* ========================================
   次のごみを表示
======================================== */

function displayNextGarbage(
    nextGarbage
) {

    /*
     * 次のごみがない場合
     */

    if (!nextGarbage) {

        nextDate.textContent =
            "";

        nextContent.innerHTML = `

            <div class="no-next-garbage">

                次の収集予定はありません。

            </div>

        `;

        return;

    }


    /*
     * 日付を表示
     */

    const month =
        nextGarbage.date.getMonth() + 1;


    const date =
        nextGarbage.date.getDate();


    const day =
        weekDays[
            nextGarbage.date.getDay()
        ];


    nextDate.textContent =
        month +
        "月" +
        date +
        "日（" +
        day.substring(0, 1) +
        "）";


    /*
     * ごみが1種類の場合
     */

    if (
        nextGarbage.garbage.length === 1
    ) {

        const garbage =
            nextGarbage.garbage[0];


        nextContent.innerHTML = `

            <div class="garbage-icon">
                ${ICONS.trash}
            </div>

            <div>

                <p class="garbage-label">
                    次回の収集
                </p>

                <h2>
                    ${garbage.name}
                </h2>

            </div>

        `;

        return;

    }


    /*
     * 複数種類の場合
     */

    let html = `
        <div class="next-garbage-list">
    `;


    nextGarbage.garbage.forEach(
        function(garbage) {

            html += `

                <div class="next-garbage-item">

                    <div class="garbage-icon">
                        ${ICONS.trash}
                    </div>

                    <span>
                        ${garbage.name}
                    </span>

                </div>

            `;

        }
    );


    html += `
        </div>
    `;


    nextContent.innerHTML =
        html;

}


/* ========================================
   実行
======================================== */

if (GomiData.ensureSelection()) {

    initialize();

}
