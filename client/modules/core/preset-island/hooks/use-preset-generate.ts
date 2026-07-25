import { receive } from '@koishijs/client'
import {
    useCallback,
    useEffect,
    useRef,
    useState
} from 'react'
import type {
    ChatLunaCoreModelItem,
    ChatLunaCorePresetGenerateEvent,
    PresetGenerateCharacterFormat,
    PresetGenerateFormat,
    PresetGenerateMainFormat
} from '../../types'
import { errorMessage } from '../lib/draft-store'
import type { PresetHubApi } from '../lib/hub-api'
import type { DraftSession, PresetSource } from '../lib/types'

const MODEL_STORAGE_KEY = 'chatluna-hub-preset-generate-model'
const MAX_LOG_LINES = 80

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
): PresetGenerateFormat =>
    source === 'character' ? 'tool-call' : 'markdown'

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
    const [requestId, setRequestId] = useState<string | null>(null)
    const [logLines, setLogLines] = useState<GenerateLogLine[]>([])
    const [tokenPreview, setTokenPreview] = useState('')

    const requestIdRef = useRef<string | null>(null)
    const jobSessionIdRef = useRef<string | null>(null)
    const jobSessionRawTextRef = useRef<string | null>(null)
    const optionsSessionIdRef = useRef<string | null>(session?.id ?? null)
    const optionsSessionRawTextRef = useRef<string | null>(
        session?.rawText ?? null
    )
    const generatingRef = useRef(false)
    const onApplyRef = useRef(onApplyRawText)
    const tokenBufRef = useRef('')

    useEffect(() => {
        requestIdRef.current = requestId
        optionsSessionIdRef.current = session?.id ?? null
        optionsSessionRawTextRef.current = session?.rawText ?? null
        generatingRef.current = generating
        onApplyRef.current = onApplyRawText
    }, [generating, onApplyRawText, requestId, session?.id, session?.rawText])

    const pushLog = useCallback(
        (text: string, kind: GenerateLogLine['kind'] = 'info') => {
            setLogLines((prev) => {
                const next = [
                    ...prev,
                    { id: ++logSeq, text, kind }
                ]
                return next.length > MAX_LOG_LINES
                    ? next.slice(next.length - MAX_LOG_LINES)
                    : next
            })
        },
        []
    )

    const finishJob = useCallback((activeRequestId: string) => {
        if (requestIdRef.current !== activeRequestId) return
        setGenerating(false)
        setRequestId(null)
        requestIdRef.current = null
        generatingRef.current = false
    }, [])

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
        void loadModels()
    }, [loadModels])

    useEffect(() => {
        if (!session) return
        setFormat((prev) => {
            const allowed = formatsForSource(session.source).map((f) => f.value)
            if (allowed.includes(prev as never)) return prev
            return defaultFormatForSource(session.source)
        })
    }, [session?.source, session?.id])

    useEffect(() => {
        let active = true

        receive<ChatLunaCorePresetGenerateEvent>(
            'chatluna-hub/core/presets/generate/event',
            (event) => {
                if (!active) return
                if (!event?.requestId) return
                if (requestIdRef.current !== event.requestId) return

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
                    const targetSessionId = jobSessionIdRef.current
                    const stillSameSession =
                        !!targetSessionId &&
                        targetSessionId ===
                            (optionsSessionIdRef.current ?? null)
                    const draftWasNotEdited =
                        jobSessionRawTextRef.current ===
                        optionsSessionRawTextRef.current

                    if (stillSameSession && draftWasNotEdited) {
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
                    } else if (!stillSameSession) {
                        pushLog(
                            '生成完成，但当前已切换预设，结果已丢弃',
                            'info'
                        )
                    } else {
                        pushLog(
                            '生成完成，但当前草稿已在生成期间修改，结果已丢弃',
                            'info'
                        )
                    }
                    setTokenPreview('')
                    tokenBufRef.current = ''
                    jobSessionIdRef.current = null
                    jobSessionRawTextRef.current = null
                    finishJob(event.requestId)
                    return
                }

                if (event.kind === 'error') {
                    pushLog(event.error || '生成失败', 'error')
                    setTokenPreview('')
                    tokenBufRef.current = ''
                    jobSessionIdRef.current = null
                    jobSessionRawTextRef.current = null
                    finishJob(event.requestId)
                    return
                }

                if (event.kind === 'aborted') {
                    pushLog('已取消生成', 'info')
                    setTokenPreview('')
                    tokenBufRef.current = ''
                    jobSessionIdRef.current = null
                    jobSessionRawTextRef.current = null
                    finishJob(event.requestId)
                }
            }
        )

        return () => {
            active = false
        }
    }, [finishJob, pushLog])

    const startGenerate = useCallback(async () => {
        const current = session
        if (!current || generatingRef.current) return

        const selectedModel = model.trim()
        if (!selectedModel) {
            pushLog('请选择 LLM 模型', 'error')
            return
        }

        // Allocate requestId before the RPC returns so early broadcast events
        // (token/step) are not dropped by the requestIdRef filter.
        const nextRequestId =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `gen-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

        writeStoredModel(selectedModel)
        setLogLines([])
        setTokenPreview('')
        tokenBufRef.current = ''
        jobSessionIdRef.current = current.id
        jobSessionRawTextRef.current = current.rawText
        setRequestId(nextRequestId)
        requestIdRef.current = nextRequestId
        setGenerating(true)
        generatingRef.current = true
        pushLog(`开始生成 · ${selectedModel} · ${format}`, 'info')

        try {
            const result = await api.startGenerate({
                requestId: nextRequestId,
                model: selectedModel,
                source: current.source,
                format,
                rawText: current.rawText
            })
            if (requestIdRef.current === nextRequestId) {
                setRequestId(result.requestId)
                requestIdRef.current = result.requestId
            }
            pushLog(`任务已提交：${result.requestId.slice(0, 8)}…`, 'info')
        } catch (err) {
            pushLog(errorMessage(err, '启动生成失败'), 'error')
            setGenerating(false)
            generatingRef.current = false
            setRequestId(null)
            requestIdRef.current = null
            jobSessionIdRef.current = null
            jobSessionRawTextRef.current = null
        }
    }, [api, format, model, pushLog, session])

    const cancelGenerate = useCallback(async () => {
        const id = requestIdRef.current
        if (!id) return

        pushLog('正在取消…', 'info')
        // Drop late done/error/aborted for this id immediately so a racing
        // completion cannot overwrite the user's draft after Stop.
        finishJob(id)
        jobSessionIdRef.current = null
        jobSessionRawTextRef.current = null
        setTokenPreview('')
        tokenBufRef.current = ''

        try {
            await api.cancelGenerate({ requestId: id })
            pushLog('已取消生成', 'info')
        } catch (err) {
            pushLog(errorMessage(err, '取消请求失败'), 'error')
        }
    }, [api, finishJob, pushLog])

    // Abort in-flight job when leaving the session / unmounting.
    useEffect(() => {
        return () => {
            const id = requestIdRef.current
            if (id) {
                void api.cancelGenerate({ requestId: id }).catch(() => undefined)
            }
            requestIdRef.current = null
            jobSessionIdRef.current = null
            jobSessionRawTextRef.current = null
            generatingRef.current = false
            setGenerating(false)
            setRequestId(null)
            setTokenPreview('')
            tokenBufRef.current = ''
        }
    }, [api, session?.id])

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
            !!session &&
            !generating &&
            !!model.trim() &&
            llmModels.length > 0
    }
}
