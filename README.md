# WorkspaceTabs

## FolderタブとLinksタブ

- `+`から `Folder Tab` または `Links Tab` を追加できます。
- Folderタブでは、各ファイル・フォルダ行の `Open` から既定アプリまたはExplorerで開きます。行のクリックは選択、ファイルのチェックボックスは複数選択です。
- Linksタブでは、`Add Link`から任意の表示名とURLを1件追加できます。`Add Links`ではURLだけを1行ずつ貼り付けて一括追加できます。
- URL行には `Open` と `Copy` があり、表示名とURLはそれぞれダブルクリックまたは右クリックメニューから編集できます。
- URLのChecked、Selected、表示順はSQLiteへ保存されます。チェックしたURLは `Open Links` でまとめて開けます。
- 登録可能なURLは `http://` と `https://` です。リンク削除は `Undo` で復元できます。

## Folder／Linksの内部設計

- `explorer-core`では、タブ内容を`TabContent::Folder`と`TabContent::Links`に分けています。種別に合わない状態や操作はコア層で拒否されます。
- SQLiteの`tabs`はID、Project、名前、位置、種別だけを保持します。Folder固有状態は`folder_tabs`、Links固有状態は`links_tabs`と`project_links`へ保存します。
- DesktopとLocal Webが返すJSONは`explorer-view-model`で一元管理し、FolderとLinksで異なる必須項目を判別可能な形式にしています。
- 旧形式の`tabs`に保存されたFolder／Links状態は、初回起動時に種別テーブルへ移行されます。

Windows Explorerの代替を目指した、プロジェクト単位のワークスペース管理アプリです。プロジェクトごとに複数のタブ、フォルダ、Note、選択ファイルなどの作業状態をSQLiteへ保存します。

## 実行方式

WorkspaceTabsは、同じ画面とSQLiteデータを2つの方式で利用できます。

- **Desktop**: Tauriのデスクトップウィンドウで動作します。
- **Local Web**: このPCの `127.0.0.1` だけでRustのHTTPサーバーを起動し、既定ブラウザで動作します。外部サーバーへは接続しません。

Local Webは現在Windows専用です。起動するとバックグラウンドで動作し、既定ブラウザで `http://127.0.0.1:47831` を開きます。最後のWorkspaceTabsブラウザタブを閉じると、Local Webも自動的に終了します。

DesktopとLocal Webを同じSQLiteに対して同時起動することはできません。後から起動した側には、起動中の方式を示すネイティブダイアログが表示され、OKを押すと後発側だけが終了します。

## ビルド

PowerShellでプロジェクト直下から実行します。

```powershell
# Tauri Desktopのみ
.\scripts\build.cmd -Target desktop

# Local Webのみ（TauriのRust crateはビルドしません）
.\scripts\build.cmd -Target local-web

# 両方
.\scripts\build.cmd -Target all
```

生成物は `outputs` に配置されます。

```text
outputs/
  workspace-tabs.exe
  workspace-tabs-local-web.exe
  data/
    workspace.sqlite3
```

`workspace-tabs.exe`と`workspace-tabs-local-web.exe`を同じフォルダに置くと、同じPortableデータを使用できます。

## Storage mode

EXEと同じフォルダに `data` フォルダがある場合はPortable modeです。

```text
workspace-tabs.exe
workspace-tabs-local-web.exe
data/
  workspace.sqlite3
```

`data`がない場合は、次のAppDataデータを使用します。

```text
C:\Users\<UserName>\AppData\Roaming\local.workspace.tabs\workspace.sqlite3
```

## 主な機能

- Projectの作成、編集、Custom／Created／Name順の切り替え、複数選択、一括削除、Undo
- 既定のCustom順ではProjectをドラッグして並び替え可能（複数選択時はまとめて移動）
- Projectごとの複数Note、Title／Content編集、複数選択、一括削除
- Projectごとの複数Tabとドラッグ並び替え
- LinksはCtrl+クリックまたはチェックボックスで複数チェックし、一括Open／Delete可能
- Folder内のファイルはCtrl+クリックで個別チェック、Shift+クリックで連続範囲をチェック可能
- 編集欄外のCtrl+Zで直前の削除をUndo
- Tabごとのフォルダ割り当て
- ファイル選択、複数チェック、Preview、Open
- Windowsのファイル変更通知による自動更新
- Active Project、Active Tab、Note表示、ウィンドウサイズなどの復元

詳細な操作説明は [explorer-shell/README.md](explorer-shell/README.md) にあります。

## License

WorkspaceTabs is available under the [MIT License](LICENSE). See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) for dependency license information.

## Local Webの安全性

- `127.0.0.1` のみで待ち受けます。
- `Host` と `Origin` を検証します。
- 起動ごとのアクセストークンをAPIと監視通知に要求します。
- UIファイルはLocal Web EXEへ埋め込まれます。
- フォルダ選択、ファイルを開く操作、SQLite保存はローカルのRustプロセスが行います。

## Local Webの終了と切断

- 画面右上の `Close Local Web` を押して確認すると、待機時間なしでLocal Webを終了します。ブラウザタブを自動で閉じられない場合は、終了済み画面を表示します。
- 通常のブラウザタブ終了通知後、10秒間再接続がなければLocal Webを終了します。
- SSE接続が予期せず切れた場合は、バックグラウンドタブの休止を考慮して60秒待ちます。
- ページをリロードして同じタブが再接続した場合、終了予定を取り消します。
- 複数タブを開いている場合は、最後のタブが閉じるまで終了しません。
- Local Webが先に終了すると、ブラウザ画面をグレーアウトして `Local Web disconnected` を表示します。
- 起動後30秒以内にブラウザが接続しなかった場合は自動終了します。

Desktop版も画面右上の `Close Desktop` から確認後に終了できます。タイトルバーの `X` は従来どおりそのまま終了します。

起動エラーはEXEと同じフォルダの `workspace-tabs-local-web.log` に記録されます。
