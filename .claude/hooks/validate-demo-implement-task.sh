#!/usr/bin/env bash
# UserPromptSubmit hook: block /demo-implement-task unless the prompt
# references at least one of:
#   - a task directory id (e.g. 001-habit-streak-goals)
#   - a user story id (e.g. US-001 or US-001.md) that exists under any task dir
# Multiple references may be separated by commas and/or whitespace.

set -u

payload="$(cat)"

prompt="$(printf '%s' "$payload" | /usr/bin/python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
print(d.get("prompt", "") or "")
')"

case "$prompt" in
  /demo-implement-task|/demo-implement-task\ *) ;;
  *) exit 0 ;;
esac

args="${prompt#/demo-implement-task}"
args="${args# }"

tasks_dir="${CLAUDE_PROJECT_DIR:-.}/.workflow/tasks"

if [ ! -d "$tasks_dir" ]; then
  echo "demo-implement-task blocked: no .workflow/tasks/ directory found." >&2
  exit 2
fi

valid_dirs=()
while IFS= read -r d; do
  [ -n "$d" ] && valid_dirs+=("$(basename "$d")")
done < <(find "$tasks_dir" -mindepth 1 -maxdepth 1 -type d 2>/dev/null)

if [ "${#valid_dirs[@]}" -eq 0 ]; then
  echo "demo-implement-task blocked: .workflow/tasks/ is empty." >&2
  exit 2
fi

# Normalize separators: replace commas with spaces.
normalized="${args//,/ }"

matched=0
unmatched=()

for token in $normalized; do
  ref="${token%.md}"
  [ -z "$ref" ] && continue

  case "$ref" in
    # Strip optional <task-id>/ prefix for user story refs
    */US-*|*/us-*) ref="${ref#*/}" ;;
  esac

  ok=0

  # Task directory id?
  for id in "${valid_dirs[@]}"; do
    if [ "$ref" = "$id" ]; then ok=1; break; fi
  done

  # User story id existing under any task dir?
  if [ "$ok" -eq 0 ]; then
    case "$ref" in
      US-*|us-*)
        upper="$(printf '%s' "$ref" | tr '[:lower:]' '[:upper:]')"
        if find "$tasks_dir" -mindepth 2 -maxdepth 2 -type f -name "${upper}.md" 2>/dev/null | grep -q .; then
          ok=1
        fi
        ;;
    esac
  fi

  if [ "$ok" -eq 1 ]; then
    matched=1
  else
    unmatched+=("$token")
  fi
done

if [ "$matched" -eq 1 ] && [ "${#unmatched[@]}" -eq 0 ]; then
  exit 0
fi

{
  if [ "$matched" -eq 0 ]; then
    echo "demo-implement-task blocked: prompt must reference at least one task id or user story."
  else
    echo "demo-implement-task blocked: unrecognized reference(s): ${unmatched[*]}"
  fi
  echo "Provided args: ${args:-<empty>}"
  echo "Accepted forms (comma- or space-separated):"
  echo "  US-XXX            US-XXX.md            <task-id>"
  echo "Available task ids and user stories:"
  for id in "${valid_dirs[@]}"; do
    echo "  - $id"
    while IFS= read -r f; do
      [ -n "$f" ] && echo "      $(basename "$f" .md)"
    done < <(find "$tasks_dir/$id" -mindepth 1 -maxdepth 1 -type f -name 'US-*.md' 2>/dev/null | sort)
  done
} >&2
exit 2
