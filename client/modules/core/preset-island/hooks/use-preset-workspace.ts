import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent
} from 'react'
import {
    defaultTabForSource,
    type EditorTabId
} from '../components/editor-tabs'
import {
    applyRawTextEdit,
    applyStructuredPatch,
    createDraftSession,
    errorMessage,
    isSessionDirty,
    mergeListWithDrafts,
    serializeSession,
    sessionFromDetail
} from '../lib/draft-store'
import type { PresetHubApi } from '../lib/hub-api'
import { isDraftId, sourceLabel } from '../lib/id'
import { downloadYaml } from '../lib/serialize'
import type { DraftSession, PresetListItem, PresetSource } from '../lib/types'
import {
    detectPresetSource,
    isYamlFilename,
    readLocalYamlFile
} from '../lib/yaml'
import { usePresetGenerate } from './use-preset-generate'

export function usePresetWorkspace(api: PresetHubApi) {
    const [presets, setPresets] = useState<PresetListItem[]>([])
    const [listReason, setListReason] = useState('')
    const [listLoading, setListLoading] = useState(false)
    const [detailLoading, setDetailLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [keyword, setKeyword] = useState('')
    const [session, setSession] = useState<DraftSession | null>(null)
    const [drafts, setDrafts] = useState<DraftSession[]>([])
    const [error, setError] = useState('')
    const [status, setStatus] = useState('')
    const [newMenuOpen, setNewMenuOpen] = useState(false)
    const [editorTab, setEditorTab] = useState<EditorTabId>('basic')
    const fileInputRef = useRef<HTMLInputElement>(null)
    const sessionRef = useRef(session)
    const openGenRef = useRef(0)
    sessionRef.current = session

    const dirty = isSessionDirty(session)

    const listItems = useMemo(
        () => mergeListWithDrafts(presets, drafts),
        [presets, drafts]
    )

    const filtered = useMemo(() => {
        const text = keyword.trim().toLowerCase()
        if (!text) return listItems

        return listItems.filter((item) =>
            [item.filename, item.sourceLabel, ...item.keywords]
                .join(' ')
                .toLowerCase()
                .includes(text)
        )
    }, [listItems, keyword])

    const coreCount = presets.filter((p) => p.source === 'core').length
    const characterCount = presets.filter((p) => p.source === 'character').length

    const fetchList = useCallback(async () => {
        setListLoading(true)
        setError('')

        try {
            const result = await api.list()
            setPresets(result.presets)
            setListReason(result.reason ?? '')
            return result.presets
        } catch (err) {
            setError(errorMessage(err, '加载预设列表失败'))
            return null
        } finally {
            setListLoading(false)
        }
    }, [api])

    const confirmDiscard = useCallback((): boolean => {
        if (!isSessionDirty(sessionRef.current)) return true
        return window.confirm(
            '当前预设有未保存修改，继续操作会丢失这些修改。是否继续？'
        )
    }, [])

    const loadDetail = useCallback(
        async (
            id: string,
            errorFallback: string
        ): Promise<'ok' | 'error' | 'stale'> => {
            const gen = ++openGenRef.current
            setDetailLoading(true)
            setError('')
            setStatus('')

            try {
                const detail = await api.get({ id })
                if (gen !== openGenRef.current) return 'stale'
                const next = sessionFromDetail(detail)
                setSession(next)
                setEditorTab(defaultTabForSource(next.source))
                return 'ok'
            } catch (err) {
                if (gen !== openGenRef.current) return 'stale'
                setError(errorMessage(err, errorFallback))
                return 'error'
            } finally {
                if (gen === openGenRef.current) setDetailLoading(false)
            }
        },
        [api]
    )

    const openPreset = useCallback(
        async (id: string) => {
            if (sessionRef.current?.id === id) return
            if (!confirmDiscard()) return

            if (isDraftId(id)) {
                openGenRef.current += 1
                const draft = drafts.find((item) => item.id === id)
                if (draft) {
                    setSession({ ...draft })
                    setEditorTab(defaultTabForSource(draft.source))
                    setStatus('')
                    setError('')
                    setDetailLoading(false)
                }
                return
            }

            await loadDetail(id, '加载预设内容失败')
        },
        [confirmDiscard, drafts, loadDetail]
    )

    const startCreate = useCallback(
        (source: PresetSource) => {
            if (!confirmDiscard()) return

            openGenRef.current += 1
            const draft = createDraftSession(source)
            setDrafts((prev) => [draft, ...prev.filter((d) => d.id !== draft.id)])
            setSession(draft)
            setEditorTab(defaultTabForSource(source))
            setNewMenuOpen(false)
            setStatus('')
            setError('')
            setDetailLoading(false)
        },
        [confirmDiscard]
    )

    const patchSession = (next: DraftSession) => {
        setSession(next)
        if (next.isDraft) {
            setDrafts((draftsPrev) =>
                draftsPrev.map((d) => (d.id === next.id ? next : d))
            )
        }
        sessionRef.current = next
    }

    const updateField = (path: string, value: unknown) => {
        const prev = sessionRef.current
        if (!prev) return
        patchSession(applyStructuredPatch(prev, path, value))
        setStatus('')
    }

    const updateRawText = (rawText: string) => {
        const prev = sessionRef.current
        if (!prev) return
        patchSession(applyRawTextEdit(prev, rawText))
        setStatus('')
    }

    const applyGeneratedText = useCallback((rawText: string) => {
        const prev = sessionRef.current
        if (!prev) return
        patchSession(applyRawTextEdit(prev, rawText))
        setStatus('AI 已写入当前草稿（未保存）')
        setError('')
    }, [])

    const generate = usePresetGenerate({
        api,
        session,
        onApplyRawText: applyGeneratedText
    })

    const updateFilename = (filename: string) => {
        const prev = sessionRef.current
        if (!prev?.isDraft) return
        patchSession({ ...prev, filename })
    }

    const resetEditor = () => {
        const prev = sessionRef.current
        if (!prev) return
        const rebound = createDraftSession(
            prev.source,
            prev.baselineRawText,
            prev.filename
        )
        patchSession({
            ...prev,
            structured: rebound.structured,
            rawText: rebound.rawText,
            parseError: rebound.parseError
        })
        setStatus('已还原到最近加载内容')
    }

    const saveSession = async () => {
        const current = sessionRef.current
        if (!current) return

        if (current.isDraft) {
            const filename = current.filename.trim()
            if (!filename) {
                setError('首次保存草稿需要填写文件名')
                return
            }
        }

        if (current.parseError) {
            setError(
                `YAML 解析错误，请先修复后再保存：${current.parseError}`
            )
            return
        }

        setSaving(true)
        setError('')
        setStatus('')

        try {
            const rawText = serializeSession(current)
            const detail = current.isDraft
                ? await api.create({
                      source: current.source,
                      filename: current.filename.trim(),
                      rawText
                  })
                : await api.update({
                      id: current.id,
                      rawText
                  })

            if (current.isDraft) {
                setDrafts((prev) => prev.filter((d) => d.id !== current.id))
            }

            setSession(sessionFromDetail(detail))
            await fetchList()
            setStatus('已保存')
        } catch (err) {
            setError(errorMessage(err, '保存预设失败'))
        } finally {
            setSaving(false)
        }
    }

    const deleteSession = async () => {
        if (!session || session.isDraft) return

        const ok = window.confirm(
            `确认删除预设文件 "${session.filename}"？此操作会从 Koishi data 目录中删除该文件，且不可撤销。`
        )
        if (!ok) return

        setDeleting(true)
        setError('')
        setStatus('')

        try {
            await api.delete({ id: session.id })
            openGenRef.current += 1
            sessionRef.current = null
            setSession(null)
            const nextList = await fetchList()
            if (nextList?.[0]) {
                await loadDetail(nextList[0].id, '加载预设内容失败')
            }
            setStatus('已删除')
        } catch (err) {
            setError(errorMessage(err, '删除预设失败'))
        } finally {
            setDeleting(false)
        }
    }

    const refresh = async () => {
        if (!confirmDiscard()) return

        const nextList = await fetchList()
        const currentId = sessionRef.current?.id

        if (currentId && isDraftId(currentId)) {
            return
        }

        if (currentId && nextList?.some((item) => item.id === currentId)) {
            await loadDetail(currentId, '刷新预设内容失败')
            return
        }

        if (nextList?.[0]) {
            const result = await loadDetail(nextList[0].id, '加载预设内容失败')
            if (result === 'error') setSession(null)
            return
        }

        openGenRef.current += 1
        setSession(null)
    }

    const onImportClick = () => {
        fileInputRef.current?.click()
    }

    const onImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return

        if (!isYamlFilename(file.name) && !file.name.toLowerCase().endsWith('.txt')) {
            setError('仅支持导入 .yml / .yaml / .txt 文件')
            return
        }

        if (!confirmDiscard()) return

        try {
            const rawText = await readLocalYamlFile(file)
            const source = detectPresetSource(rawText)
            const baseName = file.name.replace(/\.(ya?ml|txt)$/i, '')
            const draft = createDraftSession(source, rawText, `${baseName}.yml`)
            openGenRef.current += 1
            setDrafts((prev) => [draft, ...prev])
            setSession(draft)
            setEditorTab(defaultTabForSource(source))
            setDetailLoading(false)
            setStatus(`已导入为 ${sourceLabel(source)} 草稿，保存后才会落盘`)
            setError('')
        } catch (err) {
            setError(errorMessage(err, '导入文件失败'))
        }
    }

    const exportSession = () => {
        const current = sessionRef.current
        if (!current) return

        try {
            const content = serializeSession(current)
            const name =
                current.filename.trim() ||
                (current.source === 'character'
                    ? 'character-preset.yml'
                    : 'preset.yml')
            downloadYaml(content, name)
            setStatus('已导出 YAML')
        } catch (err) {
            setError(errorMessage(err, '导出失败'))
        }
    }

    useEffect(() => {
        let cancelled = false

        ;(async () => {
            const list = await fetchList()
            if (cancelled || !list?.[0]) return
            await loadDetail(list[0].id, '加载预设内容失败')
        })()

        return () => {
            cancelled = true
            openGenRef.current += 1
        }
    }, [api, fetchList, loadDetail])

    useEffect(() => {
        if (!newMenuOpen) return

        const onDocClick = () => setNewMenuOpen(false)
        document.addEventListener('click', onDocClick)
        return () => document.removeEventListener('click', onDocClick)
    }, [newMenuOpen])

    const editorTitle = session
        ? session.isDraft
            ? session.filename.trim() || '未命名草稿'
            : session.filename
        : '未选择预设'

    const editorMeta = session
        ? `${sourceLabel(session.source)} · 结构化编辑${
              session.isDraft ? ' · 草稿' : ''
          }${session.parseError ? ' · YAML 有误' : ''}`
        : '选择左侧预设，或新建 / 导入'

    const canSave =
        !!session &&
        dirty &&
        !session.parseError &&
        (!session.isDraft || session.filename.trim().length > 0)

    return {
        presets,
        listReason,
        listLoading,
        detailLoading,
        saving,
        deleting,
        keyword,
        setKeyword,
        session,
        drafts,
        error,
        status,
        newMenuOpen,
        setNewMenuOpen,
        fileInputRef,
        dirty,
        filtered,
        coreCount,
        characterCount,
        editorTitle,
        editorMeta,
        canSave,
        editorTab,
        setEditorTab,
        openPreset,
        startCreate,
        updateField,
        updateRawText,
        updateFilename,
        resetEditor,
        saveSession,
        deleteSession,
        refresh,
        onImportClick,
        onImportFile,
        exportSession,
        generate
    }
}
