#!/usr/bin/env bash
# Создаёт git worktree для новой ветки рядом с основным репо и копирует
# локальные env-файлы (они в .gitignore, поэтому их не подхватит git worktree add).
#
# Использование:
#   scripts/new-worktree.sh <branch> [base]
#
# Пример:
#   scripts/new-worktree.sh migrate-to-hono main

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $(basename "$0") <branch> [base-ref]" >&2
  exit 1
fi

BRANCH="$1"
BASE="${2:-main}"

# Корень основного worktree (тот, где лежит .git каталог, не файл-указатель).
REPO_ROOT="$(git rev-parse --show-toplevel)"
REPO_NAME="$(basename "$REPO_ROOT")"
PARENT_DIR="$(dirname "$REPO_ROOT")"
WORKTREE_PATH="$PARENT_DIR/${REPO_NAME}-${BRANCH}"

if [[ -e "$WORKTREE_PATH" ]]; then
  echo "error: $WORKTREE_PATH already exists" >&2
  exit 1
fi

echo "→ git worktree add -b $BRANCH $WORKTREE_PATH $BASE"
git worktree add -b "$BRANCH" "$WORKTREE_PATH" "$BASE"

# Копируем локальные env-файлы (если есть). Они вне VCS, но нужны для dev/seed.
for f in .env .env.local .env.development.local; do
  if [[ -f "$REPO_ROOT/$f" ]]; then
    cp "$REPO_ROOT/$f" "$WORKTREE_PATH/$f"
    echo "  copied $f"
  fi
done

echo
echo "✔ worktree ready: $WORKTREE_PATH"
echo "  cd $WORKTREE_PATH && pnpm install"
