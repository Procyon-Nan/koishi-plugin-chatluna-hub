/**
 * ChatLuna Core management RPC implementations for the Hub core page.
 *
 * This is a barrel that re-exports the focused modules under `core/`:
 * - `models`            — read-only model catalogue
 * - `conversations`     — conversation list, routes, usage updates, deletion
 * - `conversation-routes` — pure route parsing/formatting/comparison
 * - `presets`           — preset CRUD across core + character sources
 * - `preset-files`      — preset id/path safety and YAML validation
 * - `preset-generate`   — one-click AI generate (start/cancel + broadcast)
 * - `preset-generate-types` — generate RPC / broadcast DTOs
 * - `requester-log`     — model-scoped ChatLuna fetch instrumentation
 * - `log-store`         — the model HTTP exchange log store
 * - `log-types`         — log DTOs and serialization helpers
 *
 * The published API surface (re-exported from `src/index.ts`) is intentionally
 * kept stable, so consumers continue importing from `./webui/core`.
 */
export type { Page as PageResult } from './shared'

export * from './core/models'
export * from './core/conversation-routes'
export * from './core/conversations'
export * from './core/preset-files'
export * from './core/presets'
export * from './core/preset-generate-types'
export * from './core/preset-generate'
export * from './core/requester-log'
export * from './core/log-types'
export * from './core/log-store'
