# Agent Instructions for ChatLuna Hub

This file applies only to the standalone `chatluna-hub` repository.
Treat current source code in this repository as the source of truth. Older
design notes for this project are stale unless they are confirmed against
`src/` and `client/`.

## Working Rules

- Keep changes scoped to this repository unless the user explicitly asks to edit
  a sibling ChatLuna ecosystem plugin.
- Read current source before changing behavior. The Hub has moved through
  several integration strategies, and old assumptions are likely wrong.
- Prefer CodeGraph first when `.codegraph/` exists, then verify against current
  files when needed.
- Prefer parallel reads for independent files and command outputs.
- Use `apply_patch` for manual edits.
- Do not register additional Koishi sidebar pages for ecosystem plugins from
  this repository.
- Do not remove or rewrite external plugin routes. Hub sidebar unification is
  done by hiding duplicate sidebar activities on the client side.
- Prefer current `src/` and `client/` files over generated `lib/` or `dist/`.
  Inspect generated output only for build or runtime loading debugging.

## Repository Identity

- Package name: `koishi-plugin-chatluna-hub`
- Koishi plugin export name: `chatluna-hub`
- Koishi service: `chatluna_hub`
- Console DataService: `chatluna_hub_webui`
- Hub route: `/chatluna`
- Hub sidebar entry: `ChatLuna Hub`
- Hub RPC namespace: `chatluna-hub/*`

## Commands

Build from the monorepo root, not from inside the package:

```powershell
cd C:\Users\31899\dev\koishi-dev
yarn build chatluna-hub
```

`yakumo.yml` declares the `build` pipeline as `tsc` -> `esbuild` -> `client`,
and `yarn build <name>` resolves `<name>` against workspace folders, so
`chatluna-hub` matches `external/chatluna-hub`.

Run these inside the package:

- Tests: `yarn test`
- Client type check: `yarn typecheck:client`
- Server type check: `npx tsc -b`
- Lint: `yarn lint`
- Auto-fix lint: `yarn lint-fix`
- Whitespace check: `git diff --check`

The package also owns build scripts used by the publish path: `build:server`
(writes `lib/`), `build:client` (writes `dist/`), `build`, `clean`, and
`prepack`. They are not read-only checks.

Both build paths produce the same client bundle. They call
`@koishijs/client`'s `build()` with the package root, so Vite discovers the root
`vite.config.cjs`. See `Build Output and Packaging`.

The package has ESLint and Prettier config at `.eslintrc.yml` and `.prettierrc`.
Koishi module augmentation uses `namespace Console`; the
`@typescript-eslint/no-namespace` rule is intentionally disabled.

`yarn lint` checks `src --ext=ts` only, and this is a known gate gap, not a
statement that `client/` is clean. Running ESLint over `client/` today reports
findings nothing in CI or in the scripts would catch: mostly `prettier/prettier`
at **error** severity, plus a few `no-void` and `prefer-const` errors and
`sort-imports` / `@typescript-eslint/naming-convention` warnings. Two
consequences:

- Do not treat "lint passes" as evidence that a change under `client/` is
  formatted correctly. It was never checked.
- Do not widen the `lint` script or run `lint-fix` over `client/` as a drive-by
  step. It turns any unrelated task into a large formatting diff across the
  React island and the Vue pages. Fix findings in the files you are already
  editing, or widen the gate deliberately as its own change.

`yarn typecheck:client` is what covers `client/`; `test/` is neither linted nor
type-checked. It is the client gate and its exit code is authoritative: the bar is
**exit 0 with zero errors in repository sources**, and that bar is currently met.
See `Client Type Check` for why the exit code is trustworthy despite the vendor
diagnostics.

Invoke ESLint through the monorepo's own copy. The `.bin` shim throws a
`SyntaxError` in this checkout:

```powershell
cd C:\Users\31899\dev\koishi-dev
node node_modules\eslint\bin\eslint.js external\chatluna-hub\client
```

## Current Product Shape

ChatLuna Hub has these current surfaces:

- A relationship graph home page at `/chatluna`.
- A ChatLuna Core management page rendered inside Hub after clicking the
  `ChatLuna` main node.
- Route-jump integration for ecosystem plugins that already provide WebUI
  pages.
- Config-entry integration for ecosystem plugins that do not have Hub-owned
  pages but can be opened through their Koishi plugin config page.

Ecosystem WebUI plugins are not embedded in the Hub shell now. Clicking an
available WebUI ecosystem node sends the user to the plugin's original WebUI
route, and a global return card sends the user back to `/chatluna?home=1`.

## Module Model

The module model is defined and mirrored in these files:

- `src/webui/modules.ts`: server-side module definitions, runtime state, route
  generation, and toggle eligibility. It delegates package resolution to
  `src/webui/package-resolver.ts` and loader config matching to
  `src/webui/loader.ts`.
- `client/types.ts`: client-side mirror of the Hub module DTO used by the
  relationship graph and shell.
- `client/module-catalog.ts`: static frontend fallback modules and detail-card
  copy.

`fallbackModules` is built by mapping an intermediate constant that carries its
own `FallbackModuleDefinition[]` annotation, and the indirection is required, not
stylistic. Annotating only the `.map()` result does not flow a contextual type
back into the array literal that feeds it, so each `id: 'chatluna'` widens to
`string` and the elements stop satisfying `HubModuleId`. Keeping the annotated
constant gives the literal its contextual type, which also means every entry is
checked against `HubModuleId` at its declaration site instead of at the far end of
the pipeline. When adding a fallback module, add it to the annotated definition
array; do not inline the literal back into the `.map()` call.

Current module ids:

```ts
type HubModuleId =
    | 'chatluna'
    | 'agent'
    | 'livingMemory'
    | 'mediaLuna'
    | 'memesLuna'
    | 'character'
    | 'multimodalService'
    | 'usage'
    | 'groupAnalysis'
    | 'affinity'
    | 'searchService'
    | 'forwardMsg'
    | 'llmWebSearch'
    | 'longMemory'
    | 'pluginCommon'
    | 'vectorStoreService'
    | 'storageService'
    | 'toolbox'
```

Each module carries `installed`, `configured`, `available`, `configStatus`,
`entryType`, `group`, `ring`, and `toggleable`, plus the optional
`pluginName`, `configPath`, `configRoutePath`, `routePath`, `activityId`,
`marketPackageName`, and `reason`.

- `installed` means the corresponding package can be resolved from Koishi /
  loader roots.
- `configured` means a matching plugin config entry exists in the Koishi loader
  config.
- `available` means the runtime plugin scope is running.
- `configStatus` distinguishes `none`, `missing-package`, `not-configured`,
  `single`, and `multiple`.
- Graph status text should show uninstalled modules as `未安装`, unconfigured
  modules as `未配置`, and multiple matches as `多配置`.
- Do not enable or disable a module unless `canToggleHubModule()` permits it.
  The current rule requires `toggleable`, `installed`, and
  `configStatus === 'single'`.

`client/module-access.ts` is the single home for every "may the user do this to
this node" predicate, and both the graph and the shell import from it:

- `canOpenHubModule` — open the module's own page or route.
- `canOpenHubModuleMarket` — uninstalled ecosystem module; jump to `/market`
  with `marketPackageName` as the keyword.
