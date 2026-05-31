/**
 * Read-only ChatLuna model catalogue: lists every model the platform service
 * exposes, normalized for the Hub model page.
 */
import type { Context } from 'koishi'
import { coerceReason, coerceString, naturalCompare } from '../shared'
import {
    getChatLuna,
    listRawPlatformModels,
    type RawPlatformModelInfo
} from './chatluna-service'

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

const modelTypeOrder: Record<ChatLunaCoreModelType, number> = {
    llm: 0,
    embeddings: 1,
    reranker: 2,
    unknown: 3
}

export const emptyModelSummary = (): ChatLunaCoreModelSummary => ({
    total: 0,
    llm: 0,
    embeddings: 0,
    reranker: 0,
    unknown: 0
})

/** Map ChatLuna's numeric/string model type onto our discriminated union. */
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

const coerceCapabilities = (value: unknown): string[] => {
    if (!Array.isArray(value)) return []

    return Array.from(
        new Set(
            value
                .map((item) => (typeof item === 'string' ? item : String(item)))
                .filter(Boolean)
        )
    )
}

const coerceMaxTokens = (value: unknown): number | null => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    return value
}

/**
 * The model's canonical full name. Prefers the adapter-provided `toModelName()`
 * and falls back to `platform/name`. Shared by the catalogue and the
 * conversation option list so both agree on identifiers.
 */
export const resolveModelFullName = (
    raw: RawPlatformModelInfo,
    platform: string,
    name: string
): string => {
    return typeof raw.toModelName === 'function'
        ? String(raw.toModelName())
        : `${platform}/${name}`
}

const normalizeModel = (
    raw: RawPlatformModelInfo,
    index: number
): ChatLunaCoreModelItem | null => {
    const name = coerceString(raw.name)
    const platform = coerceString(raw.platform)

    if (!name || !platform) return null

    const fullName = resolveModelFullName(raw, platform, name)

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
): number => {
    const platformOrder = naturalCompare(left.platform, right.platform)
    if (platformOrder !== 0) return platformOrder

    const typeOrder = modelTypeOrder[left.type] - modelTypeOrder[right.type]
    if (typeOrder !== 0) return typeOrder

    return naturalCompare(left.name, right.name)
}

const summarizeModels = (
    models: ChatLunaCoreModelItem[]
): ChatLunaCoreModelSummary => {
    const summary = emptyModelSummary()

    for (const model of models) {
        summary.total += 1
        summary[model.type] += 1
    }

    return summary
}

const emptyModelResult = (reason?: string): ChatLunaCoreModelListResult => ({
    models: [],
    platforms: [],
    summary: emptyModelSummary(),
    updatedAt: new Date().toISOString(),
    reason
})

export const listChatLunaCoreModels = (
    ctx: Context
): ChatLunaCoreModelListResult => {
    if (!getChatLuna(ctx)?.platform?.listAllModels) {
        return emptyModelResult('ChatLuna service is not available.')
    }

    let rawModels: unknown[]
    try {
        rawModels = listRawPlatformModels(ctx, 0)
    } catch (error) {
        return emptyModelResult(coerceReason(error))
    }

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
        ).sort(naturalCompare),
        summary: summarizeModels(models),
        updatedAt: new Date().toISOString()
    }
}
