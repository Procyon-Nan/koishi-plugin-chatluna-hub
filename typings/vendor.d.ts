/**
 * Ambient declarations shared by the client type check (`npm run typecheck:client`).
 *
 * TypeScript cannot parse single-file components, so every `import x from
 * './y.vue'` is an unresolved module for it. The vite build resolves them
 * through @vitejs/plugin-vue; this declaration only keeps the type checker from
 * reporting them.
 *
 * Not part of the published bundle and not referenced by `tsconfig.json`
 * (server build), only by `client/tsconfig.json`.
 */
declare module '*.vue' {
    const component: any
    export default component
}
