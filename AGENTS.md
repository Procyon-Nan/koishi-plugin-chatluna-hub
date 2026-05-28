# Agent Instructions for ChatLuna Hub

This file applies only to the standalone `chatluna-hub` repository.
The previous design notes for this file are considered stale. Treat the code in
this repository as the source of truth.

## Working Rules

- Keep changes scoped to this repository unless the user explicitly asks to edit
  a sibling ChatLuna ecosystem plugin.
- Read current source before changing behavior. The Hub has moved through
  several integration strategies, and old assumptions are likely wrong.
- Prefer parallel reads for independent files and command outputs.
- Use `apply_patch` for manual edits.
- Do not register additional Koishi sidebar pages for ecosystem plugins from
  this repository.
- Do not remove or rewrite external plugin routes. Hub sidebar unification is
  done by hiding duplicate sidebar activities on the client side.

## Repository Identity

- Package name: `koishi-plugin-chatluna-hub`
- Koishi plugin export name: `chatluna-hub`
- Koishi service: `chatluna_hub`
- Console DataService: `chatluna_hub_webui`
- Hub route: `/chatluna`
- Hub sidebar entry: `ChatLuna Hub`
- Hub RPC namespace: `chatluna-hub/*`

## Commands

- Server build: `yarn build:server`
- Client build: `yarn build:client`
- Full build: `yarn build`
- Lint: `yarn lint`
- Auto-fix lint: `yarn lint-fix`
- Whitespace check: `git diff --check`

The package currently has ESLint and Prettier config at `.eslintrc.yml` and
`.prettierrc`. Koishi module augmentation uses `namespace Console`; the
`@typescript-eslint/no-namespace` rule is intentionally disabled.

`yarn lint` currently checks `src --ext=ts` only. It does not cover Vue client
files. `build:server` writes `lib/`, and `build:client` writes `dist/`, so do
not treat build commands as read-only checks.

## Current Product Shape

ChatLuna Hub has two surfaces:

- A relationship graph home page at `/chatluna`.
- A ChatLuna Core management page rendered inside Hub after clicking the
  `ChatLuna` main node.

Ecosystem plugins are not embedded in the Hub shell now. They use route-jump
integration: clicking an available ecosystem node sends the user to the
plugin's original WebUI route, and a global return card sends the user back to
`/chatluna?home=1`.

## Module Model

The current module model is shared between server and client in:

- `src/webui/modules.ts`
- `client/types.ts`

Current module ids:

```ts
type HubModuleId =
    | 'chatluna'
    | 'agent'
    | 'livingMemory'
    | 'mediaLuna'
    | 'memesLuna'
```

Each module carries both `configured` and `available`.

- `configured` means a matching plugin config entry exists in the Koishi loader
  config.
- `available` means the runtime plugin scope is running.
- Unconfigured ecosystem modules should show `未安装` on the graph and must not
  trigger enable or disable operations when dragged across the effective range
  boundary.

The graph's ecosystem total is manually maintained in
`client/components/home/hub-relationship-graph.vue` as
`confirmedEcosystemTotal`. Update it when adding or removing visible ecosystem
nodes.

## Ecosystem Route Integration

Current external WebUI route map is in
`client/components/layout/hub-shell.vue`:

- `agent` -> `/chatluna-agent`
- `livingMemory` -> `/chatluna-livingmemory`
- `mediaLuna` -> `/media-luna`
- `memesLuna` -> `/memesluna/`

The global return card is
`client/components/layout/ecosystem-route-return-card.vue`. It is registered as
a global slot in `client/index.ts` and currently appears on those ecosystem
routes. Its text is `返回ChatLuna Hub 首页`.

The ecosystem sidebar entries are hidden in `client/index.ts` through the
Koishi console `activity` bail hook. Current hidden ids/paths include:

- `chatluna-agent` / `/chatluna-agent`
- `chatluna-livingmemory` / `/chatluna-livingmemory`
- `media-luna` / `/media-luna`
- `memesluna` / `/memesluna` and `/memesluna/`

Do not hide Hub's own `/chatluna` activity.

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

## ChatLuna Core Page

The Core page lives under `client/modules/core/`.

- `page.vue` owns the local tab state.
- `sidebar.vue` provides the right-side floating tab switcher.
- Current tabs are `conversation`, `model`, and `preset`.
- Shared client RPC wrappers live in `client/modules/core/api.ts`.
- Shared client types live in `client/modules/core/types.ts`.
- Compact/wide display state is shared and persisted by
  `client/modules/core/use-compact-mode.ts`.

The default display mode is compact mode. The localStorage key is
`chatluna-hub-core-compact-mode`.

## Core Conversation Page

File: `client/modules/core/pages/conversation-page.vue`

This page manages ChatLuna conversations through Hub-owned RPC:

- `chatluna-hub/core/conversations/list`
- `chatluna-hub/core/conversations/options`
- `chatluna-hub/core/conversations/update-usage`
- `chatluna-hub/core/conversations/delete`

The implementation lives in `src/webui/core.ts` and must not depend on Living
Memory being installed. It reads ChatLuna conversation/binding tables and uses
`ctx.chatluna.conversation` for mutation/cache cleanup.

## Core Model Page

Files:

