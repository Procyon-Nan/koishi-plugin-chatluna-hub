# Tests

Runner: Node's built-in `node:test`, executing TypeScript sources directly
through Node's built-in type transform. No test framework, no bundler, no extra
dependency.

```bash
npm test
```

Requires Node >= 22.18 (type stripping on by default); developed on Node 24.15.
The script uses `--experimental-transform-types` rather than `--strip-types`
because the sources use parameter properties (`constructor(private readonly x)`),
which plain stripping cannot erase.

## Layout

All test files live in this directory (they are not published: `files` in
`package.json` does not list `test`).

```
test/
  register-hooks.mjs             # --import entry, registers the resolver hook
  resolve-extensionless.mjs      # maps './foo' -> './foo.ts'
  smoke.test.ts                  # proves the runner works; keep it (1 case)
  preset-serialize.test.ts       # client preset parse/serialize
  draft-list-hints.test.ts       # client draft list-row hints
  field-guard-logic.test.ts      # guarded field readers and bounded previews
  preset-generate-tools.test.ts  # server draft-ingestion guards
  prompt-template.test.ts        # completion catalog consistency
  preset-write-rollback.test.ts  # server write-then-reload rollback
```

Only files matching `test/**/*.test.ts` are picked up.

## What each file covers

### `preset-serialize.test.ts`

Covers `client/modules/core/preset-island/lib/serialize.ts` together with the
factories in `preset-types.ts`. This is the regression suite for the "editing a
preset in the form silently corrupts the file" class of bug, so every case is a
property of the `parse → edit → serialize → parse` path a save performs:

- all six roles ChatLuna accepts (`system/user/assistant/ai/model/human`, see
  upstream `llm-core/prompt/preset_prompt_parse.ts`) are kept verbatim instead
  of collapsing to `system`;
- a LangChain `MessageContentComplex[]` content survives instead of becoming `''`;
- the global `world_lores` config element (upstream `isRoleBookConfig`, i.e. any
  element lacking both `keywords` and `content`) is not turned into a junk entry,
  while a real entry is still normalized;
- numeric scalars (`version: 1.0`, `bot_id: 3345618715`) keep both their value
  and their number type;
- unknown top-level keys and unknown keys on a prompt element survive;
- **the normalizer deletes nothing.** A known key holding an unexpected value
  keeps it whatever its shape — a scalar where an object was declared, an object
  where text was declared, an array element that is not a scalar. Trimming a
  value to fit the form is the components' job, through the `isRenderable*`
  guards in `preset-types.ts`. Three describes hold this together and are meant
  to be read as one boundary:
  - *shapes the normalizer cannot express are kept verbatim* — the guard fails,
    the original value passes through, and a malformed document round-trips byte
    for byte (one core case, one character case);
  - *conversions the normalizer is still expected to make* — `keywords: a,b` →
    `['a','b']`, a lone scalar → one item, an empty key → `[]`, `name: 123` →
    `'123'`. These are the rewrites the form depends on, so widening the fidelity
    rules must not swallow them;
  - *an array with a non-scalar element is kept whole* — `String({a:1})` yields
    `'[object Object]'`, a rewrite no later layer can undo and one that reads as
    real data in a diff, so a single non-scalar element preserves the entire
    array; an all-scalar array is still coerced, and a `null` element still
    counts as "no value". `keywords`, `nick_name` and `mute_keyword` share the
    conversion and are all covered;
- empty input yields the empty preset, never the `new-preset` placeholder draft;
- `parse(serialize(parse(x)))` deep-equals `parse(x)`, and re-serializing
  reproduces byte-identical YAML;
- input using anchors/aliases dumps without emitting `&ref_`/`*ref_`, and
  re-parsing gives independent copies rather than shared references.

### `draft-list-hints.test.ts`

Covers the sidebar row an open draft renders: `draftAsListItem` in
`client/modules/core/preset-island/lib/draft-store.ts`, which reads its hints
from the parsed structure and falls back to the regex scraper in `yaml.ts` only
for a document that failed to parse. Cases drive the public
`createDraftSession` → `draftAsListItem` path because `structuredListHints` is
module-private.

- keyword hints resolve every YAML shape, not only the block sequence the
  scraper could see: a scalar, an inline array, a comma-separated scalar, and
  the block list itself;
- a preserved malformed shape does not break the row: a mapping yields no
  keywords instead of throwing, and a non-text element is skipped while its
  siblings are still listed;
