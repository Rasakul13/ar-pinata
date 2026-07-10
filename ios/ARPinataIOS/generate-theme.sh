#!/bin/sh
set -eu

PROJECT_ROOT="$(cd "${SRCROOT}/../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
OUTPUT_FILE="${SRCROOT}/ARPinataIOS/BuildTheme.generated.swift"

if [ ! -f "${ENV_FILE}" ]; then
  echo "error: Missing ${ENV_FILE}"
  exit 1
fi

THEME="$(awk -F= '/^[[:space:]]*FINAL_EFFECT_THEME[[:space:]]*=/ { value=$2; gsub(/[[:space:]\047\042]/, "", value); print tolower(value); exit }' "${ENV_FILE}")"

case "${THEME}" in
  blue|pink) ;;
  *)
    echo "error: FINAL_EFFECT_THEME must be blue or pink"
    exit 1
    ;;
esac

printf '// Generated from the repository .env by the Xcode build phase.\nenum BuildTheme {\n    static let name = "%s"\n}\n' "${THEME}" > "${OUTPUT_FILE}"
