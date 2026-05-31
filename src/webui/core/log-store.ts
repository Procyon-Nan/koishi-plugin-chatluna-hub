/**
 * In-memory + disk-persisted store of ChatLuna LLM call logs. It captures
 * request/response bodies by instrumenting the callback chain (see
 * {@link ChatLunaCoreLogStore.instrumentCallbacks}) and keeps the most recent
 * {@link maxCoreLogEntries} entries. All persistence is best-effort: a failed
 * read or write is logged and ignored, never blocking the chat pipeline.
 */
import fs from 'fs/promises'
import path from 'path'
import { CallbackManager } from '@langchain/core/callbacks/manager'
import {
    BaseCallbackHandler,
    type CallbackHandlerMethods
} from '@langchain/core/callbacks/base'
import {
    coerceReason,
    coerceString,
    getRecordString,
    isRecord,
    normalizePage,
    normalizePageSize,
    paginate,
    toTimestamp
} from '../shared'
import { parseRouteInfo } from './conversation-routes'
import {
    type ChatLunaCallbackProviderInputLike,
    type ChatLunaCoreLogDetail,
    type ChatLunaCoreLogGetInput,
    type ChatLunaCoreLogListQuery,
    type ChatLunaCoreLogListResult,
    type ChatLunaCoreLogRun,
    type ChatLunaCoreLogRunType,
    type ChatLunaCoreLogStatus,
    cloneCoreLogDetail,
    extractLogText,
    extractRunUsageMetadata,
    logKeywordFields,
    stringifyLogBody,
    summarizeCoreLog,
    summarizeLogText
} from './log-types'

const maxCoreLogEntries = 100
const coreLogStoreVersion = 1
const coreLogSaveDebounceMs = 1500

export interface ChatLunaCoreLogStoreOptions {
    filePath?: string
    logger?: { warn: (...args: unknown[]) => void }
}

interface PersistedCoreLogFile {
    version: number
    sequence: number
    entries: ChatLunaCoreLogDetail[]
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

    // --- persistence ------------------------------------------------------

