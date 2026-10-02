/* ========================================
   ながさきごみナビ
   Service Worker
======================================== */


/* ========================================
   Push通知を受信
======================================== */

self.addEventListener(
    "push",
    function (event) {

        console.log(
            "Push通知を受信しました。"
        );


        /*
         * 通知データ
         */

        let data = {

            title:
                "ながさきごみナビ",

            body:
                "ごみ収集のお知らせです。"

        };


        /*
         * サーバーからデータが
         * 送られてきた場合
         */

        if (event.data) {

            try {

                data =
                    event.data.json();

            } catch (error) {

                console.error(
                    "通知データの解析に失敗しました。",
                    error
                );

            }

        }


        /*
         * 通知を表示
         */

        event.waitUntil(

            self.registration.showNotification(

                data.title,

                {

                    body:
                        data.body,

                    icon:
                        "/img/icon.png",

                    badge:
                        "/img/icon.png"

                }

            )

        );

    }
);


/* ========================================
   通知をクリック
======================================== */

self.addEventListener(
    "notificationclick",
    function (event) {

        /*
         * 通知を閉じる
         */

        event.notification.close();


        /*
         * カレンダーを開く
         */

        event.waitUntil(

            clients.openWindow(
                "/calendar.html"
            )

        );

    }
);