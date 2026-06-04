#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <commit-message> <path> [<path> ...]" >&2
  exit 1
fi

commit_message="$1"
shift
paths=("$@")

if git diff --quiet -- "${paths[@]}"; then
  echo "No changes detected for ${paths[*]}. Skipping commit."
  exit 0
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git add -- "${paths[@]}"
git commit -m "$commit_message"
echo "Commit created: $(git rev-parse --short HEAD)"

for attempt in 1 2; do
  echo "Push attempt ${attempt}/2: fetching origin/main..."
  git fetch origin main

  echo "Push attempt ${attempt}/2: rebasing onto origin/main..."
  if ! git rebase origin/main; then
    conflicted_files="$(git diff --name-only --diff-filter=U || true)"
    git rebase --abort || true
    if [ -n "$conflicted_files" ]; then
      echo "Rebase conflict detected in: $conflicted_files" >&2
    else
      echo "Rebase conflict detected while syncing with origin/main." >&2
    fi
    exit 1
  fi

  echo "Push attempt ${attempt}/2: pushing HEAD to main..."
  if git push origin HEAD:main; then
    echo "Push completed successfully."
    exit 0
  fi

  if [ "$attempt" -eq 2 ]; then
    echo "Push failed after 2 attempts." >&2
    exit 1
  fi

  echo "Push failed on attempt ${attempt}/2; retrying after a fresh fetch and rebase..."
done
