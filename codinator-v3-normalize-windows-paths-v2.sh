#!/usr/bin/env bash
set -euo pipefail

if [ ! -d apps ] || [ ! -d packages ]; then
  echo "ERROR: Run this script from the codinator repository root." >&2
  exit 1
fi

git config core.ignorecase false || true

mkdir -p apps/web/src/pages/evaluation
mkdir -p apps/web/src/assets/evaluation
mkdir -p apps/web/src/assets/ranking
mkdir -p apps/ai/app/api/v3

copy_first_existing() {
  local target="$1"
  shift
  local src
  for src in "$@"; do
    if [ -f "$src" ]; then
      cp -f "$src" "$target"
      return 0
    fi
  done
  return 1
}

move_first_existing() {
  local target="$1"
  shift
  local src
  for src in "$@"; do
    if [ -f "$src" ]; then
      if [ "$src" = "$target" ]; then
        return 0
      fi
      rm -f "$target"
      mv -f "$src" "$target"
      return 0
    fi
  done
  return 1
}

copy_first_existing \
  apps/web/src/pages/evaluation/EvaluationZone.tsx \
  apps/web/src/pages/Evaluation/EvaluationZone.tsx \
  apps/web/src/pages/evaluation/EvaluationZone.tsx || {
  echo "ERROR: EvaluationZone.tsx not found in Evaluation/evaluation." >&2
  exit 1
}

copy_first_existing \
  apps/web/src/pages/evaluation/EvaluationZone.module.css \
  apps/web/src/pages/Evaluation/EvaluationZone.module.css \
  apps/web/src/pages/evaluation/EvaluationZone.module.css || {
  echo "ERROR: EvaluationZone.module.css not found in Evaluation/evaluation." >&2
  exit 1
}

move_first_existing \
  apps/web/src/assets/evaluation/evaluation-history-banner.png \
  'apps/web/src/assets/evaluation/평가기록 배너.png' \
  'apps/web/src/assets/evaluation/#Ud3c9#Uac00#Uae30#Ub85d #Ubc30#Ub108.png' \
  apps/web/src/assets/evaluation/evaluation-history-banner.png || {
  echo "ERROR: evaluation history banner image not found." >&2
  exit 1
}

move_first_existing \
  apps/web/src/assets/ranking/ranking-zone-banner.png \
  'apps/web/src/assets/ranking/랭킹존 배너.png' \
  'apps/web/src/assets/ranking/#Ub7ad#Ud0b9#Uc874 #Ubc30#Ub108.png' \
  apps/web/src/assets/ranking/ranking-zone-banner.png || {
  echo "ERROR: ranking zone banner image not found." >&2
  exit 1
}

move_first_existing \
  apps/web/src/assets/ranking/algorithm-banner.png \
  'apps/web/src/assets/ranking/알고리즘 배너.png' \
  'apps/web/src/assets/ranking/#Uc54c#Uace0#Ub9ac#Uc998 #Ubc30#Ub108.png' \
  apps/web/src/assets/ranking/algorithm-banner.png || {
  echo "ERROR: algorithm banner image not found." >&2
  exit 1
}

if [ -d apps/ai/app/api/v2 ]; then
  cp -Rf apps/ai/app/api/v2/. apps/ai/app/api/v3/
  rm -rf apps/ai/app/api/v2
fi

git rm -r --cached --ignore-unmatch \
  apps/web/src/pages/Evaluation \
  apps/ai/app/api/v2 \
  'apps/web/src/assets/evaluation/평가기록 배너.png' \
  'apps/web/src/assets/evaluation/#Ud3c9#Uac00#Uae30#Ub85d #Ubc30#Ub108.png' \
  'apps/web/src/assets/ranking/랭킹존 배너.png' \
  'apps/web/src/assets/ranking/#Ub7ad#Ud0b9#Uc874 #Ubc30#Ub108.png' \
  'apps/web/src/assets/ranking/알고리즘 배너.png' \
  'apps/web/src/assets/ranking/#Uc54c#Uace0#Ub9ac#Uc998 #Ubc30#Ub108.png' >/dev/null 2>&1 || true

git add \
  apps/web/src/pages/evaluation/EvaluationZone.tsx \
  apps/web/src/pages/evaluation/EvaluationZone.module.css \
  apps/web/src/assets/evaluation/evaluation-history-banner.png \
  apps/web/src/assets/ranking/ranking-zone-banner.png \
  apps/web/src/assets/ranking/algorithm-banner.png \
  apps/ai/app/api/v3

echo "Path normalization completed. Now run: git apply --check codinator-v3-windows-safe-text-fixes-v2.patch"
