---
name: push-master
description: Verify, commit and push all current modifications straight to master on GitHub (origin). Use when the user asks to push, commit and push, upload or publish the changes, or runs /push-master [optional commit message].
---

# Push to master

Commits every pending modification in the working tree and pushes it to `origin/master` (https://github.com/Hexanul/EcoCard). The user invoking this skill is the approval to commit and push — do not ask again, but stop and report if any check below fails.

Arguments: an optional commit message. Without one, write it yourself from the diff.

## 1. Check the state

```
git branch --show-current
git status --short
git fetch origin master
```

- Must be on `master`. On any other branch, stop and tell the user (do not switch or merge on your own).
- Nothing to commit and not ahead of `origin/master` → report "nothing to push" and stop.
- If `origin/master` has commits that are not local, run `git pull --rebase origin master` first. On a conflict, run `git rebase --abort` and stop: report the conflicting files and let the user decide.

## 2. Never commit patient data, binaries or local config

Before staging, look at every new or modified path in `git status --short`. Stop and report (do not commit) if any of these would be included, even if `.gitignore` somehow misses them:

- audio: `*.m4a`, `*.wav`, `*.webm`, `*.ogg`, `*.mp3` (dictation recordings stay local — `dictation/recordings/` holds only `.gitkeep`);
- exported reports: `*.pdf`;
- runtime files: anything in `app/bin/` or `app/models/` other than `.gitkeep`, `*.exe`, `*.dll`, `*.bin`;
- local config or secrets: `echoReport.paths.json`, `.env*`, `*.key`, `*.pem`, credentials of any kind;
- build output: `dist/`, `dist-electron/`, `dist-audio/`, `release/`, `node_modules/`.

`dist-parser-tests/` and `dictation/transcripts/` **are** meant to be committed (see CLAUDE.md).

## 3. Verify

```
npm run test:parser
npm run lint
npx tsc -b
```

`test:parser` recompiles `dist-parser-tests/`, so it also refreshes the committed compiled parser — run it before staging. If anything fails, stop and show the failure; do not commit or push a broken tree.

## 4. Commit

```
git add -A
git status --short
```

Re-check the staged list against step 2. Then commit with a message that says what changed and why (imperative subject ≤ 72 chars, short body listing the main changes). Group the summary by topic when the diff mixes several unrelated changes. End the message with the attribution lines from the current system reminder, if any. Pass the message with a here-string/heredoc so quotes and newlines survive.

Never use `--no-verify`, `--amend` on an already-pushed commit, or `-c commit.gpgsign=false`. If a hook fails, fix the cause or stop and report.

## 5. Push

```
git push origin master
```

- Never `--force` / `--force-with-lease` to master.
- If the push is rejected because the remote moved, do one `git pull --rebase origin master`, re-run step 3, and push again. If it is rejected a second time or for another reason (auth, protected branch), stop and report the exact error.

## 6. Report

Keep it short: the commit hash and subject, the number of files changed, the push result (`<old>..<new>  master -> master`), and anything skipped or stopped on. Remind the user to rebuild (`npm run package:portable`) if the change affects the shipped app.
