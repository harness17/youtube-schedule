; インストール完了後の処理
!macro customInstall
  ; 配置ガイドを SETUP_GUIDE.txt として作成
  FileOpen $0 "$INSTDIR\SETUP_GUIDE.txt" w
  FileWrite $0 "YouTube Schedule Viewer - セットアップガイド$\r$\n"
  FileWrite $0 "=============================================$\r$\n$\r$\n"
  FileWrite $0 "【必須】アプリを起動する前に credentials.json を以下のパスに配置してください：$\r$\n$\r$\n"
  FileWrite $0 "  $INSTDIR\credentials.json$\r$\n$\r$\n"
  FileWrite $0 "credentials.json の取得手順：$\r$\n"
  FileWrite $0 "  1. https://console.cloud.google.com/ にアクセス$\r$\n"
  FileWrite $0 "  2. 新しいプロジェクトを作成$\r$\n"
  FileWrite $0 "  3. [API とサービス] > [ライブラリ] で YouTube Data API v3 を有効化$\r$\n"
  FileWrite $0 "  4. [認証情報] > [OAuth クライアント ID を作成]$\r$\n"
  FileWrite $0 "     アプリの種類: デスクトップアプリ$\r$\n"
  FileWrite $0 "  5. JSON をダウンロードし、ファイル名を credentials.json に変更$\r$\n"
  FileWrite $0 "  6. このフォルダ ($INSTDIR) に配置$\r$\n$\r$\n"
  FileWrite $0 "配置後にアプリを起動すると、Google 認証画面が開きます。$\r$\n"
  FileClose $0

  ; インストール完了メッセージ
  MessageBox MB_OK|MB_ICONINFORMATION \
    "インストールが完了しました。$\n$\n\
起動前に credentials.json を以下のフォルダに配置してください：$\n$\n\
$INSTDIR$\n$\n\
詳細は同フォルダの SETUP_GUIDE.txt を参照してください。"
!macroend
