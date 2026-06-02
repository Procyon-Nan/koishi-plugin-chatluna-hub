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
import {
    buildDefaultExtraConfig,
    getAdapterDescriptor,
    listAdapterConfigFields
} from './descriptors'
import { sanitizeCredentials, serializeCredentialRow } from './credentials'
import { findInstanceMatch } from './matches'
import type {
    ChatLunaAdapterConfigColumn,
    ChatLunaAdapterConfigField,
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

type AdapterConfigFailure = { ok: false; reason?: string }

type NormalizedConfigValue =
    | AdapterConfigFailure
    | {
          ok: true
          value: unknown
          skip?: boolean
      }

type PreparedAdapterConfig =
    | AdapterConfigFailure
    | {
          ok: true
          config: Record<string, unknown>
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

const hasOwn = (source: Record<string, unknown>, key: string): boolean => {
    return Object.prototype.hasOwnProperty.call(source, key)
}

const isEmptyValue = (value: unknown): boolean => {
    return (
        value == null ||
        (typeof value === 'string' && value.trim().length === 0)
    )
}

const isBlankObject = (value: Record<string, unknown>): boolean => {
    return Object.values(value).every(isEmptyValue)
}

const normalizeNumber = (
    label: string,
    value: unknown,
    min?: number,
    max?: number
): AdapterConfigFailure | { ok: true; value: number } => {
    const numberValue =
        typeof value === 'number'
            ? value
            : typeof value === 'string' && value.trim()
              ? Number(value)
              : NaN

    if (!Number.isFinite(numberValue)) {
        return { ok: false, reason: `${label} 必须是数字。` }
    }

    if (typeof min === 'number' && numberValue < min) {
        return { ok: false, reason: `${label} 不能小于 ${min}。` }
    }

    if (typeof max === 'number' && numberValue > max) {
        return { ok: false, reason: `${label} 不能大于 ${max}。` }
    }

    return { ok: true, value: numberValue }
}

const normalizeOptionValue = (
    field: Pick<ChatLunaAdapterConfigField, 'label' | 'options'>,
    value: unknown
): NormalizedConfigValue => {
    if (!field.options?.length) return { ok: true, value }

    if (field.options.some((option) => option.value === value)) {
        return { ok: true, value }
    }

    return { ok: false, reason: `${field.label} 包含不支持的选项。` }
}

const normalizeColumnValue = (
    column: ChatLunaAdapterConfigColumn,
    value: unknown
): NormalizedConfigValue => {
    if (column.required && isEmptyValue(value)) {
        return { ok: false, reason: `${column.label} 不能为空。` }
    }

    if (column.kind === 'boolean') {
        return { ok: true, value: value === true }
    }

    if (column.kind === 'number') {
        return normalizeNumber(column.label, value, column.min, column.max)
    }

    if (column.kind === 'select') {
        return normalizeOptionValue(column, value ?? column.default)
    }

    if (column.kind === 'multi-select') {
        const values = Array.isArray(value) ? value : []
        if (
            column.options?.length &&
            values.some(
                (item) =>
                    !column.options?.some((option) => option.value === item)
            )
        ) {
            return {
                ok: false,
                reason: `${column.label} 包含不支持的选项。`
            }
        }
        return { ok: true, value: values }
    }

    return { ok: true, value: typeof value === 'string' ? value : '' }
}

const normalizeFieldValue = (
    field: ChatLunaAdapterConfigField,
    value: unknown
): NormalizedConfigValue => {
    if (field.key === 'chatTimeLimit' && typeof value === 'object') {
        return { ok: true, value, skip: true }
    }

    if (field.required && isEmptyValue(value)) {
        return { ok: false, reason: `${field.label} 不能为空。` }
    }

    if (field.kind === 'boolean') {
        return { ok: true, value: value === true }
    }

    if (field.kind === 'number') {
        return normalizeNumber(field.label, value, field.min, field.max)
    }

    if (field.kind === 'text' || field.kind === 'textarea') {
        return { ok: true, value: typeof value === 'string' ? value : '' }
    }

    if (field.kind === 'select') {
        return normalizeOptionValue(field, value ?? field.default)
    }

    if (field.kind === 'multi-select') {
        const values = Array.isArray(value) ? value : []
        if (
            field.options?.length &&
            values.some(
                (item) =>
                    !field.options?.some((option) => option.value === item)
            )
        ) {
            return {
                ok: false,
                reason: `${field.label} 包含不支持的选项。`
            }
        }
        return { ok: true, value: values }
    }

    if (field.kind === 'string-list') {
        const values = Array.isArray(value) ? value : []
        return {
            ok: true,
            value: values
                .map((item) => (typeof item === 'string' ? item.trim() : ''))
                .filter(Boolean)
        }
    }

    if (field.kind === 'tuple-table') {
        const rows = Array.isArray(value) ? value : []
        const columns = field.columns ?? []
        const nextRows: unknown[][] = []

        for (const row of rows) {
            const source = Array.isArray(row) ? row : []
            const nextRow: unknown[] = []

            for (let index = 0; index < columns.length; index++) {
                const column = columns[index]
                const normalized = normalizeColumnValue(
                    column,
                    source[index] ?? column.default
                )
                if (!normalized.ok) return normalized
                nextRow[index] = normalized.value
            }

            if (nextRow.some((item) => !isEmptyValue(item))) {
                nextRows.push(nextRow)
            }
        }

        return { ok: true, value: nextRows }
    }

    if (field.kind === 'object-table') {
        const rows = Array.isArray(value) ? value : []
        const columns = field.columns ?? []
        const nextRows: Record<string, unknown>[] = []

        for (const row of rows) {
            const source = isRecord(row) ? row : {}
            const nextRow: Record<string, unknown> = {}

            for (const column of columns) {
                const normalized = normalizeColumnValue(
                    column,
                    source[column.key] ?? column.default
                )
                if (!normalized.ok) return normalized
                nextRow[column.key] = normalized.value
            }

            if (!isBlankObject(nextRow)) nextRows.push(nextRow)
        }

        return { ok: true, value: nextRows }
    }

    if (field.kind === 'dict-table') {
        const rows = Array.isArray(value) ? value : []
        return {
            ok: true,
            value: rows.filter(isRecord).map((row) =>
                Object.fromEntries(
                    Object.entries(row)
                        .filter(([key]) => key.trim().length > 0)
                        .map(([key, item]) => [
                            key.trim(),
                            typeof item === 'string' ? item : String(item ?? '')
                        ])
                )
            )
        }
    }

    return { ok: true, value }
}

const mergeExtraConfig = (
    descriptor: NonNullable<ReturnType<typeof getAdapterDescriptor>>,
    baseConfig: Record<string, unknown>,
    input: ChatLunaAdapterSaveInput
): PreparedAdapterConfig => {
    const extraConfig = isRecord(input.extraConfig) ? input.extraConfig : {}
    const nextConfig = { ...baseConfig }

    for (const [key, value] of Object.entries(
        buildDefaultExtraConfig(descriptor)
    )) {
        if (!hasOwn(nextConfig, key)) nextConfig[key] = value
    }

    for (const field of listAdapterConfigFields(descriptor)) {
        if (field.key === 'proxyAddress') {
            const proxyMode = hasOwn(extraConfig, 'proxyMode')
                ? extraConfig.proxyMode
                : nextConfig.proxyMode
            if (proxyMode !== 'on') {
                delete nextConfig.proxyAddress
                continue
            }
        }

        if (!hasOwn(extraConfig, field.key)) continue

        const normalized = normalizeFieldValue(field, extraConfig[field.key])
        if (normalized.ok === false) {
            return { ok: false, reason: normalized.reason }
        }
        if (normalized.skip) continue

        nextConfig[field.key] = normalized.value
    }

    return { ok: true, config: nextConfig }
}

/** Build the config object for an instance from sanitized credentials. */
const buildInstanceConfig = (
    descriptor: NonNullable<ReturnType<typeof getAdapterDescriptor>>,
    input: ChatLunaAdapterSaveInput,
    existing: PluginConfigMatch | undefined
): PreparedAdapterConfig => {
    const baseConfig = isRecord(existing?.config)
        ? { ...existing!.config }
        : buildDefaultExtraConfig(descriptor)

    if (descriptor.credentialKind !== 'opaque' && descriptor.credentialField) {
        const credentials = sanitizeCredentials(descriptor, input.credentials)
        baseConfig[descriptor.credentialField] = credentials.map((entry) =>
            serializeCredentialRow(descriptor.credentialKind, entry)
        )
    }

    if (descriptor.platformConfigurable) {
        const platform =
            typeof input.platform === 'string' ? input.platform.trim() : ''
        baseConfig.platform = platform || descriptor.platformDefault
    }

    return mergeExtraConfig(descriptor, baseConfig, input)
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

    const located = input.instanceKey
        ? findInstanceMatch(ctx, input.instanceKey)
        : null

    if (input.instanceKey && !located) {
        return { ok: false, reason: '目标配置实例不存在，请刷新后重试。' }
    }

    const match = located?.match
    const preparedConfig = buildInstanceConfig(descriptor, input, match)
    if (!preparedConfig.ok) return preparedConfig

    const baseConfig = preparedConfig.config

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
