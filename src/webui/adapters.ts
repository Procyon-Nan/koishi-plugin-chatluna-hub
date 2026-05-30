import type { Context } from 'koishi'
import {
    createConfigIdent,
    findPluginConfigMatches,
    getLoader,
    isRecord,
    type PluginConfigMatch,
    renameConfigKey
} from './loader'

/**
 * ChatLuna adapter 的凭据形态。不同 adapter 的凭据字段结构不同：
 * - api-endpoint-enabled: apiKeys = [apiKey, apiEndpoint, enabled][]（多数海外平台）
 * - api-enabled: apiKeys = [apiKey, enabled][]（国内单凭据平台，无 endpoint）
 * - endpoint-enabled: apiEndpoints = [apiEndpoint, enabled][]（ollama，无 apiKey）
 * - opaque: 凭据结构特殊，本页仅做只读展示，引导至原生配置（dify、spark）
 */
export type ChatLunaAdapterCredentialKind =
    | 'api-endpoint-enabled'
    | 'api-enabled'
    | 'endpoint-enabled'
    | 'opaque'

export interface ChatLunaAdapterDescriptor {
    id: string
    title: string
    pluginName: string
    platformDefault: string
    platformConfigurable: boolean
    credentialKind: ChatLunaAdapterCredentialKind
    credentialField: string
    endpointPlaceholder?: string
}

export const adapterDescriptors: ChatLunaAdapterDescriptor[] = [
    {
        id: 'openai',
        title: 'OpenAI',
        pluginName: 'chatluna-openai-adapter',
        platformDefault: 'openai',
        platformConfigurable: false,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'https://api.openai.com/v1'
    },
    {
        id: 'openai-like',
        title: 'OpenAI Like',
        pluginName: 'chatluna-openai-like-adapter',
        platformDefault: 'openai-like',
        platformConfigurable: true,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'https://api.openai.com/v1'
    },
    {
        id: 'deepseek',
        title: 'DeepSeek',
        pluginName: 'chatluna-deepseek-adapter',
        platformDefault: 'deepseek',
        platformConfigurable: false,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'https://api.deepseek.com'
    },
    {
        id: 'claude',
        title: 'Claude',
        pluginName: 'chatluna-claude-adapter',
        platformDefault: 'claude',
        platformConfigurable: true,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'https://api.anthropic.com/v1'
    },
    {
        id: 'gemini',
        title: 'Google Gemini',
        pluginName: 'chatluna-google-gemini-adapter',
        platformDefault: 'gemini',
        platformConfigurable: true,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder:
            'https://generativelanguage.googleapis.com/v1beta'
    },
    {
        id: 'doubao',
        title: '豆包',
        pluginName: 'chatluna-doubao-adapter',
        platformDefault: 'doubao',
        platformConfigurable: false,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'https://ark.cn-beijing.volces.com/api/v3'
    },
    {
        id: 'rwkv',
        title: 'RWKV',
        pluginName: 'chatluna-rmkv-adapter',
        platformDefault: 'rwkv',
        platformConfigurable: false,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'http://127.0.0.1:8000/v1'
    },
    {
        id: 'azure-openai',
        title: 'Azure OpenAI',
        pluginName: 'chatluna-azure-openai-adapter',
        platformDefault: 'azure',
        platformConfigurable: false,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'https://xxx.openai.azure.com'
    },
    {
        id: 'hunyuan',
        title: '腾讯混元',
        pluginName: 'chatluna-hunyuan-adapter',
        platformDefault: 'hunyuan',
        platformConfigurable: false,
        credentialKind: 'api-enabled',
        credentialField: 'apiKeys'
    },
    {
        id: 'qwen',
        title: '通义千问',
        pluginName: 'chatluna-qwen-adapter',
        platformDefault: 'qwen',
        platformConfigurable: false,
        credentialKind: 'api-enabled',
        credentialField: 'apiKeys'
    },
    {
        id: 'wenxin',
        title: '文心一言',
        pluginName: 'chatluna-wenxin-adapter',
        platformDefault: 'wenxin',
        platformConfigurable: false,
        credentialKind: 'api-enabled',
        credentialField: 'apiKeys'
    },
    {
        id: 'zhipu',
        title: '智谱 ChatGLM',
        pluginName: 'chatluna-zhipu-adapter',
        platformDefault: 'zhipu',
        platformConfigurable: false,
        credentialKind: 'api-enabled',
        credentialField: 'apiKeys'
    },
    {
        id: 'ollama',
        title: 'Ollama',
        pluginName: 'chatluna-ollama-adapter',
        platformDefault: 'ollama',
        platformConfigurable: false,
        credentialKind: 'endpoint-enabled',
        credentialField: 'apiEndpoints',
        endpointPlaceholder: 'http://127.0.0.1:11434'
    },
    {
        id: 'dify',
        title: 'Dify',
        pluginName: 'chatluna-dify-adapter',
        platformDefault: 'dify',
        platformConfigurable: false,
        credentialKind: 'opaque',
        credentialField: 'additionalModels'
    },
    {
        id: 'spark',
        title: '讯飞星火',
        pluginName: 'chatluna-spark-adapter',
        platformDefault: 'spark',
        platformConfigurable: false,
        credentialKind: 'opaque',
        credentialField: 'appConfigs'
    }
]

