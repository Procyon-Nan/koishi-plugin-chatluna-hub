/**
 * The read path for adapter management: builds the list of configured adapter
 * instances, the catalogue of creatable types, and the platform→title map the
 * model page uses.
 */
import type { Context } from 'koishi'
import { getLoader } from '../loader'
import { isRecord } from '../shared'
import {
    getChatLuna,
    type RawPlatformModelInfo
} from '../core/chatluna-service'
import { adapterDescriptors, buildDefaultExtraConfig } from './descriptors'
import { readCredentials, resolvePlatform } from './credentials'
import { findAdapterMatches } from './matches'
import type { PluginConfigMatch } from '../loader'
import type {
    ChatLunaAdapterDescriptor,
    ChatLunaAdapterInstance,
    ChatLunaAdapterListResult,
    ChatLunaAdapterStatus,
    ChatLunaAdapterType
} from './types'

/** Count how many models each platform currently exposes. */
const countModelsByPlatform = (ctx: Context): Map<string, number> => {
    const counts = new Map<string, number>()
    const platform = getChatLuna(ctx)?.platform
    if (!platform?.listAllModels) return counts

    let source: unknown
    try {
        source = platform.listAllModels(0)?.value
    } catch {
        return counts
    }

    if (!Array.isArray(source)) return counts

    for (const item of source) {
        if (!isRecord(item)) continue
        const name = (item as RawPlatformModelInfo).platform
        if (typeof name !== 'string' || !name) continue
        counts.set(name, (counts.get(name) ?? 0) + 1)
    }

    return counts
}

const resolveStatus = (
    disabled: boolean,
    modelCount: number
): ChatLunaAdapterStatus => {
    if (disabled) return 'configured'

    return modelCount > 0 ? 'running' : 'configured'
}

const buildInstance = (
    descriptor: ChatLunaAdapterDescriptor,
    match: PluginConfigMatch,
    modelCounts: Map<string, number>
): ChatLunaAdapterInstance => {
    const config = isRecord(match.config) ? match.config : {}
    const platform = resolvePlatform(descriptor, config)
    const credentials = readCredentials(descriptor, config)
    const modelCount = modelCounts.get(platform) ?? 0

    const extraConfig: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(config)) {
        if (key === descriptor.credentialField) continue
        if (descriptor.platformConfigurable && key === 'platform') continue
        extraConfig[key] = value
    }

    return {
        instanceKey: match.activeKey,
        adapterId: descriptor.id,
        title: descriptor.title,
        pluginName: descriptor.pluginName,
        credentialKind: descriptor.credentialKind,
        platformConfigurable: descriptor.platformConfigurable,
        endpointPlaceholder: descriptor.endpointPlaceholder,
        configSections: descriptor.configSections,
        defaultExtraConfig: buildDefaultExtraConfig(descriptor),
        disabled: match.disabled,
        platform,
        credentials,
        extraConfig,
        modelCount,
        status: resolveStatus(match.disabled, modelCount)
    }
}

/** Whether the loader can be mutated (entries can be created/edited/removed). */
const isLoaderWritable = (ctx: Context): boolean => {
    const loader = getLoader(ctx)

    return (
        Boolean(loader?.reload && loader.unload && loader.writeConfig) &&
        loader?.writable !== false &&
        Boolean(loader?.config?.plugins)
    )
}

const buildType = (
    descriptor: ChatLunaAdapterDescriptor,
    matchCount: number,
    writable: boolean
): ChatLunaAdapterType => {
    // platform 硬编码的 adapter 已存在实例时不可再建（会触发 chatluna
    // PLUGIN_ALREADY_REGISTERED）；platform 可配置的可重复新建。
    const blockedByExisting = !descriptor.platformConfigurable && matchCount > 0
    const canCreate = writable && !blockedByExisting

    return {
        id: descriptor.id,
        title: descriptor.title,
        pluginName: descriptor.pluginName,
        credentialKind: descriptor.credentialKind,
        platformConfigurable: descriptor.platformConfigurable,
        endpointPlaceholder: descriptor.endpointPlaceholder,
        platformDefault: descriptor.platformDefault,
        configSections: descriptor.configSections,
        defaultExtraConfig: buildDefaultExtraConfig(descriptor),
        instanceCount: matchCount,
        canCreate,
        createReason: blockedByExisting
            ? '该平台固定且已配置，如需多份请使用 OpenAI Like 等平台名可自定义的适配器。'
            : undefined
    }
}

export const listChatLunaAdapters = (
    ctx: Context
): ChatLunaAdapterListResult => {
    const writable = isLoaderWritable(ctx)
    const modelCounts = countModelsByPlatform(ctx)

    const instances: ChatLunaAdapterInstance[] = []
    const types: ChatLunaAdapterType[] = []
    const platformMap: Record<string, string> = {}

    for (const descriptor of adapterDescriptors) {
        const matches = findAdapterMatches(ctx, descriptor)

        for (const match of matches) {
            const instance = buildInstance(descriptor, match, modelCounts)
            instances.push(instance)
            // platform → 适配器标题（实例优先，覆盖默认映射）。
            platformMap[instance.platform] = descriptor.title
        }

        // 默认平台名也纳入映射，便于未建实例时模型列表仍可识别。
        platformMap[descriptor.platformDefault] ??= descriptor.title

        types.push(buildType(descriptor, matches.length, writable))
    }

    return {
        instances,
        types,
        platformMap,
        writable,
        updatedAt: new Date().toISOString(),
        reason: writable
            ? undefined
            : 'Koishi 配置不可写，无法在此修改 adapter。'
    }
}
