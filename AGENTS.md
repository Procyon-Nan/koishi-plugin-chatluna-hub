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

- `src/webui/modules.ts`: server-side module definitions, runtime state, package
  resolution, config matching, route generation, and toggle eligibility.
- `client/types.ts`: client-side mirror of the Hub module DTO used by the
  relationship graph and shell.
- `client/module-catalog.ts`: static frontend fallback modules and detail-card
  copy.

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
`entryType`, `ring`, and `toggleable`.

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

The default display mode is compact mode. The localStorage key is
`chatluna-hub-core-compact-mode`.

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

Files:

- `client/modules/core/pages/preset-page.vue`
- `client/modules/core/pages/preset-templates.ts`
- `client/modules/core/components/PresetCodeEditor.vue`
- `src/webui/core/presets.ts`
- `src/webui/core/preset-files.ts`

The server RPC namespace is:

- `chatluna-hub/core/presets/list`
- `chatluna-hub/core/presets/get`
- `chatluna-hub/core/presets/validate`
- `chatluna-hub/core/presets/create`
- `chatluna-hub/core/presets/update`
- `chatluna-hub/core/presets/delete`

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

Filesystem writes must stay constrained to preset directories resolved by
`resolvePresetFile()`.

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
- `client/components/home/graph-runtime.ts`
- `client/components/home/graph-geometry.ts`
- `client/module-access.ts`
- `client/module-catalog.ts`

Important adjustable defaults in `hub-relationship-graph.vue`:

- `orbitRadiusPx`: default WebUI satellite distance from the ChatLuna node.
- `configOrbitRadiusPx`: default config-entry satellite distance from the
  ChatLuna node.
- `orbitSpeedRad`: default orbit speed.
- `getDefaultCorePosition()`: default main node position.
- `effectiveRangeMinRadiusPx`: minimum effective range slider value.
- `defaultEffectiveRangeRadiusPx`: computed default effective range.
- `positionStorageKey`: localStorage key for node positions.
- `rangeStorageKey`: localStorage key for the effective range.
- `detailFontSizeStorageKey`: localStorage key for detail card font size.
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

## Server Structure

Main files:

- `src/index.ts`
- `src/webui/config.ts`
- `src/webui/service.ts`
- `src/webui/modules.ts`
- `src/webui/events.ts`
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

Register the service before the console DataService. The current pattern is:

```ts
ctx.plugin(ChatLunaHubService, config)

ctx.inject(['console', 'chatluna_hub'], (ctx) => {
    // addEntry, addListener, DataService
})
```

This avoids accessing `ctx.chatluna_hub` before the service is registered.

`src/webui/service.ts` owns the `ChatLunaHubService` facade. It delegates to
focused modules for module state, adapter management, Core models,
conversations, presets, and logs.

`src/webui/core.ts` is a barrel over the focused `src/webui/core/*` modules. It
does not contain the implementation itself.

`src/webui/adapters.ts` is a barrel over the focused `src/webui/adapters/*`
modules. Adapter read/write behavior belongs in those focused files.

`src/webui/modules.ts` owns module definitions and runtime availability checks.
It distinguishes package install state, loader config presence, and runtime
running state.

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
- `highlight.js`
- `js-yaml`

`element-plus` is direct because Hub-owned UI imports Element Plus components
and messages directly. `highlight.js` is used by the Core request log body
viewer. `js-yaml` is used by the server preset validation path.

## Source References

Sibling repositories are references only unless the user says to edit them:

- ChatLuna main repo:
  `C:\Users\31899\dev\koishi-dev\external\chatluna`
- Living Memory repo:
  `C:\Users\31899\dev\koishi-dev\external\chatluna-livingmemory`
