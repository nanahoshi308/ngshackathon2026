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

    const municipalities =
        await GomiData.loadMunicipalities();


    const municipality =
        municipalities.find(
            function (item) {

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

    areaName.textContent =
        await GomiData.getSelectionLabel();

}


/* ===========================
   ごみデータを読み込む
=========================== */

async function loadGarbageData() {

    /* ===========================
       calendar.json 相当
    ============================ */

    const calendar =
        await GomiData.loadCalendar(
            municipalityId,
            GomiData.getSelection()
        );


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
       gomi.json 相当
    ============================ */

    const gomi =
        await GomiData.loadGomi(
            municipalityId
        );


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


    console.log(
        "読み込んだgomi.json：",
        gomiData
    );

}


/* ===========================
   検索結果をリセット
=========================== */

function resetSearchResult() {

    /*
     * 通常検索結果を消す
     */

    searchResult.innerHTML = "";


    /*
     * AI検索結果を消す
     */

    aiResult.innerHTML = "";

}


/* ===========================
   文字検索
=========================== */

function searchGarbage() {

    /*
     * 前回の検索結果をリセット
     */

    resetSearchResult();


    /*
     * 入力された文字
     */

    const keyword =
        searchInput.value
            .trim()
            .toLowerCase();


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
        function (gomi) {

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
            let matchedItems = [];


            gomi.items.forEach(
                function (item) {

                    if (
                        item
                            .toLowerCase()
                            .includes(keyword)
                    ) {

                        matched = true;

                        matchedItems.push(
                            item
                        );

                    }

                }
            );
            /*
             * 一致した場合
             */

            if (matched) {

                /*
                 * 元のgomiデータを
                 * 直接変更しないようにコピー
                 */

                const result =
                {
                    ...gomi,
                    matchedItems:
                        matchedItems
                };


                results.push(
                    result
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
        function (gomi) {

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
            function (item) {

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
        一致したごみ：
    </span>
    ${gomi.matchedItems
                ? gomi.matchedItems.join("、")
                : "検索したごみ"
            }
</p>

            <p>
                <span class="search-label">
                    分別：
                </span>
                ${garbage.separation || "情報なし"}
            </p>

            <p>
                <span class="search-label">
                    収集場所：
                </span>
                ${garbage.collectionPlace || "情報なし"}
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
 * このデータをAIへ渡す。
 */

function saveUnresolvedGarbage(
    keyword
) {

    const unresolvedData = {

        type:
            "text",

        value:
            keyword,

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
   画像を圧縮する
=========================== */

/*
 * 画像をそのままAIへ送ると
 * サイズが大きくなるため、
 * ブラウザ側で縮小・圧縮する。
 *
 * 最大サイズ：1024px
 * JPEG品質：0.7
 */

function compressImage(
    file
) {

    return new Promise(
        function (resolve, reject) {

            const reader =
                new FileReader();


            reader.onload =
                function () {

                    const image =
                        new Image();


                    image.onload =
                        function () {

                            /*
                             * 最大サイズ
                             */

                            const maxSize =
                                1024;


                            let width =
                                image.width;

                            let height =
                                image.height;


                            /*
                             * 画像を縮小
                             */

                            if (
                                width >
                                maxSize ||
                                height >
                                maxSize
                            ) {

                                if (
                                    width >
                                    height
                                ) {

                                    height =
                                        height *
                                        maxSize /
                                        width;

                                    width =
                                        maxSize;

                                } else {

                                    width =
                                        width *
                                        maxSize /
                                        height;

                                    height =
                                        maxSize;

                                }

                            }


                            /*
                             * Canvasを作成
                             */

                            const canvas =
                                document.createElement(
                                    "canvas"
                                );


                            canvas.width =
                                width;

                            canvas.height =
                                height;


                            const context =
                                canvas.getContext(
                                    "2d"
                                );


                            /*
                             * Canvasへ画像を描画
                             */

                            context.drawImage(
                                image,
                                0,
                                0,
                                width,
                                height
                            );


                            /*
                             * JPEGへ変換
                             *
                             * 0.7 = 70%程度の品質
                             */

                            const compressedImage =
                                canvas.toDataURL(
                                    "image/jpeg",
                                    0.7
                                );


                            /*
                             * 圧縮した画像を返す
                             */

                            resolve(
                                compressedImage
                            );

                        };


                    image.onerror =
                        function () {

                            reject(
                                new Error(
                                    "画像の読み込みに失敗しました。"
                                )
                            );

                        };


                    image.src =
                        reader.result;

                };


            reader.onerror =
                function () {

                    reject(
                        new Error(
                            "画像ファイルの読み込みに失敗しました。"
                        )
                    );

                };


            /*
             * 元画像を読み込む
             */

            reader.readAsDataURL(
                file
            );

        }
    );

}


/* ===========================
   画像選択
=========================== */

imageInput.addEventListener(
    "change",
    async function (event) {

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
         * 圧縮中
         */

        imageAiButton.disabled =
            true;

        imagePreviewArea.innerHTML = `
            <p class="image-preview-message">
                画像を処理しています...
            </p>
        `;


        try {

            /*
             * 画像を圧縮
             */

            selectedImageData =
                await compressImage(
                    file
                );


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


            /*
             * デバッグ用
             */

            console.log(
                "画像を圧縮しました。"
            );


            console.log(
                "元画像サイズ：",
                file.size,
                "bytes"
            );


            console.log(
                "圧縮後Base64サイズ：",
                selectedImageData.length,
                "文字"
            );


        } catch (error) {

            console.error(
                "画像圧縮エラー：",
                error
            );


            selectedImageData =
                null;

            imageAiButton.disabled =
                true;

            imagePreviewArea.innerHTML = `
                <p class="image-preview-message">
                    画像の処理に失敗しました。
                </p>
            `;

        }

    }
);


/* ===========================
   画像AI判定ボタン
=========================== */

imageAiButton.addEventListener(
    "click",
    function () {

        /*
         * 画像がない場合
         */

        if (
            !selectedImageData
        ) {

            return;

        }


        /*
         * 前回の検索結果をリセット
         */

        resetSearchResult();


        /*
         * AIへ渡すデータ
         */

        const imageData = {

            type:
                "image",

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
        ${ICONS.robot} AIでごみを判定しています<span class="loading-dots"></span>
    </div>
`;


    try {

        /* ===========================
           Workerへ送るデータ
        ============================ */

        const requestData = {

            type:
                data.type,

            gomiData:
                data.gomiData

        };


        /* ===========================
           文字検索の場合
        ============================ */

        if (
            data.type === "text"
        ) {

            requestData.question =
                data.value;

        }


        /* ===========================
           画像検索の場合
        ============================ */

        if (
            data.type === "image"
        ) {

            requestData.image =
                data.value;

        }


        console.log(
            "Workerへ送信するデータ：",
            requestData
        );


        /* ===========================
           Cloudflare Workerへ送信
        ============================ */

        const response =
            await fetch(
                "https://nagasaki-gomi-ai.nagasaki-gominavi.workers.dev",
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            requestData
                        )
                }
            );


        /* ===========================
           HTTPエラー確認
        ============================ */

        if (!response.ok) {

            const errorText =
                await response.text();


            throw new Error(
                "AIサーバーエラー: " +
                response.status +
                "\n" +
                errorText
            );

        }


        /* ===========================
           Workerから結果を取得
        ============================ */

        const result =
            await response.json();


        console.log(
            "AIからの結果：",
            result
        );


        /* ===========================
           AI結果を表示
        ============================ */

        showAIResult(
            result,
            data.type === "text"
                ? data.value
                : result.name
        );


    } catch (error) {

        console.error(
            "AI処理エラー：",
            error
        );


        aiResult.innerHTML = `

            <div class="ai-result-card">

                <h2>
                    ${ICONS.robot} AI判定
                </h2>

                <p>
                    AIによる判定に失敗しました。
                </p>

                <p>
                    ${error.message}
                </p>

            </div>

        `;

    }

}


/* ===========================
   AI結果を表示
=========================== */
function showAIResult(
    result,
    inputText
) {

    /*
     * 該当なし
     */

    if (
        !result ||
        !result.type ||
        result.type === "該当なし"
    ) {

        aiResult.innerHTML = `

            <div class="ai-result-card">

                <h2>
                    ${ICONS.robot} AI判定
                </h2>

                <p>
                    <span class="ai-label">
                        入力：
                    </span>
                    ${inputText || "画像"}
                </p>

                <p>
                    このごみを
                    分類できませんでした。
                </p>

            </div>

        `;

        return;

    }


    /*
     * AIが判断したごみの種類から
     * calendar.jsonを探す
     */

    const garbage =
        garbageData.find(
            function (item) {

                return item.name ===
                    result.type;

            }
        );


    /* ===========================
       画像
    ============================ */

    let imageHtml = "";


    if (
        garbage &&
        garbage.img
    ) {

        imageHtml = `

            <img
                src="${garbage.img}"
                alt="${garbage.name}"
                class="ai-result-image"
            >

        `;

    }


    /* ===========================
       AI結果を表示
    ============================ */

    aiResult.innerHTML = `

        <div class="ai-result-card">

            <h2>
                ${ICONS.robot} AI判定
            </h2>

            <div class="ai-result-content">

                ${imageHtml}

                <div class="ai-result-info">

                    <p>
                        <span class="ai-label">
                            ごみの名前：
                        </span>
                        ${result.name || inputText || "不明"}
                    </p>

                    <p>
                        <span class="ai-label">
                            ごみの種類：
                        </span>
                        ${result.type}
                    </p>

                    ${garbage
            ? `
                            <p>
                                <span class="ai-label">
                                    分別：
                                </span>
                                ${garbage.separation || "情報なし"}
                            </p>

                            <p>
                                <span class="ai-label">
                                    収集場所：
                                </span>
                                ${garbage.collectionPlace || "情報なし"}
                            </p>
                        `
            : ""
        }

                </div>

            </div>

        </div>

    `;

}

/* ===========================
   検索ボタン
=========================== */

searchButton.addEventListener(
    "click",
    function () {

        searchGarbage();

    }
);


/* ===========================
   Enterキー
=========================== */

searchInput.addEventListener(
    "keydown",
    function (event) {

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

if (GomiData.ensureSelection()) {

    initialize();

}
