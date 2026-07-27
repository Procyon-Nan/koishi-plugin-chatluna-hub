/**
 * Publish guard for the artifacts listed in package.json "files".
 *
 * `lib` and `dist` are git-ignored build output, and npm packs whatever happens
 * to be on disk without warning about missing entries. Without this check a
 * publish from a clean checkout (or after a failed build) silently ships an
 * empty package. Wired into the `prepack` lifecycle script.
 */
const { existsSync, statSync } = require('fs')
const { resolve } = require('path')

const root = resolve(__dirname, '..')
const manifest = require(resolve(root, 'package.json'))

const requiredArtifacts = [
    manifest.main,
    manifest.module,
    manifest.typings,
    'dist/index.js'
]

const problems = requiredArtifacts.flatMap((artifact) => {
    const target = resolve(root, artifact)
    if (!existsSync(target)) return [`missing: ${artifact}`]
    if (statSync(target).size === 0) return [`empty: ${artifact}`]
    return []
})

if (problems.length > 0) {
    console.error(
        '[check-artifacts] incomplete build output, refusing to pack/publish:'
    )
    for (const problem of problems) {
        console.error(`  - ${problem}`)
    }
    console.error('[check-artifacts] run `npm run build` first.')
    process.exit(1)
}

console.log(`[check-artifacts] ok: ${requiredArtifacts.join(', ')}`)
