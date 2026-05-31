/**
 * The write path for adapter management: create/update, enable/disable, and
 * delete adapter instances by mutating the Koishi loader config and reloading
 * the affected plugin scope. Every mutation guards loader readiness up front
 * and reports failures as a {@link ChatLunaAdapterMutationResult}.
 */
import type { Context } from 'koishi'
import {
    createConfigIdent,
    getLoader,
    type LoaderLike,
    type PluginConfigMatch,
    renameConfigKey
} from '../loader'
import { coerceReason, isRecord } from '../shared'
import { getAdapterDescriptor } from './descriptors'
import { sanitizeCredentials, serializeCredentialRow } from './credentials'
import { findInstanceMatch } from './matches'
import type {
    ChatLunaAdapterDeleteInput,
    ChatLunaAdapterMutationResult,
    ChatLunaAdapterSaveInput,
    ChatLunaAdapterToggleInput
} from './types'

interface MutationContext {
    loader: Required<Pick<LoaderLike, 'reload' | 'unload' | 'writeConfig'>> &
        LoaderLike
    plugins: Record<string, unknown>
}

/**
 * Validate that the loader is present and writable. Returns either a ready
 * mutation context or the failure result to return directly.
 */
const prepareLoader = (
    ctx: Context
): MutationContext | ChatLunaAdapterMutationResult => {
    const loader = getLoader(ctx)
    const plugins = loader?.config?.plugins

    if (!loader?.reload || !loader.unload || !loader.writeConfig || !plugins) {
        return { ok: false, reason: 'Koishi loader 不可用。' }
    }

    if (loader.writable === false) {
        return { ok: false, reason: 'Koishi 配置不可写。' }
    }

    return { loader: loader as MutationContext['loader'], plugins }
}

const isReady = (
    value: MutationContext | ChatLunaAdapterMutationResult
): value is MutationContext => {
    return 'loader' in value
}

/** Build the config object for an instance from sanitized credentials. */
const buildInstanceConfig = (
    descriptor: NonNullable<ReturnType<typeof getAdapterDescriptor>>,
    input: ChatLunaAdapterSaveInput,
    existing: PluginConfigMatch | undefined
): Record<string, unknown> => {
    const baseConfig = isRecord(existing?.config) ? { ...existing!.config } : {}
    const credentials = sanitizeCredentials(descriptor, input.credentials)

    baseConfig[descriptor.credentialField] = credentials.map((entry) =>
        serializeCredentialRow(descriptor.credentialKind, entry)
    )

    if (descriptor.platformConfigurable) {
        const platform =
            typeof input.platform === 'string' ? input.platform.trim() : ''
        baseConfig.platform = platform || descriptor.platformDefault
    }

    return baseConfig
}

export const saveChatLunaAdapter = async (
    ctx: Context,
    input: ChatLunaAdapterSaveInput
): Promise<ChatLunaAdapterMutationResult> => {
    const ready = prepareLoader(ctx)
    if (!isReady(ready)) return ready

    const { loader, plugins } = ready
    const descriptor = getAdapterDescriptor(input.adapterId)

    if (!descriptor) {
        return { ok: false, reason: '未知的 adapter。' }
    }

    if (descriptor.credentialKind === 'opaque') {
        return {
            ok: false,
            reason: `${descriptor.title} 的配置结构较特殊，请在 Koishi 插件配置页编辑。`
        }
    }

    const located = input.instanceKey
        ? findInstanceMatch(ctx, input.instanceKey)
        : null

    if (input.instanceKey && !located) {
        return { ok: false, reason: '目标配置实例不存在，请刷新后重试。' }
    }

    const match = located?.match
    const baseConfig = buildInstanceConfig(descriptor, input, match)

    try {
        if (match) {
            if (match.disabled) {
                // 已禁用的条目仅写回配置内容，不重新加载。
                match.parentConfig[match.key] = baseConfig
            } else if (match.parentContext) {
                await loader.reload(
                    match.parentContext,
                    match.activeKey,
                    baseConfig
                )
                renameConfigKey(
                    match.parentConfig,
                    match.key,
                    match.activeKey,
                    baseConfig
                )
            } else {
                match.parentConfig[match.key] = baseConfig
            }
        } else {
            if (!loader.entry) {
                return { ok: false, reason: '无法解析 Koishi 根上下文。' }
            }
            const key = `${descriptor.pluginName}:${createConfigIdent()}`
            await loader.reload(loader.entry, key, baseConfig)
            plugins[key] = baseConfig
        }

        await loader.writeConfig()

        return { ok: true, instanceKey: match?.activeKey, status: 'configured' }
    } catch (error) {
        return { ok: false, reason: coerceReason(error) }
    }
}

export const toggleChatLunaAdapter = async (
    ctx: Context,
    input: ChatLunaAdapterToggleInput
): Promise<ChatLunaAdapterMutationResult> => {
    const ready = prepareLoader(ctx)
    if (!isReady(ready)) return ready

    const { loader } = ready
    const located = findInstanceMatch(ctx, input.instanceKey)

    if (!located) {
        return { ok: false, reason: '目标配置实例不存在，请刷新后重试。' }
    }

    const { match } = located

    // 请求状态与当前状态一致时（enabled === !disabled）无需变更。
    if (input.enabled !== match.disabled) {
        return { ok: true, instanceKey: match.activeKey, status: 'configured' }
    }

    try {
        if (input.enabled) {
            if (!match.parentContext) {
                return { ok: false, reason: '无法解析父上下文。' }
            }
            await loader.reload(
                match.parentContext,
                match.activeKey,
                match.config
            )
            renameConfigKey(
                match.parentConfig,
                match.key,
                match.activeKey,
                match.config
            )
        } else {
            if (match.parentContext) {
                loader.unload(match.parentContext, match.activeKey)
            }
            renameConfigKey(
                match.parentConfig,
                match.key,
                `~${match.activeKey}`,
                match.config
            )
        }

        await loader.writeConfig()

        return { ok: true, instanceKey: match.activeKey, status: 'configured' }
    } catch (error) {
        return { ok: false, reason: coerceReason(error) }
    }
}

export const deleteChatLunaAdapter = async (
    ctx: Context,
    input: ChatLunaAdapterDeleteInput
): Promise<ChatLunaAdapterMutationResult> => {
    const ready = prepareLoader(ctx)
    if (!isReady(ready)) return ready

    const { loader } = ready
    const located = findInstanceMatch(ctx, input.instanceKey)

    if (!located) {
        return { ok: true, instanceKey: input.instanceKey, status: 'available' }
    }

    const { match } = located

    try {
        if (!match.disabled && match.parentContext) {
            loader.unload(match.parentContext, match.activeKey)
        }

        delete match.parentConfig[match.activeKey]
        delete match.parentConfig[`~${match.activeKey}`]

        await loader.writeConfig()

        return { ok: true, instanceKey: input.instanceKey, status: 'available' }
    } catch (error) {
        return { ok: false, reason: coerceReason(error) }
    }
}
