import { resolve } from 'path'
import { Context, Service } from 'koishi'
import { coerceReason } from './shared'
import {
    createHubModules,
    getHubModuleDefinition,
    type HubConsoleData,
    type HubModuleCreateConfigResult,
    type HubModuleId,
    type HubModuleToggleResult,
    isToggleableHubModule,
    resolveHubModuleState
} from './modules'
import {
    createConfigIdent,
    getConfigPathFromKey,
    getLoader,
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
import {
    type ChatLunaCreateModelService,
    registerChatLunaRequesterLogProvider
} from './core/requester-log'
import type { Config } from './config'

export type { ChatLunaCreateModelService }

export class ChatLunaHubService extends Service {
    private readonly coreLogStore: ChatLunaCoreLogStore
    private readonly moduleConfigCreations = new Map<
        HubModuleId,
        Promise<HubModuleCreateConfigResult>
    >()

    private disposeRequesterLogProvider?: () => void

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
            this.unregisterRequesterLogProvider()
            this.coreLogStore.dispose()
        })
    }

    async getConsoleData(): Promise<HubConsoleData> {
        return {
            modules: await createHubModules(this.ctx),
            config: {
                hideDependencyGraphEntry:
                    this.config.hideDependencyGraphEntry ?? false,
                enableHomeGraphAnimations:
                    this.config.enableHomeGraphAnimations ?? true
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

        const pluginName = definition.pluginName!
        const moduleState = await resolveHubModuleState(this.ctx, definition)

        if (!moduleState.installed) {
            return this.toggleFailure(
                moduleId,
                enabled,
                `${pluginName} is not installed.`
            )
        }

        if (moduleState.configStatus === 'not-configured') {
            return {
                ok: false,
                moduleId,
                enabled,
                status: 'not-configured',
                reason: `${pluginName} is not configured.`
            }
        }

        if (moduleState.configStatus === 'multiple') {
            return {
                ok: false,
                moduleId,
                enabled,
                status: 'ambiguous',
                reason: `${pluginName} has multiple config entries.`
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

        const match = moduleState.matches[0]

        if (!match.parentContext) {
            return this.toggleFailure(
                moduleId,
                enabled,
                `Cannot resolve parent context for ${pluginName}.`
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

    /**
     * Create a single empty Koishi loader config entry for an ecosystem module
     * that is installed but not yet present in koishi.yml. Returns the Console
     * config route so the client can navigate after refresh.
     */
    async createModuleConfig(
        moduleId: HubModuleId
    ): Promise<HubModuleCreateConfigResult> {
        const pendingCreation = this.moduleConfigCreations.get(moduleId)
        if (pendingCreation) return pendingCreation

        const creation = this.createModuleConfigOnce(moduleId)
        this.moduleConfigCreations.set(moduleId, creation)

        try {
            return await creation
        } finally {
            if (this.moduleConfigCreations.get(moduleId) === creation) {
                this.moduleConfigCreations.delete(moduleId)
            }
        }
    }

    private async createModuleConfigOnce(
        moduleId: HubModuleId
    ): Promise<HubModuleCreateConfigResult> {
        const definition = getHubModuleDefinition(moduleId)

        if (
            !definition ||
            definition.group !== 'ecosystem' ||
            !definition.pluginName
        ) {
            return {
                ok: false,
                moduleId,
                status: 'failed',
                reason: 'This Hub module cannot create a config entry.'
            }
        }

        const pluginName = definition.pluginName
        const moduleState = await resolveHubModuleState(this.ctx, definition)

        if (!moduleState.installed) {
            return {
                ok: false,
                moduleId,
                status: 'not-installed',
                reason: `${pluginName} is not installed.`
            }
        }

        if (moduleState.configStatus === 'multiple') {
            return {
                ok: false,
                moduleId,
                status: 'ambiguous',
                reason: `${pluginName} has multiple config entries.`
            }
        }

        if (moduleState.configStatus === 'single') {
            return {
                ok: true,
                moduleId,
                status: 'exists',
                configPath: moduleState.configPath,
                routePath: moduleState.routePath
            }
        }

        const loader = getLoader(this.ctx)
        const plugins = loader?.config?.plugins

        if (
            !loader?.entry ||
            !plugins ||
            !loader.reload ||
            !loader.writeConfig
        ) {
            return {
                ok: false,
                moduleId,
                status: 'failed',
                reason: 'Koishi loader is not available.'
            }
        }

        if (loader.writable === false) {
            return {
                ok: false,
                moduleId,
                status: 'failed',
                reason: 'Koishi config is not writable.'
            }
        }

        const key = `${pluginName}:${createConfigIdent()}`
        const config: Record<string, unknown> = {}

        try {
            await loader.reload(loader.entry, key, config)
            plugins[key] = config
            await loader.writeConfig()

            const configPath = getConfigPathFromKey(key)
            return {
                ok: true,
                moduleId,
                status: 'created',
                configPath,
                routePath: `/plugins/${configPath}`
            }
        } catch (error) {
            return {
                ok: false,
                moduleId,
                status: 'failed',
                reason: coerceReason(error)
            }
        }
    }

    registerRequesterLogProvider(chatluna: ChatLunaCreateModelService) {
        this.unregisterRequesterLogProvider()

        const dispose = registerChatLunaRequesterLogProvider(
            chatluna,
            this.coreLogStore,
            this.ctx.logger('chatluna-hub'),
            this.ctx.baseDir
        )

        this.disposeRequesterLogProvider = dispose

        return () => {
            if (this.disposeRequesterLogProvider === dispose) {
                this.disposeRequesterLogProvider = undefined
            }

            dispose()
        }
    }

    unregisterRequesterLogProvider() {
        this.disposeRequesterLogProvider?.()
        this.disposeRequesterLogProvider = undefined
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