- `canOpenHubModuleConfig` — open an existing Koishi plugin config page.
- `canCreateHubModuleConfig` — installed but `not-configured`; create the loader
  entry, then open it.
- `canToggleHubModule` — enable/disable the configured plugin.
- `isHubModuleDisabled` / `isHubModuleStatusActive` — visual state only.

Do not inline these conditions into components. The rules differ per
`entryType` and `group`, and duplicating them is how the graph and the shell
start disagreeing about whether a node is clickable.

The graph's ecosystem total is computed from the current module list in
`client/components/home/hub-relationship-graph.vue`; there is no manual total
constant to maintain.

## Ecosystem Route Integration

WebUI route paths are defined in `src/webui/modules.ts` and mirrored in
`client/module-catalog.ts` fallback metadata:

- `agent` -> `/chatluna-agent`
- `livingMemory` -> `/chatluna-livingmemory`
- `mediaLuna` -> `/media-luna`
- `memesLuna` -> `/memesluna/`
- `affinity` -> `/chatluna-affinity/dashboard`

`client/components/layout/hub-shell.vue` opens `target.routePath`; it should not
carry a separate route map.

Config-entry ecosystem modules generate route paths server-side as
`/plugins/${configPath}` when exactly one matching Koishi plugin config entry is
found. Multiple matches must stay non-openable and surface the ambiguous state.

The global return card is
`client/components/layout/ecosystem-route-return-card.vue`. It is registered as
a global slot in `client/index.ts` and currently appears on ecosystem routes.
Its text is `返回ChatLuna Hub 首页`.

The ecosystem sidebar entries are hidden in `client/index.ts` through the
Koishi console `activity` bail hook. Current hidden ids/paths include:

- `chatluna-agent` / `/chatluna-agent`
- `chatluna-livingmemory` / `/chatluna-livingmemory`
- `media-luna` / `/media-luna`
- `memesluna` / `/memesluna` and `/memesluna/`
- `chatluna-affinity-dashboard` / `/chatluna-affinity/dashboard`

Do not hide Hub's own `/chatluna` activity.

The predicate must return an explicit `false` on its fall-through path, and doing
so is safe rather than a hazard. `activity` is a bail hook, but Cordis treats
`false` as a non-bail value exactly like `undefined`: `isBailed` in
`@cordisjs/core` is `value !== null && value !== false && value !== void 0`, so
`false`, `null`, and `undefined` all let the listener chain continue, and only a
truthy return stops it and hides the activity. Returning `false` therefore cannot
pre-empt another plugin's hook. `@koishijs/client` relies on the same semantics
itself, registering `root.on('activity', data => !data)` in its own entry.

So an explicit `return false` is the correct way to satisfy the predicate's
declared return type, and it is behaviorally identical to falling off the end of
the function. Do not "restore" the implicit return to avoid an imagined bail, and
do not return `undefined` to be safe — the type is what breaks, not the runtime.

## Optional Dependency Graph Hiding

The plugin config has:

```ts
hideDependencyGraphEntry?: boolean
```

Default is `false`. When enabled, `client/index.ts` hides the Koishi Insight
dependency graph sidebar activity:

- id: `graph`
- path: `/graph`

This only hides the sidebar entry. It must not remove the `/graph` route.

## Home Graph Animations

The plugin config has:

```ts
enableHomeGraphAnimations?: boolean
```

Default is `true`. When disabled, the home relationship graph stops autonomous
orbit motion, edge flow, node floating, and glow pulse animations. Static
edges and user-driven interactions such as dragging, zooming, selecting nodes,
adjusting the effective range, and toggling configured plugins remain enabled.

Treat a missing client config field as enabled so older or loading Console data
preserves the default behavior. Do not stop the graph runtime solely because
animations are disabled; it also owns resize and KeepAlive lifecycle behavior.

## ChatLuna Core Page

The Core page lives under `client/modules/core/`.

- `page.vue` owns the local tab state.
- `sidebar.vue` provides the right-side floating tab switcher.
- Current tabs are `conversation`, `model`, `preset`, and `log`.
- Shared client RPC wrappers live in `client/modules/core/api.ts`.
- Shared client types live in `client/modules/core/types.ts`, which re-exports
  server DTO types from `koishi-plugin-chatluna-hub`.
- Compact/wide display state is shared and persisted by
  `client/modules/core/use-compact-mode.ts`.
- Shared client helpers: `client/modules/core/format.ts`,
  `use-error-toast.ts`, `use-highlight.ts`, and the shared components under
  `client/modules/core/components/`.

The default display mode is compact mode. The localStorage key is
`chatluna-hub-core-compact-mode`.

The `conversation`, `model`, and `log` tabs are Vue and follow the conventions
above: they consume `api.ts` and `use-compact-mode.ts`. The `preset` tab does
not; it is a React island with its own RPC layer and its own layout, so it
shares neither (see `Core Preset Page`).

`page.vue` wraps every tab in `KeepAlive`, so switching tabs deactivates a tab
instead of unmounting it. The preset island's React root therefore survives a
tab switch, and so does any in-flight preset generation.

## Core Conversation Page

Files:

- `client/modules/core/pages/conversation-page.vue`
- `client/modules/core/pages/conversation-routes.ts`
- `client/modules/core/pages/use-conversation-routes-data.ts`
- `src/webui/core/conversations.ts`
- `src/webui/core/conversation-routes.ts`

This page manages ChatLuna conversations through Hub-owned RPC:

- `chatluna-hub/core/conversations/list`
- `chatluna-hub/core/conversations/routes`
- `chatluna-hub/core/conversations/options`
- `chatluna-hub/core/conversations/update-usage`
- `chatluna-hub/core/conversations/batch-update-usage`
- `chatluna-hub/core/conversations/delete`
- `chatluna-hub/core/conversations/batch-delete`

The implementation reads ChatLuna conversation/binding tables and uses
`ctx.chatluna.conversation` for mutation/cache cleanup. It must not depend on
Living Memory being installed.

## Core Model Page

Files:

- `client/modules/core/pages/model-page.vue`
- `client/modules/core/pages/model/use-model-catalogue.ts`
- `client/modules/core/pages/model/use-adapters.ts`
- `client/modules/core/pages/model/AdapterEditorDialog.vue`
- `client/modules/core/pages/model/AdapterTypePickerDialog.vue`
- `src/webui/core/models.ts`
- `src/webui/adapters.ts`
- `src/webui/adapters/*`

The server RPC namespace includes:

- `chatluna-hub/core/models/list`
- `chatluna-hub/core/adapters/list`
- `chatluna-hub/core/adapters/save`
- `chatluna-hub/core/adapters/toggle`
- `chatluna-hub/core/adapters/delete`

Model listing reads `ctx.get('chatluna')?.platform?.listAllModels(0)?.value`,
normalizes model name, platform, type, max tokens, and capabilities, then
returns summary counts and platform filters.

Model type coercion currently recognizes:

- `1` / `llm`
- `2` / `embedding` / `embeddings`
- `3` / `reranker` / `rerank`

Model capabilities are displayed as adapter-reported metadata. Do not infer or
rewrite capabilities client-side unless the server contract changes.

Adapter management reads and mutates Koishi loader config. Mutations must guard
loader writability and package install state server-side, not only in the UI.
Unavailable adapter instances should remain visible, muted, and warning-capable.

