# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Raport Eco: an offline Windows desktop app (Electron + React 19 + TypeScript + Vite) for dictating and producing echocardiography reports in Romanian. Audio is transcribed locally with whisper.cpp; nothing leaves the machine. UI strings, dictation aliases, and much domain vocabulary are Romanian.

## Commands

```
npm run dev                # compile electron/ then start Vite + native window (scripts/dev.mjs)
npm run dev:vite           # renderer only in a browser (no Electron bridge)
npm run build              # tsc -b, compile electron/, vite build
npm run lint               # eslint .
npm run test:parser        # compile pure TS modules to dist-parser-tests/ and run all tests/*.test.mjs
npm run test:pipeline      # real ffmpeg+whisper end-to-end; needs `npm run build` first and ECHOREPORT_TEST_AUDIO set to a non-patient fixture
npm run package:portable   # release/Raport-Eco-Portable.exe (client handoff)
npm run package:installer  # NSIS installer in release/
```

Run a single parser test: `npx tsc -p tsconfig.parser.json && node --test --test-name-pattern "<test name substring>" tests/medicalParser.test.mjs`

Tests import the compiled JS from `dist-parser-tests/` (not the `.ts` sources), so always recompile via `tsconfig.parser.json` before running. `dist-parser-tests/` is committed to git — it changes whenever the parser sources change. Pure (React/DOM-free) modules under test — parser, `reportState.ts`, `measurementFields.ts`, `measurementUnits.ts`, `utils/bmi.ts`, `utils/derivedMeasurements.ts` — are listed in `tsconfig.parser.json` `include`; a new import from them must be added there too, and these modules must use `.js` extensions on relative imports (nodenext).

## Runtime dependencies (not in git)

`app/bin/ffmpeg.exe`, `app/bin/whisper-cli.exe` (+ its DLLs), and `app/models/ggml-large-v3-turbo.bin`. Path resolution in `electron/config.cts`: env vars `ECHOREPORT_FFMPEG` / `ECHOREPORT_WHISPER_CLI` / `ECHOREPORT_MODEL` / `ECHOREPORT_TEMP_DIR` > `echoReport.paths.json` (ignored; copy from `.example`) > default `app/` layout. When packaged, `app/` is shipped as an extraResource and resolved from `process.resourcesPath`.

## Architecture

**Electron process (`electron/*.cts`)** — compiled to CommonJS `.cjs` in `dist-electron/` via `tsconfig.electron.json` (the sandboxed preload requires CJS; imports between these files use `.cjs` extensions).
- `main.cts`: creates the BrowserWindow (contextIsolation, sandbox, no nodeIntegration) and registers fixed IPC handlers.
- `preload.cts`: the only renderer bridge — exposes exactly `getPipelineStatus()`, `transcribeAudio(bytes, mimeType)`, `exportPdf(suggestedName)`. Keep it narrow; never expose fs, shell, child_process, or a generic command channel. Types for this bridge live in `src/types/electron.d.ts`, wrapped by `src/services/electronBridge.ts`.
- `transcription.cts`: writes audio to a `%TEMP%/echoreport-*` dir, ffmpeg → 16 kHz mono PCM WAV, then `whisper-cli -l ro`, deletes the dir in `finally`. Returns safe error codes (types in `shared.cts` / `src/types/audioPipeline.ts`), never raw stacks.
- `pdf.cts`: `echo-report:export-pdf` waits for `#printable-report`, shows Save As, uses `webContents.printToPDF()` A4 portrait. Elements with `.no-print` are hidden in print.

