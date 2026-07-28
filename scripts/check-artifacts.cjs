/**
 * Publish guard for the artifacts listed in package.json "files", plus the
 * client Vite config those artifacts depend on.
 *
 * `lib` and `dist` are git-ignored build output, and npm packs whatever happens
 * to be on disk without warning about missing entries. Without this check a
 * publish from a clean checkout (or after a failed build) silently ships an
 * empty package. Wired into the `prepack` lifecycle script.
 */
const { existsSync, statSync, readdirSync } = require('fs')
const { resolve } = require('path')

const root = resolve(__dirname, '..')
const manifest = require(resolve(root, 'package.json'))

const requiredArtifacts = [
    manifest.main,
    manifest.module,
    manifest.typings,
    'dist/index.js'
]

const artifactProblems = requiredArtifacts.flatMap((artifact) => {
    const target = resolve(root, artifact)
    if (!existsSync(target)) return [`missing: ${artifact}`]
    if (statSync(target).size === 0) return [`empty: ${artifact}`]
    return []
})

/**
 * Both build paths rely on Vite discovering `vite.config.cjs` at the package
 * root; neither passes it explicitly. Losing it, or adding a config file Vite
 * ranks higher, drops resolve.dedupe and the React jsxImportSource without
 * failing the build, so the breakage only surfaces at runtime. Vite's lookup
 * order is vite.config.{js,mjs,ts,cjs,mts,cts}, so anything before `.cjs`
 * shadows ours and anything after is dead weight that implies a mistake.
 */
const expectedViteConfig = 'vite.config.cjs'
const viteConfigNames = readdirSync(root).filter((name) =>
    /^vite\.config\.[cm]?[jt]s$/.test(name)
)

const configProblems = []
if (!viteConfigNames.includes(expectedViteConfig)) {
    configProblems.push(`missing: ${expectedViteConfig}`)
}
for (const name of viteConfigNames) {
    if (name !== expectedViteConfig) {
        configProblems.push(`conflicting Vite config: ${name}`)
    }
}

if (artifactProblems.length > 0 || configProblems.length > 0) {
    console.error('[check-artifacts] refusing to pack/publish:')
    for (const problem of [...artifactProblems, ...configProblems]) {
        console.error(`  - ${problem}`)
    }
    if (artifactProblems.length > 0) {
        console.error('[check-artifacts] run `npm run build` first.')
    }
    if (configProblems.length > 0) {
        console.error(
            `[check-artifacts] keep exactly one root Vite config, named ${expectedViteConfig}.`
        )
    }
    process.exit(1)
}

console.log(
    `[check-artifacts] ok: ${[...requiredArtifacts, expectedViteConfig].join(', ')}`
)
