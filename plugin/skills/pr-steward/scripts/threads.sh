#!/usr/bin/env bash
# pr-steward review-thread + CI helpers.
# Requires: gh (authenticated), git. Bash 3.2+ (macOS default).
#
# Usage:
#   threads.sh list [--all]           list review threads as JSON (one per line)
#   threads.sh reply <threadId> [file] reply in a thread (body from file or stdin)
#   threads.sh resolve <threadId> [reason]  resolve a thread (ADDRESSED|INVALID|WONT_FIX)
#   threads.sh request-review [effort]  request Copilot review (lite|balanced|max)
#   threads.sh overview               list Copilot review bodies (closer-look worklists)
#   threads.sh status                 print check buckets JSON; exit 8 when checks pending
#
# Env: PR=<number>  override the PR (default: current branch's PR)

set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: threads.sh <command> [args]
  list [--all]           list review threads as JSON (one per line, unresolved by default)
  reply <threadId> [file] reply in a thread; body from file or stdin
  resolve <threadId> [reason]  resolve a thread (ADDRESSED|INVALID|WONT_FIX; default ADDRESSED)
  request-review [effort]  request Copilot review (lite|balanced|max; default balanced)
  overview               list Copilot review bodies (for "Needs a closer look")
  status                 print check buckets JSON; exit 8 when checks are pending
Env: PR=<number>  override the PR (default: current branch's PR)
EOF
  exit 1
}

need() {
  command -v gh >/dev/null 2>&1 || {
    echo "gh not found — install it (brew install gh) and run 'gh auth login' first." >&2
    exit 1
  }
  command -v git >/dev/null 2>&1 || { echo "git not found in PATH." >&2; exit 1; }
}

repo_vars() { # sets OWNER and REPO
  local info
  info=$(gh repo view --json owner,name --jq '"\(.owner.login) \(.name)"')
  OWNER=${info%% *}
  REPO=${info#* }
}

pr_number() {
  if [ -n "${PR:-}" ]; then
    printf '%s\n' "$PR"
  else
    gh pr view --json number --jq '.number'
  fi
}

cmd_list() {
  local filter="${1:-unresolved}"
  local pr jq_expr query
  pr=$(pr_number)
  query='query($owner: String!, $name: String!, $number: Int!, $endCursor: String) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        reviewThreads(first: 100, after: $endCursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            isResolved
            isOutdated
            path
            line
            comments(first: 100) {
              totalCount
              nodes { id author { login } path line body }
            }
          }
        }
      }
    }
  }'
  jq_expr='.data.repository.pullRequest.reviewThreads.nodes[]'
  if [ "$filter" != "--all" ]; then
    jq_expr="$jq_expr | select(.isResolved == false)"
  fi
  jq_expr="$jq_expr | {id, isResolved, isOutdated, path, line, comments: [.comments.nodes[] | {id, author: .author.login, path, line, body}]}"
  gh api graphql --paginate \
    -f owner="$OWNER" -f name="$REPO" -F number="$pr" -f query="$query" \
    --jq "$jq_expr"
}

cmd_reply() {
  local thread="${1:-}" body
  [ -n "$thread" ] || usage
  body=$(cat "${2:--}")
  [ -n "$body" ] || { echo "refusing to post an empty reply" >&2; exit 1; }
  tmp=$(mktemp)
  trap 'rm -f "${tmp:-}"' EXIT
  printf '%s' "$body" > "$tmp"
  gh api graphql \
    -f query='mutation($threadId: ID!, $body: String!) { addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: $threadId, body: $body}) { comment { id url } } }' \
    -F threadId="$thread" \
    -F body="@$tmp" \
    --jq '.data.addPullRequestReviewThreadReply.comment'
}