    /**
     * Load persisted logs from disk. Safe to call once at startup; failures are
     * logged and ignored (logs are best-effort, never block plugin load).
     */
    async load() {
        if (!this.filePath) return
        // Don't clobber live entries captured before load ran (e.g. HMR).
        if (this.entries.size > 0) return

        let raw: string
        try {
            raw = await fs.readFile(this.filePath, 'utf8')
        } catch (error) {
            // Missing file on first run is expected; only warn on real errors.
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
                if (entry && typeof entry.id === 'string') {
                    this.entries.set(entry.id, entry)
                }
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

    /** Flush any pending save and stop the debounce timer. */
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

        // Coalesce concurrent saves: if a write is in flight, mark that another
        // is needed and let the current one re-run after it finishes.
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

    // --- instrumentation --------------------------------------------------

    /**
     * Inject log handlers into a CallbackManager as *inheritable* handlers, so
     * they propagate to nested LLM runs via getChild().
     *
     * The official registerCallbacksProvider path adds handlers to the
     * non-inheritable slot of CallbackManager.configure, which means the
     * chain-level manager drops them before reaching the model run. Patching
     * resolveCallbacks and re-adding with inherit=true is the only hub-side way
     * to observe handleChatModelStart / handleLLMEnd.
     */
    instrumentCallbacks(manager: unknown, input: unknown): unknown {
        // When no other callbacks provider is registered, chatluna's
        // resolveCallbacks returns input.callbacks (usually undefined), so
        // there is no manager to attach to. Create our own and return it —
        // chatluna passes it to chain.invoke as the inheritable callbacks, so
        // getChild() propagates our handlers to the LLM run. We only mutate a
        // manager we created; an incoming one is copied first to avoid
        // polluting a caller-owned instance.
        const target =
            manager instanceof CallbackManager
                ? manager.copy()
                : new CallbackManager()

        for (const handler of this.buildHandlers(input)) {
            target.addHandler(BaseCallbackHandler.fromMethods(handler), true)
        }

        return target
    }

    private buildHandlers(input: unknown): CallbackHandlerMethods[] {
        const entry = this.createEntry(
            input as ChatLunaCallbackProviderInputLike
        )

        const safely = (fn: () => void) => {
            try {
                fn()
            } catch {
                // Never let log bookkeeping disrupt the chat callback chain.
            }
        }

        return [
            {
                handleChatModelStart: (...args: unknown[]) => {
                    safely(() => this.startRun(entry.id, 'chat-model', args))
                },
                handleLLMStart: (...args: unknown[]) => {
                    safely(() => this.startRun(entry.id, 'llm', args))
                },
                handleLLMEnd: (...args: unknown[]) => {
                    safely(() => this.completeRun(entry.id, args))
                },
                handleLLMError: (...args: unknown[]) => {
                    safely(() => this.failRun(entry.id, args))
                },
                handleChainError: (...args: unknown[]) => {
                    safely(() => this.failEntry(entry.id, args[0]))
                }
            }
        ]
    }

    // --- queries ----------------------------------------------------------

    list(query: ChatLunaCoreLogListQuery = {}): ChatLunaCoreLogListResult {
        const page = normalizePage(query.page)
        const pageSize = normalizePageSize(query.pageSize)
        const keyword = query.keyword?.trim().toLowerCase()
        const status = query.status ?? 'all'
        let items = Array.from(this.entries.values()).map(summarizeCoreLog)

        if (status !== 'all') {
            items = items.filter((item) => item.status === status)
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

        items.sort(
            (left, right) =>
                toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt)
        )

        return {
            ...paginate(items, page, pageSize),
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

    // --- run bookkeeping --------------------------------------------------

    private createEntry(
        input: ChatLunaCallbackProviderInputLike
    ): ChatLunaCoreLogDetail {
        const conversation = input.conversation
        const session = input.session
        const requestId =
            input.requestId?.trim() ||
            `chatluna-hub-${Date.now()}-${++this.sequence}`
        const bindingKey = coerceString(conversation?.bindingKey)
        const now = new Date().toISOString()
        const entry: ChatLunaCoreLogDetail = {
            id: requestId,
            requestId,
            conversationId: coerceString(conversation?.id),
            conversationTitle: coerceString(conversation?.title),
            bindingKey,
            model: coerceString(conversation?.model),
            preset: coerceString(conversation?.preset),
            chatMode: coerceString(conversation?.chatMode),
            platform: getRecordString(session, 'platform') || null,
            userId: getRecordString(session, 'userId') || null,
            guildId: getRecordString(session, 'guildId') || null,
            channelId: getRecordString(session, 'channelId') || null,
            messageSummary: summarizeLogText(input.message),
            messageBody: extractLogText(input.message),
            status: 'pending',
            stream: input.stream === true,
            startedAt: now,
            updatedAt: now,
            completedAt: null,
            durationMs: null,
            runCount: 0,
            errorCount: 0,
            requestSize: 0,
            responseSize: 0,
            latestRunName: null,
            route: parseRouteInfo(bindingKey),
            runs: []
        }

        this.entries.set(entry.id, entry)
        this.trimEntries()
        this.scheduleSave()

        return entry
    }

    private nextRunId(entryId: string): string {
        return `${entryId}:run:${++this.sequence}`
    }

    /** A reproducible snapshot of the chat request, embedded in run bodies. */
    private requestSnapshot(entry: ChatLunaCoreLogDetail) {
        return {
            requestId: entry.requestId,
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
            message: entry.messageBody,
            stream: entry.stream
        }
    }

    /** A pending run skeleton with its request body already sized. */
    private createRun(
        entry: ChatLunaCoreLogDetail,
        runId: string,
        parentRunId: unknown,
        type: ChatLunaCoreLogRunType,
        runName: string,
        requestBody: string
    ): ChatLunaCoreLogRun {
        return {
            id: `${entry.id}:${runId}`,
            runId,
            parentRunId: typeof parentRunId === 'string' ? parentRunId : null,
            runName,
            type,
            status: 'pending',
            startedAt: new Date().toISOString(),
            completedAt: null,
            durationMs: null,
            requestBody,
            responseBody: null,
            requestSize: requestBody.length,
            responseSize: 0,
            error: null,
            usageMetadata: undefined
        }
    }

    private startRun(
        entryId: string,
        type: ChatLunaCoreLogRunType,
        args: unknown[]
    ) {
        const entry = this.entries.get(entryId)
        if (!entry) return

        const [
            target,
            payload,
            runId,
            parentRunId,
            extraParams,
            tags,
            metadata,
            runName
        ] = args
        const normalizedRunId =
            typeof runId === 'string' ? runId : this.nextRunId(entryId)
        const resolvedRunName =
            typeof runName === 'string'
                ? runName
                : (this.resolveRunName(target) ?? type)
        const requestBody = stringifyLogBody({
            type,
            runId: normalizedRunId,
            parentRunId,
            runName: resolvedRunName,
            target,
            payload,
            extraParams,
            tags,
            metadata,
            chatluna: this.requestSnapshot(entry)
        })

        // Ignore duplicate starts for a run id we already track.
        if (entry.runs.some((item) => item.runId === normalizedRunId)) return

        entry.runs.push(
            this.createRun(
                entry,
                normalizedRunId,
                parentRunId,
                type,
                resolvedRunName,
                requestBody
            )
        )

        this.refreshEntrySummary(entry, 'pending', new Date().toISOString())
    }

    private completeRun(entryId: string, args: unknown[]) {
        const entry = this.entries.get(entryId)
        if (!entry) return

        const [output, runId, parentRunId, tags, extraParams] = args
        const run = this.resolveRun(entry, runId, parentRunId)
        const now = new Date().toISOString()
        const responseBody = stringifyLogBody({ output, extraParams, tags })

        run.status = 'success'
        run.completedAt = now
        run.durationMs = toTimestamp(now) - toTimestamp(run.startedAt)
        run.responseBody = responseBody
        run.responseSize = responseBody.length
        run.error = null
        run.usageMetadata = extractRunUsageMetadata(output)

        this.refreshEntrySummary(entry, 'success', now)
    }

    private failRun(entryId: string, args: unknown[]) {
        const entry = this.entries.get(entryId)
        if (!entry) return

        const [error, runId, parentRunId, tags, extraParams] = args
        const run = this.resolveRun(entry, runId, parentRunId)
        const now = new Date().toISOString()
        const responseBody = stringifyLogBody({ error, extraParams, tags })

        run.status = 'error'
        run.completedAt = now
        run.durationMs = toTimestamp(now) - toTimestamp(run.startedAt)
        run.responseBody = responseBody
        run.responseSize = responseBody.length
        run.error = coerceReason(error)

        this.refreshEntrySummary(entry, 'error', now)
    }

    private failEntry(entryId: string, error: unknown) {
        const entry = this.entries.get(entryId)
        if (!entry || entry.status === 'error') return

        const now = new Date().toISOString()
        if (entry.runs.length === 0) {
            const body = stringifyLogBody({ error })
            const run = this.createRun(
                entry,
                'chain-error',
                null,
                'llm',
                'chain-error',
                stringifyLogBody(this.requestSnapshot(entry))
            )

            run.startedAt = entry.startedAt
            run.completedAt = now
            run.durationMs = toTimestamp(now) - toTimestamp(entry.startedAt)
            run.responseBody = body
            run.requestSize = 0
            run.responseSize = body.length
            run.error = coerceReason(error)

            entry.runs.push(run)
        }

        this.refreshEntrySummary(entry, 'error', now)
    }

    /** Find an existing run by id, or create a placeholder pending run. */
    private resolveRun(
        entry: ChatLunaCoreLogDetail,
        runId: unknown,
        parentRunId: unknown
    ): ChatLunaCoreLogRun {
        const normalizedRunId =
            typeof runId === 'string' ? runId : this.nextRunId(entry.id)
        const existing = entry.runs.find((run) => run.runId === normalizedRunId)
        if (existing) return existing

        const run = this.createRun(
            entry,
            normalizedRunId,
            parentRunId,
            'llm',
            'unknown',
            stringifyLogBody(this.requestSnapshot(entry))
        )

        entry.runs.push(run)

        return run
    }

    private refreshEntrySummary(
        entry: ChatLunaCoreLogDetail,
        status: ChatLunaCoreLogStatus,
        now: string
    ) {
        const hasError = entry.runs.some((run) => run.status === 'error')
        const hasPending = entry.runs.some((run) => run.status === 'pending')

        entry.status = hasError ? 'error' : hasPending ? 'pending' : status
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
        entry.errorCount = summary.errorCount
        entry.requestSize = summary.requestSize
        entry.responseSize = summary.responseSize
        entry.latestRunName = summary.latestRunName

        this.scheduleSave()
    }

    private resolveRunName(value: unknown): string | null {
        if (!isRecord(value)) return null

        const name = coerceString(value.name)
        if (name) return name

        const id = value.id
        if (Array.isArray(id)) {
            return id.map((item) => String(item)).join('/')
        }

        return coerceString(value.lc_name) || null
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
