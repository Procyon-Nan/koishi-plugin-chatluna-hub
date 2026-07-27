/**
 * Module resolution hook: maps extensionless relative specifiers to the files
 * they mean, the way the vite/esbuild builds resolve them.
 *
 * `./foo` -> `./foo.ts`, `./foo.js`, `./foo/index.ts`, `./foo/index.js`
 *
 * `.tsx` is deliberately not resolved: Node's type stripping does not transform
 * JSX, so a `.tsx` module cannot be loaded by the test runner at all and must
 * fail loudly instead of half-resolving.
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const candidateSuffixes = ['.ts', '.js', '.mjs', '/index.ts', '/index.js']
const hasKnownExtension = /\.(?:[cm]?[jt]s|json|node)$/

const isRelative = (specifier) =>
    specifier.startsWith('./') || specifier.startsWith('../')

export async function resolve(specifier, context, nextResolve) {
    if (
        !isRelative(specifier) ||
        hasKnownExtension.test(specifier) ||
        !context.parentURL
    ) {
        return nextResolve(specifier, context)
    }

    const base = new URL(specifier, context.parentURL)
    for (const suffix of candidateSuffixes) {
        const candidate = new URL(base.href + suffix)
        if (existsSync(fileURLToPath(candidate))) {
            return nextResolve(candidate.href, context)
        }
    }

    return nextResolve(specifier, context)
}
