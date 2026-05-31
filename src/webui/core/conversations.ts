/**
 * ChatLuna conversation management: listing, route grouping, usage updates and
 * deletion. Reads the ChatLuna conversation/binding tables directly and uses
 * `ctx.chatluna.conversation` for mutation and cache cleanup. Must work without
 * Living Memory installed.
 */
import type { Context } from 'koishi'
import {
    coerceReason,
    coerceString,
    naturalCompare,
    normalizePage,
    normalizePageSize,
    type Page,
    paginate,
    toTimestamp,
    unique
} from '../shared'
import {
    type BindingRecord,
    type ChatLunaConversationEventRoot,
    type ConversationRecord,
    getChatLuna,
    getDatabase,
    listRawPlatformModels,
    type RawPlatformModelInfo
} from './chatluna-service'
import { resolveModelFullName } from './models'
import {
    type ChatLunaConversationRouteInfo,
    type ChatLunaConversationRouteMode,
    type ChatLunaConversationStatus,
    compareRoute,
    formatRouteDetail,
    formatRouteLabel,
    parseRouteInfo
} from './conversation-routes'

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

const createConversationListItem = (
    conversation: ConversationRecord,
    activeConversationId?: string | null
): ChatLunaConversationListItem => {
    return {
        id: conversation.id,
        seq: conversation.seq,
        bindingKey: conversation.bindingKey,
        title: conversation.title,
        model: conversation.model,
        preset: conversation.preset,
        chatMode: conversation.chatMode,
        createdBy: conversation.createdBy,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        lastChatAt: conversation.lastChatAt,
        status: conversation.status,
        isCurrent: activeConversationId === conversation.id,
        activeConversationId: activeConversationId ?? null,
        route: parseRouteInfo(conversation.bindingKey)
    }
}

/** Tie-breaker ordering applied whenever the primary sort key is equal. */
const compareConversationFallback = (
    left: ChatLunaConversationListItem,
    right: ChatLunaConversationListItem
): number => {
    const route = compareRoute(left.route, right.route)
    if (route !== 0) return route

    const bindingKey = left.bindingKey.localeCompare(right.bindingKey)
    if (bindingKey !== 0) return bindingKey

    const seq = (left.seq ?? 0) - (right.seq ?? 0)
    if (seq !== 0) return seq

    const created = toTimestamp(left.createdAt) - toTimestamp(right.createdAt)
    if (created !== 0) return created

    return left.id.localeCompare(right.id)
}

const compareConversationBySortKey = (
    left: ChatLunaConversationListItem,
    right: ChatLunaConversationListItem,
    sortKey: ChatLunaConversationSortKey
): number => {
    if (sortKey === 'route') {
        return compareConversationFallback(left, right)
    }

    if (
        sortKey === 'createdAt' ||
        sortKey === 'updatedAt' ||
        sortKey === 'lastChatAt'
    ) {
        return toTimestamp(left[sortKey]) - toTimestamp(right[sortKey])
    }

    return naturalCompare(
        String(left[sortKey] ?? ''),
        String(right[sortKey] ?? '')
    )
}

const sortConversations = (
    items: ChatLunaConversationListItem[],
    query: ChatLunaConversationListQuery
): ChatLunaConversationListItem[] => {
    const sortKey = query.sortKey ?? 'route'
    const direction = query.sortOrder === 'descending' ? -1 : 1

    return items.sort((left, right) => {
        const primary =
            compareConversationBySortKey(left, right, sortKey) * direction

        if (primary !== 0) return primary
        return compareConversationFallback(left, right)
    })
}

const includesConversationKeyword = (
    item: ChatLunaConversationListItem,
    keyword: string
): boolean => {
    const values = [
        item.id,
        item.title,
        item.model,
        item.preset,
        item.chatMode,
        item.createdBy,
        item.status,
        item.bindingKey,
        item.activeConversationId,
        item.route.mode,
        item.route.platform,
        item.route.selfId,
        item.route.userId,
        item.route.guildId,
        item.route.routeKey,
        item.route.presetLane
    ]

    return values.some((value) =>
        String(value ?? '')
            .toLocaleLowerCase()
            .includes(keyword)
    )
}

