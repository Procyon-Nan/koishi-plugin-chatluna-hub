import { createRequire } from 'module'
import { resolve } from 'path'
import type { Context } from 'koishi'
import { getLoader } from '../loader'
import type { ChatLunaAdapterDescriptor } from './types'

export const adapterNotInstalledReason =
    '此adapter尚未安装，请先前往插件市场安装'

interface AdapterInstallState {
    packageName: string
    installed: boolean
}

const getAdapterPackageName = (
    descriptor: ChatLunaAdapterDescriptor
): string => {
    if (descriptor.packageName) return descriptor.packageName
    if (descriptor.pluginName.startsWith('@')) return descriptor.pluginName
    if (descriptor.pluginName.startsWith('koishi-plugin-')) {
        return descriptor.pluginName
    }

    return `koishi-plugin-${descriptor.pluginName}`
}

const getResolverRoots = (ctx: Context): string[] => {
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

const canResolvePackage = (root: string, packageName: string): boolean => {
    const requireFromRoot = createRequire(resolve(root, 'package.json'))

    return (
        tryResolve(requireFromRoot, `${packageName}/package.json`) ||
        tryResolve(requireFromRoot, packageName)
    )
}

export const resolveAdapterInstallState = (
    ctx: Context,
    descriptor: ChatLunaAdapterDescriptor
): AdapterInstallState => {
    const packageName = getAdapterPackageName(descriptor)

    return {
        packageName,
        installed: getResolverRoots(ctx).some((root) =>
            canResolvePackage(root, packageName)
        )
    }
}
