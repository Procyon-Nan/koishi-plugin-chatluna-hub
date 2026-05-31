/**
 * The Hub core page's shared types.
 *
 * Every DTO and the RPC contract are owned by the server package and re-exported
 * here, so the client never hand-copies the server's shapes (which used to drift
 * silently — the compiler can't compare two separate compilation units). Editing
 * a server DTO now surfaces in the client typecheck immediately.
 *
 * `export type *` (not `export *`) re-exports type meanings only, so no server
 * runtime is ever pulled into the client bundle. In-repo, the package resolves
 * to `src/` via the monorepo tsconfig paths; a standalone client build resolves
 * via `exports` to `lib/`, so `build:server` must run first (`yarn build` does).
 */
import type { HubEvents } from 'koishi-plugin-chatluna-hub'

export type * from 'koishi-plugin-chatluna-hub'

/** Client-only UI tab key — has no server counterpart. */
export type CoreTab = 'conversation' | 'model' | 'preset' | 'log'

declare module '@koishijs/client' {
    interface Events extends HubEvents {}
}
