import { receive } from '@koishijs/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type {
    ChatLunaCoreModelItem,
    ChatLunaCorePresetGenerateEvent,
    PresetGenerateCharacterFormat,
    PresetGenerateFormat,
    PresetGenerateMainFormat
} from '../../types'
import { errorMessage } from '../lib/draft-store'
import type { PresetHubApi } from '../lib/hub-api'
import {
    resolveGenerateDone,
    routeGenerateEvent
} from '../lib/lifecycle-decisions'
import type { DraftSession, PresetSource } from '../lib/types'

const MODEL_STORAGE_KEY = 'chatluna-hub-preset-generate-model'
const MAX_LOG_LINES = 80
const GENERATE_EVENT = 'chatluna-hub/core/presets/generate/event'
/** Cap on events held while the server-assigned requestId is still unknown. */
const MAX_PENDING_EVENTS = 400

export type GenerateLogLine = {
    id: number
    text: string
    kind: 'info' | 'step' | 'token' | 'ok' | 'error'
}

const mainFormats: { value: PresetGenerateMainFormat; label: string }[] = [
    { value: 'markdown', label: 'Markdown' },
    { value: 'koishi', label: 'Koishi 消息元素' }
]

const characterFormats: {
    value: PresetGenerateCharacterFormat
    label: string
}[] = [
    { value: 'tool-call', label: '工具调用' },
    { value: 'standard', label: '标准 XML' }
]

export const formatsForSource = (source: PresetSource) =>
    source === 'character' ? characterFormats : mainFormats

export const defaultFormatForSource = (
    source: PresetSource
): PresetGenerateFormat => (source === 'character' ? 'tool-call' : 'markdown')

const readStoredModel = (): string => {
    try {
        return localStorage.getItem(MODEL_STORAGE_KEY) ?? ''
    } catch {
        return ''
    }
}

const writeStoredModel = (fullName: string) => {
    try {
        localStorage.setItem(MODEL_STORAGE_KEY, fullName)
    } catch {
        // ignore quota / private mode
    }
}

type GenerateEventHandler = (event: ChatLunaCorePresetGenerateEvent) => void

const generateEventHandlers = new Set<GenerateEventHandler>()
let generateEventBound = false

/**
 * `receive` keeps a single listener per event name in a module-global map and
 * exposes no way to remove it, so registering per hook instance both outlives
 * the component and silently unsubscribes every earlier instance. Bind once and
 * fan out to the handlers that are still mounted.
 */
const subscribeGenerateEvents = (handler: GenerateEventHandler) => {
    if (!generateEventBound) {
        generateEventBound = true
        receive<ChatLunaCorePresetGenerateEvent>(GENERATE_EVENT, (event) => {
            for (const current of [...generateEventHandlers]) current(event)
        })
    }

    generateEventHandlers.add(handler)
    return () => {
        generateEventHandlers.delete(handler)
    }
}

const bufferPendingEvent = (
    buffer: ChatLunaCorePresetGenerateEvent[],
    event: ChatLunaCorePresetGenerateEvent
) => {
    if (buffer.length >= MAX_PENDING_EVENTS) {
        // Only tokens can realistically overflow this buffer, and they feed a
        // preview that keeps just the tail, so the oldest token is the safe
        // drop — step/done/error carry state the replay must not lose.
        const index = buffer.findIndex((item) => item.kind === 'token')
        buffer.splice(index >= 0 ? index : 0, 1)
    }

    buffer.push(event)
}

let logSeq = 0

