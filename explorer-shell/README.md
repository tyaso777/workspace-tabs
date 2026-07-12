# WorkspaceTabs

Windows Explorerの代替を目指したTauriアプリです。プロジェクトごとに複数タブを持ち、タブごとにフォルダを割り当てて作業状態を保存します。

Tauri Desktop版に加えて、同じUIを既定ブラウザで使うLocal Web版もあります。実行方式とビルド方法はプロジェクト直下の [README.md](../README.md) を参照してください。

## 主な機能

- プロジェクトの作成、削除
- Project・NoteのCtrl／Shift複数選択と一括削除
- LinksのCtrl+クリック／チェックボックスによる複数チェック、一括Open／Delete
- Folder内のFile／FolderはCtrl+クリックで個別チェック、Shift+クリックでActiveからの連続範囲を一括チェック／解除
- 編集欄外のCtrl+Zによる削除Undo
- ProjectはCustom／Created／Name順を切り替え可能。既定のCustom順ではドラッグで並び替え、複数選択時はまとめて移動
- プロジェクト名、短い説明のダブルクリック編集
- プロジェクトごとの複数Note、タイトル一覧と選択中Contentの編集
- NotesパネルのCompact／Expanded切り替え
- タブバー右端の `+` によるタブ追加
- タブ名のダブルクリック編集
- タブに対応するフォルダパスのダブルクリック編集
- フォルダパス編集中の `Choose` ボタンによるフォルダ選択
- タブのドラッグ並び替え
- タブ削除
- 選択ファイルのPreview
- 最近開いたファイルの記録
- 前回のActive Project、Active Tab、選択状態、Notes表示サイズ、ウィンドウ幅・高さの復元

## Storage mode

データはSQLiteの `workspace.sqlite3` に保存します。起動時に、exeと同じフォルダに `data` フォルダがあるかどうかで保存先を切り替えます。

### AppData mode

`data` フォルダがない場合は通常モードです。

```text
C:\Users\<UserName>\AppData\Roaming\local.workspace.tabs\workspace.sqlite3
```

この場合、exeを別フォルダに移しても同じユーザーなら同じ状態を読みます。

### Portable mode

exeと同じフォルダに `data` フォルダがある場合はPortable modeです。

```text
ExplorerShellPortable/
  workspace-tabs.exe
  data/
    workspace.sqlite3
```

`data\workspace.sqlite3` が存在しない場合は、新しいSQLiteファイルが自動作成されます。このフォルダを丸ごとコピーすれば、アプリ本体と作業状態を一緒に移動できます。

### UI表示

左ペイン下部に現在の保存モードとSQLiteパスを表示します。

```text
Storage: AppData
```

または

```text
Storage: Portable
```

## Portable modeへの切り替え

1. アプリを終了します。
2. `workspace-tabs.exe` と同じフォルダに `data` フォルダを作ります。
3. アプリを起動します。

既存のAppData側データをPortableへ移したい場合は、以下のファイルをコピーしてください。

```text
C:\Users\<UserName>\AppData\Roaming\local.workspace.tabs\workspace.sqlite3
```

コピー先:

```text
<exeのフォルダ>\data\workspace.sqlite3
```

## 操作

- Project name: ダブルクリックで編集
- Short description: ダブルクリックで編集
- Note追加: Notes右上の `+`
- Note選択: 左側のタイトル一覧をクリック
- Noteタイトル変更: 選択中タイトルをダブルクリック
- Note Content変更: Contentをダブルクリック
- Notes拡大・縮小: Notes右上の拡大／縮小ボタン
- Note削除: 選択中Noteの `Delete Note`（Undo可能）
- 複数選択: `Ctrl+クリック` で個別追加・解除、`Shift+クリック` で連続範囲
- 一括削除: 複数選択後に `Delete Project` または `Delete Note`（1回のUndoで復元）
- タブ追加: タブバー右端の `+`
- タブ名変更: タブをダブルクリック
- フォルダ変更: `Folder` のパス表示をダブルクリック
- フォルダ選択: フォルダ編集中に `Choose`
- タブ削除: タブ右側の `x`
- タブ並び替え: タブをドラッグ

Note Contentでは通常のEnterは改行です。保存はフォーカス外し、またはCtrl+Enterです。Escでキャンセルできます。

## 開発

### UIテスト

```powershell
npm.cmd run test:ui
```

### フロントエンドビルド

```powershell
npm.cmd run build
```

### Tauri側テスト

```powershell
cargo test
```

`explorer-shell\src-tauri` で実行します。

### Window幅復元E2E

リリースビルド後に、実アプリを起動してウィンドウ幅の保存・復元を検証します。

```powershell
npm.cmd run tauri build
npm.cmd run test:e2e:window-width
```

このE2Eは `explorer-shell\src-tauri\target\release\workspace-tabs.exe` の横に一時的な `data` フォルダを作り、Portable modeで検証します。既にその場所に `data` フォルダがある場合は、既存データを壊さないため実行を中止します。

### Core側テスト

```powershell
cargo test
```

`explorer-core` で実行します。

### リリースビルド

```powershell
npm.cmd run tauri build
```

生成物は主に以下に出力されます。

```text
explorer-shell\src-tauri\target\release\workspace-tabs.exe
```

The Desktop build is distributed as the portable `workspace-tabs.exe`; installer bundles are disabled.
