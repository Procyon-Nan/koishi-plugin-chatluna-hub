/**
 * In-memory + disk-persisted store of ChatLuna model HTTP logs. Hub records the
 * real fetch exchanges below ChatLunaChatModel requester calls.
 */
import fs from 'fs/promises'
import path from 'path'
import {
    coerceReason,
    coerceString,
    normalizePage,
    normalizePageSize,
    paginate,
    toTimestamp
} from '../shared'
import { parseRouteInfo } from './conversation-routes'
import {
    type ChatLunaCoreLogDetail,
    type ChatLunaCoreLogExchange,
    type ChatLunaCoreLogGetInput,
    type ChatLunaCoreLogListQuery,
    type ChatLunaCoreLogListResult,
    type ChatLunaCoreLogRun,
    type ChatLunaCoreLogStatus,
    type ChatLunaCoreLogStatusCounts,
    cloneCoreLogDetail,
    extractLogText,
    logKeywordFields,
    summarizeCoreLog,
    summarizeLogText,
    summarizeRunBodies
} from './log-types'

const maxCoreLogEntries = 100
const coreLogStoreVersion = 2
const coreLogSaveDebounceMs = 1500
const missingHttpExchangeError =
    'No HTTP exchange was captured for this model run. The model response may have succeeded, but request logging did not observe the underlying fetch call.'

export interface ChatLunaCoreLogStoreOptions {
    filePath?: string
    logger?: { warn: (...args: unknown[]) => void }
}

export interface ChatLunaModelRunStart {
    requestId?: string | null
    source?: string | null
    method: 'completion' | 'completionStream'
    model?: string | null
    platform?: string | null
    conversationId?: string | null
    conversationTitle?: string | null
    bindingKey?: string | null
    preset?: string | null
    chatMode?: string | null
    selfId?: string | null
    userId?: string | null
    guildId?: string | null
    channelId?: string | null
    message?: unknown
    stream?: boolean
}

export interface ChatLunaHttpExchangeStart {
    url: string
    method: string
    requestBody: string
    requestTruncated?: boolean
}

export interface ChatLunaHttpExchangeComplete {
    httpStatus?: number | null
    httpStatusText?: string | null
    responseBody: string
    responseTruncated?: boolean
}

interface PersistedCoreLogFile {
    version: number
    sequence: number
    entries: ChatLunaCoreLogDetail[]
}

const normalizeSource = (source: string | null | undefined) => {
    return source === 'character' ? 'character' : 'chatluna'
}

const isPending = (item: { status: ChatLunaCoreLogStatus }) => {
    return item.status === 'pending'
}

export class ChatLunaCoreLogStore {
    private entries = new Map<string, ChatLunaCoreLogDetail>()

    private sequence = 0

    private readonly filePath?: string

    private readonly logger?: { warn: (...args: unknown[]) => void }

    private saveTimer: ReturnType<typeof setTimeout> | undefined

    private saving = false

    private pendingSave = false

    private disposed = false

    constructor(options: ChatLunaCoreLogStoreOptions = {}) {
        this.filePath = options.filePath
        this.logger = options.logger
    }

    async load() {
        if (!this.filePath) return
        if (this.entries.size > 0) return

        let raw: string
        try {
            raw = await fs.readFile(this.filePath, 'utf8')
        } catch (error) {
            if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
                this.logger?.warn(
                    'failed to read core log store: %s',
                    coerceReason(error)
                )
            }
            return
        }

