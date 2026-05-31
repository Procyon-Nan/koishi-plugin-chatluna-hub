/**
 * The Hub RPC contract: every console event the server exposes, declared once.
 *
 * This single interface is the source of truth. `src/index.ts` merges it into
 * both the `@koishijs/plugin-console` and `@koishijs/console` module
 * augmentations (Koishi ships the console under two package ids), so the
 * contract never has to be written out twice. The runtime listener table in
 * `src/console/listeners.ts` is type-checked against these same signatures.
 */
import type { DataService } from '@koishijs/plugin-console'
import type {
    HubConsoleData,
    HubModuleId,
    HubModuleToggleResult
} from './modules'
import type {
    ChatLunaAdapterDeleteInput,
    ChatLunaAdapterListResult,
    ChatLunaAdapterMutationResult,
    ChatLunaAdapterSaveInput,
    ChatLunaAdapterToggleInput
} from './adapters'
import type {
    BatchDeleteChatLunaConversationInput,
    BatchDeleteChatLunaConversationResult,
    BatchUpdateChatLunaConversationUsageInput,
    BatchUpdateChatLunaConversationUsageResult,
    ChatLunaConversationListItem,
    ChatLunaConversationListQuery,
    ChatLunaConversationOptions,
    ChatLunaConversationRouteListResult,
    ChatLunaCoreLogDetail,
    ChatLunaCoreLogGetInput,
    ChatLunaCoreLogListQuery,
    ChatLunaCoreLogListResult,
    ChatLunaCoreModelListResult,
    ChatLunaCorePresetCreateInput,
    ChatLunaCorePresetDeleteInput,
    ChatLunaCorePresetDetail,
    ChatLunaCorePresetGetInput,
    ChatLunaCorePresetListResult,
    ChatLunaCorePresetUpdateInput,
    ChatLunaCorePresetValidateInput,
    ChatLunaCorePresetValidationResult,
    DeleteChatLunaConversationInput,
    PageResult,
    UpdateChatLunaConversationUsageInput
} from './core'

/** Every Hub console RPC event, keyed by its `chatluna-hub/*` channel name. */
export interface HubEvents {
    'chatluna-hub/module/set-enabled': (
        moduleId: HubModuleId,
        enabled: boolean
    ) => Promise<HubModuleToggleResult>
    'chatluna-hub/core/models/list': () => Promise<ChatLunaCoreModelListResult>
    'chatluna-hub/core/adapters/list': () => Promise<ChatLunaAdapterListResult>
    'chatluna-hub/core/adapters/save': (
        input: ChatLunaAdapterSaveInput
    ) => Promise<ChatLunaAdapterMutationResult>
    'chatluna-hub/core/adapters/toggle': (
        input: ChatLunaAdapterToggleInput
    ) => Promise<ChatLunaAdapterMutationResult>
    'chatluna-hub/core/adapters/delete': (
        input: ChatLunaAdapterDeleteInput
    ) => Promise<ChatLunaAdapterMutationResult>
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

/** The Hub's console DataService, declared once for both console packages. */
export interface HubConsoleServices {
    chatluna_hub_webui: DataService<HubConsoleData>
}
