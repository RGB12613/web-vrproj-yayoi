#!/bin/sh

# 1. 最新のGitコミットメッセージの1行目を取得
# (%s は件名のみを取得する指定子)
COMMIT_MESSAGE=$(git log -1 --pretty=%s)

# 2. 公開用のディレクトリを作成 (例: dist)
mkdir -p dist

# 3. js, css, html ファイルを dist にコピー
cp *.js *.css *.html dist/

# 4. dist内のmain.jsの目印(__VERSION_PLACEHOLDER__)をコミットメッセージで置換
# sedコマンドで文字列を置換しています
sed -i.bak "s/__VERSION_PLACEHOLDER__/$COMMIT_MESSAGE/g" dist/main.js

echo "ビルド完了！バージョンは '$COMMIT_MESSAGE' です。"