export const getAdapterDescriptor = (id: string) => {
    return adapterDescriptors.find((item) => item.id === id)
}

export interface ChatLunaAdapterCredentialEntry {
    apiKey: string
    apiEndpoint: string
    enabled: boolean
}

export type ChatLunaAdapterStatus =
    | 'running'
    | 'configured'
    | 'available'
    | 'unsupported'

export interface ChatLunaAdapterInstance {
    /** 以条目的 activeKey（去除 ~ 前缀）作为稳定唯一标识。 */
    instanceKey: string
    adapterId: string
    title: string
    pluginName: string
    credentialKind: ChatLunaAdapterCredentialKind
    platformConfigurable: boolean
    endpointPlaceholder?: string
    disabled: boolean
    platform: string
    credentials: ChatLunaAdapterCredentialEntry[]
    extraConfig: Record<string, unknown>
    modelCount: number
    status: ChatLunaAdapterStatus
}

export interface ChatLunaAdapterType {
    id: string
    title: string
    pluginName: string
    credentialKind: ChatLunaAdapterCredentialKind
    platformConfigurable: boolean
    endpointPlaceholder?: string
    platformDefault: string
    instanceCount: number
    canCreate: boolean
    createReason?: string
}

export interface ChatLunaAdapterListResult {
    instances: ChatLunaAdapterInstance[]
    types: ChatLunaAdapterType[]
    /** platform 名 → adapter 标题，用于模型列表展示适配器名称。 */
    platformMap: Record<string, string>
    writable: boolean
    updatedAt: string
    reason?: string
}

export interface ChatLunaAdapterSaveInput {
    adapterId: string
    /** 不传则新建实例；传则更新该 activeKey 对应实例。 */
    instanceKey?: string
    platform?: string
    credentials: ChatLunaAdapterCredentialEntry[]
}

export interface ChatLunaAdapterToggleInput {
    instanceKey: string
    enabled: boolean
}

export interface ChatLunaAdapterDeleteInput {
    instanceKey: string
}

export interface ChatLunaAdapterMutationResult {
    ok: boolean
    instanceKey?: string
    status?: ChatLunaAdapterStatus
    reason?: string
}

const coerceReason = (error: unknown) => {
    if (error instanceof Error) return error.message
    return String(error)
}

const emptyCredential = (): ChatLunaAdapterCredentialEntry => ({
    apiKey: '',
    apiEndpoint: '',
    enabled: true
})

const coerceCredentialRow = (
    kind: ChatLunaAdapterCredentialKind,
    row: unknown
): ChatLunaAdapterCredentialEntry | null => {
    if (!Array.isArray(row)) return null

    const entry = emptyCredential()

    if (kind === 'api-endpoint-enabled') {
        entry.apiKey = typeof row[0] === 'string' ? row[0] : ''
        entry.apiEndpoint = typeof row[1] === 'string' ? row[1] : ''
        entry.enabled = row[2] !== false
    } else if (kind === 'api-enabled') {
        entry.apiKey = typeof row[0] === 'string' ? row[0] : ''
        entry.enabled = row[1] !== false
    } else if (kind === 'endpoint-enabled') {
        entry.apiEndpoint = typeof row[0] === 'string' ? row[0] : ''
        entry.enabled = row[1] !== false
    } else {
        return null
    }

    return entry
}

const serializeCredentialRow = (
    kind: ChatLunaAdapterCredentialKind,
    entry: ChatLunaAdapterCredentialEntry
): unknown[] => {
    if (kind === 'api-endpoint-enabled') {
        return [entry.apiKey, entry.apiEndpoint, entry.enabled]
    }
    if (kind === 'api-enabled') {
        return [entry.apiKey, entry.enabled]
    }

    return [entry.apiEndpoint, entry.enabled]
}

