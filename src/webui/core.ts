import fs from 'fs/promises'
import path from 'path'
import type { Context } from 'koishi'

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

export interface ChatLunaCorePresetListItem extends ChatLunaCorePresetSummary {
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

export interface ChatLunaCorePresetValidationResult extends ChatLunaCorePresetSummary {
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

interface ConversationRecord {
    id: string
    seq?: number
    bindingKey: string
    title: string
    model: string
    preset: string
    chatMode: string
    createdBy: string
    createdAt: Date
    updatedAt: Date
    lastChatAt?: Date | null
    status: ChatLunaConversationStatus
    archivedAt?: Date | null
    archiveId?: string | null
}

interface BindingRecord {
    bindingKey: string
    activeConversationId?: string | null
    lastConversationId?: string | null
    updatedAt: Date
}

interface DatabaseLike {
    get: (table: string, query: Record<string, unknown>) => Promise<unknown[]>
    upsert: (table: string, rows: Record<string, unknown>[]) => Promise<unknown>
    remove: (table: string, query: Record<string, unknown>) => Promise<unknown>
}

interface ChatLunaConversationEventRoot {
    parallel: (
        name:
            | 'chatluna/before-conversation-delete'
            | 'chatluna/after-conversation-delete',
        payload: {
            conversation: ConversationRecord
        }
    ) => Promise<void>
}

interface ChatLunaLikeService {
    platform?: {
        listAllModels?: (type: number) => {
            value?: unknown
        }
    }
    preset?: ChatLunaPresetServiceLike
    conversation?: ChatLunaConversationServiceLike
    clearCache?: (conversation: ConversationRecord) => Promise<void>
}

interface ChatLunaConversationServiceLike {
    getConversation?: (
        conversationId: string
    ) => Promise<ConversationRecord | null | undefined>
    touchConversation?: (
        conversationId: string,
        patch: Partial<ConversationRecord>
    ) => Promise<ConversationRecord | null | undefined>
    getBinding?: (
        bindingKey: string
    ) => Promise<BindingRecord | null | undefined>
    removeAcl?: (conversationId: string) => Promise<void>
}

interface ChatLunaPresetServiceLike {
    getAllPreset?: (concatKeyword?: boolean) => {
        value?: unknown
    }
    getPreset?: (
        triggerKeyword: string,
        throwError?: boolean
    ) => {
        value?: unknown
    }
    resolvePresetDir?: () => string
    loadAllPreset?: () => Promise<void>
}

interface ChatLunaCharacterLikeService {
    preset?: ChatLunaCharacterPresetServiceLike
}

interface ChatLunaCharacterPresetServiceLike {
    resolvePresetDir?: () => string
    loadAllPreset?: () => Promise<void>
}

interface RawPlatformModelInfo {
    name?: unknown
    platform?: unknown
    type?: unknown
    maxTokens?: unknown
    capabilities?: unknown
    toModelName?: unknown
}

interface RawPresetTemplateLike {
    triggerKeyword?: unknown
    messages?: unknown
    path?: unknown
    rawText?: unknown
    version?: unknown
}

type YamlLoad = (rawText: string) => unknown

const modelTypeOrder: Record<ChatLunaCoreModelType, number> = {
    llm: 0,
    embeddings: 1,
    reranker: 2,
    unknown: 3
}

const defaultPage = 1
const defaultPageSize = 20
const maxPageSize = 100

const emptySummary = (): ChatLunaCoreModelSummary => ({
    total: 0,
    llm: 0,
    embeddings: 0,
    reranker: 0,
    unknown: 0
})

const coerceReason = (error: unknown) => {
    if (error instanceof Error) return error.message
    return String(error)
}

const getDatabase = (ctx: Context) => {
    const database = ctx.get('database') as DatabaseLike | undefined
    if (!database?.get || !database.upsert || !database.remove) {
        throw new Error('Koishi database service is not available.')
    }

    return database
}

const normalizePage = (value: number | undefined) => {
    if (value == null || !Number.isFinite(value)) return defaultPage
    return Math.max(1, Math.floor(value))
}

const normalizePageSize = (value: number | undefined) => {
    if (value == null || !Number.isFinite(value)) return defaultPageSize
    return Math.min(maxPageSize, Math.max(1, Math.floor(value)))
}

const toTimestamp = (value: Date | string | null | undefined) => {
    if (value == null) return 0
    const date = value instanceof Date ? value : new Date(value)
    const time = date.getTime()

    return Number.isFinite(time) ? time : 0
}

const unique = <T>(items: T[], resolveKey: (item: T) => string) => {
    const result: T[] = []
    const keys = new Set<string>()

    for (const item of items) {
        const key = resolveKey(item)
        if (keys.has(key)) continue
        keys.add(key)
        result.push(item)
    }

    return result
}

const emptyPresetSummary = (): ChatLunaCorePresetSummary => ({
    keywords: [],
    promptCount: 0
})

const presetSourceLabels: Record<ChatLunaCorePresetSource, string> = {
    core: '主插件预设',
    character: 'Character 预设'
}

const coerceModelType = (value: unknown): ChatLunaCoreModelType => {
    if (value === 1 || value === 'llm') return 'llm'
    if (value === 2 || value === 'embedding' || value === 'embeddings') {
        return 'embeddings'
    }
    if (value === 3 || value === 'reranker' || value === 'rerank') {
        return 'reranker'
    }

    return 'unknown'
}

const coerceString = (value: unknown) => {
    return typeof value === 'string' ? value : ''
}

const coerceCapabilities = (value: unknown) => {
    if (!Array.isArray(value)) return []

    return Array.from(
        new Set(
            value
                .map((item) => (typeof item === 'string' ? item : String(item)))
                .filter(Boolean)
        )
    )
}

const coerceMaxTokens = (value: unknown) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null