        try {
            const parsed = JSON.parse(raw) as PersistedCoreLogFile
            if (!parsed || !Array.isArray(parsed.entries)) return

            this.entries.clear()
            for (const entry of parsed.entries) {
                if (!entry || typeof entry.id !== 'string') continue

                const normalized = this.normalizePersistedEntry(entry)
                this.entries.set(normalized.id, normalized)
            }
            this.sequence =
                typeof parsed.sequence === 'number' ? parsed.sequence : 0
            this.trimEntries()
        } catch (error) {
            this.logger?.warn(
                'failed to parse core log store: %s',
                coerceReason(error)
            )
        }
    }

    async dispose() {
        this.disposed = true
        if (this.saveTimer) {
            clearTimeout(this.saveTimer)
            this.saveTimer = undefined
        }
        await this.flush()
    }

    private scheduleSave() {
        if (!this.filePath || this.disposed) return
        if (this.saveTimer) return

        this.saveTimer = setTimeout(() => {
            this.saveTimer = undefined
            this.flush()
        }, coreLogSaveDebounceMs)
    }

    private async flush() {
        if (!this.filePath) return

        if (this.saving) {
            this.pendingSave = true
            return
        }

        this.saving = true
        try {
            const payload: PersistedCoreLogFile = {
                version: coreLogStoreVersion,
                sequence: this.sequence,
                entries: Array.from(this.entries.values())
            }
            const dir = path.dirname(this.filePath)
            await fs.mkdir(dir, { recursive: true })

            const tmp = `${this.filePath}.tmp`
            await fs.writeFile(tmp, JSON.stringify(payload), 'utf8')
            await fs.rename(tmp, this.filePath)
        } catch (error) {
            this.logger?.warn(
                'failed to persist core log store: %s',
                coerceReason(error)
            )
        } finally {
            this.saving = false
            if (this.pendingSave) {
                this.pendingSave = false
                await this.flush()
            }
        }
    }

    list(query: ChatLunaCoreLogListQuery = {}): ChatLunaCoreLogListResult {
        const page = normalizePage(query.page)
        const pageSize = normalizePageSize(query.pageSize)
        const keyword = query.keyword?.trim().toLowerCase()
        const status = query.status ?? 'all'
        const source = query.source ?? 'all'
        let items = Array.from(this.entries.values()).map(summarizeCoreLog)

        if (status !== 'all') {
            items = items.filter((item) => item.status === status)
        }

        if (source !== 'all') {
            items = items.filter((item) => item.source === source)
        }

        if (keyword) {
            items = items.filter((item) =>
                logKeywordFields(item)
                    .filter(Boolean)
                    .join('\n')
                    .toLowerCase()
                    .includes(keyword)
            )
        }

        const statusCounts: ChatLunaCoreLogStatusCounts = {
            pending: 0,
            success: 0,
            error: 0
        }

        for (const item of items) {
            statusCounts[item.status] += 1
        }

        items.sort(
            (left, right) =>
                toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt)
        )

        return {
            ...paginate(items, page, pageSize),
            statusCounts,
            updatedAt: new Date().toISOString()
        }
    }

    get(input: ChatLunaCoreLogGetInput): ChatLunaCoreLogDetail {
        const id = input.id?.trim()
        if (!id) throw new Error('Log id is required.')

        const entry = this.entries.get(id)
        if (!entry) throw new Error(`ChatLuna log is not found: ${id}`)

        return cloneCoreLogDetail(entry)
    }

    clear() {
        this.entries.clear()
        this.scheduleSave()
    }

    startModelRun(input: ChatLunaModelRunStart) {
        const now = new Date().toISOString()
        const entry = this.findOrCreateEntry(input, now)
        const runId = `${entry.id}:model:${++this.sequence}`
        const run = this.createRun(entry, runId, input.method, now)

        entry.runs.push(run)
        this.entries.set(entry.id, entry)
        this.trimEntries()
        this.refreshEntrySummary(entry, now)

        return { entryId: entry.id, runId }
    }

    completeModelRun(ref: { entryId: string; runId: string }) {
        const entry = this.entries.get(ref.entryId)
        const run = entry?.runs.find((item) => item.runId === ref.runId)
        if (!entry || !run) return

        const now = new Date().toISOString()
        run.completedAt = now
        run.durationMs = toTimestamp(now) - toTimestamp(run.startedAt)
        run.error = null

        this.refreshRunSummary(run)
        this.refreshEntrySummary(entry, now)
    }

    failModelRun(ref: { entryId: string; runId: string }, error: unknown) {
        const entry = this.entries.get(ref.entryId)
        const run = entry?.runs.find((item) => item.runId === ref.runId)
        if (!entry || !run) return

        const now = new Date().toISOString()
        run.completedAt = now
        run.durationMs = toTimestamp(now) - toTimestamp(run.startedAt)
        run.error = coerceReason(error)

        this.refreshRunSummary(run)
        this.refreshEntrySummary(entry, now)
    }

    startHttpExchange(
        ref: { entryId: string; runId: string },
        input: ChatLunaHttpExchangeStart
    ) {
        const entry = this.entries.get(ref.entryId)
        const run = entry?.runs.find((item) => item.runId === ref.runId)
        if (!entry || !run) return null

        const now = new Date().toISOString()
        const exchangeId = `${run.runId}:http:${++this.sequence}`
        const exchange: ChatLunaCoreLogExchange = {
            id: `${entry.id}:${exchangeId}`,
            exchangeId,
            runId: run.runId,
            url: input.url,
            method: input.method,
            status: 'pending',
            httpStatus: null,
            httpStatusText: null,
            startedAt: now,
            completedAt: null,
            durationMs: null,
            requestBody: input.requestBody,
            responseBody: null,
            requestSize: input.requestBody.length,
            responseSize: 0,
            requestTruncated: input.requestTruncated === true,
            responseTruncated: false,
            error: null
        }

        run.exchanges.push(exchange)
        this.refreshRunSummary(run)
        this.refreshEntrySummary(entry, now)

        return { entryId: entry.id, runId: run.runId, exchangeId }
    }

    completeHttpExchange(
        ref: { entryId: string; runId: string; exchangeId: string },
        output: ChatLunaHttpExchangeComplete
    ) {
        const entry = this.entries.get(ref.entryId)
        const run = entry?.runs.find((item) => item.runId === ref.runId)
        const exchange = run?.exchanges.find(
            (item) => item.exchangeId === ref.exchangeId
        )
        if (!entry || !run || !exchange) return

        const now = new Date().toISOString()
        exchange.status =
            output.httpStatus != null && output.httpStatus >= 400
                ? 'error'
                : 'success'
        exchange.httpStatus = output.httpStatus ?? null
        exchange.httpStatusText = output.httpStatusText ?? null
        exchange.completedAt = now
        exchange.durationMs = toTimestamp(now) - toTimestamp(exchange.startedAt)
        exchange.responseBody = output.responseBody
        exchange.responseSize = output.responseBody.length
        exchange.responseTruncated = output.responseTruncated === true
        exchange.error =
            exchange.status === 'error' ? output.responseBody : null

        this.refreshRunSummary(run)
        this.refreshEntrySummary(entry, now)
    }

    failHttpExchange(
        ref: { entryId: string; runId: string; exchangeId: string },
        error: unknown
    ) {
        const entry = this.entries.get(ref.entryId)
        const run = entry?.runs.find((item) => item.runId === ref.runId)
        const exchange = run?.exchanges.find(
            (item) => item.exchangeId === ref.exchangeId
        )
        if (!entry || !run || !exchange) return

        const now = new Date().toISOString()
        const reason = coerceReason(error)
        exchange.status = 'error'
        exchange.completedAt = now
        exchange.durationMs = toTimestamp(now) - toTimestamp(exchange.startedAt)
        exchange.responseBody = reason
        exchange.responseSize = reason.length
        exchange.error = reason

        this.refreshRunSummary(run)
        this.refreshEntrySummary(entry, now)
    }

    private findOrCreateEntry(
        input: ChatLunaModelRunStart,
        now: string
    ): ChatLunaCoreLogDetail {
        const requestId =
            input.requestId?.trim() ||
            `chatluna-hub-model-${Date.now()}-${++this.sequence}`
        const entryId = input.requestId?.trim()
            ? `request:${requestId}`
            : `request:${requestId}:entry:${++this.sequence}`
        const existing = this.entries.get(entryId)

        if (existing) {
            this.mergeEntryMeta(existing, input)
            return existing
        }

        return this.createEntry(input, requestId, entryId, now)
    }

    private createEntry(
        input: ChatLunaModelRunStart,
        requestId: string,
        entryId: string,
        now: string
    ): ChatLunaCoreLogDetail {
        const source = normalizeSource(input.source)
        const bindingKey =
            coerceString(input.bindingKey) ||
            this.createFallbackBindingKey(input, source)
        const messageBody = extractLogText(input.message)

        return {
            id: entryId,
            requestId,
            source,
            conversationId: coerceString(input.conversationId) || bindingKey,
            conversationTitle:
                coerceString(input.conversationTitle) ||
                (source === 'character' ? 'Character' : 'ChatLuna'),
            bindingKey,
            model: coerceString(input.model),
            preset: coerceString(input.preset),
            chatMode:
                coerceString(input.chatMode) ||
                (source === 'character' ? 'character' : ''),
            platform: input.platform ?? null,
            userId: input.userId ?? null,
            guildId: input.guildId ?? null,
            channelId: input.channelId ?? null,
            messageSummary: summarizeLogText(messageBody),
            messageBody,
            status: 'pending',
            stream: input.stream === true,
            startedAt: now,
            updatedAt: now,
            completedAt: null,
            durationMs: null,
            runCount: 0,
            exchangeCount: 0,
            errorCount: 0,
            requestSize: 0,
            responseSize: 0,
            latestRunName: null,
            route: parseRouteInfo(bindingKey),
            runs: []
        }
    }

    private mergeEntryMeta(
        entry: ChatLunaCoreLogDetail,
        input: ChatLunaModelRunStart
    ) {
        if (input.source) {
            entry.source = normalizeSource(input.source)
            if (!entry.conversationTitle) {
                entry.conversationTitle =
                    entry.source === 'character' ? 'Character' : 'ChatLuna'
            }
        }
        entry.model ||= coerceString(input.model)
        entry.preset ||= coerceString(input.preset)
        entry.chatMode ||= coerceString(input.chatMode)
        entry.platform ??= input.platform ?? null
        entry.userId ??= input.userId ?? null
        entry.guildId ??= input.guildId ?? null
        entry.channelId ??= input.channelId ?? null
        entry.stream ||= input.stream === true

        const messageBody = extractLogText(input.message)
        if (!entry.messageBody && messageBody) {
            entry.messageBody = messageBody
            entry.messageSummary = summarizeLogText(messageBody)
        }
    }

    private createFallbackBindingKey(
        input: ChatLunaModelRunStart,
        source: 'chatluna' | 'character'
    ) {
        const platform = input.platform ?? source
        const guildId = input.guildId ?? input.channelId
        const selfId = input.selfId ?? '-'
        const userId = input.userId ?? '-'

        if (!guildId) return `personal:${platform}:${selfId}:direct:${userId}`
        return `personal:${platform}:${selfId}:${guildId}:${userId}`
    }

    private createRun(
        entry: ChatLunaCoreLogDetail,
        runId: string,
        runName: string,
        now: string
    ): ChatLunaCoreLogRun {
        return {
            id: `${entry.id}:${runId}`,
            runId,
            parentRunId: null,
            runName,
            type: 'model-requester',
            status: 'pending',
            startedAt: now,
            completedAt: null,
            durationMs: null,
            requestBody: '',
            responseBody: null,
            requestSize: 0,
            responseSize: 0,
            error: null,
            usageMetadata: undefined,
            exchangeCount: 0,
            exchanges: []
        }
    }

    private refreshRunSummary(run: ChatLunaCoreLogRun) {
        const hasError = run.exchanges.some(
            (exchange) => exchange.status === 'error'
        )
        const hasPending = run.exchanges.some(isPending)
        const hasCompleted = run.completedAt != null
        const hasExchange = run.exchanges.length > 0
        const bodies = summarizeRunBodies(run)

        run.exchangeCount = run.exchanges.length
        run.requestSize = run.exchanges.reduce(
            (sum, exchange) => sum + exchange.requestSize,
            0
        )
        run.responseSize = run.exchanges.reduce(
            (sum, exchange) => sum + exchange.responseSize,
            0
        )
        run.requestBody = bodies.requestBody
        run.responseBody = bodies.responseBody

        if (hasExchange && run.error === missingHttpExchangeError) {
            run.error = null
        }

        if (run.error || hasError) {
            run.status = 'error'
        } else if (!hasCompleted || hasPending) {
            run.status = 'pending'
        } else if (!hasExchange) {
            run.status = 'error'
            run.error = missingHttpExchangeError
        } else {
            run.status = 'success'
        }
    }

    private refreshEntrySummary(entry: ChatLunaCoreLogDetail, now: string) {
        for (const run of entry.runs) {
            this.refreshRunSummary(run)
        }

        const hasError = entry.runs.some((run) => run.status === 'error')
        const hasPending = entry.runs.some(isPending)

        entry.status = hasError ? 'error' : hasPending ? 'pending' : 'success'
        entry.updatedAt = now

        if (entry.status === 'pending') {
            entry.completedAt = null
            entry.durationMs = null
        } else {
            entry.completedAt = now
            entry.durationMs = toTimestamp(now) - toTimestamp(entry.startedAt)
        }

        const summary = summarizeCoreLog(entry)
        entry.runCount = summary.runCount
        entry.exchangeCount = summary.exchangeCount
        entry.errorCount = summary.errorCount
        entry.requestSize = summary.requestSize
        entry.responseSize = summary.responseSize
        entry.latestRunName = summary.latestRunName

        this.scheduleSave()
    }

    private normalizePersistedEntry(
        entry: ChatLunaCoreLogDetail
    ): ChatLunaCoreLogDetail {
        entry.source = normalizeSource(entry.source)
        entry.runs = (entry.runs ?? []).map((run) =>
            this.normalizePersistedRun(entry, run)
        )
        entry.route ??= parseRouteInfo(entry.bindingKey)
        entry.exchangeCount ??= entry.runs.reduce(
            (sum, run) => sum + run.exchanges.length,
            0
        )
        this.refreshEntrySummary(
            entry,
            entry.updatedAt ?? new Date().toISOString()
        )
        return entry
    }

    private normalizePersistedRun(
        entry: ChatLunaCoreLogDetail,
        run: ChatLunaCoreLogRun
    ): ChatLunaCoreLogRun {
        const legacyType = (run as { type?: string }).type
        run.type = 'model-requester'
        run.runName ||= legacyType ?? 'model-requester'
        run.exchanges = Array.isArray(run.exchanges)
            ? run.exchanges
            : [
                  {
                      id: `${run.id}:legacy-http`,
                      exchangeId: `${run.runId}:legacy-http`,
                      runId: run.runId,
                      url: '',
                      method: 'POST',
                      status: run.status,
                      httpStatus: null,
                      httpStatusText: null,
                      startedAt: run.startedAt,
                      completedAt: run.completedAt ?? null,
                      durationMs: run.durationMs ?? null,
                      requestBody: run.requestBody ?? '',
                      responseBody: run.responseBody ?? null,
                      requestSize: run.requestSize ?? 0,
                      responseSize: run.responseSize ?? 0,
                      requestTruncated: false,
                      responseTruncated: false,
                      error: run.error ?? null
                  }
              ]
        run.exchangeCount = run.exchanges.length
        run.id ||= `${entry.id}:${run.runId}`
        this.refreshRunSummary(run)
        return run
    }

    private trimEntries() {
        while (this.entries.size > maxCoreLogEntries) {
            const oldest = Array.from(this.entries.values()).sort(
                (left, right) =>
                    toTimestamp(left.startedAt) - toTimestamp(right.startedAt)
            )[0]

            if (!oldest) return
            this.entries.delete(oldest.id)
        }
    }
}
