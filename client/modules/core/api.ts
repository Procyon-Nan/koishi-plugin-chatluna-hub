import { send } from '@koishijs/client'
import type {
    BatchDeleteChatLunaConversationInput,
    BatchDeleteChatLunaConversationResult,
    BatchUpdateChatLunaConversationUsageInput,
    BatchUpdateChatLunaConversationUsageResult,
    ChatLunaAdapterDeleteInput,
    ChatLunaAdapterListResult,
    ChatLunaAdapterMutationResult,
    ChatLunaAdapterSaveInput,
    ChatLunaAdapterToggleInput,
    ChatLunaConversationListItem,
    ChatLunaConversationListQuery,
    ChatLunaConversationOptions,
    ChatLunaConversationRouteListResult,
    ChatLunaCoreLogDetail,
    ChatLunaCoreLogGetInput,
    ChatLunaCoreLogListQuery,
    ChatLunaCoreLogListResult,
    ChatLunaCoreModelListResult,
    DeleteChatLunaConversationInput,
    PageResult,
    UpdateChatLunaConversationUsageInput
} from './types'

export async function listChatLunaConversations(
    params: ChatLunaConversationListQuery
): Promise<PageResult<ChatLunaConversationListItem>> {
    return await send('chatluna-hub/core/conversations/list', params)
}

export async function listChatLunaConversationRoutes(): Promise<ChatLunaConversationRouteListResult> {
    return await send('chatluna-hub/core/conversations/routes')
}

export async function listChatLunaConversationOptions(): Promise<ChatLunaConversationOptions> {
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

export async function listChatLunaCoreLogs(
    params: ChatLunaCoreLogListQuery
): Promise<ChatLunaCoreLogListResult> {
    return await send('chatluna-hub/core/logs/list', params)
}

export async function getChatLunaCoreLog(
    input: ChatLunaCoreLogGetInput
): Promise<ChatLunaCoreLogDetail> {
    return await send('chatluna-hub/core/logs/get', input)
}

export async function clearChatLunaCoreLogs(): Promise<{ success: true }> {
    return await send('chatluna-hub/core/logs/clear')
}

export async function listChatLunaCoreModels(): Promise<ChatLunaCoreModelListResult> {
    return await send('chatluna-hub/core/models/list')
}

export async function listChatLunaAdapters(): Promise<ChatLunaAdapterListResult> {
    return await send('chatluna-hub/core/adapters/list')
}

export async function saveChatLunaAdapter(
    input: ChatLunaAdapterSaveInput
): Promise<ChatLunaAdapterMutationResult> {
    return await send('chatluna-hub/core/adapters/save', input)
}

export async function toggleChatLunaAdapter(
    input: ChatLunaAdapterToggleInput
): Promise<ChatLunaAdapterMutationResult> {
    return await send('chatluna-hub/core/adapters/toggle', input)
}

export async function deleteChatLunaAdapter(
    input: ChatLunaAdapterDeleteInput
): Promise<ChatLunaAdapterMutationResult> {
    return await send('chatluna-hub/core/adapters/delete', input)
}
