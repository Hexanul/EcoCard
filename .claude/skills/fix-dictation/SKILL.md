---
name: fix-dictation
description: Transcribe new dictation test recordings, report which fields the medical parser missed or misassigned, fix the parser, and lock each recording in as a regression test. Use when the user says they recorded the dictation script, asks to check/fix dictation recordings, or runs /fix-dictation [name-filter].
---

# Fix dictation

Closes the loop between a real dictation of `dictation/scripts/<script>.txt` and the parser in `src/services/medicalParser.ts`. Read the "Medical parser" and "Dictation test loop" sections of CLAUDE.md first.

Arguments: an optional name filter (e.g. `standard-2026-10-04`) limits the run to matching recordings/transcripts.

## 1. Transcribe and check

```
npm run eval:dictation -- <filter>
```

- New audio in `dictation/recordings/` (`<script>-<anything>.m4a|wav|webm|ogg|mp3`) is transcribed with the app's own audio conversion (Chromium, in a hidden Electron window) + whisper and cached in `dictation/transcripts/<name>.txt`. Whisper takes ~10–60 s per minute of audio; do not interrupt it.
- A recording whose name does not start with a script name is skipped with a warning — tell the user how to rename it.
- Exit code 1 just means there are fields to fix.
- `--json` gives the same data machine-readable; `--all` also lists passing rows.

Statuses: `OK`; `OK*` (right value, or offered as a choice, but flagged with a warning under the field that the doctor must resolve — dictated several times / ambiguous / hedged / unit mismatch; acceptable, but mention it); `WRONG` (detail names the field whose value it took, if any); `MISPLACED` (the expected value went to another field); `MISSING` (with the transcript excerpt where the label should be).

Record the starting score per transcript for the final report.

## 2. Fix each failure — narrowest change first

Work from the excerpt. Typical causes and fixes, in order of preference:

1. **Whisper spelled one label differently** ("crossie", "SIF", "Taps") → add an alias to that field's definition in `NUMERIC_FIELDS` / `QUALITATIVE_FIELDS`, written in normalized form (lowercase, no diacritics, `ș/ț` → `s/t`). Add the obvious sibling forms (with/without the article: "diametru"/"diametrul").
2. **A misspelling that recurs across many labels** ("ase" for "as", "vese" for "vse") → one rule in `TYPO_REPLACEMENTS` / `ABBREVIATION_REPLACEMENTS`, only if the misspelled form is not a real Romanian word; a length-changing rule must keep `rawIndex` aligned (see `normalizeWithIndex`).
3. **Section heading not recognized** (Doppler values missing or misplaced as a block) → add to `CONTEXT_ALIASES`.
4. **Number or unit not understood** (number words, decimal phrasing, a new unit wording) → `romanianNumberParser.ts` / `unitNormalizer.ts`.
5. **`MISPLACED`/`WRONG` with "got the value of …"** → usually the next label was not recognized, so its number leaked into this field's window: fix the *next* field's alias (cause 1), not this one.

Never fix by loosening generic matching (bare short aliases like "e", "a", "s", wider windows) unless the user agrees — those cause misplaced values in other dictations. Do not edit the transcript or the expected values to make a check pass; transcripts are real whisper output. The reading script itself changes only if the user asks.

After each batch of fixes re-run `npm run eval:dictation -- <filter>` until the transcript passes.

If a value is truly unrecoverable (whisper dropped the number entirely, or produced nonsense with no stable pattern), add it to `dictation/known-issues.json` as `{ "<transcript name>": { "<field key>": "<short reason>" } }` — and say so explicitly in the report. The lock test fails if a known issue starts passing, so remove entries when they get fixed.

## 3. Verify

```
npm run test:parser
npm run lint
```

`test:parser` includes `tests/dictation.test.mjs`, which locks every committed transcript and checks the perfect-text baseline of every script, so a fix that breaks an older recording shows up here. All must pass. The new transcript in `dictation/transcripts/` is meant to be committed; the audio in `dictation/recordings/` is git-ignored and stays local.

## 4. Report to the user

Keep it short:
- per transcript: score before → after (e.g. `standard-2026-10-04: 54/66 → 66/66`);
- each fix as "what whisper wrote → what was added" (alias / rule / file);
- anything left `OK*` or in `known-issues.json`, and why;
- reminder to rebuild (`npm run build` / `npm run package:portable`) before testing in the app.
