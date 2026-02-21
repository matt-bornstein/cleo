#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Sync selected variables from a local env file to Convex deployment env.

Usage:
  bash ./set-convex-env.sh [options]

Options:
  --env-file <path>            Source env file (default: .env.local)
  --prod                       Target production deployment
  --deployment-name <name>     Target a specific deployment
  --preview-name <name>        Target a preview deployment
  --generate-jwt-keys          Generate JWT_PRIVATE_KEY/JWKS if missing in env file
  --include-ai                 Also sync AI provider keys
  --dry-run                    Print actions without applying
  -h, --help                   Show this help

Always synced:
  AUTH_GOOGLE_CLIENT_ID
  AUTH_GOOGLE_CLIENT_SECRET
  SITE_URL
  JWT_PRIVATE_KEY
  JWKS

Optional with --include-ai:
  OPENAI_API_KEY
  ANTHROPIC_API_KEY
  GEMINI_API_KEY
EOF
}

ENV_FILE=".env.local"
DRY_RUN="false"
INCLUDE_AI="false"
GENERATE_JWT_KEYS="false"
TARGET_ARGS=()
GENERATED_JWT_PRIVATE_KEY=""
GENERATED_JWKS=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      [[ $# -ge 2 ]] || { echo "Missing value for --env-file" >&2; exit 1; }
      ENV_FILE="$2"
      shift 2
      ;;
    --prod)
      TARGET_ARGS+=("--prod")
      shift
      ;;
    --deployment-name)
      [[ $# -ge 2 ]] || { echo "Missing value for --deployment-name" >&2; exit 1; }
      TARGET_ARGS+=("--deployment-name" "$2")
      shift 2
      ;;
    --preview-name)
      [[ $# -ge 2 ]] || { echo "Missing value for --preview-name" >&2; exit 1; }
      TARGET_ARGS+=("--preview-name" "$2")
      shift 2
      ;;
    --generate-jwt-keys)
      GENERATE_JWT_KEYS="true"
      shift
      ;;
    --include-ai)
      INCLUDE_AI="true"
      shift
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE" >&2
  exit 1
fi

read_env_value() {
  local key="$1"
  local line
  line="$(awk -v k="$key" '
    $0 ~ "^[[:space:]]*"k"=" {
      sub(/^[[:space:]]*/, "", $0);
      sub(/^[^=]*=/, "", $0);
      print $0;
      exit;
    }
  ' "$ENV_FILE")"

  # Trim carriage return if present.
  line="${line%$'\r'}"

  if [[ -z "$line" ]]; then
    return 1
  fi

  # Strip matching surrounding quotes.
  if [[ "$line" == \"*\" && "$line" == *\" ]]; then
    line="${line:1:${#line}-2}"
  elif [[ "$line" == \'*\' && "$line" == *\' ]]; then
    line="${line:1:${#line}-2}"
  fi

  printf '%s' "$line"
}

generate_jwt_keys() {
  if [[ -n "$GENERATED_JWT_PRIVATE_KEY" && -n "$GENERATED_JWKS" ]]; then
    return 0
  fi

  local payload
  payload="$(node - <<'NODE'
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

process.stdout.write(
  JSON.stringify({
    jwtPrivateKey: privateKey.trimEnd().replace(/\n/g, " "),
    jwks,
  }),
);
NODE
)"

  GENERATED_JWT_PRIVATE_KEY="$(node -e 'const p = JSON.parse(process.argv[1]); process.stdout.write(p.jwtPrivateKey);' "$payload")"
  GENERATED_JWKS="$(node -e 'const p = JSON.parse(process.argv[1]); process.stdout.write(p.jwks);' "$payload")"
}

read_generated_value() {
  local key="$1"
  case "$key" in
    JWT_PRIVATE_KEY)
      printf '%s' "$GENERATED_JWT_PRIVATE_KEY"
      ;;
    JWKS)
      printf '%s' "$GENERATED_JWKS"
      ;;
    *)
      return 1
      ;;
  esac
}

sync_key() {
  local key="$1"
  local value
  if ! value="$(read_env_value "$key")"; then
    if [[ "$GENERATE_JWT_KEYS" == "true" && ( "$key" == "JWT_PRIVATE_KEY" || "$key" == "JWKS" ) ]]; then
      generate_jwt_keys
      value="$(read_generated_value "$key")"
    else
      echo "Skipping $key (not found in $ENV_FILE)"
      return 0
    fi
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "Would set $key on Convex"
    return 0
  fi

  echo "Setting $key on Convex..."
  if [[ -z "${TARGET_ARGS[*]-}" ]]; then
    npx convex env set "$key" -- "$value"
  else
    npx convex env "${TARGET_ARGS[@]}" set "$key" -- "$value"
  fi
}

BASE_KEYS=(
  "AUTH_GOOGLE_CLIENT_ID"
  "AUTH_GOOGLE_CLIENT_SECRET"
  "SITE_URL"
  "JWT_PRIVATE_KEY"
  "JWKS"
)

AI_KEYS=(
  "OPENAI_API_KEY"
  "ANTHROPIC_API_KEY"
  "GEMINI_API_KEY"
)

for key in "${BASE_KEYS[@]}"; do
  sync_key "$key"
done

if [[ "$INCLUDE_AI" == "true" ]]; then
  for key in "${AI_KEYS[@]}"; do
    sync_key "$key"
  done
fi

echo "Done."