const matchesConversationQuery = (
    item: ChatLunaConversationListItem,
    query: ChatLunaConversationListQuery
): boolean => {
    const routeBaseBindingKey = query.routeBaseBindingKey?.trim()
    const keyword = query.keyword?.trim().toLocaleLowerCase()

    if (
        routeBaseBindingKey != null &&
        routeBaseBindingKey.length > 0 &&
        item.route.baseBindingKey !== routeBaseBindingKey
    ) {
        return false
    }

    if (query.routeMode != null && item.route.mode !== query.routeMode) {
        return false
    }

    return keyword == null || keyword.length === 0
        ? true
        : includesConversationKeyword(item, keyword)
}

/** Load every active conversation as a list item, with its current flag set. */
const loadActiveConversationItems = async (
    ctx: Context
): Promise<ChatLunaConversationListItem[]> => {
    const database = getDatabase(ctx)
    const conversations = (await database.get('chatluna_conversation', {
        status: 'active'
    })) as ConversationRecord[]
    const bindings = (await database.get(
        'chatluna_binding',
        {}
    )) as BindingRecord[]
    const activeByBindingKey = new Map(
        bindings.map((binding) => [
            binding.bindingKey,
            binding.activeConversationId ?? null
        ])
    )

    return conversations.map((conversation) =>
        createConversationListItem(
            conversation,
            activeByBindingKey.get(conversation.bindingKey)
        )
    )
}

/**
 * The ChatLuna conversation service, validated to expose every method this
 * module calls. Throws a single clear error when the service is incomplete.
 */
const getConversationService = (ctx: Context) => {
    const chatluna = getChatLuna(ctx)
    const conversation = chatluna?.conversation

    if (
        !chatluna ||
        !conversation?.getConversation ||
        !conversation.touchConversation ||
        !conversation.getBinding ||
        !conversation.removeAcl ||
        !chatluna.clearCache
    ) {
        throw new Error('ChatLuna conversation service is not available.')
    }

    return { chatluna, conversation }
}

const unbindConversation = async (ctx: Context, conversationId: string) => {
    const database = getDatabase(ctx)
    const [active, last] = await Promise.all([
        database.get('chatluna_binding', {
            activeConversationId: conversationId
        }),
        database.get('chatluna_binding', {
            lastConversationId: conversationId
        })
    ])
    const bindings = Array.from(
        new Map(
            [...(active as BindingRecord[]), ...(last as BindingRecord[])].map(
                (binding) => [binding.bindingKey, binding]
            )
        ).values()
    )

    for (const binding of bindings) {
        await database.upsert('chatluna_binding', [
            {
                bindingKey: binding.bindingKey,
                activeConversationId:
                    binding.activeConversationId === conversationId
                        ? null
                        : binding.activeConversationId,
                lastConversationId:
                    binding.lastConversationId === conversationId
                        ? null
                        : binding.lastConversationId,
                updatedAt: new Date()
            }
        ])
    }
}

const emitConversationDeleteEvent = async (
    ctx: Context,
    name:
        | 'chatluna/before-conversation-delete'
        | 'chatluna/after-conversation-delete',
    conversation: ConversationRecord
) => {
    await (ctx.root as unknown as ChatLunaConversationEventRoot).parallel(
        name,
        { conversation }
    )
}

const normalizeConversationIds = (
    conversationIds: string[] | undefined
): string[] => {
    return Array.from(
        new Set(
            (conversationIds ?? [])
                .map((conversationId) => conversationId.trim())
                .filter(Boolean)
        )
    )
}

/** Build a selectable model option, or null when the raw model is unusable. */
const toModelOption = (
    raw: RawPlatformModelInfo
): ChatLunaModelOption | null => {
    const name = coerceString(raw.name)
    const platform = coerceString(raw.platform)
    const fullName = resolveModelFullName(raw, platform, name)

    if (!name || !platform || !fullName) return null

    return { label: fullName, value: fullName, platform, name }
}

export const listChatLunaConversationOptions = (
    ctx: Context
): ChatLunaConversationOptions => {
    const chatluna = getChatLuna(ctx)
    const getAllPreset = chatluna?.preset?.getAllPreset

    if (!chatluna?.platform?.listAllModels || !getAllPreset) {
        throw new Error('ChatLuna service is not available.')
    }

    const modelItems = listRawPlatformModels(ctx, 1)
        .map((raw) => toModelOption(raw as RawPlatformModelInfo))
        .filter((item): item is ChatLunaModelOption => Boolean(item))
        .sort((left, right) => left.value.localeCompare(right.value))

    const rawPresets = getAllPreset.call(chatluna.preset, false)?.value
    const presetItems = (Array.isArray(rawPresets) ? rawPresets : [])
        .map((preset) =>
            typeof preset === 'string' ? { label: preset, value: preset } : null
        )
        .filter((item): item is ChatLunaPresetOption => Boolean(item))
        .sort((left, right) => left.value.localeCompare(right.value))

    return {
        models: unique(modelItems, (item) => item.value),
        presets: unique(presetItems, (item) => item.value)
    }
}