    return value
}

const normalizeModel = (
    raw: RawPlatformModelInfo,
    index: number
): ChatLunaCoreModelItem | null => {
    const name = coerceString(raw.name)
    const platform = coerceString(raw.platform)

    if (!name || !platform) return null

    const fullName =
        typeof raw.toModelName === 'function'
            ? String(raw.toModelName())
            : `${platform}/${name}`

    return {
        id: fullName || `${platform}:${name}:${index}`,
        name,
        fullName,
        platform,
        type: coerceModelType(raw.type),
        maxTokens: coerceMaxTokens(raw.maxTokens),
        capabilities: coerceCapabilities(raw.capabilities)
    }
}

const sortModels = (
    left: ChatLunaCoreModelItem,
    right: ChatLunaCoreModelItem
) => {
    const platformOrder = left.platform.localeCompare(
        right.platform,
        undefined,
        {
            numeric: true,
            sensitivity: 'base'
        }
    )

    if (platformOrder !== 0) return platformOrder

    const typeOrder = modelTypeOrder[left.type] - modelTypeOrder[right.type]
    if (typeOrder !== 0) return typeOrder

    return left.name.localeCompare(right.name, undefined, {
        numeric: true,
        sensitivity: 'base'
    })
}

const summarizeModels = (
    models: ChatLunaCoreModelItem[]
): ChatLunaCoreModelSummary => {
    const summary = emptySummary()

    for (const model of models) {
        summary.total += 1
        summary[model.type] += 1
    }

    return summary
}

export const listChatLunaCoreModels = (
    ctx: Context
): ChatLunaCoreModelListResult => {
    const chatluna = ctx.get('chatluna') as ChatLunaLikeService | undefined
    const listAllModels = chatluna?.platform?.listAllModels

    if (!listAllModels) {
        return {
            models: [],
            platforms: [],
            summary: emptySummary(),
            updatedAt: new Date().toISOString(),
            reason: 'ChatLuna service is not available.'
        }
    }

    let source: unknown

    try {
        source = listAllModels.call(chatluna.platform, 0)?.value
    } catch (error) {
        return {
            models: [],
            platforms: [],
            summary: emptySummary(),
            updatedAt: new Date().toISOString(),
            reason: coerceReason(error)
        }
    }

    const rawModels = Array.isArray(source) ? source : []
    const models = rawModels
        .map((item, index) =>
            normalizeModel(item as RawPlatformModelInfo, index)
        )
        .filter((item): item is ChatLunaCoreModelItem => Boolean(item))
        .sort(sortModels)

    return {
        models,
        platforms: Array.from(
            new Set(models.map((item) => item.platform))
        ).sort((left, right) =>
            left.localeCompare(right, undefined, {
                numeric: true,
                sensitivity: 'base'
            })
        ),
        summary: summarizeModels(models),
        updatedAt: new Date().toISOString()
    }
}

const parseRouteInfo = (bindingKey: string): ChatLunaConversationRouteInfo => {
    const presetMarker = ':preset:'
    const presetIndex = bindingKey.indexOf(presetMarker)
    const baseBindingKey =
        presetIndex >= 0 ? bindingKey.slice(0, presetIndex) : bindingKey
    const presetLane =
        presetIndex >= 0
            ? bindingKey.slice(presetIndex + presetMarker.length) || null
            : null
    const parts = baseBindingKey.split(':')

    if (parts[0] === 'custom') {
        return {
            mode: 'custom',
            baseBindingKey,
            presetLane,
            routeKey: parts.slice(1).join(':') || null,
            isDirect: null
        }
    }

    if (parts[0] === 'shared' && parts.length >= 4) {
        return {
            mode: 'shared',
            baseBindingKey,
            presetLane,
            platform: parts[1],
            selfId: parts[2],
            guildId: parts[3],
            isDirect: false
        }
    }

    if (parts[0] === 'personal' && parts.length >= 5) {
        const direct = parts[3] === 'direct'

        return {
            mode: 'personal',
            baseBindingKey,
            presetLane,
            platform: parts[1],
            selfId: parts[2],
            guildId: direct ? null : parts[3],
            userId: parts[4],
            isDirect: direct
        }
    }

    return {
        mode: 'unknown',
        baseBindingKey,
        presetLane,
        isDirect: null
    }
}

const routeModeOrder: Record<ChatLunaConversationRouteMode, number> = {
    shared: 0,
    personal: 1,
    custom: 2,
    unknown: 3
}

const formatConversationRouteLabel = (route: ChatLunaConversationRouteInfo) => {
    if (route.mode === 'custom') {
        return route.routeKey ?? route.baseBindingKey
    }

    if (route.mode === 'shared') {
        return `群聊 ${route.guildId ?? '-'}`
    }

    if (route.mode === 'personal' && route.isDirect) {
        return `私聊 ${route.userId ?? '-'}`
    }

    if (route.mode === 'personal') {
        return `群聊 ${route.guildId ?? '-'} / 用户 ${route.userId ?? '-'}`
    }

    return route.baseBindingKey
}

const formatConversationRouteDetail = (
    route: ChatLunaConversationRouteInfo
) => {
    if (route.mode === 'custom') {
        return route.baseBindingKey
    }

    const parts = [route.platform, route.selfId].filter(Boolean)

    return parts.length > 0 ? parts.join(' / ') : route.baseBindingKey
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

const compareRoute = (
    left: ChatLunaConversationRouteInfo,
    right: ChatLunaConversationRouteInfo
) => {
    const mode = routeModeOrder[left.mode] - routeModeOrder[right.mode]
    if (mode !== 0) return mode

    return formatConversationRouteLabel(left).localeCompare(
        formatConversationRouteLabel(right),
        undefined,
        {
            numeric: true,
            sensitivity: 'base'
        }
    )
}

const compareConversationFallback = (
    left: ChatLunaConversationListItem,
    right: ChatLunaConversationListItem
) => {
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
) => {
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

    return String(left[sortKey] ?? '').localeCompare(
        String(right[sortKey] ?? ''),
        undefined,
        {
            numeric: true,
            sensitivity: 'base'
        }
    )
}

const sortConversations = (
    items: ChatLunaConversationListItem[],
    query: ChatLunaConversationListQuery
) => {
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
) => {
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
) => {
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

const loadActiveConversationItems = async (ctx: Context) => {
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

const getConversationService = (ctx: Context) => {
    const chatluna = ctx.get('chatluna') as ChatLunaLikeService | undefined
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

    return {
        chatluna,
        conversation
    }
}

const getModelValues = (options: ChatLunaConversationOptions) => {
    return new Set(options.models.map((model) => model.value))
}

const getPresetValues = (options: ChatLunaConversationOptions) => {
    return new Set(options.presets.map((preset) => preset.value))
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
        {
            conversation
        }
    )
}

export const listChatLunaConversationOptions = (
    ctx: Context
): ChatLunaConversationOptions => {
    const chatluna = ctx.get('chatluna') as ChatLunaLikeService | undefined
    const listAllModels = chatluna?.platform?.listAllModels
    const getAllPreset = chatluna?.preset?.getAllPreset

    if (!chatluna?.platform || !listAllModels || !getAllPreset) {
        throw new Error('ChatLuna service is not available.')
    }

    const rawModels = listAllModels.call(chatluna.platform, 1)?.value
    const modelItems = (Array.isArray(rawModels) ? rawModels : [])
        .map((raw) => {
            const model = raw as RawPlatformModelInfo
            const name = coerceString(model.name)
            const platform = coerceString(model.platform)
            const fullName =
                typeof model.toModelName === 'function'
                    ? String(model.toModelName())
                    : `${platform}/${name}`

            if (!name || !platform || !fullName) return null

            return {
                label: fullName,
                value: fullName,
                platform,
                name
            }
        })
        .filter((item): item is ChatLunaModelOption => Boolean(item))
        .sort((left, right) => left.value.localeCompare(right.value))

    const rawPresets = getAllPreset.call(chatluna.preset, false)?.value
    const presetItems = (Array.isArray(rawPresets) ? rawPresets : [])
        .map((preset) =>
            typeof preset === 'string'
                ? {
                      label: preset,
                      value: preset
                  }
                : null
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
): Promise<PageResult<ChatLunaConversationListItem>> => {
    const page = normalizePage(query.page)
    const pageSize = normalizePageSize(query.pageSize)
    const items = sortConversations(
        (await loadActiveConversationItems(ctx)).filter((item) =>
            matchesConversationQuery(item, query)
        ),
        query
    )
    const start = (page - 1) * pageSize

    return {
        items: items.slice(start, start + pageSize),
        page,
        pageSize,
        total: items.length
    }
}

export const listChatLunaConversationRoutes = async (
    ctx: Context
): Promise<ChatLunaConversationRouteListResult> => {
    const items = await loadActiveConversationItems(ctx)
    const routeMap = new Map<string, ChatLunaConversationRouteGroup>()

    for (const item of items) {
        const route = item.route
        const current = routeMap.get(route.baseBindingKey)
        const updatedAt = toTimestamp(item.updatedAt)
        const lastChatAt = toTimestamp(item.lastChatAt)

        if (current == null) {
            routeMap.set(route.baseBindingKey, {
                id: route.baseBindingKey,
                label: formatConversationRouteLabel(route),
                detail: formatConversationRouteDetail(route),
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
            })
            continue
        }

        current.count += 1
        current.currentCount += item.isCurrent ? 1 : 0

        if (
            route.presetLane &&
            !current.presetLanes.includes(route.presetLane)
        ) {
            current.presetLanes.push(route.presetLane)
        }

        if (updatedAt > toTimestamp(current.updatedAt)) {
            current.updatedAt = item.updatedAt
        }

        if (lastChatAt > toTimestamp(current.lastChatAt)) {
            current.lastChatAt = item.lastChatAt ?? null
        }
    }

    const routes = Array.from(routeMap.values()).sort((left, right) =>
        compareRoute(left, right)
    )

    for (const route of routes) {
        route.presetLanes.sort((left, right) =>
            left.localeCompare(right, undefined, {
                numeric: true,
                sensitivity: 'base'
            })
        )
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
    const modelValues = getModelValues(options)
    const presetValues = getPresetValues(options)
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

const normalizeConversationIds = (conversationIds: string[] | undefined) => {
    return Array.from(
        new Set(
            (conversationIds ?? [])
                .map((conversationId) => conversationId.trim())
                .filter(Boolean)
        )
    )
}

export const batchUpdateChatLunaConversationUsage = async (
    ctx: Context,
    input: BatchUpdateChatLunaConversationUsageInput
): Promise<BatchUpdateChatLunaConversationUsageResult> => {
    const updates: BatchUpdateChatLunaConversationUsageItem[] = []

    if (input.updates != null && input.updates.length > 0) {
        for (const item of input.updates) {
            const conversationId = item.conversationId?.trim()
            if (!conversationId) continue

            updates.push({
                conversationId,
                model: item.model,
                preset: item.preset
            })
        }
    } else {
        for (const conversationId of normalizeConversationIds(
            input.conversationIds
        )) {
            updates.push({
                conversationId,
                model: input.model,
                preset: input.preset
            })
        }
    }

    if (updates.length === 0) {
        throw new Error('Conversation ids are required.')
    }

    const updated: ChatLunaConversationListItem[] = []
    const failed: ChatLunaConversationBatchFailure[] = []

    for (const item of updates) {
        try {
            updated.push(
                await updateChatLunaConversationUsage(ctx, {
                    conversationId: item.conversationId,
                    model: item.model,
                    preset: item.preset
                })
            )
        } catch (error) {
            failed.push({
                conversationId: item.conversationId,
                reason: coerceReason(error)
            })
        }
    }

    return {
        updated,
        failed
    }
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
            await deleteChatLunaConversation(ctx, {
                conversationId
            })
            deleted.push(conversationId)
        } catch (error) {
            failed.push({
                conversationId,
                reason: coerceReason(error)
            })
        }
    }

    return {
        deleted,
        failed
    }
}

const getPresetService = (ctx: Context) => {
    const chatluna = ctx.get('chatluna') as ChatLunaLikeService | undefined
    const preset = chatluna?.preset

    if (
        !preset ||
        !preset.getAllPreset ||
        !preset.getPreset ||
        !preset.resolvePresetDir ||
        !preset.loadAllPreset
    ) {
        throw new Error('ChatLuna preset service is not available.')
    }

    return preset
}

const getCharacterPresetService = (ctx: Context) => {
    const character = ctx.get('chatluna_character') as
        | ChatLunaCharacterLikeService
        | undefined

    return character?.preset
}

const normalizePresetSource = (
    source?: ChatLunaCorePresetSource
): ChatLunaCorePresetSource => {
    return source === 'character' ? 'character' : 'core'
}

const encodePresetId = (source: ChatLunaCorePresetSource, filename: string) => {
    return `${source}:${filename}`
}

const parsePresetId = (
    id: string
): {
    source: ChatLunaCorePresetSource
    filename: string
} => {
    const [source, ...filenameParts] = id.split(':')

    if (
        (source === 'core' || source === 'character') &&
        filenameParts.length > 0
    ) {
        return {
            source: normalizePresetSource(source),
            filename: filenameParts.join(':')
        }
    }

    return {
        source: 'core',
        filename: id
    }
}

const getFallbackPresetDir = (
    ctx: Context,
    source: ChatLunaCorePresetSource
) => {
    const relative =
        source === 'character'
            ? 'data/chathub/character/presets'
            : 'data/chathub/presets'

    return path.resolve(ctx.baseDir, relative)
}

const resolvePresetSourceDir = (
    ctx: Context,
    source: ChatLunaCorePresetSource
) => {
    if (source === 'character') {
        return (
            getCharacterPresetService(ctx)?.resolvePresetDir?.() ??
            getFallbackPresetDir(ctx, source)
        )
    }

    const chatluna = ctx.get('chatluna') as ChatLunaLikeService | undefined

    return (
        chatluna?.preset?.resolvePresetDir?.() ??
        getFallbackPresetDir(ctx, source)
    )
}

const reloadPresetSource = async (
    ctx: Context,
    source: ChatLunaCorePresetSource
) => {
    if (source === 'character') {
        await getCharacterPresetService(ctx)?.loadAllPreset?.()
        return
    }

    await getPresetService(ctx).loadAllPreset!()
}

const toStringArray = (value: unknown) => {
    if (!Array.isArray(value)) return []

    return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const normalizePresetFilename = (
    filename: string,
    source: ChatLunaCorePresetSource
) => {
    const trimmed = filename.trim()

    if (!trimmed) {
        throw new Error('Preset filename is required.')
    }

    if (
        trimmed.includes('/') ||
        trimmed.includes('\\') ||
        path.isAbsolute(trimmed) ||
        /^[a-zA-Z]:/.test(trimmed)
    ) {
        throw new Error('Preset filename must be a plain file name.')
    }

    const ext = path.extname(trimmed).toLowerCase()
    const normalized = ext ? trimmed : `${trimmed}.yml`
    const normalizedExt = path.extname(normalized).toLowerCase()

    if (source === 'character') {
        if (normalizedExt !== '.yml') {
            throw new Error('Character preset filename must end with .yml.')
        }

        return normalized
    }

    if (normalizedExt !== '.yml' && normalizedExt !== '.txt') {
        throw new Error('Preset filename must end with .yml or .txt.')
    }

    return normalized
}

const resolvePresetFile = (
    presetDir: string,
    filename: string,
    source: ChatLunaCorePresetSource
) => {
    const normalized = normalizePresetFilename(filename, source)
    const root = path.resolve(presetDir)
    const filePath = path.resolve(root, normalized)

    if (!filePath.startsWith(`${root}${path.sep}`)) {
        throw new Error('Preset filename points outside the preset directory.')
    }

    return {
        filename: normalized,
        filePath
    }
}

const loadYamlParser = async (): Promise<YamlLoad> => {
    const moduleName = 'js-yaml'
    const module = (await import(moduleName)) as {
        load?: unknown
        default?: {
            load?: unknown
        }
    }
    const load = module.load ?? module.default?.load

    if (typeof load !== 'function') {
        throw new Error('YAML parser is not available.')
    }

    return load as YamlLoad
}

const parseCorePresetRawText = async (rawText: string) => {
    const load = await loadYamlParser()
    const preset = load(rawText)

    if (!isRecord(preset)) {
        throw new Error('Preset YAML must be an object.')
    }

    const keywords = toStringArray(preset.keywords)
    const prompts = Array.isArray(preset.prompts) ? preset.prompts : []
    const summary: ChatLunaCorePresetSummary = {
        keywords,
        promptCount: prompts.length,
        version: typeof preset.version === 'string' ? preset.version : undefined
    }

    if (!summary.keywords.length) {
        throw new Error('Preset must contain at least one keyword.')
    }

    if (summary.promptCount < 1) {
        throw new Error('Preset must contain at least one prompt.')
    }

    const validRoles = new Set([
        'assistant',
        'ai',
        'model',
        'user',
        'human',
        'system'
    ])

    for (const [index, prompt] of prompts.entries()) {
        if (!isRecord(prompt)) {
            throw new Error(`Prompt #${index + 1} must be an object.`)
        }

        if (typeof prompt.role !== 'string' || !validRoles.has(prompt.role)) {
            throw new Error(`Prompt #${index + 1} has an invalid role.`)
        }

        if (prompt.content == null) {
            throw new Error(`Prompt #${index + 1} must contain content.`)
        }
    }

    return {
        summary
    }
}

const parseCharacterPresetRawText = async (rawText: string) => {
    const load = await loadYamlParser()
    const preset = load(rawText)

    if (!isRecord(preset)) {
        throw new Error('Character preset YAML must be an object.')
    }

    const name = typeof preset.name === 'string' ? preset.name.trim() : ''
    const input = typeof preset.input === 'string' ? preset.input : ''
    const system = typeof preset.system === 'string' ? preset.system : ''

    if (!name) {
        throw new Error('Character preset must contain a name.')
    }

    if (!input.trim()) {
        throw new Error('Character preset must contain input.')
    }

    if (!system.trim()) {
        throw new Error('Character preset must contain system.')
    }

    if (
        preset.nick_name != null &&
        (!Array.isArray(preset.nick_name) ||
            preset.nick_name.some((item) => typeof item !== 'string'))
    ) {
        throw new Error('Character preset nick_name must be a string array.')
    }

    return {
        summary: {
            keywords: [name],
            promptCount: 2
        } satisfies ChatLunaCorePresetSummary
    }
}

const parsePresetRawText = async (
    rawText: string,
    source: ChatLunaCorePresetSource
) => {
    return source === 'character'
        ? parseCharacterPresetRawText(rawText)
        : parseCorePresetRawText(rawText)
}

const summarizePresetRawText = async (
    rawText: string,
    source: ChatLunaCorePresetSource
) => {
    try {
        return (await parsePresetRawText(rawText, source)).summary
    } catch {
        return emptyPresetSummary()
    }
}

const getCachedPresets = (service: ChatLunaPresetServiceLike) => {
    const names = service.getAllPreset?.(false)?.value
    if (!Array.isArray(names)) return []

    const presets: RawPresetTemplateLike[] = []

    for (const name of names) {
        if (typeof name !== 'string') continue

        const preset = service.getPreset?.(name, false)?.value
        if (!preset || typeof preset !== 'object') continue

        presets.push(preset as RawPresetTemplateLike)
    }

    return presets
}

const getPresetFileStat = async (filePath: string) => {
    try {
        const stat = await fs.stat(filePath)

        return {
            updatedAt: stat.mtime.toISOString(),
            size: stat.size
        }
    } catch {
        return {
            updatedAt: null,
            size: null
        }
    }
}

const listPresetDirectoryItems = async (
    source: ChatLunaCorePresetSource,
    presetDir: string
) => {
    let files: string[]

    try {
        files = await fs.readdir(presetDir)
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
        throw error
    }

    const supportedExtensions =
        source === 'character' ? new Set(['.yml']) : new Set(['.yml', '.txt'])

    const items = await Promise.all(
        files
            .filter((file) =>
                supportedExtensions.has(path.extname(file).toLowerCase())
            )
            .map(async (file) => {
                const { filename, filePath } = resolvePresetFile(
                    presetDir,
                    file,
                    source
                )
                const [rawText, stat] = await Promise.all([
                    fs.readFile(filePath, 'utf-8'),
                    getPresetFileStat(filePath)
                ])
                const summary = await summarizePresetRawText(rawText, source)

                return {
                    id: encodePresetId(source, filename),
                    source,
                    sourceLabel: presetSourceLabels[source],
                    filename,
                    ...summary,
                    ...stat
                }
            })
    )

    return items.sort((left, right) =>
        left.filename.localeCompare(right.filename, undefined, {
            numeric: true,
            sensitivity: 'base'
        })
    )
}

const ensureUniqueCorePresetKeywords = async (
    service: ChatLunaPresetServiceLike,
    keywords: string[],
    currentFilename?: string
) => {
    const presetDir = service.resolvePresetDir!()
    const target = new Set(keywords)

    for (const preset of getCachedPresets(service)) {
        const presetPath = typeof preset.path === 'string' ? preset.path : ''
        const filename = presetPath ? path.basename(presetPath) : ''
        if (currentFilename && filename === currentFilename) continue

        const conflict = toStringArray(preset.triggerKeyword).find((keyword) =>
            target.has(keyword)
        )

        if (conflict) {
            const source = filename || path.basename(presetDir)
            throw new Error(
                `Preset keyword "${conflict}" already exists in ${source}.`
            )
        }
    }
}

const ensureUniqueCharacterPresetKeywords = async (
    ctx: Context,
    keywords: string[],
    currentFilename?: string
) => {
    const presetDir = resolvePresetSourceDir(ctx, 'character')
    const target = new Set(keywords)
    let files: string[]

    try {
        files = await fs.readdir(presetDir)
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
        throw error
    }

    for (const file of files) {
        if (path.extname(file).toLowerCase() !== '.yml') continue
        if (currentFilename && file === currentFilename) continue

        const { filePath } = resolvePresetFile(presetDir, file, 'character')
        const rawText = await fs.readFile(filePath, 'utf-8')
        const summary = await summarizePresetRawText(rawText, 'character')
        const conflict = summary.keywords.find((keyword) => target.has(keyword))

        if (conflict) {
            throw new Error(
                `Character preset name "${conflict}" already exists in ${file}.`
            )
        }
    }
}

const ensureUniquePresetKeywords = async (
    ctx: Context,
    source: ChatLunaCorePresetSource,
    keywords: string[],
    currentFilename?: string
) => {
    if (source === 'character') {
        await ensureUniqueCharacterPresetKeywords(
            ctx,
            keywords,
            currentFilename
        )
        return
    }

    const service = getPresetService(ctx)
    await ensureUniqueCorePresetKeywords(service, keywords, currentFilename)
}

export const listChatLunaCorePresets = async (
    ctx: Context
): Promise<ChatLunaCorePresetListResult> => {
    const presets: ChatLunaCorePresetListItem[] = []
    const reasons: string[] = []

    try {
        await reloadPresetSource(ctx, 'core')
        presets.push(
            ...(await listPresetDirectoryItems(
                'core',
                resolvePresetSourceDir(ctx, 'core')
            ))
        )
    } catch (error) {
        reasons.push(`主插件预设：${coerceReason(error)}`)
    }

    try {
        await reloadPresetSource(ctx, 'character')
        presets.push(
            ...(await listPresetDirectoryItems(
                'character',
                resolvePresetSourceDir(ctx, 'character')
            ))
        )
    } catch (error) {
        reasons.push(`Character 预设：${coerceReason(error)}`)
    }

    presets.sort((left, right) => {
        const sourceOrder =
            (left.source === 'core' ? 0 : 1) - (right.source === 'core' ? 0 : 1)

        if (sourceOrder !== 0) return sourceOrder

        return left.filename.localeCompare(right.filename, undefined, {
            numeric: true,
            sensitivity: 'base'
        })
    })

    return {
        presets,
        updatedAt: new Date().toISOString(),
        reason: reasons.length ? reasons.join('；') : undefined
    }
}

export const getChatLunaCorePreset = async (
    ctx: Context,
    input: ChatLunaCorePresetGetInput
): Promise<ChatLunaCorePresetDetail> => {
    const presetId = parsePresetId(input.id)
    const presetDir = resolvePresetSourceDir(ctx, presetId.source)
    const { filename, filePath } = resolvePresetFile(
        presetDir,
        presetId.filename,
        presetId.source
    )
    const rawText = await fs.readFile(filePath, 'utf-8')
    const summary = await summarizePresetRawText(rawText, presetId.source)
    const stat = await getPresetFileStat(filePath)

    return {
        rawText,
        preset: {
            id: encodePresetId(presetId.source, filename),
            source: presetId.source,
            sourceLabel: presetSourceLabels[presetId.source],
            filename,
            ...summary,
            ...stat
        }
    }
}

export const validateChatLunaCorePreset = async (
    input: ChatLunaCorePresetValidateInput
): Promise<ChatLunaCorePresetValidationResult> => {
    try {
        const { summary } = await parsePresetRawText(
            input.rawText,
            normalizePresetSource(input.source)
        )

        return {
            valid: true,
            ...summary
        }
    } catch (error) {
        return {
            valid: false,
            ...emptyPresetSummary(),
            error: coerceReason(error)
        }
    }
}

export const createChatLunaCorePreset = async (
    ctx: Context,
    input: ChatLunaCorePresetCreateInput
): Promise<ChatLunaCorePresetDetail> => {
    const source = normalizePresetSource(input.source)
    const presetDir = resolvePresetSourceDir(ctx, source)
    const { filename, filePath } = resolvePresetFile(
        presetDir,
        input.filename,
        source
    )

    await fs.mkdir(presetDir, { recursive: true })

    try {
        await fs.access(filePath)
        throw new Error(`Preset file "${filename}" already exists.`)
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error
        }
    }

    const { summary } = await parsePresetRawText(input.rawText, source)
    await reloadPresetSource(ctx, source)
    await ensureUniquePresetKeywords(ctx, source, summary.keywords)
    await fs.writeFile(filePath, input.rawText, 'utf-8')
    await reloadPresetSource(ctx, source)

    return getChatLunaCorePreset(ctx, { id: encodePresetId(source, filename) })
}

export const updateChatLunaCorePreset = async (
    ctx: Context,
    input: ChatLunaCorePresetUpdateInput
): Promise<ChatLunaCorePresetDetail> => {
    const presetId = parsePresetId(input.id)
    const presetDir = resolvePresetSourceDir(ctx, presetId.source)
    const { filename, filePath } = resolvePresetFile(
        presetDir,
        presetId.filename,
        presetId.source
    )

    await fs.access(filePath)

    const { summary } = await parsePresetRawText(input.rawText, presetId.source)
    await reloadPresetSource(ctx, presetId.source)
    await ensureUniquePresetKeywords(
        ctx,
        presetId.source,
        summary.keywords,
        filename
    )
    await fs.writeFile(filePath, input.rawText, 'utf-8')
    await reloadPresetSource(ctx, presetId.source)

    return getChatLunaCorePreset(ctx, {
        id: encodePresetId(presetId.source, filename)
    })
}

export const deleteChatLunaCorePreset = async (
    ctx: Context,
    input: ChatLunaCorePresetDeleteInput
): Promise<{ success: true }> => {
    const presetId = parsePresetId(input.id)
    const presetDir = resolvePresetSourceDir(ctx, presetId.source)
    const { filePath } = resolvePresetFile(
        presetDir,
        presetId.filename,
        presetId.source
    )

    await fs.unlink(filePath)

    try {
        await reloadPresetSource(ctx, presetId.source)
    } catch {
        // The file has already been deleted; list refresh will surface reload issues.
    }

    return { success: true }
}
