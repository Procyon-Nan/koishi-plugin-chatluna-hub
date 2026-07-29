import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react'
import { type EditorTabId } from '../components/editor-tabs'
import { isSessionDirty } from '../lib/draft-store'
import type { PresetHubApi } from '../lib/hub-api'
import { isDraftId } from '../lib/id'
import type { DraftSession } from '../lib/types'
import { usePresetDraft, type WorkspaceCore } from './use-preset-draft'
import { usePresetGenerate } from './use-preset-generate'
import { usePresetList } from './use-preset-list'
import { usePresetPersistence } from './use-preset-persistence'

export function usePresetWorkspace(api: PresetHubApi) {
    const [keyword, setKeyword] = useState('')
    const [editorTab, setEditorTab] = useState<EditorTabId>('basic')
    const [session, setSession] = useState<DraftSession | null>(null)
    const [drafts, setDrafts] = useState<DraftSession[]>([])
    const [error, setError] = useState('')
    const [status, setStatus] = useState('')
    const [detailLoading, setDetailLoading] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const sessionRef = useRef(session)
    const openGenRef = useRef(0)
    sessionRef.current = session

    const dirty = isSessionDirty(session)

    /**
     * Drafts that are not open in the editor live only in this component's
     * memory, so the host page's navigation guard has to account for them too —
     * `dirty` alone only describes the session currently on screen.
     */
    const hasUnsavedWork = useMemo(
        () =>
            dirty ||
            drafts.some((d) => d.id !== session?.id && isSessionDirty(d)),
        [dirty, drafts, session?.id]
    )

    const confirmDiscard = useCallback((): boolean => {
        const current = sessionRef.current
        // A draft stays in `drafts` after the editor moves on, so nothing is
        // lost and the warning would be a lie. Only a saved preset's unsaved
        // edits disappear here.
        if (!current || current.isDraft) return true
        if (!isSessionDirty(current)) return true
        return window.confirm(
            '当前预设有未保存修改，继续操作会丢失这些修改。是否继续？'
        )
    }, [])

    // Shared kernel: the timing anchors and cross-cutting workspace state that
    // the draft and persistence sub-hooks both operate on. Holding it here keeps
    // the two sub-hooks decoupled from each other.
    const ws: WorkspaceCore = {
        openGenRef,
        sessionRef,
        session,
        setSession,
        drafts,
        setDrafts,
        error,
        setError,
        status,
        setStatus,
        detailLoading,
        setDetailLoading,
        setEditorTab,
        confirmDiscard
    }

    const list = usePresetList({
        api,
        drafts,
        keyword,
        notifyError: setError
    })
    const draft = usePresetDraft({ api, ws, dirty })
    const persistence = usePresetPersistence({
        api,
        ws,
        fetchList: list.fetchList,
        loadDetail: draft.loadDetail,
        fileInputRef
    })

    const generate = usePresetGenerate({
        api,
        session,
        onApplyRawText: draft.applyGeneratedText
    })

    const refresh = async () => {
        if (!confirmDiscard()) return

        const nextList = await list.fetchList()
        const currentId = sessionRef.current?.id

        // A failed request says nothing about what exists on disk, so the
        // editor keeps its content and only the error banner changes. Closing
        // the session here used to make an outage look like an empty directory.
        if (!nextList) return

        if (currentId && isDraftId(currentId)) {
            return
        }

        if (currentId && nextList.some((item) => item.id === currentId)) {
            await draft.loadDetail(currentId, '刷新预设内容失败')
            return
        }

        if (nextList[0]) {
            const result = await draft.loadDetail(
                nextList[0].id,
                '加载预设内容失败'
            )
            if (result === 'error') setSession(null)
            return
        }

        openGenRef.current += 1
        setSession(null)
    }

    useEffect(() => {
        const gen = openGenRef.current

        const autoOpenFirst = async () => {
            const result = await list.fetchList()
            // The list request is slow enough for the user to create, import or
            // pick a preset meanwhile — every one of those bumps the generation
            // or leaves a session behind, and auto-open must never take it over.
            if (openGenRef.current !== gen || sessionRef.current) return
            if (!result?.[0]) return
            await draft.loadDetail(result[0].id, '加载预设内容失败')
        }

        autoOpenFirst().catch(() => undefined)

        return () => {
            openGenRef.current += 1
        }
    }, [list.fetchList, draft.loadDetail])

    return {
        // list
        presets: list.presets,
        listReason: list.listReason,
        listError: list.listError,
        listLoading: list.listLoading,
        filtered: list.filtered,
        coreCount: list.coreCount,
        characterCount: list.characterCount,
        // workspace state
        session,
        drafts,
        error,
        status,
        detailLoading,
        dirty,
        hasUnsavedWork,
        // draft derived
        structuredEditingBlocked: draft.structuredEditingBlocked,
        editorTitle: draft.editorTitle,
        editorMeta: draft.editorMeta,
        canSave: draft.canSave,
        // ui
        keyword,
        setKeyword,
        editorTab,
        setEditorTab,
        fileInputRef,
        // draft actions
        openPreset: draft.openPreset,
        startCreate: draft.startCreate,
        updateField: draft.updateField,
        updateRawText: draft.updateRawText,
        updateFilename: draft.updateFilename,
        resetEditor: draft.resetEditor,
        discardDraft: draft.discardDraft,
        // persistence
        saving: persistence.saving,
        deleting: persistence.deleting,
        saveSession: persistence.saveSession,
        deleteSession: persistence.deleteSession,
        onImportClick: persistence.onImportClick,
        onImportFile: persistence.onImportFile,
        exportSession: persistence.exportSession,
        // combo
        refresh,
        generate
    }
}
