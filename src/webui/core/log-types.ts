/**
 * Helpers for the core HTTP log store: safe serialization of arbitrary values,
 * log-text normalization, and run/entry summarization.
 */
import { coerceReason, coerceString, isRecord } from '../shared'
import type { ChatLunaConversationRouteInfo } from './conversation-routes'

export type ChatLunaCoreLogStatus = 'pending' | 'success' | 'error'

export type ChatLunaCoreLogSource = 'chatluna' | 'character'

export type ChatLunaCoreLogRunType = 'model-requester'

export interface ChatLunaCoreLogExchangeSummary {
    id: string
    exchangeId: string
    runId: string
    url: string
    method: string
    status: ChatLunaCoreLogStatus
    httpStatus?: number | null
    httpStatusText?: string | null
    startedAt: string
    completedAt?: string | null
    durationMs?: number | null
    requestSize: number
    responseSize: number
    requestTruncated?: boolean
    responseTruncated?: boolean
    error?: string | null
}

export interface ChatLunaCoreLogExchange extends ChatLunaCoreLogExchangeSummary {
    requestBody: string
    responseBody?: string | null
}

export interface ChatLunaCoreLogRunSummary {
    id: string
    runId: string
    parentRunId?: string | null
    runName?: string | null
    type: ChatLunaCoreLogRunType
    status: ChatLunaCoreLogStatus
    startedAt: string
    completedAt?: string | null
    durationMs?: number | null
    requestSize: number
    responseSize: number
    error?: string | null
    usageMetadata?: unknown
    exchangeCount: number
}

export interface ChatLunaCoreLogRun extends ChatLunaCoreLogRunSummary {
    requestBody: string
    responseBody?: string | null
    exchanges: ChatLunaCoreLogExchange[]
}

export interface ChatLunaCoreLogListItem {
    id: string
    requestId: string
    source: ChatLunaCoreLogSource
    conversationId: string
    conversationTitle: string
    bindingKey: string
    model: string
    preset: string
    chatMode: string
    platform?: string | null
    userId?: string | null
    guildId?: string | null
    channelId?: string | null
    messageSummary: string
    status: ChatLunaCoreLogStatus
    stream: boolean
    startedAt: string
    updatedAt: string
    completedAt?: string | null
    durationMs?: number | null
    runCount: number
    exchangeCount: number
    errorCount: number
    requestSize: number
    responseSize: number
    latestRunName?: string | null
}

export interface ChatLunaCoreLogDetail extends ChatLunaCoreLogListItem {
    messageBody: string
    route: ChatLunaConversationRouteInfo
    runs: ChatLunaCoreLogRun[]
}

export interface ChatLunaCoreLogListQuery {
    keyword?: string
    status?: ChatLunaCoreLogStatus | 'all'
    source?: ChatLunaCoreLogSource | 'all'
    page?: number
    pageSize?: number
}

export type ChatLunaCoreLogStatusCounts = Record<ChatLunaCoreLogStatus, number>

export interface ChatLunaCoreLogListResult {
    items: ChatLunaCoreLogListItem[]
    page: number
    pageSize: number
    total: number
    statusCounts: ChatLunaCoreLogStatusCounts
    updatedAt: string
}

export interface ChatLunaCoreLogGetInput {
    id: string
}

const normalizeMessageContent = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (Array.isArray(value)) {
        return value.map(normalizeMessageContent).filter(Boolean).join('\n')
    }
    if (!isRecord(value)) return ''

    return (
        coerceString(value.content) ||
        normalizeMessageContent(value.data) ||
        normalizeMessageContent(value.kwargs) ||
        coerceString(value.text)
    )
}

const messageRole = (value: unknown): string => {
    if (!isRecord(value)) return ''

    const directType = coerceString(value.type)
    const directRole = coerceString(value.role)
    const data = value.data
    const kwargs = value.kwargs

    return (
        directRole ||
        directType ||
        (isRecord(data)
            ? coerceString(data.type) || coerceString(data.role)
            : '') ||
        (isRecord(kwargs)
            ? coerceString(kwargs.type) || coerceString(kwargs.role)
            : '')
    )
}

const normalizeLogText = (value: unknown): string => {
    if (typeof value === 'string') return value

    if (Array.isArray(value)) {
        return value
            .map((item) => {
                const text = normalizeMessageContent(item)
                if (!text) return ''

                const role = messageRole(item)
                return role ? `[${role}]\n${text}` : text
            })
            .filter(Boolean)
            .join('\n\n')
    }

    return normalizeMessageContent(value)
}

