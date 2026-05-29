import { DataService } from '@koishijs/plugin-console'
import { resolve } from 'path'
import { Context, Schema, Service } from 'koishi'
import {
    createHubModules,
    getHubModuleDefinition,
    type HubConsoleData,
    type HubModuleId,
    type HubModuleToggleResult,
    isToggleableHubModule
} from './webui/modules'
import {
    batchDeleteChatLunaConversation,
    type BatchDeleteChatLunaConversationInput,
    type BatchDeleteChatLunaConversationResult,
    batchUpdateChatLunaConversationUsage,
    type BatchUpdateChatLunaConversationUsageInput,
    type BatchUpdateChatLunaConversationUsageResult,
    type ChatLunaConversationListItem,
    type ChatLunaConversationListQuery,
    type ChatLunaConversationOptions,
    type ChatLunaConversationRouteListResult,
    type ChatLunaCoreLogDetail,
    type ChatLunaCoreLogGetInput,
    type ChatLunaCoreLogListQuery,
    type ChatLunaCoreLogListResult,
    ChatLunaCoreLogStore,
    type ChatLunaCoreModelListResult,
    type ChatLunaCorePresetCreateInput,
    type ChatLunaCorePresetDeleteInput,
    type ChatLunaCorePresetDetail,
    type ChatLunaCorePresetGetInput,
    type ChatLunaCorePresetListResult,
    type ChatLunaCorePresetUpdateInput,
    type ChatLunaCorePresetValidateInput,
    type ChatLunaCorePresetValidationResult,
    createChatLunaCorePreset,
    deleteChatLunaCorePreset,
    deleteChatLunaConversation,
    type DeleteChatLunaConversationInput,
    getChatLunaCorePreset,
    listChatLunaConversationOptions,
    listChatLunaConversationRoutes,
    listChatLunaConversations,
    listChatLunaCoreModels,
    listChatLunaCorePresets,
    type PageResult,
    updateChatLunaConversationUsage,
    type UpdateChatLunaConversationUsageInput,
    updateChatLunaCorePreset,
    validateChatLunaCorePreset
} from './webui/core'

export const name = 'chatluna-hub'

export interface Config {
    hideDependencyGraphEntry?: boolean
}

export const Config: Schema<Config> = Schema.object({
    hideDependencyGraphEntry: Schema.boolean()
        .default(false)
        .description('隐藏 Koishi 侧边栏依赖图页面入口')
})

const loaderRecord = Symbol.for('koishi.loader.record')

interface LoaderLike {
    config?: {
        plugins?: Record<string, unknown>
    }
    entry?: Context
    writable?: boolean
    reload?: (parent: Context, key: string, source: unknown) => Promise<unknown>
    unload?: (parent: Context, key: string) => void
    writeConfig?: () => Promise<void>
}

interface PluginConfigMatch {
    key: string
    activeKey: string
    disabled: boolean
    config: unknown
    parentConfig: Record<string, unknown>
    parentContext?: Context
}

interface ChatLunaCallbackProviderService {
    resolveCallbacks?: (input: unknown) => Promise<unknown>
}

