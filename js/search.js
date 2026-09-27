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

const searchInput =
    document.getElementById(
        "search-input"
    );

const searchButton =
    document.getElementById(
        "search-button"
    );

const searchResult =
    document.getElementById(
        "search-result"
    );

const imageInput =
    document.getElementById(
        "image-input"
    );

const imagePreviewArea =
    document.getElementById(
        "image-preview-area"
    );

const imageAiButton =
    document.getElementById(
        "image-ai-button"
    );

const aiResult =
    document.getElementById(
        "ai-result"
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
   ごみデータ
=========================== */

/*
 * calendar.json
 *
 * 画像、収集日、分別方法、
 * 収集場所などが入っている
 */

let garbageData = null;


/*
 * gomi.json
 *
 * 含まれるごみの検索に使用する
 */

let gomiData = null;


/*
 * 現在選択されている画像
 */

let selectedImageData = null;


/* ===========================
   初期処理
=========================== */

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
         * ごみデータを読み込む
         */

        await loadGarbageData();

    } catch (error) {

        console.error(
            "検索データの読み込みに失敗しました。",
            error
        );

        searchResult.innerHTML = `
            <div class="search-error">
                ごみ情報を読み込めませんでした。
            </div>
        `;

    }

}


/* ===========================
   市町村名を読み込む
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


    if (municipality) {

        cityName.textContent =
            municipality.name;

    }

}


/* ===========================
   地区名を読み込む
=========================== */

