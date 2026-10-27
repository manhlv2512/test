#!/usr/bin/env bash
# ─────────────────────────────────────────────
# Git add + commit + push
# Usage:
#   ./git_commit.sh "commit message"              # push lên branch hiện tại
#   ./git_commit.sh "commit message" <branch>     # checkout/tạo branch rồi push
# ─────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

MESSAGE="$1"
BRANCH="$2"

if [[ -z "$MESSAGE" ]]; then
  echo "❌  Thiếu commit message."
  echo "   Usage: ./git_commit.sh \"message\" [branch]"
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "❌  Không phải git repository."
  exit 1
fi

# Chuyển branch nếu được truyền vào
if [[ -n "$BRANCH" ]]; then
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    echo "▶  Checkout branch: $BRANCH"
    git checkout "$BRANCH"
  else
    echo "▶  Tạo branch mới: $BRANCH"
    git checkout -b "$BRANCH"
  fi
else
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  echo "▶  Branch hiện tại: $BRANCH"
fi

# Không có gì để commit
if [[ -z "$(git status --porcelain)" ]]; then
  echo "ℹ️   Không có thay đổi để commit."
  exit 0
fi

echo "▶  git add ."
git add .

echo "▶  git commit"
git commit -m "$MESSAGE"

echo "▶  git push -u origin $BRANCH"
git push -u origin "$BRANCH"

echo ""
echo "✅  Đã push '$MESSAGE' lên branch '$BRANCH'."