Supported adapter descriptors currently live in
`src/webui/adapters/descriptors.ts`. When adding an adapter, update the
descriptor, server DTO expectations if needed, and model-page UI assumptions.

## Core Preset Page

The preset tab is a React island mounted inside the Vue Core page, not a Vue
page. Client files:

- `client/modules/core/pages/preset-page.vue`: mount host only. It owns one
  `div` and calls `mountPresetIsland` / `unmountPresetIsland`.
- `client/modules/core/preset-island/index.ts`: the island boundary. Owns the
  React root, the dirty flag, `confirmPresetIslandDiscard()`, and the
  `beforeunload` guard.
- `client/modules/core/preset-island/app.tsx`: React root component.
- `client/modules/core/preset-island/lib/*`: framework-free logic — RPC surface
  (`hub-api.ts`), DTO mirrors (`types.ts`, `preset-types.ts`), YAML
  parse/serialize (`yaml.ts`, `serialize.ts`), draft state (`draft-store.ts`),
  prompt templates (`prompt-template.ts`, `templates.ts`), and small helpers
  (`id.ts`, `form-utils.ts`).
- `client/modules/core/preset-island/hooks/*`: `use-preset-workspace.ts` (list,
  selection, load, save, delete, dirty tracking) and `use-preset-generate.ts`
  (generation session state).
- `client/modules/core/preset-island/components/*`: the React component layer.
  Two files under `components/forms/` are infrastructure that the form
  components must go through, not optional helpers:
  - `components/forms/field-guards.tsx`: per-field type guards (`readText`,
    `readScalarText`, `readTextList`, `readTextOrTextList`, `readObject`,
    `readList`), the `FieldShapeNotice` fallback, and the guarded controls built
    on them (`TextInputField`, `ListInputField`, `TemplateField`). See `Field
    Shape Guards`.
  - `components/forms/use-row-keys.ts`: stable React keys for list rows. See
    `List Row Keys`.
- `client/modules/core/preset-island/styles.css`: island-scoped styles. See
  `Island Styles and Contrast`.

Server files:

- `src/webui/core/presets.ts`: listing, reading, validation, writing.
- `src/webui/core/preset-files.ts`: path resolution, parsing, and the prompt
  role whitelist.
- `src/webui/core/preset-generate.ts`: generation job lifecycle.
- `src/webui/core/preset-generate-tools.ts`: the tools the generation agent
  calls, plus the draft buffer they write into.
- `src/webui/core/preset-generate-types.ts`: generation DTOs and the event
  union.

Exactly one island root may exist. `index.ts` holds `root` at module scope and
unmounts the previous root before mounting a new host element, because two roots
editing the same preset would both drive the single dirty flag and the
navigation guard would then read the wrong one. The dirty flag is published
outward through `onDirtyChange` (fed by `hasUnsavedWork`) and consumed by
`client/components/layout/hub-shell.vue`, which calls
`confirmPresetIslandDiscard()` before leaving. Keep that flag a single module
value; it is what makes an unsaved preset survivable across both in-app
navigation and a browser reload.

`mountPresetIsland` accepts an `invoke` override and defaults to `send` from
`@koishijs/client`. The override exists so island logic can be driven without a
console socket; do not inline `send` into the hooks. The default wrapper also
converts an `undefined` resolution into a thrown disconnect error, because
`send` resolves with `undefined` instead of rejecting when the socket is closed
and every Hub listener otherwise answers with an object.

The server RPC namespace is:

- `chatluna-hub/core/presets/list`
- `chatluna-hub/core/presets/get`
- `chatluna-hub/core/presets/validate`
- `chatluna-hub/core/presets/create`
- `chatluna-hub/core/presets/update`
- `chatluna-hub/core/presets/delete`
- `chatluna-hub/core/presets/generate/start`
- `chatluna-hub/core/presets/generate/cancel`

`presets/validate` has no in-repo caller and **must not be deleted**. The island
validates drafts locally and only contacts the server on save, which re-validates
anyway, so every dead-code sweep rediscovers this listener and proposes removing
it. It stays for three reasons:

- The `spec` row in `src/console/listeners.ts` carries a comment recording the
  decision. Read it before touching the row.
- It is published API. `src/index.ts` re-exports `./webui/core`, whose barrel
  re-exports `./core/presets`, so `validateChatLunaCorePreset` and its DTOs are
  importable from the package root by third-party console clients of a released
  plugin.
- It is five layers, not one, so a partial removal breaks plugin load rather than
  failing a check. `registerHubListeners` iterates the table and calls
  `ctx.console.addListener` for every row, so a row whose handler or `HubEvents`
  entry is gone throws during initialization.

If it ever really is removed, these four go together, in this order:

1. `src/webui/events.ts` — the `HubEvents` signature for
   `chatluna-hub/core/presets/validate`.
2. `src/console/listeners.ts` — the `spec` row.
3. `src/webui/service.ts` — `ChatLunaHubService.validateCorePreset`.
4. `src/webui/core/presets.ts` — `validateChatLunaCorePreset`.

The fifth layer, `parsePresetRawText` / `summarizePresetRawText` in
`src/webui/core/preset-files.ts`, is shared with listing and saving and stays
regardless.

Preset sources:

- `core`: label `主插件预设`
- `character`: label `Character 预设`

Core presets use `ctx.chatluna.preset.resolvePresetDir()` when available, with
fallback `data/chathub/presets`.

Character presets use `ctx.chatluna_character.preset.resolvePresetDir()` when
available, with fallback `data/chathub/character/presets`.

### Editing Model

A `DraftSession` carries both representations at once: `structured` (the last
successfully parsed form model) and `rawText` (the YAML text), plus
`baselineRawText` for dirty comparison and `parseError`.

`structured` is deliberately kept when parsing or structured serialization
fails. Structured editing is blocked while `parseError` is set
(`isStructuredEditingBlocked`), and `applyStructuredPatch` is a no-op in that
state, so a half-typed document cannot be silently rewritten from a stale model.
If serialization of a new structured patch throws, both the previous
`structured` value and `rawText` remain unchanged and the error is surfaced
through the same lock. Raw text editing stays available as the escape hatch.

List hints prefer the parsed structure (`structuredListHints`);
`extractListHints` in `lib/yaml.ts` scrapes them out of raw text and is only
the fallback for a document that failed to parse. Do not promote the scraper
to the primary path.

Prompt template fields use CodeMirror 6, wired up in
`components/template-editor.tsx`. CodeMirror is a devDependency and is bundled
into `dist/`; exactly one copy of it has to survive install, type check, and
bundle (see `CodeMirror Single Instance`).

`lib/prompt-template.ts` opens with a file-level
`/* eslint-disable no-template-curly-in-string */`, and the header comment gives
the reason: the `${...}` occurrences in that file sit inside ordinary string
literals and are CodeMirror completion-snippet placeholders, which
`@codemirror/autocomplete`'s snippet mechanism parses into cursor stops inside the
editor. They are not JavaScript interpolation. Following the rule's suggestion and
turning them into template literals breaks completion. Do not remove the disable,
and do not narrow it to individual lines as snippets are added.

### Zero Data Loss Contract

`lib/serialize.ts` is written so that loading a preset, editing one field, and
saving cannot drop anything the Hub does not model. This is a contract, not
defensive clutter:

- `normalizeOrKeep` returns the original value when normalization would discard
  information.