const readCredentials = (
    descriptor: ChatLunaAdapterDescriptor,
    config: Record<string, unknown>
): ChatLunaAdapterCredentialEntry[] => {
    if (descriptor.credentialKind === 'opaque') return []

    const rows = config[descriptor.credentialField]
    if (!Array.isArray(rows)) return []

    return rows
        .map((row) => coerceCredentialRow(descriptor.credentialKind, row))
        .filter((row): row is ChatLunaAdapterCredentialEntry => Boolean(row))
}

const sanitizeCredentials = (
    descriptor: ChatLunaAdapterDescriptor,
    credentials: ChatLunaAdapterCredentialEntry[]
): ChatLunaAdapterCredentialEntry[] => {
    return credentials
        .map((entry) => ({
            apiKey: typeof entry.apiKey === 'string' ? entry.apiKey.trim() : '',
            apiEndpoint:
                typeof entry.apiEndpoint === 'string'
                    ? entry.apiEndpoint.trim()
                    : '',
            enabled: entry.enabled !== false
        }))
        .filter((entry) => {
            if (descriptor.credentialKind === 'endpoint-enabled') {
                return entry.apiEndpoint.length > 0
            }

            return entry.apiKey.length > 0
        })
}

const resolvePlatform = (
    descriptor: ChatLunaAdapterDescriptor,
    config: Record<string, unknown>
) => {
    if (descriptor.platformConfigurable) {
        const platform = config.platform
        if (typeof platform === 'string' && platform.length > 0) {
            return platform
        }
    }

    return descriptor.platformDefault
}

interface ChatLunaPlatformServiceLike {
    platform?: {
        listAllModels?: (type: number) => {
            value?: unknown
        }
    }
}

const countModelsByPlatform = (ctx: Context): Map<string, number> => {
    const counts = new Map<string, number>()
    const chatluna = ctx.get('chatluna') as
        | ChatLunaPlatformServiceLike
        | undefined
    const listAllModels = chatluna?.platform?.listAllModels

    if (!listAllModels) return counts

    let source: unknown
    try {
        source = listAllModels.call(chatluna!.platform, 0)?.value
    } catch {
        return counts
    }

    if (!Array.isArray(source)) return counts

    for (const item of source) {
        if (!isRecord(item)) continue
        const platform = item.platform
        if (typeof platform !== 'string' || !platform) continue
        counts.set(platform, (counts.get(platform) ?? 0) + 1)
    }

    return counts
}

const resolveStatus = (
    disabled: boolean,
    credentialKind: ChatLunaAdapterCredentialKind,
    modelCount: number
): ChatLunaAdapterStatus => {
    if (credentialKind === 'opaque') {
        return modelCount > 0 ? 'running' : 'unsupported'
    }
    if (disabled) return 'configured'

    return modelCount > 0 ? 'running' : 'configured'
}

const findAdapterMatches = (
    ctx: Context,
    descriptor: ChatLunaAdapterDescriptor
): PluginConfigMatch[] => {
    const loader = getLoader(ctx)
    const plugins = loader?.config?.plugins
    if (!plugins) return []

    const matches: PluginConfigMatch[] = []
    findPluginConfigMatches(
        plugins,
        descriptor.pluginName,
        loader?.entry,
        matches
    )

    return matches
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
        disabled: match.disabled,
        platform,
        credentials,
        extraConfig,
        modelCount,
        status: resolveStatus(
            match.disabled,
            descriptor.credentialKind,
            modelCount
        )
    }
}

export const listChatLunaAdapters = (
    ctx: Context
): ChatLunaAdapterListResult => {
    const loader = getLoader(ctx)
    const writable =
        Boolean(loader?.reload && loader.unload && loader.writeConfig) &&
        loader?.writable !== false &&
        Boolean(loader?.config?.plugins)

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

        // platform 硬编码的 adapter 已存在实例时不可再建（会触发 chatluna
        // PLUGIN_ALREADY_REGISTERED）；platform 可配置的可重复新建。
        const blockedByExisting =
            !descriptor.platformConfigurable && matches.length > 0
        const canCreate =
            writable &&
            descriptor.credentialKind !== 'opaque' &&
            !blockedByExisting

        types.push({
            id: descriptor.id,
            title: descriptor.title,
            pluginName: descriptor.pluginName,
            credentialKind: descriptor.credentialKind,
            platformConfigurable: descriptor.platformConfigurable,
            endpointPlaceholder: descriptor.endpointPlaceholder,
            platformDefault: descriptor.platformDefault,
            instanceCount: matches.length,
            canCreate,
            createReason:
                descriptor.credentialKind === 'opaque'
                    ? '配置结构特殊，请在 Koishi 插件配置页编辑。'
                    : blockedByExisting
                      ? '该平台固定且已配置，如需多份请使用 OpenAI Like 等平台名可自定义的适配器。'
                      : undefined
        })
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

interface MutationContext {
    loader: NonNullable<ReturnType<typeof getLoader>>
    plugins: Record<string, unknown>
}

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

    return { loader, plugins }
}

