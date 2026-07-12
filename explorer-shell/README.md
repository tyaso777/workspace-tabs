# WorkspaceTabs UI

Tauri Desktop版とLocal Web版で共有するVanilla TypeScript UIです。実行方式、Storage、配布、ビルドの説明はプロジェクト直下の[README.md](../README.md)を参照してください。

## 基本操作

- Project追加: 左上の名前と短い説明を入力して`Add Project`
- Project編集: Active Project欄またはサイドバーの名前・説明をダブルクリック。右クリックメニューからも編集可能
- Project並び順: `Custom`／`Created`／`Name`。Customではドラッグ可能
- 複数選択: Ctrl+クリックで個別追加・解除、Shift+クリックで連続範囲
- Project削除: 右クリックまたはActive Project右上の`Delete Project`から確認後に削除
- Undo: `Undo`または編集欄外のCtrl+Z

## Note

- 追加: Notes右上の`+`
- 選択: 左側のタイトル一覧をクリック
- 編集: タイトル／Contentをダブルクリック、または右クリックメニュー
- 複数削除: Ctrl／Shift選択後にDelete
- 高さ変更: 下端をドラッグ。ダブルクリックで既定高さへ戻す
- 最大化／復元: Notes右上のサイズボタン
- ContentはCtrl+Enterまたはフォーカスを外して保存。Escでキャンセル

## Tab

- 追加: Tab列末尾の`+`からFolder TabまたはLinks Tabを選択
- 名前変更: TabまたはActive Tab名をダブルクリック
- 複数選択: Ctrl／Shiftクリック
- 並び替え: 1件または複数選択したTabをドラッグ
- 削除: 右クリックメニューのDeleteから確認後に削除。実フォルダ、File、URLは削除しない

## Folder Tab

- Folder Pathをダブルクリックし、直接入力または`Choose`で変更
- 行クリックでActive選択、チェックボックスまたはCtrl／Shiftクリックで複数チェック
- `Open`でFile／Folderを開く
- `Open Checked`でチェック項目をまとめて開く
- Fileを選択するとPreviewを自動表示

## Links Tab

- `Add Link`: 表示名とURLを1件追加
- `Add Links`: URLを1行ずつ一括追加
- 行クリックで選択、チェックボックスまたはCtrl／Shiftクリックで複数チェック
- `Open`／`Copy`、ダブルクリック編集、右クリックメニュー
- `Open Links`でチェックしたURLをまとめて開く

## 開発

```powershell
npm.cmd ci
npm.cmd run test:ui
npm.cmd run build
npm.cmd run test:e2e
```

Desktopのリリースビルド:

```powershell
npm.cmd run tauri build
```

生成物:

```text
src-tauri\target\release\workspace-tabs.exe
```

インストーラーバンドルは無効で、portable EXEを配布します。
