export type CoreTab = 'conversation' | 'model' | 'preset'

export type ChatLunaCoreModelType =
    | 'llm'
    | 'embeddings'
    | 'reranker'
    | 'unknown'

export interface ChatLunaCoreModelItem {
    id: string
    name: string
    fullName: string
    platform: string
    type: ChatLunaCoreModelType
    maxTokens: number | null
    capabilities: string[]
}

export interface ChatLunaCoreModelSummary {
    total: number
    llm: number
    embeddings: number
    reranker: number
    unknown: number
}

export interface ChatLunaCoreModelListResult {
    models: ChatLunaCoreModelItem[]
    platforms: string[]
    summary: ChatLunaCoreModelSummary
    updatedAt: string
    reason?: string
}

export interface ChatLunaCorePresetSummary {
    keywords: string[]
    promptCount: number
    version?: string
}

export type ChatLunaCorePresetSource = 'core' | 'character'

export interface ChatLunaCorePresetListItem
    extends ChatLunaCorePresetSummary {
    id: string
    source: ChatLunaCorePresetSource
    sourceLabel: string
    filename: string
    updatedAt: string | null
    size: number | null
}

export interface ChatLunaCorePresetListResult {
    presets: ChatLunaCorePresetListItem[]
    updatedAt: string
    reason?: string
}

export interface ChatLunaCorePresetDetail {
    preset: ChatLunaCorePresetListItem
    rawText: string
}

export interface ChatLunaCorePresetValidationResult
    extends ChatLunaCorePresetSummary {
    valid: boolean
    error?: string
}

export interface ChatLunaCorePresetGetInput {
    id: string
}

export interface ChatLunaCorePresetValidateInput {
    source?: ChatLunaCorePresetSource
    rawText: string
}

export interface ChatLunaCorePresetCreateInput {
    source?: ChatLunaCorePresetSource
    filename: string
    rawText: string
}

export interface ChatLunaCorePresetUpdateInput {
    id: string
    rawText: string
}

export interface ChatLunaCorePresetDeleteInput {
    id: string
}

export type ChatLunaConversationRouteMode =
    | 'personal'
    | 'shared'
    | 'custom'
    | 'unknown'

export type ChatLunaConversationStatus =
    | 'active'
    | 'archived'
    | 'deleted'
    | 'broken'

export interface ChatLunaConversationRouteInfo {
    mode: ChatLunaConversationRouteMode
    baseBindingKey: string
    presetLane?: string | null
    platform?: string | null
    selfId?: string | null
    userId?: string | null
    guildId?: string | null
    routeKey?: string | null
    isDirect?: boolean | null
}

export type ChatLunaConversationSortKey =
    | 'route'
    | 'title'
    | 'model'
    | 'preset'
    | 'createdAt'
    | 'updatedAt'
    | 'lastChatAt'

export type ChatLunaConversationSortOrder = 'ascending' | 'descending'

export interface ChatLunaConversationListQuery {
    keyword?: string
    routeBaseBindingKey?: string
    routeMode?: ChatLunaConversationRouteMode
    sortKey?: ChatLunaConversationSortKey
    sortOrder?: ChatLunaConversationSortOrder
    page?: number
    pageSize?: number
}

export interface ChatLunaModelOption {
    label: string
    value: string
    platform: string
    name: string
}

export interface ChatLunaPresetOption {
    label: string
    value: string
}

export interface ChatLunaConversationOptions {
    models: ChatLunaModelOption[]
    presets: ChatLunaPresetOption[]
}

export interface ChatLunaConversationListItem {
    id: string
    seq?: number
    bindingKey: string
    title: string
    model: string
    preset: string
    chatMode: string
    createdBy: string
    createdAt: Date | string
    updatedAt: Date | string
    lastChatAt?: Date | string | null
    status: ChatLunaConversationStatus
    isCurrent: boolean
    activeConversationId?: string | null
    route: ChatLunaConversationRouteInfo
}

export interface ChatLunaConversationRouteGroup {
    id: string
    label: string
    detail: string
    mode: ChatLunaConversationRouteMode
    baseBindingKey: string
    platform?: string | null
    selfId?: string | null
    userId?: string | null
    guildId?: string | null
    routeKey?: string | null
    isDirect?: boolean | null
    count: number
    currentCount: number
    presetLanes: string[]
    updatedAt: string | Date | null
    lastChatAt: string | Date | null
}

export interface ChatLunaConversationRouteListResult {
    routes: ChatLunaConversationRouteGroup[]
    total: number
    updatedAt: string
}

export interface UpdateChatLunaConversationUsageInput {
    conversationId: string
    model?: string
    preset?: string
}

export type BatchUpdateChatLunaConversationUsageItem =
    UpdateChatLunaConversationUsageInput

export interface BatchUpdateChatLunaConversationUsageInput {
    conversationIds?: string[]
    model?: string
    preset?: string
    updates?: BatchUpdateChatLunaConversationUsageItem[]
}

export interface DeleteChatLunaConversationInput {
    conversationId: string
}

export interface BatchDeleteChatLunaConversationInput {
    conversationIds: string[]
}

export interface ChatLunaConversationBatchFailure {
    conversationId: string
    reason: string
}

export interface BatchUpdateChatLunaConversationUsageResult {
    updated: ChatLunaConversationListItem[]
    failed: ChatLunaConversationBatchFailure[]
}

export interface BatchDeleteChatLunaConversationResult {
    deleted: string[]
    failed: ChatLunaConversationBatchFailure[]
}

export interface PageResult<T> {
    items: T[]
    page: number
    pageSize: number
    total: number
}

declare module '@koishijs/client' {
    interface Events {
        'chatluna-hub/core/conversations/list': (
            query: ChatLunaConversationListQuery
        ) => PageResult<ChatLunaConversationListItem>
        'chatluna-hub/core/conversations/routes': () =>
            ChatLunaConversationRouteListResult
        'chatluna-hub/core/conversations/options': () =>
            ChatLunaConversationOptions
        'chatluna-hub/core/conversations/update-usage': (
            input: UpdateChatLunaConversationUsageInput
        ) => ChatLunaConversationListItem
        'chatluna-hub/core/conversations/batch-update-usage': (
            input: BatchUpdateChatLunaConversationUsageInput
        ) => BatchUpdateChatLunaConversationUsageResult
        'chatluna-hub/core/conversations/delete': (
            input: DeleteChatLunaConversationInput
        ) => { success: true }
        'chatluna-hub/core/conversations/batch-delete': (
            input: BatchDeleteChatLunaConversationInput
        ) => BatchDeleteChatLunaConversationResult
        'chatluna-hub/core/models/list': () => ChatLunaCoreModelListResult
        'chatluna-hub/core/presets/list': () => ChatLunaCorePresetListResult
        'chatluna-hub/core/presets/get': (
            input: ChatLunaCorePresetGetInput
        ) => ChatLunaCorePresetDetail
        'chatluna-hub/core/presets/validate': (
            input: ChatLunaCorePresetValidateInput
        ) => ChatLunaCorePresetValidationResult
        'chatluna-hub/core/presets/create': (
            input: ChatLunaCorePresetCreateInput
        ) => ChatLunaCorePresetDetail
        'chatluna-hub/core/presets/update': (
            input: ChatLunaCorePresetUpdateInput
        ) => ChatLunaCorePresetDetail
        'chatluna-hub/core/presets/delete': (
            input: ChatLunaCorePresetDeleteInput
        ) => { success: true }
    }
}
