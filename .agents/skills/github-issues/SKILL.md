---
name: github-issues
description: >-
  Use this skill for all GitHub issue and repository interactions for the ZAP repository.
  Provides a consistent workflow for creating, listing, closing, and migrating issues
  using the GitHub REST API, and for managing issue-driven development with worktrees.
---

# GitHub Issues Skill

Use this skill whenever a task involves GitHub issues, issue migration, or issue-driven
development for the ZAP repository (`alendnl/zap`).

## Prerequisites

- Repository: `alendnl/zap` (public, default branch `main`)
- API base: `https://api.github.com/repos/alendnl/zap`
- Authentication: GitHub Personal Access Token (classic) with the `repo` scope.
  The token must be provided by the user and must never be committed or stored in
  repository files. Prefer passing it via an environment variable or a temporary
  file that is deleted immediately after use.

> [!IMPORTANT]
> If a token is ever shared in chat or terminal history, instruct the user to revoke
> it in GitHub settings and create a new one.

## Workflow

### 1. List Issues

```bash
curl -sS \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Accept: application/vnd.github+json' \
  'https://api.github.com/repos/alendnl/zap/issues?state=all&per_page=100'
```

### 2. Create an Issue

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Accept: application/vnd.github+json' \
  -H 'Content-Type: application/json' \
  'https://api.github.com/repos/alendnl/zap/issues' \
  -d '{
    "title": "Issue title",
    "body": "Issue body in Markdown",
    "labels": ["feature"]
  }'
```

### 3. Close an Issue

```bash
curl -sS -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Accept: application/vnd.github+json' \
  -H 'Content-Type: application/json' \
  'https://api.github.com/repos/alendnl/zap/issues/<NUMBER>' \
  -d '{"state": "closed"}'
```

### 4. Migrate Local Issues to GitHub

When local issue files exist (for example under `.issues/`):

1. Read each local issue file.
2. Create a GitHub issue with the same title and body.
3. Record the mapping between the local file and the GitHub issue number.
4. Close the GitHub issue if the work is already complete.
5. Archive or remove the local issue files only after confirmation.

### 5. Issue-Driven Development

For each GitHub issue:

1. Create an isolated worktree using the `git-worktree-parallel` skill.
2. Implement the changes using the `build-issue` skill.
3. Verify with the build verification script.
4. Merge using the `merge-conflict-resolver` skill.
5. Close the GitHub issue after the merge is verified.

## Security Notes

- Never commit tokens, `.env` files, or credentials.
- Never paste tokens into chat.
- Prefer environment variables or temporary files for token handling.
- Revoke and rotate tokens that have been exposed.