export function usePresetGenerate(options: {
    api: PresetHubApi
    session: DraftSession | null
    onApplyRawText: (rawText: string) => void
}) {
    const { api, session, onApplyRawText } = options
    const [llmModels, setLlmModels] = useState<ChatLunaCoreModelItem[]>([])
    const [modelsLoading, setModelsLoading] = useState(false)
    const [modelsError, setModelsError] = useState('')
    const [model, setModel] = useState(readStoredModel)
    const [format, setFormat] = useState<PresetGenerateFormat>(
        defaultFormatForSource(session?.source ?? 'core')
    )
    const [generating, setGenerating] = useState(false)
    const [logLines, setLogLines] = useState<GenerateLogLine[]>([])
    const [tokenPreview, setTokenPreview] = useState('')

    /**
     * Server-assigned job id, null while the start RPC is in flight: the server
     * ignores any client-supplied id and only reveals its own in the reply.
     */
    const requestIdRef = useRef<string | null>(null)
    /**
     * Local job identity, assigned before the RPC. A reply or a late event from
     * an older generation belongs to a job the user already replaced.
     */
    const jobGenRef = useRef(0)
    const pendingEventsRef = useRef<ChatLunaCorePresetGenerateEvent[]>([])
    const jobSessionIdRef = useRef<string | null>(null)
    const jobSessionRawTextRef = useRef<string | null>(null)
    const optionsSessionIdRef = useRef<string | null>(session?.id ?? null)
    const optionsSessionRawTextRef = useRef<string | null>(
        session?.rawText ?? null
    )
    const generatingRef = useRef(false)
    const onApplyRef = useRef(onApplyRawText)
    const apiRef = useRef(api)
    const tokenBufRef = useRef('')

    /**
     * Mirrored during render rather than from an effect: the `done` handler
     * compares these against the snapshot taken when the job started to decide
     * whether the draft was edited meanwhile. A passive effect can still be
     * pending when a `done` event arrives, and the stale value would then read
     * as "not edited" and overwrite the keystroke the user just committed.
     *
     * requestIdRef / generatingRef are deliberately not mirrored here: they are
     * owned by the job lifecycle below, and deriving them from render state
     * would resurrect the id of a job that was just cancelled.
     */
    optionsSessionIdRef.current = session?.id ?? null
    optionsSessionRawTextRef.current = session?.rawText ?? null

    useEffect(() => {
        // Callbacks are only read from event handlers, long after the commit
        // that changed them, so mirroring them during render buys nothing.
        apiRef.current = api
        onApplyRef.current = onApplyRawText
    }, [api, onApplyRawText])

    const pushLog = useCallback(
        (text: string, kind: GenerateLogLine['kind'] = 'info') => {
            setLogLines((prev) => {
                const next = [...prev, { id: ++logSeq, text, kind }]
                return next.length > MAX_LOG_LINES
                    ? next.slice(next.length - MAX_LOG_LINES)
                    : next
            })
        },
        []
    )

    /**
     * Ends the current job locally. Bumping the generation is what makes a
     * still-pending start reply, and every event arriving afterwards, belong to
     * nobody — a finished or cancelled job can then never write state again.
     */
    const resetJobState = useCallback(() => {
        jobGenRef.current += 1
        requestIdRef.current = null
        pendingEventsRef.current = []
        jobSessionIdRef.current = null
        jobSessionRawTextRef.current = null
        generatingRef.current = false
        tokenBufRef.current = ''
        setGenerating(false)
        setTokenPreview('')
    }, [])

    const applyEvent = useCallback(
        (event: ChatLunaCorePresetGenerateEvent) => {
            if (event.kind === 'token') {
                tokenBufRef.current += event.token
                if (tokenBufRef.current.length > 240) {
                    tokenBufRef.current = tokenBufRef.current.slice(-240)
                }
                setTokenPreview(tokenBufRef.current)
                return
            }

            if (event.kind === 'step') {
                pushLog(event.summary || event.stepType, 'step')
                return
            }

            if (event.kind === 'done') {
                // The apply/discard verdict lives in `resolveGenerateDone` so
                // the session/text double-check is unit-testable.
                const { apply, reason } = resolveGenerateDone({
                    jobSessionId: jobSessionIdRef.current,
                    optionsSessionId: optionsSessionIdRef.current,
                    jobRaw: jobSessionRawTextRef.current,
                    optionsRaw: optionsSessionRawTextRef.current
                })

                if (apply) {
                    onApplyRef.current(event.rawText)
                    if (event.warnings?.length) {
                        pushLog(
                            `完成（警告：${event.warnings.join('；')}）`,
                            'ok'
                        )
                    } else {
                        pushLog(
                            '生成完成，已写入当前草稿（未保存到磁盘）',
                            'ok'
                        )
                    }
                } else if (reason === 'switched') {
                    pushLog('生成完成，但当前已切换预设，结果已丢弃', 'info')
                } else {
                    pushLog(
                        '生成完成，但当前草稿已在生成期间修改，结果已丢弃',
                        'info'
                    )
                }
                resetJobState()
                return
            }

            if (event.kind === 'error') {
                pushLog(event.error || '生成失败', 'error')
                resetJobState()
                return
            }

            if (event.kind === 'aborted') {
                pushLog('已取消生成', 'info')
                resetJobState()
            }
        },
        [pushLog, resetJobState]
    )

    const flushPendingEvents = useCallback(
        (activeRequestId: string) => {
            const buffered = pendingEventsRef.current
            pendingEventsRef.current = []
            for (const event of buffered) {
                // A replayed done/error/aborted already ended the job; anything
                // queued behind it would write into a job that no longer exists.
                if (!generatingRef.current) break
                // Other clients' jobs share this broadcast, so the replay keeps
                // only what the server attributed to this job.
                if (event.requestId === activeRequestId) applyEvent(event)
            }
        },
        [applyEvent]
    )

    const handleGenerateEvent = useCallback(
        (event: ChatLunaCorePresetGenerateEvent) => {
            const route = routeGenerateEvent({
                eventRequestId: event?.requestId,
                generating: generatingRef.current,
                currentRequestId: requestIdRef.current
            })

            if (route === 'buffer') {
                // The id exists only in the start reply, so events broadcast
                // before it lands cannot be matched yet. Dropping them would
                // blank the first seconds of output, so they wait here and are
                // replayed — filtered by requestId — once the reply arrives.
                bufferPendingEvent(pendingEventsRef.current, event)
                return
            }

            if (route === 'apply') applyEvent(event)
        },
        [applyEvent]
    )

    useEffect(
        () => subscribeGenerateEvents(handleGenerateEvent),
        [handleGenerateEvent]
    )

    const loadModels = useCallback(async () => {
        setModelsLoading(true)
        setModelsError('')
        try {
            const result = await api.listModels()
            const llms = result.models.filter((item) => item.type === 'llm')
            setLlmModels(llms)

            setModel((prev) => {
                if (prev && llms.some((item) => item.fullName === prev)) {
                    return prev
                }
                return llms[0]?.fullName ?? ''
            })

            if (llms.length === 0) {
                setModelsError(
                    result.reason || '暂无可用 LLM 模型，请先在模型页配置适配器'
                )
            }
        } catch (err) {
            setLlmModels([])
            setModelsError(errorMessage(err, '加载模型列表失败'))
        } finally {
            setModelsLoading(false)
        }
    }, [api])

    useEffect(() => {
        loadModels().catch(() => undefined)
    }, [loadModels])

    useEffect(() => {
        if (!session) return
        setFormat((prev) => {
            const allowed = formatsForSource(session.source).map((f) => f.value)
            if (allowed.includes(prev as never)) return prev
            return defaultFormatForSource(session.source)
        })
    }, [session?.source, session?.id])

    const startGenerate = useCallback(async () => {
        const current = session
        if (!current || generatingRef.current) return

        const selectedModel = model.trim()
        if (!selectedModel) {
            pushLog('请选择 LLM 模型', 'error')
            return
        }

        const gen = ++jobGenRef.current

        writeStoredModel(selectedModel)
        setLogLines([])
        setTokenPreview('')
        tokenBufRef.current = ''
        pendingEventsRef.current = []
        requestIdRef.current = null
        jobSessionIdRef.current = current.id
        jobSessionRawTextRef.current = current.rawText
        generatingRef.current = true
        setGenerating(true)
        pushLog(`开始生成 · ${selectedModel} · ${format}`, 'info')

        try {
            // No requestId is sent: the server always allocates its own, so that
            // a client cannot cancel a job started by someone else.
            const result = await api.startGenerate({
                model: selectedModel,
                source: current.source,
                format,
                rawText: current.rawText
            })

            if (jobGenRef.current !== gen) {
                // Stop was pressed, or another job started, while this reply was
                // in flight. Its id is the only handle on the server job, so
                // this is the last chance to stop the orphan.
                apiRef.current
                    .cancelGenerate({ requestId: result.requestId })
                    .catch(() => undefined)
                return
            }

            requestIdRef.current = result.requestId
            pushLog(`任务已提交：${result.requestId.slice(0, 8)}…`, 'info')
            flushPendingEvents(result.requestId)
        } catch (err) {
            // A superseded job must not report its failure over the job that
            // replaced it, nor stop that job's spinner.
            if (jobGenRef.current !== gen) return
            pushLog(errorMessage(err, '启动生成失败'), 'error')
            resetJobState()
        }
    }, [
        api,
        format,
        flushPendingEvents,
        model,
        pushLog,
        resetJobState,
        session
    ])

    const cancelGenerate = useCallback(async () => {
        if (!generatingRef.current) return
        const id = requestIdRef.current

        pushLog('正在取消…', 'info')
        // Drop late done/error/aborted for this job immediately so a racing
        // completion cannot overwrite the user's draft after Stop.
        resetJobState()

        if (!id) {
            // The start reply has not landed yet; it cancels the server job
            // itself as soon as it can see the id.
            pushLog('已取消生成', 'info')
            return
        }

        try {
            await api.cancelGenerate({ requestId: id })
            pushLog('已取消生成', 'info')
        } catch (err) {
            pushLog(errorMessage(err, '取消请求失败'), 'error')
        }
    }, [api, pushLog, resetJobState])

    // Abort the in-flight job on unmount only. Keying this on session?.id used
    // to cancel a healthy job on every preset switch; the done handler already
    // discards a result whose session changed, and `api` is read through a ref
    // so a new api identity cannot re-run the teardown either.
    useEffect(() => {
        return () => {
            const id = requestIdRef.current
            jobGenRef.current += 1
            requestIdRef.current = null
            pendingEventsRef.current = []
            generatingRef.current = false
            if (!id) return
            apiRef.current
                .cancelGenerate({ requestId: id })
                .catch(() => undefined)
        }
    }, [])

    return {
        llmModels,
        modelsLoading,
        modelsError,
        model,
        setModel: (fullName: string) => {
            setModel(fullName)
            if (fullName) writeStoredModel(fullName)
        },
        format,
        setFormat,
        formatOptions: formatsForSource(session?.source ?? 'core'),
        generating,
        logLines,
        tokenPreview,
        loadModels,
        startGenerate,
        cancelGenerate,
        canStart:
            !!session && !generating && !!model.trim() && llmModels.length > 0
    }
}