- `client/modules/core/pages/model-page.vue`
- `src/webui/core.ts`

The server RPC is:

- `chatluna-hub/core/models/list`

It reads `ctx.get('chatluna')?.platform?.listAllModels(0)?.value`, normalizes
model name, platform, type, max tokens, and capabilities, then returns summary
counts and platform filters.

Model type coercion currently recognizes:

- `1` / `llm`
- `2` / `embedding` / `embeddings`
- `3` / `reranker` / `rerank`

Model capabilities are displayed as adapter-reported metadata. Do not infer or
rewrite capabilities client-side unless the server contract changes.

## Core Preset Page

Files:

- `client/modules/core/pages/preset-page.vue`
- `src/webui/core.ts`

The server RPC namespace is:

- `chatluna-hub/core/presets/list`
- `chatluna-hub/core/presets/get`
- `chatluna-hub/core/presets/validate`
- `chatluna-hub/core/presets/create`
- `chatluna-hub/core/presets/update`

Preset sources:

- `core`: label `主插件预设`
- `character`: label `Character 预设`

Core presets use `ctx.chatluna.preset.resolvePresetDir()` when available, with
fallback `data/chathub/presets`.

Character presets use `ctx.chatluna_character.preset.resolvePresetDir()` when
available, with fallback `data/chathub/character/presets`.

The preset editor is a custom textarea-based YAML editor with line numbers and
indent guides. Do not add Monaco or another editor dependency unless the user
explicitly asks for it.

Validation uses `js-yaml` and local structural checks:

- Core presets require `keywords` and at least one valid `prompts` entry.
- Character presets require `name`, `input`, and `system`.
- Core file extensions may be `.yml` or `.txt`.
- Character file extension must be `.yml`.
- Preset ids are encoded as `source:filename`; never expose absolute paths to
  the client.

## Home Relationship Graph

Main file: `client/components/home/hub-relationship-graph.vue`

Important adjustable defaults are in this file:

- `orbitRadiusPx`: default satellite distance from the ChatLuna node.
- `orbitSpeedRad`: default orbit speed.
- `getDefaultCorePosition()`: default main node position.
- `effectiveRangeMinRadiusPx`: minimum effective range slider value.
- `defaultEffectiveRangeRadiusPx`: computed default effective range.
- `positionStorageKey`: localStorage key for node positions.
- `rangeStorageKey`: localStorage key for the effective range.
- `detailFontSizeStorageKey`: localStorage key for detail card font size.

The effective range ellipse is only a temporary preview while the user adjusts
the slider. The reset button clears node positions, effective range, detail
font size, disturbances, carried visual state, and related localStorage keys.

Dragging an ecosystem node across the effective range can enable or disable the
underlying configured plugin through:

- client event: `chatluna-hub/module/set-enabled`
- service method: `ChatLunaHubService.setModuleEnabled()`

Never toggle a module whose `configured` value is `false`. Module toggling
recursively searches Koishi loader plugin config and only changes state when
there is exactly one matching config entry. Multiple matches return
`ambiguous`; missing config returns `not-configured`.

## Server Structure

Main files:

- `src/index.ts`
- `src/webui/modules.ts`
- `src/webui/core.ts`

`src/index.ts` owns:

- plugin config schema
- `ChatLunaHubService`
- `ChatLunaHubConsoleService`
- console entry registration
- Hub RPC listeners
- Koishi and console type augmentation

The server registers the console bundle with `ctx.console.addEntry()`. The
actual `/chatluna` page registration is client-side in `client/index.ts` via
`ctx.page()`.

Register the service before the console DataService. The current pattern is:

```ts
ctx.plugin(ChatLunaHubService, config)

ctx.inject(['console', 'chatluna_hub'], (ctx) => {
    // addEntry, addListener, DataService
})
```

This avoids accessing `ctx.chatluna_hub` before the service is registered.

`src/webui/modules.ts` owns the module definitions and runtime availability
checks. It distinguishes loader config presence from runtime running state.

`src/webui/core.ts` owns Core management RPC implementation for model and preset
pages. Keep filesystem writes constrained to preset directories resolved by the
server helper functions.

## Console Entry Rules

Only register the Hub top-level page from the client entry:

- page name: `ChatLuna Hub`
- path: `/chatluna`
- authority: `3`
- fields: `['chatluna_hub_webui']`

For local external workspace development, keep console entry paths based on the
Koishi loader base directory and `node_modules/koishi-plugin-chatluna-hub`.
Direct real paths under `external/` can fail under Koishi production asset
serving.

## Dependency Notes

Direct runtime dependencies currently include:

- `@element-plus/icons-vue`
- `element-plus`
- `js-yaml`

`element-plus` is direct because Hub-owned UI imports Element Plus components
and messages directly. `js-yaml` is used by the server preset validation path.

## Source References

Sibling repositories are references only unless the user says to edit them:

- ChatLuna main repo:
  `C:\Users\31899\dev\koishi-dev\external\chatluna`
- Living Memory repo:
  `C:\Users\31899\dev\koishi-dev\external\chatluna-livingmemory`

Prefer current `src/` and `client/` files in this repository over generated
`lib/` or `dist/`. Inspect generated output only for build or runtime loading
debugging.
