#!/bin/sh
# git pre-commit フックをインストールする
# 使い方: sh scripts/install-hooks.sh

cp scripts/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
echo "pre-commit フックをインストールしました"
