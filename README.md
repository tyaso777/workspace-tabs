# WorkspaceTabs

Windows上のフォルダ、ファイル、URL、メモをProject単位でまとめるワークスペース管理アプリです。Projectごとに複数のFolder／Links Tabを持ち、作業状態をSQLiteへ保存します。

## 実行方式

同じ画面とSQLiteデータを2つの方式で利用できます。

- **Desktop**: Tauriのデスクトップウィンドウで動作します。
- **Local Web**: Windows上の`127.0.0.1`だけでRustのHTTPサーバーを起動し、既定ブラウザで動作します。外部サーバーへは接続しません。

DesktopとLocal Webを同じSQLiteに対して同時起動することはできません。後から起動した側には、既に動作中の方式を示すダイアログが表示されます。

## 主な機能

### ProjectとNote

- Project名と短い説明を、Active Project欄、サイドバー、右クリックメニューから編集
- `Custom`／`Created`／`Name`順の切り替え
- Custom順でのドラッグ並び替え。複数選択したProjectはまとめて移動
- ProjectのCtrl／Shift複数選択、一括削除、確認ダイアログ、Undo
- Projectごとの複数Noteを、タイトル一覧＋選択中Contentで表示
- NoteのCtrl／Shift複数選択、編集、一括削除、Undo
- Notesパネルのドラッグリサイズ、既定高さへのリセット、最大化／復元

### Folder Tab

- Tabごとに任意のフォルダを割り当て
- File／Folderの単一選択とチェックボックスによる複数チェック
- Ctrl+クリックで個別チェック、Shift+クリックでActiveからの連続範囲を一括チェック／解除
- Fileの自動Preview、選択項目またはチェック項目のOpen
- File／Folder行のOpenボタン
- Windowsのファイル変更通知による一覧の自動更新
- 選択項目、チェック項目、最近開いたFileをSQLiteへ保存

### Links Tab

- 表示名とURLを1件追加する`Add Link`
- URLを1行ずつ一括追加する`Add Links`
- URL行のOpen／Copy
- 表示名とURLのダブルクリック編集、右クリック編集
- Ctrl／Shiftクリックとチェックボックスによる複数チェック
- チェックしたURLの一括Open／Delete
- 選択、チェック、表示順をSQLiteへ保存
- 登録可能なURLは`http://`と`https://`

### Tabと復元

- `+`からFolder TabまたはLinks Tabを追加
- Tab名とFolder Pathの編集
- TabのCtrl／Shift複数選択、ドラッグ並び替え、一括削除
- Tab削除は右クリックメニューから確認後に実行し、Undo可能
- 編集欄外のCtrl+Zで直前の削除をUndo
- Active Project、Active Tab、選択・チェック状態、Notes高さ、サイドバー状態、ウィンドウ幅・高さを復元

## ダウンロード

GitHub Releasesでは次を配布します。インストーラーは使用しません。

- `workspace-tabs.exe`: Desktop版
- `workspace-tabs-local-web.exe`: Local Web版
- `WorkspaceTabs-portable-windows-x64.zip`: 両方のEXEと空の`data`フォルダを含むPortable版

ZIPを展開してEXEを起動してください。Windows Defenderなどの警告が出る場合は、ファイルをスキャンして発行元を確認してください。現在、コード署名は行っていません。

## Storage mode

EXEと同じフォルダに`data`フォルダがある場合はPortable modeです。

```text
WorkspaceTabs/
  workspace-tabs.exe
  workspace-tabs-local-web.exe
  data/
    workspace.sqlite3
```

`workspace.sqlite3`が存在しない場合は自動作成されます。フォルダごとコピーすれば、アプリ本体と作業状態を一緒に移動できます。

`data`がない場合はAppData modeです。

```text
C:\Users\<UserName>\AppData\Roaming\local.workspace.tabs\workspace.sqlite3
```

左ペイン下部に現在のStorage modeとSQLiteパスを表示し、Open Folderから保存先を開けます。

## Local Webの終了と安全性

- `127.0.0.1`だけで待ち受け、`Host`と`Origin`を検証します。
- 起動ごとのアクセストークンをAPIと監視通知に要求します。
- UIはLocal Web EXEへ埋め込まれます。
- 右上の`Close Local Web`から待機時間なしで終了できます。
- 通常のブラウザタブ終了後は10秒、予期しない切断後は60秒の再接続猶予を設けます。
- Local Webが先に終了した場合、ブラウザ画面をグレーアウトして切断を表示します。
- 起動エラーはEXEと同じフォルダの`workspace-tabs-local-web.log`へ記録します。

Desktop版も右上の`Close Desktop`から確認後に終了できます。

## ビルド

Windows、Node.js 22、Rust stableが必要です。プロジェクト直下から実行します。

```powershell
# Desktopのみ
.\scripts\build.cmd -Target desktop

# Local Webのみ
.\scripts\build.cmd -Target local-web

# 両方
.\scripts\build.cmd -Target all
```

生成したportable EXEは`outputs`へ配置されます。

```text
outputs/
  workspace-tabs.exe
  workspace-tabs-local-web.exe
```

## テスト

```powershell
cd explorer-shell
npm.cmd ci
npm.cmd run test:ui
npm.cmd run build
npm.cmd run test:e2e

cd ..
cargo test --manifest-path explorer-core/Cargo.toml --locked
cargo test --manifest-path explorer-view-model/Cargo.toml --locked
cargo test --manifest-path explorer-shell/src-tauri/Cargo.toml --locked
cargo test --manifest-path local-web/Cargo.toml --locked
```

GitHub ActionsのCIはpush／pull requestで同じFrontend・Rust・Local Web E2Eを実行します。`v*`タグをpushすると、テスト成功後にWindows x64のEXEとPortable ZIPをGitHub Releaseへ公開します。Release workflowは手動実行もでき、その場合はartifactだけを生成します。

## 内部設計

- `explorer-core`: Project、Tab、Note、Link、Undoなどのドメイン状態
- `explorer-view-model`: Desktop／Local Web共通のJSON表現
- `explorer-shell`: Vanilla TypeScript UIとTauri Desktop
- `local-web`: localhost HTTP API、SSE、ブラウザライフサイクル
- SQLiteでは共通Tab情報とFolder／Links固有状態を分離して保存

詳細な画面操作は[explorer-shell/README.md](explorer-shell/README.md)を参照してください。

## License

WorkspaceTabs is available under the [MIT License](LICENSE). See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) for dependency license information.
