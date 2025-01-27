# Javascript-3D-Maze-Game

このリポジトリには、Three.js を使用して作成されたシンプルな3D迷路ゲームが含まれています。プレイヤーは迷路内を移動し、アイテムを収集し、敵と戦いながら出口を目指します。

### 機能

*   **3D迷路探索:** プレイヤーは3D空間で迷路を移動できます。
*   **アイテム収集:**  迷路にはアイテムが隠されており、収集することで特殊能力（壁破壊）を使用できます。
*   **敵との戦闘:** 迷路内には敵が徘徊しており、プレイヤーは攻撃を繰り出すことができます。
*   **ミニマップ:** 現在のプレイヤーの位置と探索済みの領域を示すミニマップが表示されます。
*   **ステータス表示:** プレイヤーのHP、残り時間、アイテム所持数などが表示されます。
*   **キーボード/ボタン操作:** WASDキーで移動、Jキーでジャンプ、Q/Eキーで回転、Zキーで攻撃ができます。また、画面上のボタンでも操作が可能です。
*   **制限時間:** ゲームには制限時間が設定されており、時間切れになるとゲームオーバーになります。
*   **ランダム生成:** 迷路は毎回ランダムに生成されます。
*   **ゴール:** ゴールに到達するとゲームクリアになります。

### 操作方法

*   **移動:**
    *   キーボード: W (上), A (左), S (下), D (右)
    *   画面上のボタン: Up, Down, Left, Right
*   **ジャンプ:**
    *   キーボード: J
*   **回転:**
    *  キーボード: Q(左回転), E(右回転)
     *   画面上のボタン：左右の回転ボタン
*   **攻撃:**
    *   キーボード: Z
    *   画面上のボタン: Attack
*   **アイテム切り替え:**
   *　(現状実装なし)
    

### 依存関係

*   [Three.js](https://threejs.org/)

### 実行方法

1.  このリポジトリをクローンまたはダウンロードします。
    ```bash
    git clone https://github.com/your-username/your-repository.git
    ```
2.  `kadai16.html` をブラウザで開きます。

### ファイル構成

*   `kadai16.html`: ゲームのHTMLファイル。
*   `kadai16.css`: ゲームのスタイルシート。
*   `kadai16.js`: ゲームのロジックを実装したJavaScriptファイル。

### その他

*   このゲームは、Three.jsの基本的な機能とゲームロジックのデモンストレーションとして作成されています。
*   改善点や拡張機能のアイデアがあれば、ぜひプルリクエストを送ってください。
*   バグや改善点があれば、Issueを作成してください。

### ライセンス
このプロジェクトはMITライセンスのもとで公開されています。詳細については、LICENSEファイルを参照してください。