- `keepDroppedValues` retains entries the form model cannot represent.
- `preserveUnknownKeys` reattaches keys outside `CORE_KNOWN_KEYS` /
  `CHARACTER_KNOWN_KEYS` on the way back out.
- No placeholder rows are injected. A file with a legitimately empty `prompts`
  list must serialize back as an empty list, not as one blank prompt.

The contract has exactly two deliberate exceptions, both in `normalizeCorePreset`
and both carrying a comment that says so: a non-mapping element of `prompts` or of
`world_lores` is dropped by `.filter(Boolean)`. Every legitimate producer of those
two keys writes a mapping, so a non-mapping element can only be a hand-written
typo, and its loss is visible at once as a missing row in the list. Preserving it
would mean widening the element type through every form component. Do not "fix"
these two by keeping the element, and do not copy the pattern to a third key.

The price of deleting nothing is paid one layer up, in the form components: see
`Field Shape Guards`.

`forYaml` rebuilds every object before dumping, so its own `noRefs` really is
redundant. The server-side `noRefs` in `preset-generate-tools.ts` is not — see
`Preset Generation`.

`parsePresetYaml` and `serializePresetData` mirror the server's 200,000-node,
64-level, 8 MiB expanded-content, and 8 MiB final-output limits. Expanded
content counts every string value and object key once per path, deliberately
revisiting aliases; otherwise a long scalar or key repeated through a small
alias graph can evade the node cap. A parse-time rejection keeps the raw YAML,
and a structured serialization failure keeps both the previous `structured`
value and `rawText` while locking the form.

### Field Shape Guards

Because `lib/serialize.ts` deletes nothing, a key declared `string` in the form
model may hold any YAML shape at runtime: a mapping, a sequence, a number. Render
safety is therefore an obligation of the **form layer**, not of the parser.

`lib/preset-types.ts` holds the low-level predicates — `isRenderableText`,
`isRenderableObject`, `isRenderableList`, plus `isPlainTextContent` and
`promptContentPreview` for LangChain complex message content.
`components/forms/field-guards.tsx` builds the form layer on top of them.

**Reach for the guarded field components first.** The guards are not a convention
that each call site has to remember to follow — they are sealed inside three
components, so at the field level they cannot be bypassed:

- `TextInputField` — reads through its `read` prop (default `readText`, pass
  `readScalarText` where YAML may hold a number), renders an `<input>`.
- `ListInputField` — default `readTextList`, pass `readTextOrTextList` for the
  string-or-list keys, renders `CommaListInput`.
- `TemplateField` — reads through `readText`, renders `TemplateEditor`.

Each one calls its reader, renders `FieldShapeNotice` when the reader returns
`null`, and renders the control otherwise. When adding a form field, use these
rather than hand-rolling a `read*` + `FieldShapeNotice` pair; the raw readers are
for the cases the three components do not cover (`readObject` and `readList` for
container fields, and the bespoke rows in `main-messages.tsx` /
`main-world-lores.tsx`).

Adoption is currently complete, and that is the state to preserve: all seven form
components import from `./field-guards`, `character-input.tsx` and
`character-system.tsx` consist of nothing but `TemplateField`, `FieldShapeNotice`
appears directly in five files, and `String(` and `as string` occur **zero** times
anywhere under `components/forms/` except inside `field-guards.tsx` itself. The
zero-deletion contract is genuinely enforced at this layer rather than cast away.

Which reader to pick:

- A missing value is not an anomaly. YAML omits optional keys, so every reader
  maps `null`/`undefined` to an empty field (`''`, `[]`, `{}`), not to the notice.
- `readScalarText`, not `readText`, for keys YAML parses as numbers or booleans
  (`version: 1.0`, `bot_id: 3345618715`).
- `readTextList` filters by `isRenderableText` and then compares lengths,
  returning `null` when they differ. It deliberately does **not** hand back the
  filtered array: dropping the non-text element for display would delete it from
  the file the moment the user edits a neighbouring entry. Turning the whole field
  read-only is what the zero-deletion contract requires.
- `readTextOrTextList` for the keys ChatLuna accepts as either one string or a
  list of them.
- `readList` still performs an `isRenderableList` check at runtime even though its
  signature is `<T,>(value: T[] | undefined)`. The declared element type is only
  what the caller gets to work with; whether the key holds a list at all is a
  runtime question, because `prompts` is declared as a message array yet may hold
  any shape. A `prompts:` that parsed as a mapping would otherwise reach `.map`
  and blank the page. The trailing comma in `<T,>` is the `.tsx` disambiguation
  form, not a typo — do not "clean it up".

The notice branch is read-only by design. Putting an unrepresentable value into a
control would write the form's own interpretation of it back to the file on the
next keystroke, and no interpretation of an object survives that round trip. The
YAML tab is the escape hatch, and `SHAPE_NOTICE_TEXT` tells the user so.

`shapePreview` uses a character-budgeted incremental traversal. It detects cycles
and stops reading later properties as soon as the preview budget is exhausted,
so rendering an unsupported field cannot materialize the full expanded YAML
value. Do not replace it with `JSON.stringify(...).slice(...)`; slicing only
after serialization restores the unbounded allocation the preview avoids.

Do not replace these readers with `String(...)`, optional chaining, or a cast to
silence a type error. Each substitution re-introduces either the crash or a silent
rewrite of the user's data.

### List Row Keys

`components/forms/use-row-keys.ts` supplies the React keys for the YAML lists
behind `main-messages.tsx` and `main-world-lores.tsx`, which carry no id of their
own. Neither obvious choice works, and both failure modes are silent:

- The array index makes React reuse row N's DOM for whatever value moves into
  slot N. Remove a middle row and every row below it stays mounted under its
  former neighbour's key, so the text in an `<input>` — or in a CodeMirror
  instance, which owns its own document — belongs to a different entry than the
  one that row now writes to.
- Object identity changes while the user types, because a structured patch
  replaces the edited object on every keystroke, remounting the row mid-edit.

So the keys are tracked alongside the data: a local removal is announced through
`removeAt`, called next to the `onChange` that removes the same index, and any
other length change — a YAML-tab edit, or a generation replacing the whole array
— is reconciled on the next render. When adding a list form, call `useRowKeys`
and pair every removal with `removeAt`; omitting the pairing reproduces the index
bug exactly.

### Island Styles and Contrast

`client/modules/core/preset-island/styles.css` defines the island's tokens on the
`.chatluna-preset-island` root. One of them deviates from Koishi's own choice for
the same role, and the deviation is deliberate.

`--pei-muted` resolves to `var(--k-text-normal)` (`--fg2`), not the
`var(--k-text-light)` (`--fg3`) Koishi uses for secondary text. `--fg3` composites
to `#a9a9ab` on the light card and `#7c7c7b` on the dark one, i.e. 2.35:1 and
3.66:1 against their own backgrounds — both under the 4.5:1 that WCAG 2.1
SC 1.4.3 asks of body text. `--fg2` reaches 5.51:1 and 6.38:1.

The constraint that makes a theme-flipping token the only option is proven, not a
preference: no single literal colour clears 4.5:1 on both themes, because the
light card demands a relative luminance of at most 0.183 and the dark card at
least 0.260, and the two intervals do not intersect. Do not "fix" a muted colour
here by hard-coding a hex value.