const isLoaderReady = (
    value: MutationContext | ChatLunaAdapterMutationResult
): value is MutationContext => {
    return 'loader' in value
}

/** 在 config.plugins 中按 activeKey（去 ~ 前缀）定位某个具体实例。 */
const findInstanceMatch = (
    ctx: Context,
    instanceKey: string
): {
    descriptor: ChatLunaAdapterDescriptor
    match: PluginConfigMatch
} | null => {
    for (const descriptor of adapterDescriptors) {
        const matches = findAdapterMatches(ctx, descriptor)
        const match = matches.find((item) => item.activeKey === instanceKey)
        if (match) return { descriptor, match }
    }

    return null
}

export const saveChatLunaAdapter = async (
    ctx: Context,
    input: ChatLunaAdapterSaveInput
): Promise<ChatLunaAdapterMutationResult> => {
    const ready = prepareLoader(ctx)
    if (!isLoaderReady(ready)) return ready

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
    const baseConfig = isRecord(match?.config) ? { ...match!.config } : {}
    const credentials = sanitizeCredentials(descriptor, input.credentials)
    const rows = credentials.map((entry) =>
        serializeCredentialRow(descriptor.credentialKind, entry)
    )

    baseConfig[descriptor.credentialField] = rows

    if (descriptor.platformConfigurable) {
        const platform =
            typeof input.platform === 'string' ? input.platform.trim() : ''
        baseConfig.platform = platform || descriptor.platformDefault
    }

    try {
        if (match) {
            if (match.disabled) {
                // 已禁用的条目仅写回配置内容，不重新加载。
                match.parentConfig[match.key] = baseConfig
            } else if (match.parentContext) {
                await loader.reload!(
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
            await loader.reload!(loader.entry, key, baseConfig)
            plugins[key] = baseConfig
        }

        await loader.writeConfig!()

        return {
            ok: true,
            instanceKey: match?.activeKey,
            status: 'configured'
        }
    } catch (error) {
        return { ok: false, reason: coerceReason(error) }
    }
}

export const toggleChatLunaAdapter = async (
    ctx: Context,
    input: ChatLunaAdapterToggleInput
): Promise<ChatLunaAdapterMutationResult> => {
    const ready = prepareLoader(ctx)
    if (!isLoaderReady(ready)) return ready

    const { loader } = ready
    const located = findInstanceMatch(ctx, input.instanceKey)

    if (!located) {
        return { ok: false, reason: '目标配置实例不存在，请刷新后重试。' }
    }

    const { match } = located

    // enabled === !disabled 时无需变更。
    if (input.enabled !== match.disabled) {
        return {
            ok: true,
            instanceKey: match.activeKey,
            status: 'configured'
        }
    }

    try {
        if (input.enabled) {
            if (!match.parentContext) {
                return { ok: false, reason: '无法解析父上下文。' }
            }
            await loader.reload!(
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
                loader.unload!(match.parentContext, match.activeKey)
            }
            renameConfigKey(
                match.parentConfig,
                match.key,
                `~${match.activeKey}`,
                match.config
            )
        }

        await loader.writeConfig!()

        return {
            ok: true,
            instanceKey: match.activeKey,
            status: 'configured'
        }
    } catch (error) {
        return { ok: false, reason: coerceReason(error) }
    }
}

export const deleteChatLunaAdapter = async (
    ctx: Context,
    input: ChatLunaAdapterDeleteInput
): Promise<ChatLunaAdapterMutationResult> => {
    const ready = prepareLoader(ctx)
    if (!isLoaderReady(ready)) return ready

    const { loader } = ready
    const located = findInstanceMatch(ctx, input.instanceKey)

    if (!located) {
        return { ok: true, instanceKey: input.instanceKey, status: 'available' }
    }

    const { match } = located

    try {
        if (!match.disabled && match.parentContext) {
            loader.unload!(match.parentContext, match.activeKey)
        }

        delete match.parentConfig[match.activeKey]
        delete match.parentConfig[`~${match.activeKey}`]

        await loader.writeConfig!()

        return { ok: true, instanceKey: input.instanceKey, status: 'available' }
    } catch (error) {
        return { ok: false, reason: coerceReason(error) }
    }
}




