import type { Context } from 'koishi'
import { canResolveAnyPackage } from '../package-resolver'
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

export const resolveAdapterInstallState = (
    ctx: Context,
    descriptor: ChatLunaAdapterDescriptor
): AdapterInstallState => {
    const packageName = getAdapterPackageName(descriptor)

    return {
        packageName,
        installed: canResolveAnyPackage(ctx, [packageName])
    }
}