The override is scoped to the island root and inherits no further than the island.
Do not redefine `--fg3` or any other Koishi token globally to solve a contrast
problem on this page; that reaches the whole console.

### Preset Generation

`presets/generate/start` returns immediately with a `requestId`; progress
arrives on the Console broadcast channel
`chatluna-hub/core/presets/generate/event` with event kinds `token`, `step`,
`done`, `error`, and `aborted`.

The `requestId` is always allocated server-side with `randomUUID()` and
`input.requestId` is ignored. It doubles as the cancel handle, and a Console RPC
handler cannot tell which client invoked it, so a client-chosen id would let any
caller cancel someone else's job. Do not "restore" client-supplied ids.

`broadcastEvent` passes `{ authority: CONSOLE_AUTHORITY_MUTATE }` as the third
argument to `console.broadcast`. That argument is what `console/intercept` gates
on; omitting it pushes generated preset content and the cancellable `requestId`
to every connected client, logged in or not.

Current server limits:

- Concurrent jobs: `MAX_ACTIVE_GENERATE_JOBS = 2`.
- Job timeout: `GENERATE_TIMEOUT_MS = 5 * 60 * 1000`.
- Characters of draft text handed to the model: `GENERATE_TEXT_LIMIT = 4000`.
- Draft YAML accepted per request: `MAX_RAW_TEXT_LENGTH = 512 * 1024`.
- Expanded draft size: `MAX_DRAFT_NODES = 200_000`.
- Expanded string values and object keys:
  `MAX_DRAFT_EXPANDED_CONTENT_LENGTH = 8 * 1024 * 1024` UTF-16 code units.
- Serialized YAML returned to the client:
  `MAX_DRAFT_OUTPUT_LENGTH = 8 * 1024 * 1024` UTF-16 code units.
- Draft nesting, so the walk cannot exhaust the JS stack:
  `MAX_DRAFT_DEPTH = 64`.
- Prompt JSON nesting accepted by the start RPC: `PROMPT_JSON_MAX_DEPTH = 8`.

`activeJobs` is module state and survives a plugin reload, so the per-context
`dispose` handler must release concurrency slots itself; otherwise every
post-reload request hits the concurrency cap until the old jobs time out.

`serializeDraftBuffer` dumps with `noRefs: true`, and that flag is load-bearing.
`load()` can hand back a structure where many nodes are the same object, which
YAML would re-emit cheaply as aliases; `noRefs` materializes each one, so a small
alias graph can expand enormously on the way out. This is why the draft is capped
by node count and by the expanded length of every string value and object key,
as well as by raw length (`MAX_RAW_TEXT_LENGTH`) — a length cap on the input
cannot bound the dumped output. `serializeDraftBuffer` repeats the expanded
checks immediately before dumping, then enforces the actual output-length cap.

`assertDraftWithinLimits` deliberately does not memoize shared references.
Counting a shared node once would miss exactly the amplification the cap exists
to catch, so revisiting it is the point, not an oversight.

Tool writes go through `createWriteGuard` and `assertNoSensitiveKeys`. The
generation agent must not be able to write arbitrary keys into a file that is
later loaded as configuration.

On the client, `hooks/use-preset-generate.ts` subscribes to the broadcast
channel **once at module scope** and fans out to the handlers of hook instances
that are still mounted. This is not an accident of style: `receive` from
`@koishijs/client` keeps one listener per event name in a module-global map and
offers no way to remove it, so subscribing per hook instance would both outlive
the component and silently unsubscribe every earlier instance. Do not move that
subscription into an effect.

Three more behaviors in that hook exist to survive real event ordering, and
should not be flattened:

- Events that arrive before the start RPC resolves are buffered
  (`bufferPendingEvent`, capped at `MAX_PENDING_EVENTS = 400`, dropping the
  oldest token first) and replayed by `flushPendingEvents`. The broadcast can
  beat the RPC response, so without buffering the first tokens are lost.
- `jobGenRef` is a generation counter checked before applying any event, so a
  cancelled or superseded job cannot write into the current session's state.
- Teardown cancels the job on unmount only. Keying it on the selected preset
  used to cancel a healthy job on every preset switch.

### Prompt Roles

`src/webui/core/preset-files.ts` is the single source of truth:

```ts
export const PROMPT_ROLES = [
    'assistant', 'ai', 'model', 'user', 'human', 'system'
] as const
```

`PROMPT_ROLE_SET` gates validation, `AI_PROMPT_ROLES` selects the
assistant-side roles, and the generation tool schema derives its zod enum from
`PROMPT_ROLES` so the tool contract cannot drift from the validator. The list
mirrors ChatLuna's own `preset_prompt_parse.ts`. Add a role in this one place;
do not hand-write a second list, and do not narrow the set to the three roles
the UI happens to offer.

### Validation and Filesystem

Validation uses `js-yaml` and local structural checks:

- Core presets require `keywords` and at least one valid `prompts` entry, and
  every prompt role must be in `PROMPT_ROLES`.
- Character presets require `name`, `input`, and `system`.
- Core file extensions may be `.yml` or `.txt`.
- Character file extension must be `.yml`.
- Preset ids are encoded as `source:filename`; never expose absolute paths to
  the client.

Filesystem writes must stay constrained to preset directories resolved by
`resolvePresetFile()`.

`create` and `update` are not plain writes. Each one parses and validates the
raw text, enforces keyword uniqueness against the other presets of the same
source (`ensureUniquePresetKeywords`), writes the file, and then reloads the
ChatLuna preset source through `reloadPresetSourceAfterWrite` — which rolls the
file back (delete on create, restore previous text on update) if the reload
fails. Without that rollback a preset that ChatLuna rejects stays on disk and
keeps the running instance broken. `delete` restores the file the same way.

Character presets carry two extra guards, `ensureCharacterPresetNameCanChange`
and `ensureCharacterPresetCanDelete`, because a character preset's name is
referenced elsewhere and renaming or deleting one in use breaks that reference.

## Core Request Log Page

Files:

- `client/modules/core/pages/log-page.vue`
- `client/modules/core/pages/log-format.ts`
- `client/modules/core/components/LogBodyViewer.vue`
- `client/modules/core/use-highlight.ts`
- `src/webui/core/requester-log.ts`
- `src/webui/core/log-store.ts`
- `src/webui/core/log-types.ts`

The server RPC namespace is:

- `chatluna-hub/core/logs/list`
- `chatluna-hub/core/logs/get`
- `chatluna-hub/core/logs/clear`

`ChatLunaHubService` registers the requester log provider when both
`chatluna_hub` and `chatluna` are available. Request logs are captured from
ChatLuna model requester HTTP exchanges, then stored in memory and persisted to
`data/chatluna-hub/core-logs.json` under Koishi `ctx.baseDir`.

Keep requester log patch ownership unique per ChatLuna service instance. Koishi
config reloads can dispose the Hub service scope and its injected scope in
either order, so the provider disposer must remain idempotent and a replacement
provider must release the previous Hub owner before patching model methods.

Current log constraints:

- Maximum retained log entries: `100`.
- Maximum logged request or response body length: `512 * 1024` characters.
- Long request and response bodies are truncated and marked on the DTO.

Logs may contain user prompts, model responses, and request metadata. Preserve
clear UI affordances for clearing logs, and do not silently expand capture scope
without checking privacy and storage impact.

## Home Relationship Graph

Main files:

- `client/components/home/hub-relationship-graph.vue`
- `client/components/home/graph-types.ts`
- `client/components/home/graph-detail-panel.vue`
- `client/components/home/hub-relationship-graph.css`
- `client/components/home/graph-runtime.ts`
- `client/components/home/graph-geometry.ts`
- `client/module-access.ts`
- `client/module-catalog.ts`

Home layout is a flex split: left graph stage (`graph-container-box`, owns
`stageRef` for size/pointer metrics) and right detail rail
(`hub-module-detail-panel`, left divider only, no card chrome). Adjust
`--hub-panel-width` in `hub-relationship-graph.css` for rail width.

Important adjustable defaults in `graph-types.ts` (unless noted):

- `orbitRadiusPx`: default WebUI satellite distance from the ChatLuna node.
- `configOrbitRadiusPx`: default config-entry satellite distance from the
  ChatLuna node.
- `orbitSpeedRad`: default orbit speed.
- `getDefaultCorePosition()`: default main node position (viewBox center).
- `effectiveRangeMinRadiusPx`: minimum effective range slider value.
- `defaultEffectiveRangeRadiusPx`: computed default effective range
  (`hub-relationship-graph.vue`).
- `positionStorageKey`: localStorage key for node positions.
- `rangeStorageKey`: localStorage key for the effective range.
- `detailFontSizeStorageKey`: localStorage key for detail rail font size.
- `graphZoomStorageKey`: localStorage key for relationship graph zoom.

The effective range ellipse is only a temporary preview while the user adjusts
the slider. The reset button clears node positions, effective range, detail
font size, graph zoom, carried visual state, carried velocities, and related
localStorage keys.

Dragging an ecosystem node across the effective range can enable or disable the
underlying configured plugin through:

- client event: `chatluna-hub/module/set-enabled`
- service method: `ChatLunaHubService.setModuleEnabled()`

Never toggle a module whose `configStatus` is not `single`, whose package is not
installed, or whose `toggleable` value is false. Module toggling recursively
searches Koishi loader plugin config and only changes state when there is
exactly one matching config entry. Multiple matches return `ambiguous`; missing
config returns `not-configured`.

Clicking an installed ecosystem node that has no loader entry yet sends
`chatluna-hub/module/create-config`, handled by
`ChatLunaHubService.createModuleConfig()`. It creates exactly one empty entry
and returns the config route to open.

Both ends de-duplicate concurrent creations per module id: the service coalesces
on an in-flight promise, and `hub-shell.vue` tracks pending ids. Keep both. A
second entry would push the module into `configStatus === 'multiple'`, which
makes it permanently non-toggleable and non-openable until the user edits
`koishi.yml` by hand.

## Server Structure

Main files:

- `src/index.ts`
- `src/webui/config.ts`
- `src/webui/service.ts`
- `src/webui/modules.ts`
- `src/webui/events.ts`
- `src/webui/shared.ts`
- `src/webui/loader.ts`
- `src/webui/package-resolver.ts`
- `src/console/listeners.ts`
- `src/console/data-service.ts`
- `src/webui/core.ts`
- `src/webui/core/*`
- `src/webui/adapters.ts`
- `src/webui/adapters/*`

`src/index.ts` owns:

- plugin service registration
- optional ChatLuna requester log provider registration
- console entry registration
- Hub RPC listener registration
- console DataService registration
- Koishi and console type augmentation
- public exports

The config schema lives in `src/webui/config.ts`.

The server registers the console bundle with `ctx.console.addEntry()`. The
actual `/chatluna` page registration is client-side in `client/index.ts` via
`ctx.page()`.

Register the service before anything that reads it. The current pattern is:

```ts
ctx.plugin(ChatLunaHubService, config)

ctx.inject(['chatluna_hub', 'chatluna'], (ctx) => {
    // registerRequesterLogProvider
})

ctx.inject(['console', 'chatluna_hub'], (ctx) => {
    // addEntry, registerHubListeners, DataService
})
```

Both `console` and `chatluna` are declared optional in `export const inject`, so
each surface must come up through its own `ctx.inject` rather than assuming the
peer exists. This also avoids accessing `ctx.chatluna_hub` before the service is
registered.

Console type augmentation is declared for **both** `@koishijs/plugin-console`
and `@koishijs/console`. Koishi ships the console under two package ids and they
share one contract, so a new event added to only one of them type-checks in some
consumers and fails in others. Add to both.

`src/webui/service.ts` owns the `ChatLunaHubService` facade. It delegates to
focused modules for module state, adapter management, Core models,
conversations, presets, and logs.

`src/webui/core.ts` is a barrel over the focused `src/webui/core/*` modules. It
does not contain the implementation itself.

`src/webui/core/chatluna-service.ts` holds structural `...Like` interfaces
describing only the slices of ChatLuna and Koishi that the Hub actually uses,
plus thin accessors for them. The Hub treats ChatLuna as an optional peer and
must never import ChatLuna's concrete types: these interfaces are how the Hub
stays type-safe against a service that may be absent at runtime. Do not replace
them with real imports from ChatLuna, and do not widen them to `any` — add the
narrow slice you need.

`src/webui/adapters.ts` is a barrel over the focused `src/webui/adapters/*`
modules. Adapter read/write behavior belongs in those focused files.

`src/webui/modules.ts` owns module definitions and runtime availability checks.
It distinguishes package install state, loader config presence, and runtime
running state.

`src/webui/loader.ts` owns every read and write against the Koishi loader
config: plugin-name normalization, config-key parsing, fork lookup, config
matching, key renaming, and write validation. Adapter and module mutations go
through it instead of touching `ctx.loader` directly.

`src/webui/package-resolver.ts` owns package install detection against Koishi and
loader roots. `installed` state comes from here.

`src/webui/shared.ts` holds generic, domain-free helpers (`coerceReason`,
`isRecord`, string/record coercion, `naturalCompare`, `toTimestamp`, `unique`,
pagination). Keep it free of Koishi and ChatLuna types so any server module can
import it without forming a cycle; domain helpers belong next to the feature
that owns them.

`src/webui/shared.ts` also owns the console authority constants
`CONSOLE_AUTHORITY_READ` and `CONSOLE_AUTHORITY_MUTATE`. They live there and not
in `src/console/listeners.ts` because `src/webui/**` needs them (preset
generation broadcasts with MUTATE) and importing the listener table from there
would close a cycle back through the Hub service.

`src/console/listeners.ts` is a data-driven table, not a sequence of
`addListener` calls. Each row carries its event name, handler, `authority`, and an
optional `refresh` flag; `registerHubListeners` walks the table and calls
`ctx.console.addListener(event, handler, { authority })` for every row, awaiting
`ctx.console.refresh` afterwards when `refresh` is set.

Register new RPC by adding a row, and **declare its authority explicitly in that
row.** Authority is a required field on the row rather than a default applied
during registration, so a forgotten level is a type error at build time instead of
a silently public endpoint at runtime. Do not add a bare `ctx.console.addListener`
call alongside the table; it bypasses the one place that guarantees this.

`src/index.ts` re-exports `./webui/config`, `service`, `modules`, `core`,
`loader`, `adapters`, and `events`. Client code imports server DTO types from
the package root through these barrels.

## Console Entry Rules

Only register the Hub top-level page from the client entry:

- page name: `ChatLuna Hub`
- path: `/chatluna`
- authority: `3`
- fields: `['chatluna_hub_webui']`

Every Hub RPC listener declares an authority level, taken from
`src/webui/shared.ts`:

- `CONSOLE_AUTHORITY_READ = 3` for handlers that only read config or data.
- `CONSOLE_AUTHORITY_MUTATE = 4` for handlers that change loader config, delete
  data, write preset files, or start/cancel generation.

Console broadcasts must pass the same level in the third argument of
`console.broadcast(type, body, { authority })`. That argument is what
`console/intercept` gates on; a broadcast without it reaches every connected
client regardless of login state. A new RPC or broadcast that carries preset
content, credentials, or a cancellation handle is MUTATE.

For local external workspace development, keep console entry paths based on the
Koishi loader base directory and `node_modules/koishi-plugin-chatluna-hub`.
Direct real paths under `external/` can fail under Koishi production asset
serving.

## Tests

`yarn test` runs Node's built-in `node:test` against TypeScript sources
directly, through Node's own type transform. There is no test framework, no
bundler, and no extra dependency. Requires Node >= 22.18.

Current test files:

- `test/smoke.test.ts`
- `test/preset-serialize.test.ts`
- `test/draft-list-hints.test.ts`
- `test/preset-generate-tools.test.ts`
- `test/prompt-template.test.ts`
- `test/preset-write-rollback.test.ts`

`test/readme.md` documents what each file covers and why each invariant is
pinned. Update it when adding cases. `npm test` must be fully green before a
change is considered done.

