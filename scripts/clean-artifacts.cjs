/**
 * Removes the build output directories before a full rebuild.
 *
 * `tsc -b` and esbuild only overwrite the files they emit this run, so output
 * left over from renamed or deleted sources survives forever and gets packed
 * into the tarball (observed: an orphan `lib/index.js` from a pre-esbuild
 * build, plus `lib/webui/modules.js`). Wired as the first step of `prepack` so
 * publishing always packs "clean -> build -> self-check" output.
 *
 * Only the two directory names below are ever removed, they must be direct
 * children of the package root, and symlinks are refused, so this can never
 * reach into source directories.
 */
const { lstatSync, rmSync } = require('fs')
const { dirname, resolve } = require('path')

const root = resolve(__dirname, '..')
const outputDirectories = ['lib', 'dist']

for (const name of outputDirectories) {
    const target = resolve(root, name)
    if (dirname(target) !== root) {
        console.error(`[clean-artifacts] refusing to remove ${target}`)
        process.exit(1)
    }

    const stats = lstatSync(target, { throwIfNoEntry: false })
    if (!stats) continue

    if (!stats.isDirectory()) {
        console.error(
            `[clean-artifacts] ${name} is not a directory, refusing to remove it`
        )
        process.exit(1)
    }

    rmSync(target, { recursive: true })
    console.log(`[clean-artifacts] removed ${name}`)
}