cmd_resolve() {
  local thread="${1:-}" reason="${2:-ADDRESSED}" out
  [ -n "$thread" ] || usage
  case "$reason" in
    ADDRESSED|INVALID|WONT_FIX) ;;
    *) echo "reason must be ADDRESSED, INVALID, or WONT_FIX (got '$reason')" >&2; exit 2 ;;
  esac
  # threadId is a GitHub-issued PRRT_ id; reason is whitelisted above, so
  # interpolating the enum literal is safe.
  if out=$(gh api graphql \
    -f query="mutation { resolveReviewThread(input: {threadId: \"$thread\", resolutionReason: $reason}) { thread { id isResolved } } }" \
    --jq '.data.resolveReviewThread.thread' 2>&1); then
    printf '%s\n' "$out"
    return 0
  fi
  # Older hosts/schemas may not accept resolutionReason — retry without it.
  gh api graphql \
    -f query='mutation($threadId: ID!) { resolveReviewThread(input: {threadId: $threadId}) { thread { id isResolved } } }' \
    -F threadId="$thread" \
    --jq '.data.resolveReviewThread.thread'
}

cmd_request_review() {
  local pr requested effort="${1:-balanced}" out
  case "$effort" in
    lite|balanced|max) ;;
    *) echo "effort must be lite, balanced, or max (got '$effort')" >&2; exit 2 ;;
  esac
  pr=$(pr_number)

  # Already requested? Native gh command; no raw REST call.
  requested=$(gh pr view "$pr" --json reviewRequests \
    --jq '[.[] | (.login // .slug // "")] | join(",")' 2>/dev/null || true)
  case ",$requested," in
    *,copilot*) echo "Copilot review already requested ($requested)."; return 0 ;;
  esac

  # Dedicated endpoint via gh api — the CLI's API surface, never raw HTTP.
  if out=$(gh api -X POST "repos/$OWNER/$REPO/pulls/$pr/copilot-code-review" \
    -f "review_effort=$effort" 2>&1); then
    echo "Requested Copilot review (effort: $effort)."
    return 0
  fi
  case "$out" in
    *"already pending"*|*409*)
      echo "Copilot review already pending."
      return 0 ;;
  esac

  # Repo may reject the requested effort (422 INVALID_REVIEW_EFFORT): retry
  # with the repository default before falling back further.
  if out=$(gh api -X POST "repos/$OWNER/$REPO/pulls/$pr/copilot-code-review" 2>&1); then
    echo "Requested Copilot review (repository default effort)."
    return 0
  fi
  case "$out" in
    *"already pending"*|*409*)
      echo "Copilot review already pending."
      return 0 ;;
  esac

  # Native fallback: add Copilot as a reviewer (no effort selection). Some
  # hosts only accept the bare login.
  local login
  for login in "copilot-pull-request-reviewer[bot]" "copilot-pull-request-reviewer"; do
    if gh pr edit "$pr" --add-reviewer "$login" >/dev/null 2>&1; then
      echo "Requested Copilot review via gh pr edit ($login)."
      return 0
    fi
  done

  echo "Could not request Copilot review: ${out}" >&2
  echo "Request it from the PR sidebar, or enable the repo rule 'Automatically request Copilot code review'." >&2
  return 1
}

cmd_overview() {
  local pr
  pr=$(pr_number)
  gh api "repos/$OWNER/$REPO/pulls/$pr/reviews" --paginate \
    --jq '.[] | select(.is_copilot_code_review == true)
      | {id, state, commit_id, submitted_at, body}'
}

cmd_status() {
  local pr out code
  pr=$(pr_number)
  set +e
  out=$(gh pr checks "$pr" --json name,bucket,state,link 2>&1)
  code=$?
  set -e
  if [ "$code" -eq 8 ]; then
    echo "PENDING"
    printf '%s\n' "$out"
    exit 8
  fi
  if [ "$code" -ne 0 ]; then
    printf '%s\n' "$out" >&2
    exit "$code"
  fi
  printf '%s\n' "$out"
}

need
case "${1:-}" in
  list) repo_vars; cmd_list "${2:-unresolved}" ;;
  reply) repo_vars; cmd_reply "${2:-}" "${3:-}" ;;
  resolve) repo_vars; cmd_resolve "${2:-}" "${3:-}" ;;
  request-review) repo_vars; cmd_request_review "${2:-}" ;;
  overview) repo_vars; cmd_overview ;;
  status) cmd_status ;;
  *) usage ;;
esac