async function loadAreaName() {

    /*
     * 地区がない場合
     */

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


/* ===========================
   ごみデータを読み込む
=========================== */

async function loadGarbageData() {

    let calendarPath;
    let gomiPath;


    /*
     * 地区がある場合
     */

    if (areaId) {

        calendarPath =
            "data/" +
            municipalityId +
            "/" +
            areaId +
            "/calendar.json";


        gomiPath =
            "data/" +
            municipalityId +
            "/" +
            areaId +
            "/gomi.json";

    }


    /*
     * 地区がない場合
     */

    else {

        calendarPath =
            "data/" +
            municipalityId +
            "/calendar.json";


        gomiPath =
            "data/" +
            municipalityId +
            "/gomi.json";

    }


    console.log(
        "読み込むcalendar.json：",
        calendarPath
    );


    console.log(
        "読み込むgomi.json：",
        gomiPath
    );


    /* ===========================
       calendar.json
    ============================ */

    const calendarResponse =
        await fetch(
            calendarPath
        );


    if (!calendarResponse.ok) {

        throw new Error(
            "calendar.jsonが見つかりません"
        );

    }


    const calendar =
        await calendarResponse.json();


    if (
        !Array.isArray(
            calendar.garbage
        )
    ) {

        throw new Error(
            "calendar.jsonにごみデータがありません"
        );

    }


    garbageData =
        calendar.garbage;


    /* ===========================
       gomi.json
    ============================ */

    const gomiResponse =
        await fetch(
            gomiPath
        );


    if (!gomiResponse.ok) {

        throw new Error(
            "gomi.jsonが見つかりません"
        );

    }


    const gomi =
        await gomiResponse.json();


    if (
        !Array.isArray(
            gomi.gomi
        )
    ) {

        throw new Error(
            "gomi.jsonにごみデータがありません"
        );

    }


    gomiData =
        gomi.gomi;

}


/* ===========================
   文字検索
=========================== */

function searchGarbage() {

    /*
     * 入力された文字
     */

    const keyword =
        searchInput.value
            .trim()
            .toLowerCase();


    /*
     * AI結果を一度消す
     */

    aiResult.innerHTML = "";


    /* ===========================
       未入力
    ============================ */

    if (keyword === "") {

        searchResult.innerHTML = `
            <div class="no-result">
                検索するごみの名前を入力してください。
            </div>
        `;

        return;

    }


    /* ===========================
       gomi.jsonから検索
    ============================ */

    const results = [];


    gomiData.forEach(
        function(gomi) {

            /*
             * itemsが配列か確認
             */

            if (
                !Array.isArray(
                    gomi.items
                )
            ) {

                return;

            }


            /*
             * 一致したか
             */

            let matched = false;


            gomi.items.forEach(
                function(item) {

                    if (
                        item
                            .toLowerCase()
                            .includes(keyword)
                    ) {

                        matched = true;

                    }

                }
            );


            /*
             * 一致した場合
             */

            if (matched) {

                results.push(
                    gomi
                );

            }

        }
    );


    /* ===========================
       検索結果を表示
    ============================ */

    displaySearchResults(
        results,
        keyword
    );


    /* ===========================
       結果がない場合
       AIへ渡す
    ============================ */

    if (results.length === 0) {

        const unresolvedData =
            saveUnresolvedGarbage(
                keyword
            );


        sendToAI(
            unresolvedData
        );

    }

}


/* ===========================
   検索結果を表示
=========================== */

function displaySearchResults(
    results,
    keyword
) {

    /*
     * 前の結果を消す
     */

    searchResult.innerHTML = "";


    /*
     * 結果件数
     */

    const title =
        document.createElement(
            "h2"
        );

    title.className =
        "search-result-title";

    title.textContent =
        "検索結果：" +
        results.length +
        "件";


    searchResult.appendChild(
        title
    );


    /* ===========================
       結果なし
    ============================ */

    if (results.length === 0) {

        const noResult =
            document.createElement(
                "div"
            );

        noResult.className =
            "no-result";


        noResult.innerHTML = `
            「${keyword}」に一致する
            ごみが見つかりませんでした。
            <br><br>
            AIで判定しています...
        `;


        searchResult.appendChild(
            noResult
        );

        return;

    }


    /* ===========================
       結果あり
    ============================ */

    results.forEach(
        function(gomi) {

            createSearchItem(
                gomi
            );

        }
    );

}


/* ===========================
   検索結果カード
=========================== */

function createSearchItem(
    gomi
) {

    /*
     * gomi.jsonのnameと
     * calendar.jsonのnameを比較
     */

    const garbage =
        garbageData.find(
            function(item) {

                return item.name ===
                    gomi.name;

            }
        );


    /*
     * カード
     */

    const item =
        document.createElement(
            "div"
        );

    item.className =
        "search-item";


    /* ===========================
       画像
    ============================ */

    const image =
        document.createElement(
            "img"
        );

    image.className =
        "search-item-image";


    if (garbage) {

        image.src =
            garbage.img;

        image.alt =
            garbage.name;

    }


    /* ===========================
       内容
    ============================ */

    const content =
        document.createElement(
            "div"
        );

    content.className =
        "search-item-content";


    if (garbage) {

        content.innerHTML = `

            <h2>
                ${garbage.name}
            </h2>

            <p>
                <span class="search-label">
                    分別：
                </span>
                ${garbage.separation}
            </p>

            <p>
                <span class="search-label">
                    収集場所：
                </span>
                ${garbage.collectionPlace}
            </p>

        `;

    } else {

        content.innerHTML = `

            <h2>
                ${gomi.name}
            </h2>

            <p>
                詳細情報がありません。
            </p>

        `;

    }


    item.appendChild(
        image
    );

    item.appendChild(
        content
    );


    searchResult.appendChild(
        item
    );

}


/* ===========================
   解決できなかった
   ごみを保存
=========================== */

/*
 * 文字検索で見つからなかった
 * ごみを一時的にまとめる。
 *
 * このデータをあとでAIへ渡す。
 */

function saveUnresolvedGarbage(
    keyword
) {

    const unresolvedData = {

        type: "text",

        value: keyword,

        municipality:
            municipalityId,

        area:
            areaId,

        gomiData:
            gomiData

    };


    console.log(
        "解決できなかったごみ：",
        unresolvedData
    );


    return unresolvedData;

}


/* ===========================
   画像選択
=========================== */

imageInput.addEventListener(
    "change",
    function(event) {

        const file =
            event.target.files[0];


        /*
         * ファイルがない場合
         */

        if (!file) {

            selectedImageData =
                null;

            imageAiButton.disabled =
                true;

            imagePreviewArea.innerHTML = `
                <p class="image-preview-message">
                    画像を選択するとここに表示されます。
                </p>
            `;

            return;

        }


        /*
         * 画像か確認
         */

        if (
            !file.type.startsWith(
                "image/"
            )
        ) {

            selectedImageData =
                null;

            imageAiButton.disabled =
                true;

            imagePreviewArea.innerHTML = `
                <p class="image-preview-message">
                    画像ファイルを選択してください。
                </p>
            `;

            return;

        }


        /*
         * FileReaderを使用して
         * 画像を読み込む
         */

        const reader =
            new FileReader();


        reader.onload =
            function() {

                /*
                 * Base64形式の画像データ
                 */

                selectedImageData =
                    reader.result;


                /*
                 * プレビュー表示
                 */

                imagePreviewArea.innerHTML = `
                    <img
                        src="${selectedImageData}"
                        class="image-preview"
                        alt="選択した画像"
                    >
                `;


                /*
                 * AIボタンを有効にする
                 */

                imageAiButton.disabled =
                    false;

            };


        reader.readAsDataURL(
            file
        );

    }
);


/* ===========================
   画像AI判定ボタン
=========================== */

imageAiButton.addEventListener(
    "click",
    function() {

        /*
         * 画像がない場合
         */

        if (
            !selectedImageData
        ) {

            return;

        }


        /*
         * AIへ渡すデータ
         */

        const imageData = {

            type: "image",

            value:
                selectedImageData,

            municipality:
                municipalityId,

            area:
                areaId,

            gomiData:
                gomiData

        };


        /*
         * AIへ渡す
         */

        sendToAI(
            imageData
        );

    }
);


/* ===========================
   AIへデータを渡す
=========================== */

/*
 * 文字検索で見つからなかった場合と
 * 画像検索の場合の両方が
 * この関数に入ってくる。
 *
 * 後でAI APIを接続するときは
 * この関数を変更する。
 */

async function sendToAI(
    data
) {

    console.log(
        "AIへ渡すデータ：",
        data
    );


    /* ===========================
       AI処理中の表示
    ============================ */

    aiResult.innerHTML = `
        <div class="ai-loading">
            🤖 AIでごみを判定しています...
        </div>
    `;


    /*
     * ここではまだAI APIを
     * 接続していない。
     *
     * 後でここにAI APIとの
     * 通信処理を追加する。
     */


    /*
     * 現在はテストとして
     * 3秒後に結果を表示する。
     */

    setTimeout(
        function() {

            showAITestResult(
                data
            );

        },
        1000
    );

}


/* ===========================
   AIテスト結果
=========================== */

/*
 * AI APIを接続するまでの
 * 仮の処理。
 */

function showAITestResult(
    data
) {

    let inputText = "";


    if (
        data.type === "text"
    ) {

        inputText =
            data.value;

    } else {

        inputText =
            "アップロードされた画像";

    }


    aiResult.innerHTML = `

        <div class="ai-result-card">

            <h2>
                🤖 AI判定
            </h2>

            <p>
                <span class="ai-label">
                    入力：
                </span>
                ${inputText}
            </p>

            <p>
                <span class="ai-label">
                    判定結果：
                </span>
                AI API接続後にここへ
                判定結果を表示します。
            </p>

            <p>
                <span class="ai-label">
                    対象地域：
                </span>
                ${municipalityId}
                ${areaId ? " / " + areaId : ""}
            </p>

        </div>

    `;

}


/* ===========================
   検索ボタン
=========================== */

searchButton.addEventListener(
    "click",
    function() {

        searchGarbage();

    }
);


/* ===========================
   Enterキー
=========================== */

searchInput.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key ===
            "Enter"
        ) {

            searchGarbage();

        }

    }
);


/* ===========================
   開始
=========================== */

initialize();