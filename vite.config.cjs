/**
 * Single source of truth for the client bundle's Vite overrides.
 *
 * Two build paths reach @koishijs/client's `build()` and both MUST apply this
 * config, otherwise they produce different bundles:
 *
 *   1. `npm run build:client` -> scripts/build-client.cjs -> build(root)
 *   2. `yarn build chatluna-hub` from the monorepo root -> yakumo's `client`
 *      step -> build(root)
 *
 * Neither path passes this file explicitly. `build()` writes the package root
 * into Vite's `root`, and Vite discovers the config file from there, so this
 * file must stay at the package root and stay named `vite.config.cjs`:
 * `vite.config.js`, `.mjs` and `.ts` come earlier in Vite's lookup order and
 * would shadow it, and a missing config yields a silently unconfigured bundle.
 * scripts/check-artifacts.cjs asserts both conditions before packing.
 *
 * Keep this module data-only and free of side effects, and keep every Vite
 * override here rather than in scripts/build-client.cjs.
 */

/**
 * CodeMirror, Lezer and React keep module-level singletons (facets, state
 * fields, node props, hook dispatchers). When the dependency tree contains more
 * than one physical copy of a package, extensions created by one copy are
 * rejected or silently ignored by the other one, so every copy must collapse
 * into a single instance at bundle time.
 *
 * @koishijs/client only sets resolve.dedupe on its dev server config, and the
 * build config it merges here (via vite.mergeConfig(builtin, config)) has none,
 * so this list is the only thing preventing duplicates in dist/index.js.
 */
const dedupedPackages = [
    'codemirror',
    '@codemirror/autocomplete',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    'react',
    'react-dom'
]

/**
 * The monorepo tsconfig uses jsxImportSource=@satorijs/element for Satori;
 * client TSX must compile against react/jsx-runtime instead.
 */
module.exports = {
    esbuild: {
        jsx: 'automatic',
        jsxImportSource: 'react'
    },
    resolve: {
        dedupe: dedupedPackages
    }
}