export const listChatLunaConversations = async (
    ctx: Context,
    query: ChatLunaConversationListQuery
): Promise<Page<ChatLunaConversationListItem>> => {
    const items = sortConversations(
        (await loadActiveConversationItems(ctx)).filter((item) =>
            matchesConversationQuery(item, query)
        ),
        query
    )

    return paginate(
        items,
        normalizePage(query.page),
        normalizePageSize(query.pageSize)
    )
}

/** Create a fresh route group seeded from the first conversation seen for it. */
const createRouteGroup = (
    item: ChatLunaConversationListItem
): ChatLunaConversationRouteGroup => {
    const route = item.route
    const updatedAt = toTimestamp(item.updatedAt)
    const lastChatAt = toTimestamp(item.lastChatAt)

    return {
        id: route.baseBindingKey,
        label: formatRouteLabel(route),
        detail: formatRouteDetail(route),
        mode: route.mode,
        baseBindingKey: route.baseBindingKey,
        platform: route.platform ?? null,
        selfId: route.selfId ?? null,
        userId: route.userId ?? null,
        guildId: route.guildId ?? null,
        routeKey: route.routeKey ?? null,
        isDirect: route.isDirect ?? null,
        count: 1,
        currentCount: item.isCurrent ? 1 : 0,
        presetLanes: route.presetLane ? [route.presetLane] : [],
        updatedAt: updatedAt > 0 ? item.updatedAt : null,
        lastChatAt: lastChatAt > 0 ? (item.lastChatAt ?? null) : null
    }
}

/** Fold one more conversation into an existing route group. */
const mergeIntoRouteGroup = (
    group: ChatLunaConversationRouteGroup,
    item: ChatLunaConversationListItem
) => {
    group.count += 1
    group.currentCount += item.isCurrent ? 1 : 0

    const presetLane = item.route.presetLane
    if (presetLane && !group.presetLanes.includes(presetLane)) {
        group.presetLanes.push(presetLane)
    }

    if (toTimestamp(item.updatedAt) > toTimestamp(group.updatedAt)) {
        group.updatedAt = item.updatedAt
    }

    if (toTimestamp(item.lastChatAt) > toTimestamp(group.lastChatAt)) {
        group.lastChatAt = item.lastChatAt ?? null
    }
}

export const listChatLunaConversationRoutes = async (
    ctx: Context
): Promise<ChatLunaConversationRouteListResult> => {
    const items = await loadActiveConversationItems(ctx)
    const routeMap = new Map<string, ChatLunaConversationRouteGroup>()

    for (const item of items) {
        const group = routeMap.get(item.route.baseBindingKey)
        if (group == null) {
            routeMap.set(item.route.baseBindingKey, createRouteGroup(item))
        } else {
            mergeIntoRouteGroup(group, item)
        }
    }

    const routes = Array.from(routeMap.values()).sort(compareRoute)
    for (const route of routes) {
        route.presetLanes.sort(naturalCompare)
    }

    return {
        routes,
        total: items.length,
        updatedAt: new Date().toISOString()
    }
}

export const updateChatLunaConversationUsage = async (
    ctx: Context,
    input: UpdateChatLunaConversationUsageInput
): Promise<ChatLunaConversationListItem> => {
    const conversationId = input.conversationId?.trim()
    if (conversationId == null || conversationId.length === 0) {
        throw new Error('Conversation id is required.')
    }

    const { chatluna, conversation: conversationService } =
        getConversationService(ctx)
    const conversation =
        await conversationService.getConversation!(conversationId)
    if (conversation == null) {
        throw new Error('Conversation not found.')
    }

    if (conversation.status !== 'active') {
        throw new Error('Only active conversations can be updated.')
    }

    const options = listChatLunaConversationOptions(ctx)
    const modelValues = new Set(options.models.map((model) => model.value))
    const presetValues = new Set(options.presets.map((preset) => preset.value))
    const patch: Partial<ConversationRecord> = {}
    const model = input.model?.trim()
    const preset = input.preset?.trim()

    if (model != null) {
        if (!modelValues.has(model)) {
            throw new Error(`Model is unavailable: ${model}`)
        }
        patch.model = model
    }

    if (preset != null) {
        if (!presetValues.has(preset)) {
            throw new Error(`Preset is unavailable: ${preset}`)
        }
        patch.preset = preset
    }

    if (patch.model == null && patch.preset == null) {
        throw new Error('No conversation usage change provided.')
    }

    const updated = await conversationService.touchConversation!(
        conversation.id,
        patch
    )
    if (updated == null) {
        throw new Error('Conversation not found.')
    }

    await chatluna.clearCache!(updated)

    const binding = await conversationService.getBinding!(updated.bindingKey)

    return createConversationListItem(
        updated,
        binding?.activeConversationId ?? null
    )
}