**Renderer data flow (`src/`)**
1. `DictationPanel` records via MediaRecorder → `transcriptionService` → IPC → transcript text (editable).
2. `parseEchoTranscript()` in `src/services/medicalParser.ts` turns the Romanian transcript into `ParsedEchoData` (numeric/qualitative measurements with confidence, conclusions, patient info).
3. `App.tsx` keeps the latest parse in `pendingParse`; `services/reportState.ts` (pure, unit-tested) builds the review list with derived ratios (`utils/derivedMeasurements.ts`: E/A, E'/A', E/E') and merges approved items. `MeasurementReview` lets the user accept items before they reach the `EchoReport` state. The callbacks passed to `DictationPanel` must stay referentially stable — the panel reports a parse whenever its effect deps change, so an unstable callback re-opens the review panel. Only patient fields that changed between parses are pushed (`changedPatientFields`). "Șterge formularul" remounts `DictationPanel` via `key` to drop the previous patient's transcript.
4. Form components edit the report; `ReportPreviewPage`/`ReportPreview` render the printable report used for PDF export.

`src/types/echoReport.ts` defines `EchoReport` / `Measurements` (all values are strings; keys are the `MeasurementKey` union used everywhere). `src/config/measurementFields.ts` is the single registry of every measurement's form section, label, unit, report label, and review label; the forms (`MeasurementGroup`), report rows, review labels, derived-key list, and `MEASUREMENT_UNITS` are all generated from it (a test asserts it covers every key once). Adding a measurement means touching the type, the registry, the parser's alias definitions, and placing a `<Field k=…>` in the report layout (`ReportPreview.tsx`, which keeps its hand-built print layout).

The register number ("Nr. curent") is consumed only by a successful PDF export, which stores exported+1 in localStorage (`ecocard-next-current-number`); the next number appears when a new report is started. The clinic header (name, address) printed on the report is edited via "⚙ Setări" (`SettingsDialog`) and stored in localStorage (`ecocard-clinic-settings`, parsed by the pure `src/config/clinicSettings.ts`). It starts empty — the app ships to several doctors, so never hard-code a clinic's name or address. `src/dev/testReport.ts` is a dev-only fixture behind an `import.meta.env.DEV` button.

## Medical parser (`src/services/medicalParser.ts`)

The core and most-edited logic. Key mechanics:
- Text is normalized (lowercase `ro-RO`, diacritics stripped, ș/ț → s/t, whitespace/hyphens collapsed, decimal commas → dots, abbreviation fixes like `V.S.` → `vs`, and known Whisper mis-transcription fixes) while `normalizeWithIndex` keeps a `rawIndex` map back to the original transcript. Rewrite rules live once in `ABBREVIATION_REPLACEMENTS` / `TYPO_REPLACEMENTS`; `normalize()` is just `normalizeWithIndex().text`, and a length-changing typo rule needs explicit index mapping there. **Aliases must therefore be written in normalized form** (lowercase, no diacritics).
- `NUMERIC_FIELDS` / `QUALITATIVE_FIELDS` are alias tables per `MeasurementKey`. Whisper variants (split words, typos like "telediastoric") are handled by adding aliases or a normalization step.
- Matching: at each position the longest alias wins; aliases starting inside an already-consumed span are skipped. Section headings (`CONTEXT_ALIASES`, e.g. aortic/LVOT/mitral flow) set an active `FlowContext` that disambiguates shared aliases like "vmax"; `context` / `excludeContexts` on a field def control this.
- The value window runs from the alias end to the next match; numbers come from `romanianNumberParser.ts` (spoken Romanian numerals, "virgulă" decimals) and units from `unitNormalizer.ts`. A spoken unit that differs from the field's unit in `MEASUREMENT_UNITS` is converted (mm↔cm, mm/s and m/s→cm/s, `convertedFrom`) or flagged `unitMismatch` (review row starts unchecked). Commas don't end a window, so a misheard label lets its number leak into the previous field; a window with several numbers proposes the first one as `ambiguousValue` (low confidence, unchecked in review) rather than dropping the field.
- Text after "concluzii" is extracted as conclusions and excluded from measurement parsing; patient name/age/weight/height are pulled by label regexes.

When fixing a parser bug, add a regression test in `tests/medicalParser.test.mjs` using a realistic Whisper-style transcript.

## Dictation test loop (`dictation/`)

- `dictation/scripts/<name>.txt` is a text the doctor reads aloud; `<name>.expected.json` holds its expected patient data, every dictated measurement (all numeric values unique, so misplaced values are identifiable) and conclusions. Derived ratios are computed, not listed. `"scope": "numeric"` marks a labels-and-numbers-only script (e.g. `numeric`) that covers just the measurements with a unit.
- Recordings go in `dictation/recordings/<script>-<anything>.m4a|wav|webm|ogg|mp3` (git-ignored, stays local). `npm run eval:dictation [-- <filter>] [--retranscribe] [--all] [--json]` transcribes new recordings with the app's own ffmpeg + whisper into `dictation/transcripts/<name>.txt` (committed, cached), then reports per field `OK` / `OK*` (right value, review row unchecked) / `WRONG` / `MISPLACED` / `MISSING` with transcript excerpts. Logic lives in `scripts/dictation-check.mjs`.
- `tests/dictation.test.mjs` (part of `test:parser`) requires each script's text to parse perfectly and every committed transcript to keep passing, except entries in `dictation/known-issues.json` (unrecoverable whisper output, with a reason).
- `/fix-dictation` (`.claude/skills/fix-dictation/SKILL.md`) is the procedure for turning a new recording's failures into parser fixes. Never edit transcripts or expected values to make a check pass.
