// ========================================
// ながさきごみナビ
// 地域選択用 JavaScript
// ========================================


// ========================================
// データ
// ========================================

let municipalitiesData = [];

let areasData = {};


// ========================================
// HTMLの要素
// ========================================

const municipalitySelect =
    document.getElementById("municipality");

const areaGroup =
    document.getElementById("area-group");

const areaList =
    document.getElementById("area-list");

const areaSelect =
    document.getElementById("area");

const startButton =
    document.getElementById("start-button");


    /*
 * 変更画面から来たか確認
 */
const params =
    new URLSearchParams(
        window.location.search
    );

const isChange =
    params.get("change") === "true";


/*
 * 「変更」ではない場合だけ
 * 保存されている地域を確認
 */
if (!isChange) {

    const municipality =
        localStorage.getItem(
            "municipality"
        );

    const area =
        localStorage.getItem(
            "area"
        );


    /*
     * 市町村と地域が保存済みなら
     * main.htmlへ移動
     */
    if (
        municipality &&
        area
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


        // ========================================
        // 市町村データ
        // ========================================

        municipalitiesData =
            await GomiData.loadMunicipalities();


        // ========================================
        // 地区データ
        // ========================================

        areasData =
            await GomiData.loadAreasData();


        // 市町村一覧を作成
        createMunicipalityList();


    } catch (error) {

        console.error(
            "データの読み込みに失敗しました。",
            error
        );

    }

}


// ========================================
// 市町村一覧を作成
// ========================================

function createMunicipalityList() {


    // 一度空にする
    municipalitySelect.innerHTML = "";


    // ========================================
    // 初期項目
    // ========================================

    const defaultOption =
        document.createElement("option");


    defaultOption.value = "";


    defaultOption.textContent =
        "市町村を選択してください";


    municipalitySelect.appendChild(
        defaultOption
    );


    // ========================================
    // 市町村を追加
    // ========================================

    municipalitiesData.forEach(
        function(municipality) {


            const option =
                document.createElement("option");


            option.value =
                municipality.id;


            option.textContent =
                municipality.name;


            municipalitySelect.appendChild(
                option
            );

        }
    );

}


// ========================================
// 市町村が変更されたとき
// ========================================

municipalitySelect.addEventListener(
    "change",
    function() {


        const municipalityId =
            municipalitySelect.value;


        // 地区をリセット
        resetArea();


        // ========================================
        // 市町村が未選択
        // ========================================

        if (municipalityId === "") {

            updateButton();

            return;

        }


        // ========================================
        // 市町村の地区データ
        // ========================================

        const municipalityAreaData =
            areasData[municipalityId];


        // ========================================
        // 地区データがない
        // ========================================

        if (
            !municipalityAreaData ||
            !municipalityAreaData.areas
        ) {

            updateButton();

            return;

        }


        const areas =
            municipalityAreaData.areas;


        // ========================================
        // 地区がない
        // ========================================

        if (areas.length === 0) {

            updateButton();

            return;

        }


        // ========================================
        // 地区一覧を表示
        // ========================================

        createAreaList(
            areas
        );


        // ========================================
        // 地区選択欄を作成
        // ========================================

        createAreaSelect(
            areas
        );


        // ボタン状態を更新
        updateButton();

    }
);


// ========================================
// 地区一覧を表示
// ========================================

function createAreaList(areas) {


    // 地区エリアを表示
    areaGroup.classList.remove(
        "hidden"
    );


    // 一度空にする
    areaList.innerHTML = "";


    // ========================================
    // 地区を1つずつ表示
    // ========================================

    areas.forEach(
        function(area) {


            // ========================================
            // 地区全体の枠
            // ========================================

            const areaCard =
                document.createElement("div");


            areaCard.className =
                "area-card";


            // ========================================
            // 地区名
            // ========================================

            const areaName =
                document.createElement("h4");


            areaName.textContent =
                area.name;


            areaCard.appendChild(
                areaName
            );


            // ========================================
            // 詳細一覧
            // ========================================

            const detailList =
                document.createElement("ul");


            // ========================================
            // syousaiを表示
            // ========================================

            if (
                Array.isArray(area.syousai)
            ) {


                area.syousai.forEach(
                    function(detail) {


                        const detailItem =
                            document.createElement("li");


                        detailItem.textContent =
                            detail;


                        detailList.appendChild(
                            detailItem
                        );

                    }
                );

            }


            // 詳細一覧を追加
            areaCard.appendChild(
                detailList
            );


            // ========================================
            // 地区カードを一覧に追加
            // ========================================

            areaList.appendChild(
                areaCard
            );

        }
    );

}


// ========================================
// 地区選択欄を作成
// ========================================

function createAreaSelect(areas) {


    // 一度空にする
    areaSelect.innerHTML = "";


    // ========================================
    // 初期項目
    // ========================================

    const defaultOption =
        document.createElement("option");


    defaultOption.value = "";


    defaultOption.textContent =
        "地区を選択してください";


    areaSelect.appendChild(
        defaultOption
    );


    // ========================================
    // 地区を追加
    // ========================================

    areas.forEach(
        function(area) {


            const option =
                document.createElement("option");


            option.value =
                area.id;


            option.textContent =
                area.name;


            areaSelect.appendChild(
                option
            );

        }
    );

}


// ========================================
// 地区が変更されたとき
// ========================================

areaSelect.addEventListener(
    "change",
    function() {

        updateButton();

    }
);


// ========================================
// 地区をリセット
// ========================================

function resetArea() {


    // 地区エリアを非表示
    areaGroup.classList.add(
        "hidden"
    );


    // 地区一覧を削除
    areaList.innerHTML = "";


    // 地区選択を初期化
    areaSelect.innerHTML = "";


    const defaultOption =
        document.createElement("option");


    defaultOption.value = "";


    defaultOption.textContent =
        "地区を選択してください";


    areaSelect.appendChild(
        defaultOption
    );

}


// ========================================
// ボタンの状態を更新
// ========================================

function updateButton() {


    const municipalityId =
        municipalitySelect.value;


    const areaId =
        areaSelect.value;


    // ========================================
    // 市町村が未選択
    // ========================================

    if (municipalityId === "") {

        startButton.disabled = true;

        return;

    }


    // ========================================
    // 市町村の地区データ
    // ========================================

    const municipalityAreaData =
        areasData[municipalityId];


    // ========================================
    // 地区が存在する場合
    // ========================================

    if (
        municipalityAreaData &&
        municipalityAreaData.areas &&
        municipalityAreaData.areas.length > 0
    ) {


        // 地区が未選択
        if (areaId === "") {

            startButton.disabled = true;

            return;

        }

    }


    // ========================================
    // 選択完了
    // ========================================

    startButton.disabled = false;

}


// ========================================
// ごみ情報を見る
// ========================================

startButton.addEventListener(
    "click",
    function() {


        const municipalityId =
            municipalitySelect.value;


        const areaId =
            areaSelect.value;


        // ========================================
        // 市町村を保存
        // ========================================

        localStorage.setItem(
            "municipality",
            municipalityId
        );


        // ========================================
        // 地区を保存
        // ========================================

        localStorage.setItem(
            "area",
            areaId
        );


        // ========================================
        // main.htmlへ
        // ========================================

        window.location.href =
            "main.html";

    }
);


// ========================================
// 開始
// ========================================

loadData();