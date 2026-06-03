import { resolve } from 'path'
import { Context, Service } from 'koishi'
import { coerceReason } from './shared'
import {
    createHubModules,
    getHubModuleDefinition,
    type HubConsoleData,
    type HubModuleId,
    type HubModuleToggleResult,
    isToggleableHubModule
} from './modules'
import {
    findPluginConfigMatches,
    getLoader,
    type PluginConfigMatch,
    renameConfigKey
} from './loader'
import {
    type ChatLunaAdapterDeleteInput,
    type ChatLunaAdapterListResult,
    type ChatLunaAdapterMutationResult,
    type ChatLunaAdapterSaveInput,
    type ChatLunaAdapterToggleInput,
    deleteChatLunaAdapter,
    listChatLunaAdapters,
    saveChatLunaAdapter,
    toggleChatLunaAdapter
} from './adapters'
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
    deleteChatLunaConversation,
    type DeleteChatLunaConversationInput,
    deleteChatLunaCorePreset,
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
} from './core'
import type { Config } from './config'

/** The slice of the ChatLuna service the core-log instrumentation patches. */
export interface ChatLunaCallbackProviderService {
    resolveCallbacks?: (input: unknown) => Promise<unknown>
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
            this.coreLogStore.load()
        })

        ctx.on('dispose', () => {
            this.unregisterCoreLogProvider()
            this.coreLogStore.dispose()
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

    /**
     * Enable or disable an ecosystem module by toggling its single Koishi loader
     * config entry. Refuses ambiguous (multiple entries) or unconfigured modules
     * rather than guessing which entry to change.
     */
    async setModuleEnabled(
        moduleId: HubModuleId,
        enabled: boolean
    ): Promise<HubModuleToggleResult> {
        const definition = getHubModuleDefinition(moduleId)

        if (!definition || !isToggleableHubModule(moduleId)) {
            return this.toggleFailure(
                moduleId,
                enabled,
                'This Hub module cannot be enabled or disabled.'
            )
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
            return this.toggleFailure(
                moduleId,
                enabled,
                'Koishi loader is not available.'
            )
        }

        if (loader.writable === false) {
            return this.toggleFailure(
                moduleId,
                enabled,
                'Koishi config is not writable.'
            )
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
            return this.toggleFailure(
                moduleId,
                enabled,
                `Cannot resolve parent context for ${definition.pluginName}.`
            )
        }

        // Already in the requested state — nothing to change.
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
            return this.toggleFailure(moduleId, enabled, coerceReason(error))
        }
    }

    private toggleFailure(
        moduleId: HubModuleId,
        enabled: boolean,
        reason: string
    ): HubModuleToggleResult {
        return { ok: false, moduleId, enabled, status: 'failed', reason }
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

    // --- core log queries -------------------------------------------------

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

    // --- models & adapters ------------------------------------------------

    async listCoreModels(): Promise<ChatLunaCoreModelListResult> {
        return listChatLunaCoreModels(this.ctx)
    }

    listAdapters(): ChatLunaAdapterListResult {
        return listChatLunaAdapters(this.ctx)
    }

    async saveAdapter(
        input: ChatLunaAdapterSaveInput
    ): Promise<ChatLunaAdapterMutationResult> {
        return saveChatLunaAdapter(this.ctx, input)
    }

    async toggleAdapter(
        input: ChatLunaAdapterToggleInput
    ): Promise<ChatLunaAdapterMutationResult> {
        return toggleChatLunaAdapter(this.ctx, input)
    }

    async deleteAdapter(
        input: ChatLunaAdapterDeleteInput
    ): Promise<ChatLunaAdapterMutationResult> {
        return deleteChatLunaAdapter(this.ctx, input)
    }

    // --- conversations ----------------------------------------------------

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

    // --- presets ----------------------------------------------------------

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
        return validateChatLunaCorePreset(this.ctx, input)
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
