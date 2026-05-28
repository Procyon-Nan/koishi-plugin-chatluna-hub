import { send } from '@koishijs/client'
import type {
    BatchDeleteChatLunaConversationInput,
    BatchDeleteChatLunaConversationResult,
    BatchUpdateChatLunaConversationUsageInput,
    BatchUpdateChatLunaConversationUsageResult,
    ChatLunaConversationListItem,
    ChatLunaConversationListQuery,
    ChatLunaConversationOptions,
    ChatLunaConversationRouteListResult,
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
} from './types'

export async function listChatLunaConversations(
    params: ChatLunaConversationListQuery
): Promise<PageResult<ChatLunaConversationListItem>> {
    return await send('chatluna-hub/core/conversations/list', params)
}

export async function listChatLunaConversationRoutes(): Promise<
    ChatLunaConversationRouteListResult
> {
    return await send('chatluna-hub/core/conversations/routes')
}

export async function listChatLunaConversationOptions(): Promise<
    ChatLunaConversationOptions
> {
    return await send('chatluna-hub/core/conversations/options')
}

export async function updateChatLunaConversationUsage(
    input: UpdateChatLunaConversationUsageInput
): Promise<ChatLunaConversationListItem> {
    return await send('chatluna-hub/core/conversations/update-usage', input)
}

export async function batchUpdateChatLunaConversationUsage(
    input: BatchUpdateChatLunaConversationUsageInput
): Promise<BatchUpdateChatLunaConversationUsageResult> {
    return await send(
        'chatluna-hub/core/conversations/batch-update-usage',
        input
    )
}

export async function deleteChatLunaConversation(
    input: DeleteChatLunaConversationInput
): Promise<{ success: true }> {
    return await send('chatluna-hub/core/conversations/delete', input)
}

export async function batchDeleteChatLunaConversation(
    input: BatchDeleteChatLunaConversationInput
): Promise<BatchDeleteChatLunaConversationResult> {
    return await send('chatluna-hub/core/conversations/batch-delete', input)
}

export async function listChatLunaCoreModels(): Promise<ChatLunaCoreModelListResult> {
    return await send('chatluna-hub/core/models/list')
}

export async function listChatLunaCorePresets(): Promise<ChatLunaCorePresetListResult> {
    return await send('chatluna-hub/core/presets/list')
}

export async function getChatLunaCorePreset(
    input: ChatLunaCorePresetGetInput
): Promise<ChatLunaCorePresetDetail> {
    return await send('chatluna-hub/core/presets/get', input)
}

export async function validateChatLunaCorePreset(
    input: ChatLunaCorePresetValidateInput
): Promise<ChatLunaCorePresetValidationResult> {
    return await send('chatluna-hub/core/presets/validate', input)
}

export async function createChatLunaCorePreset(
    input: ChatLunaCorePresetCreateInput
): Promise<ChatLunaCorePresetDetail> {
    return await send('chatluna-hub/core/presets/create', input)
}

export async function updateChatLunaCorePreset(
    input: ChatLunaCorePresetUpdateInput
): Promise<ChatLunaCorePresetDetail> {
    return await send('chatluna-hub/core/presets/update', input)
}

export async function deleteChatLunaCorePreset(
    input: ChatLunaCorePresetDeleteInput
): Promise<{ success: true }> {
    return await send('chatluna-hub/core/presets/delete', input)
}