export const summarizeLogText = (value: unknown, maxLength = 160): string => {
    const normalized = normalizeLogText(value).replace(/\s+/g, ' ').trim()
    if (normalized.length <= maxLength) return normalized

    return `${normalized.slice(0, maxLength)}...`
}

export const extractLogText = normalizeLogText

/** A JSON.stringify replacer that handles cyclic and non-JSON values safely. */
const createSafeJsonReplacer = () => {
    const seen = new WeakSet<object>()

    return (_key: string, value: unknown) => {
        if (typeof value === 'bigint') return `${value.toString()}n`
        if (typeof value === 'symbol') return value.toString()
        if (typeof value === 'function') {
            return `[Function ${value.name || 'anonymous'}]`
        }

        if (value instanceof Error) {
            return {
                name: value.name,
                message: value.message,
                stack: value.stack
            }
        }

        if (value instanceof Map) return Array.from(value.entries())
        if (value instanceof Set) return Array.from(value.values())

        if (value instanceof ArrayBuffer) {
            return { type: 'ArrayBuffer', byteLength: value.byteLength }
        }

        if (ArrayBuffer.isView(value)) {
            return {
                type: value.constructor.name,
                byteLength: value.byteLength
            }
        }

        if (value && typeof value === 'object') {
            if (seen.has(value)) return '[Circular]'
            seen.add(value)
        }

        return value
    }
}

/** Pretty-print an arbitrary log body, never throwing on exotic values. */
export const stringifyLogBody = (value: unknown): string => {
    try {
        return JSON.stringify(value, createSafeJsonReplacer(), 2) ?? 'null'
    } catch (error) {
        return JSON.stringify(
            {
                error: 'Failed to serialize log body.',
                reason: coerceReason(error)
            },
            null,
            2
        )
    }
}

const joinBodies = (values: (string | null | undefined)[]) => {
    return values.filter(Boolean).join('\n\n')
}

export const summarizeRunBodies = (run: ChatLunaCoreLogRun) => {
    const requestBody =
        run.requestBody ||
        joinBodies(run.exchanges.map((exchange) => exchange.requestBody))
    const responseBody =
        run.responseBody ||
        joinBodies(run.exchanges.map((exchange) => exchange.responseBody)) ||
        null

    return { requestBody, responseBody }
}

/** Build a list-item summary from a full log entry. */
export const summarizeCoreLog = (
    entry: ChatLunaCoreLogDetail
): ChatLunaCoreLogListItem => {
    const requestSize = entry.runs.reduce(
        (sum, run) => sum + run.requestSize,
        0
    )
    const responseSize = entry.runs.reduce(
        (sum, run) => sum + run.responseSize,
        0
    )
    const latestRun = entry.runs.at(-1)
    const exchangeCount = entry.runs.reduce(
        (sum, run) => sum + run.exchanges.length,
        0
    )
    const errorCount = entry.runs.filter((run) => run.status === 'error').length

    return {
        id: entry.id,
        requestId: entry.requestId,
        source: entry.source ?? 'chatluna',
        conversationId: entry.conversationId,
        conversationTitle: entry.conversationTitle,
        bindingKey: entry.bindingKey,
        model: entry.model,
        preset: entry.preset,
        chatMode: entry.chatMode,
        platform: entry.platform,
        userId: entry.userId,
        guildId: entry.guildId,
        channelId: entry.channelId,
        messageSummary: entry.messageSummary,
        status: entry.status,
        stream: entry.stream,
        startedAt: entry.startedAt,
        updatedAt: entry.updatedAt,
        completedAt: entry.completedAt,
        durationMs: entry.durationMs,
        runCount: entry.runs.length,
        exchangeCount,
        errorCount,
        requestSize,
        responseSize,
        latestRunName: latestRun?.runName ?? null
    }
}

export const cloneCoreLogDetail = (
    entry: ChatLunaCoreLogDetail
): ChatLunaCoreLogDetail => {
    return {
        ...entry,
        route: { ...entry.route },
        runs: entry.runs.map((run) => ({
            ...run,
            exchanges: run.exchanges.map((exchange) => ({ ...exchange }))
        }))
    }
}

/** Fields that the keyword search matches a log entry against. */
export const logKeywordFields = (
    item: ChatLunaCoreLogListItem
): (string | null | undefined)[] => [
    item.requestId,
    item.source,
    item.conversationId,
    item.conversationTitle,
    item.bindingKey,
    item.model,
    item.preset,
    item.chatMode,
    item.platform,
    item.userId,
    item.guildId,
    item.channelId,
    item.messageSummary
]
