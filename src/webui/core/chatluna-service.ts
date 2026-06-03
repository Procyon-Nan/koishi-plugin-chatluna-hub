/**
 * Structural ("...Like") interfaces describing the slices of the ChatLuna and
 * Koishi services that the Hub depends on, plus thin accessors for them.
 *
 * The Hub treats ChatLuna as an optional peer and never imports its concrete
 * types, so these structural interfaces are how we get type safety against a
 * service that may not be present at runtime. Feature-specific raw shapes
 * (preset templates, callback inputs) live next to the feature that reads them.
 */
import type { Context } from 'koishi'
import type { ChatLunaConversationStatus } from './conversation-routes'

/** A ChatLuna conversation row as stored in the database. */
export interface ConversationRecord {
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

/** A ChatLuna binding row linking a binding key to its active conversation. */
export interface BindingRecord {
    bindingKey: string
    activeConversationId?: string | null
    lastConversationId?: string | null
    updatedAt: Date
}

/** The minimal Koishi database surface the Hub uses. */
interface DatabaseLike {
    get: (table: string, query: Record<string, unknown>) => Promise<unknown[]>
    upsert: (table: string, rows: Record<string, unknown>[]) => Promise<unknown>
    remove: (table: string, query: Record<string, unknown>) => Promise<unknown>
}

/** ctx.root, narrowed to the conversation-delete lifecycle events we emit. */
export interface ChatLunaConversationEventRoot {
    parallel: (
        name:
            | 'chatluna/before-conversation-delete'
            | 'chatluna/after-conversation-delete',
        payload: {
            conversation: ConversationRecord
        }
    ) => Promise<void>
}

export interface ChatLunaPresetServiceLike {
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

interface ChatLunaCharacterPresetServiceLike {
    resolvePresetDir?: () => string
    loadAllPreset?: () => Promise<void>
}

interface ChatLunaCharacterPresetConfigLike {
    preset?: unknown
}

interface ChatLunaCharacterConfigLike {
    globalPrivateConfig?: ChatLunaCharacterPresetConfigLike
    globalGroupConfig?: ChatLunaCharacterPresetConfigLike
    privateConfigs?: Record<string, ChatLunaCharacterPresetConfigLike>
    configs?: Record<string, ChatLunaCharacterPresetConfigLike>
}

export interface ChatLunaCharacterLikeService {
    preset?: ChatLunaCharacterPresetServiceLike
    _config?: ChatLunaCharacterConfigLike
}

/** A raw model entry as returned by `platform.listAllModels(type).value`. */
export interface RawPlatformModelInfo {
    name?: unknown
    platform?: unknown
    type?: unknown
    maxTokens?: unknown
    capabilities?: unknown
    toModelName?: unknown
}

/** Model-type argument passed to `listAllModels`. 0 = all, 1 = LLM only. */
type ListAllModelsType = 0 | 1

/** The ChatLuna service if running, otherwise undefined. */
export const getChatLuna = (ctx: Context): ChatLunaLikeService | undefined => {
    return ctx.get('chatluna') as ChatLunaLikeService | undefined
}

/**
 * Read raw platform models from ChatLuna. Returns an empty array when the
 * service is unavailable; throws only if `listAllModels` itself throws.
 */
export const listRawPlatformModels = (
    ctx: Context,
    type: ListAllModelsType
): unknown[] => {
    const platform = getChatLuna(ctx)?.platform
    const value = platform?.listAllModels?.(type)?.value

    return Array.isArray(value) ? value : []
}

/** The Koishi database service. Throws when it is not installed. */
export const getDatabase = (ctx: Context): DatabaseLike => {
    const database = ctx.get('database') as DatabaseLike | undefined
    if (!database?.get || !database.upsert || !database.remove) {
        throw new Error('Koishi database service is not available.')
    }

    return database
}