const normalizePluginName = (name: string | undefined) => {
    return name
        ?.replace(/^@koishijs\/plugin-/, '')
        .replace(/^@[^/]+\/koishi-plugin-/, '')
        .replace(/^koishi-plugin-/, '')
        .replace(/^@[^/]+\//, '')
        .toLowerCase()
}

const getLoader = (ctx: Context): LoaderLike | undefined => {
    return (ctx as Context & { loader?: LoaderLike }).loader
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const getPluginNameFromConfigKey = (key: string) => {
    const activeKey = key.startsWith('~') ? key.slice(1) : key
    const [name] = activeKey.split(':', 1)

    return normalizePluginName(name)
}

const getActiveConfigKey = (key: string) => {
    return key.startsWith('~') ? key.slice(1) : key
}

const getForkContext = (parent: Context | undefined, key: string) => {
    if (!parent) return

    const records = (
        parent.scope as unknown as Record<
            symbol,
            Record<string, { ctx?: Context }> | undefined
        >
    )[loaderRecord]

    return records?.[key]?.ctx
}

const insertConfigKey = (
    config: Record<string, unknown>,
    key: string,
    value: unknown,
    rest: string[]
) => {
    const temp: Record<string, unknown> = {
        [key]: value
    }

    for (const item of rest) {
        if (item === key) continue
        temp[item] = config[item]
        delete config[item]
    }

    Object.assign(config, temp)
}

const renameConfigKey = (
    config: Record<string, unknown>,
    oldKey: string,
    newKey: string,
    value: unknown
) => {
    const keys = Object.keys(config)
    const index = keys.findIndex((key) => key === oldKey || key === newKey)
    const rest = index < 0 ? [] : keys.slice(index + 1)

    delete config[oldKey]
    delete config[newKey]
    insertConfigKey(config, newKey, value, rest)
}

const findPluginConfigMatches = (
    config: Record<string, unknown>,
    pluginName: string,
    parentContext: Context | undefined,
    matches: PluginConfigMatch[]
) => {
    const target = normalizePluginName(pluginName)
    if (!target) return

    for (const [key, value] of Object.entries(config)) {
        if (key.startsWith('$')) continue

        const activeKey = getActiveConfigKey(key)
        const plugin = getPluginNameFromConfigKey(key)
        const disabled = key.startsWith('~')

        if (plugin === target) {
            matches.push({
                key,
                activeKey,
                disabled,
                config: value,
                parentConfig: config,
                parentContext
            })
        }

        if (plugin !== 'group' || !isRecord(value)) continue
        findPluginConfigMatches(
            value,
            pluginName,
            getForkContext(parentContext, activeKey),
            matches
        )
    }
}

const coerceReason = (error: unknown) => {
    if (error instanceof Error) return error.message
    return String(error)
}

export class ChatLunaHubService extends Service {
    private readonly coreLogStore: ChatLunaCoreLogStore

    private disposeCoreLogProvider?: () => void

    constructor(
        public readonly ctx: Context,
        public readonly config: Config = {}
    ) {
        super(ctx, 'chatluna_hub')

        this.coreLogStore = new ChatLunaCoreLogStore({
            filePath: resolve(
                ctx.baseDir,
                'data',
                'chatluna-hub',
                'core-logs.json'
            ),
            logger: ctx.logger('chatluna-hub')
        })

        // Load persisted logs once the service starts; failures are non-fatal.
        ctx.on('ready', () => {
            void this.coreLogStore.load()
        })

        ctx.on('dispose', () => {
            this.unregisterCoreLogProvider()
            void this.coreLogStore.dispose()
        })
    }

    async getConsoleData(): Promise<HubConsoleData> {
        return {
            modules: createHubModules(this.ctx),
            config: {
                hideDependencyGraphEntry:
                    this.config.hideDependencyGraphEntry ?? false
            }
        }
    }

    async setModuleEnabled(
        moduleId: HubModuleId,
        enabled: boolean
    ): Promise<HubModuleToggleResult> {
        const definition = getHubModuleDefinition(moduleId)

        if (!definition || !isToggleableHubModule(moduleId)) {
            return {
                ok: false,
                moduleId,
                enabled,
                status: 'failed',
                reason: 'This Hub module cannot be enabled or disabled.'
            }
        }

        const loader = getLoader(this.ctx)
        const plugins = loader?.config?.plugins

        if (
            !loader?.entry ||
            !plugins ||
            !loader.reload ||
            !loader.unload ||
            !loader.writeConfig
        ) {
            return {
                ok: false,
                moduleId,
                enabled,
                status: 'failed',
                reason: 'Koishi loader is not available.'
            }
        }

        if (loader.writable === false) {
            return {
                ok: false,
                moduleId,
                enabled,
                status: 'failed',
                reason: 'Koishi config is not writable.'
            }
        }

        const matches: PluginConfigMatch[] = []
        findPluginConfigMatches(
            plugins,
            definition.pluginName!,
            loader.entry,
            matches
        )

        if (!matches.length) {
            return {
                ok: false,
                moduleId,
                enabled,
                status: 'not-configured',
                reason: `${definition.pluginName} is not configured.`
            }
        }

        if (matches.length > 1) {
            return {
                ok: false,
                moduleId,
                enabled,
                status: 'ambiguous',
                reason: `${definition.pluginName} has multiple config entries.`
            }
        }

        const match = matches[0]

        if (!match.parentContext) {
            return {
                ok: false,
                moduleId,
                enabled,
                status: 'failed',
                reason: `Cannot resolve parent context for ${definition.pluginName}.`
            }
        }

        if (enabled !== match.disabled) {
            return {
                ok: true,
                moduleId,
                enabled,
                status: enabled ? 'enabled' : 'disabled'
            }
        }

        try {
            if (enabled) {
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
                loader.unload(match.parentContext, match.activeKey)
                renameConfigKey(
                    match.parentConfig,
                    match.key,
                    `~${match.activeKey}`,
                    match.config
                )
            }

            await loader.writeConfig()

            return {
                ok: true,
                moduleId,
                enabled,
                status: enabled ? 'enabled' : 'disabled'
            }
        } catch (error) {
            return {
                ok: false,
                moduleId,
                enabled,
                status: 'failed',
                reason: coerceReason(error)
            }
        }
    }

    async listCoreModels(): Promise<ChatLunaCoreModelListResult> {
        return listChatLunaCoreModels(this.ctx)
    }

    registerCoreLogProvider(chatluna: ChatLunaCallbackProviderService) {
        this.unregisterCoreLogProvider()

        const logger = this.ctx.logger('chatluna-hub')
        const target = chatluna

        if (typeof target.resolveCallbacks !== 'function') {
            logger.warn(
                'chatluna.resolveCallbacks is unavailable; core logs cannot capture model runs.'
            )
            return () => {}
        }

        const original = target.resolveCallbacks.bind(target)
        const store = this.coreLogStore

        // Patch resolveCallbacks instead of using registerCallbacksProvider:
        // the official path adds handlers to the non-inheritable slot, so they
        // never reach the nested LLM run. Here we re-add them as inheritable.
        // Instrumentation must never alter chat control flow — on any failure
        // we log and return the original manager untouched.
        const patched = async (input: unknown) => {
            const manager = await original(input)

            try {
                return store.instrumentCallbacks(manager, input)
            } catch (error) {
                logger.warn(
                    'core log instrumentation failed: %s',
                    coerceReason(error)
                )
                return manager
            }
        }

        target.resolveCallbacks = patched

        const dispose = () => {
            if (target.resolveCallbacks === patched) {
                target.resolveCallbacks = original
            } else {
                // Another consumer patched resolveCallbacks after us. Restoring
                // now would clobber their patch, so we leave the chain intact
                // and only drop our reference.
                logger.warn(
                    'chatluna.resolveCallbacks was patched by another consumer; ' +
                        'skipping restore to avoid breaking it.'
                )
            }
        }

        this.disposeCoreLogProvider = dispose

        return () => {
            if (this.disposeCoreLogProvider === dispose) {
                this.disposeCoreLogProvider = undefined
            }

            dispose()
        }
    }

    unregisterCoreLogProvider() {
        this.disposeCoreLogProvider?.()
        this.disposeCoreLogProvider = undefined
    }

    async listCoreLogs(
        query: ChatLunaCoreLogListQuery
    ): Promise<ChatLunaCoreLogListResult> {
        return this.coreLogStore.list(query)
    }

    async getCoreLog(
        input: ChatLunaCoreLogGetInput
    ): Promise<ChatLunaCoreLogDetail> {
        return this.coreLogStore.get(input)
    }

    async clearCoreLogs(): Promise<{ success: true }> {
        this.coreLogStore.clear()

        return { success: true }
    }

    async listCoreConversations(
        query: ChatLunaConversationListQuery
    ): Promise<PageResult<ChatLunaConversationListItem>> {
        return listChatLunaConversations(this.ctx, query)
    }

    async listCoreConversationRoutes(): Promise<ChatLunaConversationRouteListResult> {
        return listChatLunaConversationRoutes(this.ctx)
    }

    async listCoreConversationOptions(): Promise<ChatLunaConversationOptions> {
        return listChatLunaConversationOptions(this.ctx)
    }

    async updateCoreConversationUsage(
        input: UpdateChatLunaConversationUsageInput
    ): Promise<ChatLunaConversationListItem> {
        return updateChatLunaConversationUsage(this.ctx, input)
    }

    async batchUpdateCoreConversationUsage(
        input: BatchUpdateChatLunaConversationUsageInput
    ): Promise<BatchUpdateChatLunaConversationUsageResult> {
        return batchUpdateChatLunaConversationUsage(this.ctx, input)
    }

    async deleteCoreConversation(
        input: DeleteChatLunaConversationInput
    ): Promise<{ success: true }> {
        return deleteChatLunaConversation(this.ctx, input)
    }

    async batchDeleteCoreConversation(
        input: BatchDeleteChatLunaConversationInput
    ): Promise<BatchDeleteChatLunaConversationResult> {
        return batchDeleteChatLunaConversation(this.ctx, input)
    }

    async listCorePresets(): Promise<ChatLunaCorePresetListResult> {
        return listChatLunaCorePresets(this.ctx)
    }

    async getCorePreset(
        input: ChatLunaCorePresetGetInput
    ): Promise<ChatLunaCorePresetDetail> {
        return getChatLunaCorePreset(this.ctx, input)
    }

    async validateCorePreset(
        input: ChatLunaCorePresetValidateInput
    ): Promise<ChatLunaCorePresetValidationResult> {
        return validateChatLunaCorePreset(input)
    }

    async createCorePreset(
        input: ChatLunaCorePresetCreateInput
    ): Promise<ChatLunaCorePresetDetail> {
        return createChatLunaCorePreset(this.ctx, input)
    }

    async updateCorePreset(
        input: ChatLunaCorePresetUpdateInput
    ): Promise<ChatLunaCorePresetDetail> {
        return updateChatLunaCorePreset(this.ctx, input)
    }

    async deleteCorePreset(
        input: ChatLunaCorePresetDeleteInput
    ): Promise<{ success: true }> {
        return deleteChatLunaCorePreset(this.ctx, input)
    }
}

class ChatLunaHubConsoleService extends DataService<HubConsoleData> {
    static inject = ['console', 'chatluna_hub']

    constructor(ctx: Context) {
        super(ctx, 'chatluna_hub_webui', {
            immediate: true
        })

        const refreshRuntimeData = ctx.debounce(() => this.refresh(false), 0)
        ctx.on('internal/runtime', refreshRuntimeData)
        ctx.on('internal/fork', refreshRuntimeData)
        ctx.on('internal/status', refreshRuntimeData)
    }

    async get() {
        return await this.ctx.chatluna_hub.getConsoleData()
    }
}

export function apply(ctx: Context, config: Config = {}) {
    ctx.plugin(ChatLunaHubService, config)

    ctx.inject(['chatluna_hub', 'chatluna'], (ctx) => {
        const chatluna = ctx.get(
            'chatluna'
        ) as ChatLunaCallbackProviderService | null

        if (!chatluna) return

        const dispose = ctx.chatluna_hub.registerCoreLogProvider(chatluna)
        ctx.on('dispose', dispose)
    })

    ctx.inject(['console', 'chatluna_hub'], (ctx) => {
        const base = ctx.loader?.baseDir ?? process.cwd()
        ctx.console.addEntry({
            dev: resolve(
                base,
                'node_modules',
                'koishi-plugin-chatluna-hub',
                'client',
                'index.ts'
            ),
            prod: resolve(
                base,
                'node_modules',
                'koishi-plugin-chatluna-hub',
                'dist'
            )
        })

        ctx.console.addListener(
            'chatluna-hub/module/set-enabled',
            async (moduleId, enabled) => {
                const result = await ctx.chatluna_hub.setModuleEnabled(
                    moduleId,
                    enabled
                )

                await ctx.console.refresh('chatluna_hub_webui')
                return result
            },
            {
                authority: 4
            }
        )

        ctx.console.addListener(
            'chatluna-hub/core/models/list',
            async () => {
                return await ctx.chatluna_hub.listCoreModels()
            },
            {
                authority: 3
            }
        )

        ctx.console.addListener(
            'chatluna-hub/core/logs/list',
            async (query) => {
                return await ctx.chatluna_hub.listCoreLogs(query ?? {})
            },
            {
                authority: 3
            }
        )

        ctx.console.addListener(
            'chatluna-hub/core/logs/get',
            async (input) => {
                return await ctx.chatluna_hub.getCoreLog(input)
            },
            {
                authority: 3
            }
        )

        ctx.console.addListener(
            'chatluna-hub/core/logs/clear',
            async () => {
                return await ctx.chatluna_hub.clearCoreLogs()
            },
            {
                authority: 4
            }
        )

        ctx.console.addListener(
            'chatluna-hub/core/conversations/list',
            async (query) => {
                return await ctx.chatluna_hub.listCoreConversations(query ?? {})
            },
            {
                authority: 3
            }
        )

        ctx.console.addListener(
            'chatluna-hub/core/conversations/routes',
            async () => {
                return await ctx.chatluna_hub.listCoreConversationRoutes()
            },
            {
                authority: 3
            }
        )

        ctx.console.addListener(
            'chatluna-hub/core/conversations/options',
            async () => {
                return await ctx.chatluna_hub.listCoreConversationOptions()
            },
            {
                authority: 3
            }
        )

        ctx.console.addListener(
            'chatluna-hub/core/conversations/update-usage',
            async (input) => {
                return await ctx.chatluna_hub.updateCoreConversationUsage(input)
            },
            {
                authority: 4
            }
        )

        ctx.console.addListener(
            'chatluna-hub/core/conversations/batch-update-usage',
            async (input) => {
                return await ctx.chatluna_hub.batchUpdateCoreConversationUsage(
                    input
                )
            },
            {
                authority: 4
            }
        )

        ctx.console.addListener(
            'chatluna-hub/core/conversations/delete',
            async (input) => {
                return await ctx.chatluna_hub.deleteCoreConversation(input)
            },
            {
                authority: 4
            }
        )

        ctx.console.addListener(
            'chatluna-hub/core/conversations/batch-delete',
            async (input) => {
                return await ctx.chatluna_hub.batchDeleteCoreConversation(input)
            },
            {
                authority: 4
            }
        )

        ctx.console.addListener(
            'chatluna-hub/core/presets/list',
            async () => {
                return await ctx.chatluna_hub.listCorePresets()
            },
            {
                authority: 3
            }
        )

        ctx.console.addListener(
            'chatluna-hub/core/presets/get',
            async (input) => {
                return await ctx.chatluna_hub.getCorePreset(input)
            },
            {
                authority: 3
            }
        )

        ctx.console.addListener(
            'chatluna-hub/core/presets/validate',
            async (input) => {
                return await ctx.chatluna_hub.validateCorePreset(input)
            },
            {
                authority: 3
            }
        )

        ctx.console.addListener(
            'chatluna-hub/core/presets/create',
            async (input) => {
                return await ctx.chatluna_hub.createCorePreset(input)
            },
            {
                authority: 4
            }
        )

        ctx.console.addListener(
            'chatluna-hub/core/presets/update',
            async (input) => {
                return await ctx.chatluna_hub.updateCorePreset(input)
            },
            {
                authority: 4
            }
        )

        ctx.console.addListener(
            'chatluna-hub/core/presets/delete',
            async (input) => {
                return await ctx.chatluna_hub.deleteCorePreset(input)
            },
            {
                authority: 4
            }
        )

        ctx.plugin(ChatLunaHubConsoleService)
    })
}

export const inject = {
    optional: ['console', 'chatluna']
}

declare module 'koishi' {
    interface Context {
        chatluna_hub: ChatLunaHubService
    }
}

declare module '@koishijs/plugin-console' {
    interface Events {
        'chatluna-hub/module/set-enabled': (
            moduleId: HubModuleId,
            enabled: boolean
        ) => Promise<HubModuleToggleResult>
        'chatluna-hub/core/models/list': () => Promise<ChatLunaCoreModelListResult>
        'chatluna-hub/core/conversations/list': (
            query: ChatLunaConversationListQuery
        ) => Promise<PageResult<ChatLunaConversationListItem>>
        'chatluna-hub/core/conversations/routes': () => Promise<ChatLunaConversationRouteListResult>
        'chatluna-hub/core/conversations/options': () => Promise<ChatLunaConversationOptions>
        'chatluna-hub/core/conversations/update-usage': (
            input: UpdateChatLunaConversationUsageInput
        ) => Promise<ChatLunaConversationListItem>
        'chatluna-hub/core/conversations/batch-update-usage': (
            input: BatchUpdateChatLunaConversationUsageInput
        ) => Promise<BatchUpdateChatLunaConversationUsageResult>
        'chatluna-hub/core/conversations/delete': (
            input: DeleteChatLunaConversationInput
        ) => Promise<{ success: true }>
        'chatluna-hub/core/conversations/batch-delete': (
            input: BatchDeleteChatLunaConversationInput
        ) => Promise<BatchDeleteChatLunaConversationResult>
        'chatluna-hub/core/logs/list': (
            query: ChatLunaCoreLogListQuery
        ) => Promise<ChatLunaCoreLogListResult>
        'chatluna-hub/core/logs/get': (
            input: ChatLunaCoreLogGetInput
        ) => Promise<ChatLunaCoreLogDetail>
        'chatluna-hub/core/logs/clear': () => Promise<{ success: true }>
        'chatluna-hub/core/presets/list': () => Promise<ChatLunaCorePresetListResult>
        'chatluna-hub/core/presets/get': (
            input: ChatLunaCorePresetGetInput
        ) => Promise<ChatLunaCorePresetDetail>
        'chatluna-hub/core/presets/validate': (
            input: ChatLunaCorePresetValidateInput
        ) => Promise<ChatLunaCorePresetValidationResult>
        'chatluna-hub/core/presets/create': (
            input: ChatLunaCorePresetCreateInput
        ) => Promise<ChatLunaCorePresetDetail>
        'chatluna-hub/core/presets/update': (
            input: ChatLunaCorePresetUpdateInput
        ) => Promise<ChatLunaCorePresetDetail>
        'chatluna-hub/core/presets/delete': (
            input: ChatLunaCorePresetDeleteInput
        ) => Promise<{ success: true }>
    }

    namespace Console {
        interface Services {
            chatluna_hub_webui: DataService<HubConsoleData>
        }
    }
}

declare module '@koishijs/console' {
    interface Events {
        'chatluna-hub/module/set-enabled': (
            moduleId: HubModuleId,
            enabled: boolean
        ) => Promise<HubModuleToggleResult>
        'chatluna-hub/core/models/list': () => Promise<ChatLunaCoreModelListResult>
        'chatluna-hub/core/conversations/list': (
            query: ChatLunaConversationListQuery
        ) => Promise<PageResult<ChatLunaConversationListItem>>
        'chatluna-hub/core/conversations/routes': () => Promise<ChatLunaConversationRouteListResult>
        'chatluna-hub/core/conversations/options': () => Promise<ChatLunaConversationOptions>
        'chatluna-hub/core/conversations/update-usage': (
            input: UpdateChatLunaConversationUsageInput
        ) => Promise<ChatLunaConversationListItem>
        'chatluna-hub/core/conversations/batch-update-usage': (
            input: BatchUpdateChatLunaConversationUsageInput
        ) => Promise<BatchUpdateChatLunaConversationUsageResult>
        'chatluna-hub/core/conversations/delete': (
            input: DeleteChatLunaConversationInput
        ) => Promise<{ success: true }>
        'chatluna-hub/core/conversations/batch-delete': (
            input: BatchDeleteChatLunaConversationInput
        ) => Promise<BatchDeleteChatLunaConversationResult>
        'chatluna-hub/core/logs/list': (
            query: ChatLunaCoreLogListQuery
        ) => Promise<ChatLunaCoreLogListResult>
        'chatluna-hub/core/logs/get': (
            input: ChatLunaCoreLogGetInput
        ) => Promise<ChatLunaCoreLogDetail>
        'chatluna-hub/core/logs/clear': () => Promise<{ success: true }>
        'chatluna-hub/core/presets/list': () => Promise<ChatLunaCorePresetListResult>
        'chatluna-hub/core/presets/get': (
            input: ChatLunaCorePresetGetInput
        ) => Promise<ChatLunaCorePresetDetail>
        'chatluna-hub/core/presets/validate': (
            input: ChatLunaCorePresetValidateInput
        ) => Promise<ChatLunaCorePresetValidationResult>
        'chatluna-hub/core/presets/create': (
            input: ChatLunaCorePresetCreateInput
        ) => Promise<ChatLunaCorePresetDetail>
        'chatluna-hub/core/presets/update': (
            input: ChatLunaCorePresetUpdateInput
        ) => Promise<ChatLunaCorePresetDetail>
        'chatluna-hub/core/presets/delete': (
            input: ChatLunaCorePresetDeleteInput
        ) => Promise<{ success: true }>
    }

    namespace Console {
        interface Services {
            chatluna_hub_webui: DataService<HubConsoleData>
        }
    }
}

export * from './webui/modules'
export * from './webui/core'