`test/preset-write-rollback.test.ts` is the only suite that exercises server code,
and it is the shape to copy when adding more. It covers all four branches of
`reloadPresetSourceAfterWrite` in `src/webui/core/presets.ts` — reload succeeds,
reload fails and rollback succeeds, the rollback itself throws (the original error
must surface, not the rollback's), and the post-rollback reload fails and is
swallowed — plus the `create` path and preset-directory resolution, including the
`data/chathub/presets` and `data/chathub/character/presets` fallbacks.

Three properties of its setup are the pattern to reuse:

- Zero new dependencies. Node's own type erasure plus `node:test`, same as every
  other suite here.
- The private function is driven through the public entry points
  `createChatLunaCorePreset` / `updateChatLunaCorePreset`. Do not export internals
  to make them testable when a public entry already reaches them.
- The doubles stay small: a `ctx` stub of a dozen-odd lines (`baseDir`, plus a
  `get()` that returns a fake preset service whose `loadAllPreset` fails on a
  scripted call index) writing into a real `fs.mkdtemp` directory. Making the
  rollback itself throw requires turning the preset file into a directory so
  `fs.writeFile` fails with `EISDIR`, because the rollback callback is not
  injectable — that is the intended way to reach the branch, not a reason to add
  an injection point.

Two pieces of the setup are load-bearing:

- `--experimental-transform-types`, not `--strip-types`. Stripping only erases
  annotations, and the sources use parameter properties
  (`constructor(private readonly x)`), which plain stripping cannot erase.
- `test/register-hooks.mjs` installs `test/resolve-extensionless.mjs`, which maps
  extensionless relative specifiers (`./foo` -> `./foo.ts`, `./foo/index.ts`) the
  way the vite and esbuild builds resolve them. Without it the source files
  under test cannot be imported at all.

`.tsx` is deliberately excluded from that resolver. Node's transform does not
handle JSX, so a `.tsx` module cannot load in the runner; it must fail loudly
rather than half-resolve. This is why tests target `preset-island/lib/*` (pure,
framework-free) and not the component layer — keep logic worth testing out of
`.tsx` files.

Test files are neither linted nor type-checked. Do not rely on `yarn lint` or
`yarn typecheck:client` to catch problems in `test/`.

## Build Output and Packaging

- `scripts/build-server.cjs` writes `lib/` (esbuild, `packages: 'external'`).
- `scripts/build-client.cjs` writes `dist/` (vite, via `@koishijs/client`).
- `scripts/clean-artifacts.cjs` removes only `lib` and `dist`, only when they are
  direct children of the package root and only when they are real directories.
  It exists because `tsc -b` and esbuild overwrite just the files they emit, so
  output from renamed or deleted sources otherwise survives and gets packed.
- `scripts/check-artifacts.cjs` verifies that `main`, `module`, `typings`, and
  `dist/index.js` exist and are non-empty. `lib` and `dist` are git-ignored and
  npm packs whatever is on disk, so without this a publish from a clean checkout
  or after a failed build silently ships an empty package.
- `prepack` runs clean, then build, then check, in that order.
- `scripts/typecheck-client.cjs` type-checks `client/` and filters vendor
  diagnostics. See `Client Type Check`.
- `typings/vendor.d.ts` declares `*.vue` for that client type check and is
  referenced from `client/tsconfig.json`.

`package.json`'s `files` field is a whitelist: `["lib", "dist", "client"]`, and
there is no `.npmignore`. So `test/`, `typings/`, and `scripts/` never reach the
npm tarball. A new directory that has to ship must be added to `files` explicitly;
adding it anywhere else has no effect.

### Client Type Check

`@koishijs/client` and `schemastery-vue` publish raw `.ts` and `.vue` sources
instead of declaration files, so `tsc` type-checks *their implementation* under
this project's stricter options and reports around a hundred diagnostics that no
change in this repository can fix. `skipLibCheck` does not help — it only skips
`.d.ts` files. Stubbing the two packages through `paths` is worse: it discards
their real types, breaks the `declare module '@koishijs/client'` augmentations in
`client/`, and turns every callback parameter into an implicit-any error.

`scripts/typecheck-client.cjs` therefore keeps the real vendor types in the
program and filters vendor diagnostics out of the *output*, so only diagnostics
owned by this repository are shown. When it classifies a line, only the file path
is tested for `node_modules`; the message text often quotes absolute paths itself
(a duplicated-package type mismatch names both copies), so matching on the whole
line would hide local errors.

The correct expectation is **exit 0 plus `no errors in repository sources`**, and
that is the current state. The exit code is trustworthy and can be wired straight
into CI as the client gate. Every diagnostic tsc emits for this project is
vendor-owned; the local errors that previously remained under `client/` have been
fixed, so a new local diagnostic means the change under review introduced it.

The crash detection behind that exit code is the part to leave alone. tsc returns
non-zero for *any* diagnostic, and vendor diagnostics here are the expected steady
state, so the status code by itself cannot separate "clean" from "crashed". The
script therefore counts parsable diagnostics **before** filtering
(`parsedDiagnosticCount`) and treats only `parsedDiagnosticCount === 0 &&
result.status !== 0` as a crash. Both halves are load-bearing:

- Status alone would report a crash on every vendor-only run. That was the
  defect this replaced.
- Diagnostic count alone would let a real crash pass silently: a compiler that
  cannot start (bad config, missing binary) emits a message carrying no file
  position, so it parses as zero diagnostics while the status is non-zero.

Do not "simplify" this into a single condition in either direction. Verified
behavior: a clean run exits 0, and a project path that does not exist still exits
with tsc's own status.

One known cosmetic flaw, recorded rather than fixed: a diagnostic with no file
position (`TS5058` for a missing tsconfig path, for example) does not match the
`file(line,col)` pattern, so it is not counted in `parsedDiagnosticCount` but is
still kept in `localLines`. The run reports `1 error(s) in repository sources`
when the error is really a compiler-invocation problem. The exit code is correct;
only the wording is misleading.

### Client Vite Config

Root `vite.config.cjs` is the single source of truth for the client bundle's
Vite overrides, and both build paths pick it up the same way:

- `npm run build:client` → `scripts/build-client.cjs` → `build(root)`.
- `yarn build chatluna-hub` from the monorepo root → yakumo's `client` step →
  `build(root)`.

Neither path passes the config explicitly. `build()` writes the package root
into Vite's `root`, and Vite discovers the config file from there. Keep every
Vite override in that file rather than in `scripts/build-client.cjs`, and keep
the module data-only and free of side effects.

Two invariants make this discovery-based wiring safe, and both fail silently:
the file must stay at the package root, and it must stay named
`vite.config.cjs`. Vite's lookup order is
`vite.config.{js,mjs,ts,cjs,mts,cts}`, so adding any of the first three shadows
it, and a missing config just yields an unconfigured bundle rather than an
error. `scripts/check-artifacts.cjs` asserts exactly one root Vite config with
that name, and runs on `prepack`.

The config carries two settings that look removable and are not:

- `resolve.dedupe` over `codemirror`, the `@codemirror/*` and `@lezer/*` packages,
  `react`, and `react-dom`. See `CodeMirror Single Instance`.
- `esbuild: { jsx: 'automatic', jsxImportSource: 'react' }`. The monorepo tsconfig
  sets `jsxImportSource: '@satorijs/element'`, which is correct for Koishi message
  elements and wrong for the React island.

Do not add a `yakumo.client` field pointing at this config, which is the obvious
alternative wiring and is broken. `@koishijs/client` resolves that field to an
absolute path and hands the raw path to `import()`; a native Windows path such
as `C:\...` is not a valid ESM specifier, so Node rejects it with
`ERR_UNSUPPORTED_ESM_URL_SCHEME` and the root-level `client` step fails before
it builds anything. With the field absent, yakumo takes the
`deps['@koishijs/client']` branch instead and calls `build(root)` with an empty
config, which is why the discovery path above is the one in use.

### CodeMirror Single Instance

CodeMirror 6 keys behavior on module-level singletons: facets, `StateField`s, and
Lezer `NodeProp`s. React's hook dispatcher is the same kind of state. Two physical
copies of `@codemirror/state` on disk therefore create two sets of facets that do
not recognize each other, and the runtime symptom is **silent** — extensions are
ignored, not rejected. Under `tsc` the same duplication is **loud** instead,
because `SelectionRange` carries private members and so is nominally typed: the
same class reached through two paths is mutually unassignable.

Three mechanisms cover three different stages. They are complementary, not
alternatives; do not delete one because another looks like it already handles the
problem.

- **Bundling** — `resolve.dedupe` in `vite.config.cjs`. Applies only
  while Vite bundles. `@koishijs/client` sets `resolve.dedupe` on its dev-server
  config only, and the build config it merges here has none, so this list is the
  only thing keeping duplicates out of `dist/index.js`.
- **Type checking** — `baseUrl` and `paths` in `client/tsconfig.json`. Vite does
  not read tsconfig `paths` and `tsc` does not read Vite config, so neither
  mechanism substitutes for the other. Each of the ten mapped packages lists two
  candidates, `../node_modules/<pkg>` then `../../../node_modules/<pkg>`, in that
  order on purpose: this package's own `node_modules` first (a standalone clone),
  then the monorepo hoist root (a workspace install), matching how Node and Vite
  search upward. An unresolvable candidate falls back to normal lookup. `react`
  and `react-dom` are deliberately absent from `paths` — their types come from
  `@types/*`, and mapping the runtime packages would drop those declarations.
- **Installation** — `resolutions` (yarn) and `overrides` (npm) pinning
  `@codemirror/state`, `@codemirror/view`, `@codemirror/autocomplete`, and
  `@codemirror/lint`. This is the only one that stops a second copy from reaching
  the disk at all.

The install-time pin has a scope limit that is easy to get wrong: **yarn 4 reads
`resolutions` from the top-level workspace manifest only, and npm ignores
`overrides` that come from a dependency.** The copy in this package's
`package.json` therefore does nothing for a monorepo install. It is kept for the
standalone-clone case, where this package *is* the install root, and as
documentation — the `comment:codemirror-dedupe` key beside it records why.

For the monorepo the effective copy lives in
`C:\Users\31899\dev\koishi-dev\package.json`, which is **not under version
control**. The pin is therefore lost on a new machine or a rebuilt tree, and what
surfaces first is the silent runtime failure. Reinstate it by pasting these two
fields into that root manifest and reinstalling:

```json
"resolutions": {
    "@codemirror/state": "^6.7.1",
    "@codemirror/view": "^6.43.6",
    "@codemirror/autocomplete": "^6.20.3",
    "@codemirror/lint": "^6.9.7"
},
"overrides": {
    "@codemirror/state": "^6.7.1",
    "@codemirror/view": "^6.43.6",
    "@codemirror/autocomplete": "^6.20.3",
    "@codemirror/lint": "^6.9.7"
}
```

Every range the workspaces declare is `^6`-compatible, so pinning each package to
the highest version already resolved in the tree collapses the copies without
changing any declared dependency. If `npm run typecheck:client` starts reporting
assignability errors between two `node_modules` paths for a CodeMirror type, check
this pin before changing any source.

## Dependency Notes

Direct runtime dependencies are exactly:

- `@langchain/core`
- `js-yaml`
- `zod`

`js-yaml` is used by the server preset read/validate/write path. `@langchain/core`
and `zod` are used by preset generation: the tools are LangChain
`DynamicStructuredTool`s with zod schemas. These three are runtime dependencies
because the server bundle is built with `packages: 'external'` and requires them
at runtime.

Client-only packages are devDependencies on purpose, including `element-plus`,
`@element-plus/icons-vue`, `highlight.js`, `codemirror`, `@codemirror/state`,
`@codemirror/view`, `@codemirror/autocomplete`, `@codemirror/lint`, `react`, and
`react-dom`. The client build externalizes only `vue`, `vue-router`,
`@vueuse/core`, and `@koishijs/client`; everything else is bundled into
`dist/index.js`, so shipping them as runtime dependencies would make installs
download code that is already in the bundle. Do not promote a client-only package
to `dependencies` to fix a build error — fix the build config instead.

The dedupe list in `vite.config.cjs` is wider than the declared
devDependencies, and the `paths` map in `client/tsconfig.json` carries the same
wider set: `@codemirror/commands`, `@codemirror/language`, `@codemirror/search`,
`@lezer/common`, and `@lezer/highlight` arrive transitively through `codemirror`
and still need collapsing. Keep them listed in both places.

`highlight.js` is used by the Core request log body viewer. Element Plus is used
by the Vue tabs and the Hub shell; the React preset island does not use it.

## Source References

Sibling repositories are references only unless the user says to edit them:

- ChatLuna main repo:
  `C:\Users\31899\dev\koishi-dev\external\chatluna`
- Living Memory repo:
  `C:\Users\31899\dev\koishi-dev\external\chatluna-livingmemory`

The monorepo root is `C:\Users\31899\dev\koishi-dev`, and this package is
`external\chatluna-hub` inside it.