- `promptCount` for a core preset is the length of the parsed `prompts` array,
  and `0` when that key holds a malformed value;
- a character row is labelled with the name, and a mapping name yields no label
  rather than the `'a: 1'` fragment the scraper used to produce;
- `promptCount` for a character preset counts sections **with content**:
  parsing always writes `input` / `system`, so counting key presence would put
  every character preset at 2 before the user typed anything (name + input is 1;
  four section keys with three filled is 3);
- the fallback: a broken document still shows scraped hints. One case pins the
  scraper's blind spot (a scalar `keywords` resolves through the structure but is
  invisible to the regex) — an empty list there is what proves the fallback
  branch ran, and it records the cost that makes it the fallback.

### `field-guard-logic.test.ts`

Covers the pure readers and bounded preview logic used by the React field
guards. Component behavior stays in `.tsx`, while shape acceptance, cycle
handling, and early preview truncation remain testable by Node.

### `preset-generate-tools.test.ts`

Covers the draft-ingestion guards in `src/webui/core/preset-generate-tools.ts`.
`MAX_RAW_TEXT_LENGTH` / `MAX_DRAFT_NODES` / `MAX_DRAFT_DEPTH` and
`assertDraftWithinLimits` are module-private, so every case drives them through
the public `createDraftBuffer`, which is the path a real request takes.

Why the node cap exists: `load()` keeps a YAML alias as a shared reference, so
parsing is cheap, but `serializeDraftBuffer` dumps with `noRefs: true`, which
materializes every reference. Expansion is exponential in alias *depth* while the
text grows only linearly with it, so a byte cap alone cannot bound the output —
a sub-kilobyte document encodes ~10^9 nodes.

- byte cap: one character over is rejected, exactly at the cap is accepted;
- alias bombs (10^7 and ~10^9 expanded nodes, both under 1 KB) are rejected, and
  a companion case shows js-yaml itself accepts them, so the guard — not the
  parser — is what stops them;
- the node cap is also reachable without any alias (a wide plain sequence);
- depth cap: 70 levels rejected, 60 levels accepted;
- **not over-rejecting**: realistic core and character presets pass, as does a
  ~130 KB preset with 300 lore entries;
- `serializeDraftBuffer` emits no aliases for shared references;
- `limitText` truncation behaviour.

> The bombs are never expanded by the test — only `createDraftBuffer` is called,
> and it throws. If the guard is ever removed, the moderate (10^7) case fails
> cleanly on the missing throw; the ~10^9 case would then be slow or exhaust
> memory, which is the intended loud failure rather than a silent pass.

### `prompt-template.test.ts`

Covers the hand-maintained completion catalog in
`client/modules/core/preset-island/lib/prompt-template.ts` with table
self-consistency guards:

- no context offers a duplicate `label`; a label declared by several entries
  must have non-overlapping `contexts` sets;
- every entry has a label/detail and an allowed `type`; keyword entries carry a
  snippet; variable and function labels are valid identifiers;
- every `contexts` value is a known context, and every known context is used by
  at least one entry;
- snippets have complete `${...}` placeholder syntax and balanced
  braces/parentheses/quotes once inserted after the `{` the user typed;
- **cross-check against the analyzer in the same module**: every offered
  variable/function label analyzes as a known `expression`, and every snippet
  analyzes without an `error` range;
- the ten providers ChatLuna registers in
  `packages/core/src/services/prompt_renderer.ts` (`date`, `isodate`, `isotime`,
  `pick`, `random`, `roll`, `timeDiff`, `time_UTC`, `url`, `weekday`) are pinned
  and asserted present in every context.

### `preset-write-rollback.test.ts`

Covers the write-then-reload contract of `src/webui/core/presets.ts`: after any
preset write the ChatLuna runtime is reloaded, and a failed reload must undo the
write. `reloadPresetSourceAfterWrite` is module-private, so every case drives it
through `createChatLunaCorePreset` / `updateChatLunaCorePreset`, the path a real
request takes.

The only stub is a ctx exposing four ChatLuna preset methods
(`resolvePresetDir` / `getAllPreset` / `getPreset` / `loadAllPreset`); writes go
to a real `mkdtemp` directory, so "was the write undone?" is asserted on the
bytes on disk rather than on a spy. That is deliberate: the rollback callback is
created *inside* the production function and cannot be injected, and the disk
state is what the feature actually promises. `loadAllPreset` is scripted per
call, which is the only lever needed — every branch is selected by which reload
throws. A core update reloads twice on the happy path (a pre-check before the
write, then the after-write reload) and a third time only after a successful
rollback, so the call count is itself an assertion.