export const deleteChatLunaConversation = async (
    ctx: Context,
    input: DeleteChatLunaConversationInput
): Promise<{ success: true }> => {
    const conversationId = input.conversationId?.trim()
    if (conversationId == null || conversationId.length === 0) {
        throw new Error('Conversation id is required.')
    }

    const database = getDatabase(ctx)
    const { chatluna, conversation: conversationService } =
        getConversationService(ctx)
    const conversation =
        await conversationService.getConversation!(conversationId)
    if (conversation == null) {
        throw new Error('Conversation not found.')
    }

    if (conversation.status !== 'active') {
        throw new Error('Only active conversations can be deleted.')
    }

    await emitConversationDeleteEvent(
        ctx,
        'chatluna/before-conversation-delete',
        conversation
    )

    const updated = await conversationService.touchConversation!(
        conversation.id,
        {
            status: 'deleted',
            archivedAt: null,
            archiveId: null
        }
    )
    if (updated == null) {
        throw new Error('Conversation not found.')
    }

    await unbindConversation(ctx, conversation.id)
    await database.remove('chatluna_message', {
        conversationId: conversation.id
    })
    await conversationService.removeAcl!(conversation.id)
    await chatluna.clearCache!(updated)
    await emitConversationDeleteEvent(
        ctx,
        'chatluna/after-conversation-delete',
        updated
    )

    return { success: true }
}

/** Expand a batch usage request into a flat list of per-conversation updates. */
const resolveBatchUsageUpdates = (
    input: BatchUpdateChatLunaConversationUsageInput
): BatchUpdateChatLunaConversationUsageItem[] => {
    if (input.updates != null && input.updates.length > 0) {
        return input.updates
            .map((item) => ({
                conversationId: item.conversationId?.trim() ?? '',
                model: item.model,
                preset: item.preset
            }))
            .filter((item) => item.conversationId.length > 0)
    }

    return normalizeConversationIds(input.conversationIds).map(
        (conversationId) => ({
            conversationId,
            model: input.model,
            preset: input.preset
        })
    )
}

export const batchUpdateChatLunaConversationUsage = async (
    ctx: Context,
    input: BatchUpdateChatLunaConversationUsageInput
): Promise<BatchUpdateChatLunaConversationUsageResult> => {
    const updates = resolveBatchUsageUpdates(input)

    if (updates.length === 0) {
        throw new Error('Conversation ids are required.')
    }

    const updated: ChatLunaConversationListItem[] = []
    const failed: ChatLunaConversationBatchFailure[] = []

    for (const item of updates) {
        try {
            updated.push(await updateChatLunaConversationUsage(ctx, item))
        } catch (error) {
            failed.push({
                conversationId: item.conversationId,
                reason: coerceReason(error)
            })
        }
    }

    return { updated, failed }
}

export const batchDeleteChatLunaConversation = async (
    ctx: Context,
    input: BatchDeleteChatLunaConversationInput
): Promise<BatchDeleteChatLunaConversationResult> => {
    const conversationIds = normalizeConversationIds(input.conversationIds)

    if (conversationIds.length === 0) {
        throw new Error('Conversation ids are required.')
    }

    const deleted: string[] = []
    const failed: ChatLunaConversationBatchFailure[] = []

    for (const conversationId of conversationIds) {
        try {
            await deleteChatLunaConversation(ctx, { conversationId })
            deleted.push(conversationId)
        } catch (error) {
            failed.push({
                conversationId,
                reason: coerceReason(error)
            })
        }
    }

    return { deleted, failed }
}
