import { createRequire } from 'module'
import { resolve } from 'path'
import type { Context } from 'koishi'
import { getLoader } from './loader'

export const getPackageResolverRoots = (ctx: Context): string[] => {
    const loader = getLoader(ctx)
    const roots = [loader?.baseDir, ctx.baseDir, process.cwd()].filter(
        (item): item is string => typeof item === 'string' && item.length > 0
    )

    return Array.from(new Set(roots))
}

const tryResolve = (resolver: NodeJS.Require, specifier: string): boolean => {
    try {
        resolver.resolve(specifier)
        return true
    } catch {
        return false
    }
}

export const canResolvePackage = (
    root: string,
    packageName: string
): boolean => {
    const requireFromRoot = createRequire(resolve(root, 'package.json'))

    return (
        tryResolve(requireFromRoot, `${packageName}/package.json`) ||
        tryResolve(requireFromRoot, packageName)
    )
}

export const canResolveAnyPackage = (
    ctx: Context,
    packageNames: string[]
): boolean => {
    const roots = getPackageResolverRoots(ctx)

    return packageNames.some((packageName) =>
        roots.some((root) => canResolvePackage(root, packageName))
    )
}
