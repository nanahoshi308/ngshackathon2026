// ========================================
// ながさきごみナビ
// 地域選択用 JavaScript
// ========================================


// ========================================
// データ
// ========================================

let municipalitiesData = [];

// 選択中の市町村の町名一覧
let townsData = [];

// 選択中の町
let selectedTown = null;

// ステーションごとの曜日の選択 { グループ: 曜日 }
let selectedVariants = {};


// 一度に表示する検索結果の数
const MAX_RESULTS = 100;


// ========================================
// HTMLの要素
// ========================================

const municipalitySelect =
    document.getElementById("municipality");

const townGroup =
    document.getElementById("town-group");

const townSearch =
    document.getElementById("town-search");

const townCount =
    document.getElementById("town-count");

const townResults =
    document.getElementById("town-results");

const selectedTownBox =
    document.getElementById("selected-town");

const selectedTownName =
    document.getElementById("selected-town-name");

const townClearButton =
    document.getElementById("town-clear");

const variantGroup =
    document.getElementById("variant-group");

const variantList =
    document.getElementById("variant-list");

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

    const selection =
        GomiData.getSelection();


    /*
     * 市町村と町が保存済みなら
     * main.htmlへ移動
     */
    if (
        selection.municipalityId &&
        selection.town
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

        municipalitiesData =
            await GomiData.loadMunicipalities();


        // 市町村一覧を作成
        createMunicipalityList();


        // ========================================
        // 「変更」のときは保存済みの地域を復元
        // ========================================

        const selection =
            GomiData.getSelection();

        if (
            selection.municipalityId &&
            municipalitiesData.some(function(m) {
                return m.id === selection.municipalityId;
            })
        ) {

            municipalitySelect.value =
                selection.municipalityId;

            await changeMunicipality();


            const town =
                townsData.find(function(t) {
                    return t.name === selection.town;
                });

            if (town) {

                selectedVariants =
                    selection.variants;

                selectTown(town);

            }

        }

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


    // 初期項目
    const defaultOption =
        document.createElement("option");

    defaultOption.value = "";

    defaultOption.textContent =
        "市町村を選択してください";

    municipalitySelect.appendChild(
        defaultOption
    );


    // 市町村を追加
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

        selectedVariants = {};

        changeMunicipality();

    }
);


async function changeMunicipality() {

    const municipalityId =
        municipalitySelect.value;


    // 町の選択をリセット
    townsData = [];

    clearTown();

    townSearch.value = "";


    // 市町村が未選択
    if (municipalityId === "") {

        townGroup.classList.add("hidden");

        updateButton();

        return;

    }


    try {

        townsData =
            await GomiData.loadTowns(
                municipalityId
            );

    } catch (error) {

        console.error(
            "町名の読み込みに失敗しました。",
            error
        );

    }


    townGroup.classList.remove("hidden");

    renderTownResults();

    updateButton();

}


// ========================================
// 検索用に文字をそろえる
// 全角/半角、カタカナ/ひらがな、空白の違いを無視
// ========================================

function normalizeText(text) {

    return text
        .normalize("NFKC")
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[ァ-ヶ]/g, function(char) {
            return String.fromCharCode(
                char.charCodeAt(0) - 0x60
            );
        });

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


    // 町を選択済みなら一覧は出さない
    if (selectedTown) {

        townCount.textContent = "";

        return;

    }


    const query =
        normalizeText(townSearch.value);


    const matches =
        townsData.filter(function(town) {

            if (query === "") {
                return true;
            }

            return normalizeText(town.name).includes(query) ||
                (town.areaName !== null &&
                    normalizeText(town.areaName).includes(query));

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
            "件を表示しています。町名を入力して絞り込んでください。";

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

            const item =
                document.createElement("li");

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "town-result";

            button.textContent =
                town.name;


            // 地区がある場合は地区名も表示
            if (town.areaName) {

                const area =
                    document.createElement("span");

                area.className =
                    "town-result-area";

                area.textContent =
                    town.areaName;

                button.appendChild(area);

            }


            button.addEventListener(
                "click",
                function() {

                    selectedVariants = {};

                    selectTown(town);

                }
            );

            item.appendChild(button);

            townResults.appendChild(item);

        });

}


// ========================================
// 町を選択
// ========================================

function selectTown(town) {

    selectedTown = town;


    selectedTownName.textContent =
        town.areaName ?
            town.name + "（" + town.areaName + "）" :
            town.name;

    selectedTownBox.classList.remove("hidden");

    townSearch.classList.add("hidden");


    renderTownResults();

    renderVariants();

    updateButton();

}


// ========================================
// 町の選択を解除
// ========================================

townClearButton.addEventListener(
    "click",
    function() {

        selectedVariants = {};

        clearTown();

        renderTownResults();

        updateButton();

        townSearch.focus();

    }
);


function clearTown() {

    selectedTown = null;

    selectedTownBox.classList.add("hidden");

    townSearch.classList.remove("hidden");

    variantGroup.classList.add("hidden");

    variantList.innerHTML = "";

}


// ========================================
// ごみステーションの曜日の選択肢を表示
// ========================================

function renderVariants() {

    variantList.innerHTML = "";


    if (
        !selectedTown ||
        selectedTown.variantGroups.length === 0
    ) {

        variantGroup.classList.add("hidden");

        return;

    }


    selectedTown.variantGroups.forEach(
        function(variantGroupData, groupIndex) {

            const fieldset =
                document.createElement("fieldset");

            fieldset.className =
                "variant-fieldset";


            const legend =
                document.createElement("legend");

            legend.textContent =
                variantGroupData.group;

            fieldset.appendChild(legend);


            variantGroupData.options.forEach(
                function(option) {

                    const label =
                        document.createElement("label");

                    label.className =
                        "variant-option";


                    const radio =
                        document.createElement("input");

                    radio.type = "radio";

                    radio.name =
                        "variant-" + groupIndex;

                    radio.value = option;

                    radio.checked =
                        selectedVariants[variantGroupData.group] === option;


                    radio.addEventListener(
                        "change",
                        function() {

                            selectedVariants[variantGroupData.group] =
                                option;

                            updateButton();

                        }
                    );


                    const text =
                        document.createElement("span");

                    text.textContent =
                        option;


                    label.appendChild(radio);

                    label.appendChild(text);

                    fieldset.appendChild(label);

                }
            );


            variantList.appendChild(fieldset);

        }
    );


    variantGroup.classList.remove("hidden");

}


// ========================================
// ボタンの状態を更新
// ========================================

function updateButton() {

    // 町が未選択
    if (!selectedTown) {

        startButton.disabled = true;

        return;

    }


    // ステーションの曜日が未選択のグループがある
    const allChosen =
        selectedTown.variantGroups.every(
            function(group) {

                return group.options.includes(
                    selectedVariants[group.group]
                );

            }
        );


    startButton.disabled =
        !allChosen;

}


// ========================================
// ごみ情報を見る
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
            municipalityId: municipalitySelect.value,
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

loadData();