The four branches, in the order they appear in the source:

- reload succeeds → the rollback never runs (the file still holds the new
  bytes) and there is no third reload;
- reload fails, rollback succeeds, second reload succeeds → throws
  `预设文件变更已回滚，运行时刷新失败：<原因>` carrying the *original* reason,
  and the file is back to its previous bytes;
- **reload fails and the rollback itself fails → the original error is
  rethrown**, not the rollback's. Asserted by reference equality against the
  error the stub threw. "Throw the last error" reads as harmless cleanup but
  would replace an actionable reload reason with an EISDIR/EACCES from the
  restore attempt and hide that the file is now in an unknown state. The
  rollback is made to fail by turning the preset file into a directory — the
  only way to break it from outside, since the callback is not injectable;
- reload fails, rollback succeeds, second reload fails → the second failure is
  swallowed and the rollback message still carries the first reason.

Plus the surrounding write path: create returns the detail and leaves the file
in the resolved directory; a failed reload deletes the newly created file; an
existing filename and an invalid preset are both rejected *before* any write or
reload (asserted by a zero reload count and an untouched directory); a
traversing id (`core:../escape.yml`) is rejected; and, with neither service
running, the directories fall back to `data/chathub/presets` and
`data/chathub/character/presets` under `ctx.baseDir`.

> Each branch was verified by mutation: rethrowing the rollback error fails only
> the third case, propagating the second reload failure fails only the fourth,
> skipping the rollback fails four cases, and running the rollback
> unconditionally fails the happy-path cases.

## Running one file

`--test` accepts paths, so a single file needs the same flags without the glob:

```bash
node --experimental-transform-types --disable-warning=ExperimentalWarning \
  --import ./test/register-hooks.mjs --test test/preset-serialize.test.ts
```

Filter by name within a file with `--test-name-pattern`:

```bash
node --experimental-transform-types --disable-warning=ExperimentalWarning \
  --import ./test/register-hooks.mjs --test test/prompt-template.test.ts \
  --test-name-pattern "upstream"
```

## Writing a case

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parsePresetYaml } from '../client/modules/core/preset-island/lib/serialize.ts'

test('parses a minimal preset', () => {
    assert.deepEqual(parsePresetYaml('keywords: [x]\n', 'core').ok, true)
})
```

Conventions:

- **Import the module under test with an explicit `.ts` extension** and a
  relative path from `test/`. Node's ESM resolver needs the extension; the
  `.ts` file itself is executed directly, nothing is compiled to `lib/` first.
- Extensionless imports *inside* the source files (`from '../shared'`) are
  resolved by `resolve-extensionless.mjs`, so the sources need no changes.
- Use `import type { … }` for type-only imports. A value import of an erased
  type fails at runtime.
- Both sides of the codebase work the same way: `src/**` (server) and
  `client/**` (client) are plain ESM + TypeScript to Node. Third-party
  dependencies (`js-yaml`, `zod`, `@langchain/core/tools`, …) resolve normally.
- **Do not assert a factory against itself.** `assert.deepEqual(parse(''),
  emptyCorePreset())` holds for whatever `emptyCorePreset` happens to return;
  assert the literal shape too, or the case cannot catch a regression in the
  factory.
- `node:test` runs each file in its own process, so module-level state does not
  leak between files.

Verified to load unmodified: `client/modules/core/preset-island/lib/serialize.ts`,
`client/modules/core/preset-island/lib/draft-store.ts`,
`client/modules/core/preset-island/lib/prompt-template.ts`,
`src/webui/core/preset-generate-tools.ts` (its `@langchain/core/tools`, `js-yaml`
and `zod` imports all resolve under the test runner).

## Limits

- **`.tsx` cannot be tested.** Node's transform does not handle JSX, so
  components under `client/modules/**/components/` are out of reach; test the
  `lib/` modules they call instead.
- `.vue` files cannot be imported either.
- Test files are executed, not type-checked. `npm run typecheck:client` covers
  `client/`, `npx tsc -b` covers `src/`; neither includes `test/`.
- `TemplateEditorContext` members are pinned by hand in `prompt-template.test.ts`
  because types are erased at runtime. Adding a member to the union alone will
  not fail a case; adding one that any definition references will.
- The catalog cases can only see definitions reachable through
  `getTemplateDefinitions`, so an entry whose `contexts` list is *entirely*
  bogus is invisible to them; a partially mistyped list is caught.
