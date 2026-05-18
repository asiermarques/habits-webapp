#!/usr/bin/env bash
# PreToolUse hook: block the `demo-implement-task` skill unless the
# arguments reference an existing task id under .workflow/tasks/.

set -u

payload="$(cat)"

skill_name="$(printf '%s' "$payload" | /usr/bin/python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
ti = d.get("tool_input") or {}
print(ti.get("skill", ""))
')"

if [ "$skill_name" != "demo-implement-task" ]; then
  exit 0
fi

args="$(printf '%s' "$payload" | /usr/bin/python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
ti = d.get("tool_input") or {}
print(ti.get("args", "") or "")
')"

tasks_dir="${CLAUDE_PROJECT_DIR:-.}/.workflow/tasks"

if [ ! -d "$tasks_dir" ]; then
  echo "demo-implement-task blocked: no .workflow/tasks/ directory found." >&2
  exit 2
fi

# Build the list of valid task ids (directory names).
valid_ids=()
while IFS= read -r d; do
  [ -n "$d" ] && valid_ids+=("$(basename "$d")")
done < <(find "$tasks_dir" -mindepth 1 -maxdepth 1 -type d 2>/dev/null)

if [ "${#valid_ids[@]}" -eq 0 ]; then
  echo "demo-implement-task blocked: .workflow/tasks/ is empty — no task ids to choose from." >&2
  exit 2
fi

# Look for any valid id as a whitespace-delimited token in args.
for id in "${valid_ids[@]}"; do
  case " $args " in
    *" $id "*)
      exit 0
      ;;
  esac
done

{
  echo "demo-implement-task blocked: the skill args must include a task id from .workflow/tasks/."
  echo "Provided args: ${args:-<empty>}"
  echo "Available task ids:"
  for id in "${valid_ids[@]}"; do
    echo "  - $id"
  done
} >&2
exit 2
