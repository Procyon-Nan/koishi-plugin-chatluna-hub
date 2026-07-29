import {
    useCallback,
    type Dispatch,
    type MutableRefObject,
    type SetStateAction
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
    isStructuredEditingBlocked,
    sessionFromDetail
} from '../lib/draft-store'
import type { PresetHubApi } from '../lib/hub-api'
import { isDraftId, sourceLabel } from '../lib/id'
import type { DraftSession, PresetSource } from '../lib/types'

/**
 * Shared kernel held by the composer and passed down to `usePresetDraft` and
 * `usePresetPersistence`. It bundles the timing anchors (`openGenRef`,
 * `sessionRef`) and the cross-cutting workspace state that both sub-hooks read
 * and write. Keeping these in the composer avoids lateral coupling between the
 * two sub-hooks: neither owns the session, they both operate on this core.
 */
export interface WorkspaceCore {
    openGenRef: MutableRefObject<number>
    sessionRef: MutableRefObject<DraftSession | null>
    session: DraftSession | null
    setSession: Dispatch<SetStateAction<DraftSession | null>>
    drafts: DraftSession[]
    setDrafts: Dispatch<SetStateAction<DraftSession[]>>
    error: string
    setError: Dispatch<SetStateAction<string>>
    status: string
    setStatus: Dispatch<SetStateAction<string>>
    detailLoading: boolean
    setDetailLoading: Dispatch<SetStateAction<boolean>>
    setEditorTab: Dispatch<SetStateAction<EditorTabId>>
    confirmDiscard: () => boolean
}

export interface UsePresetDraftArgs {
    api: PresetHubApi
    ws: WorkspaceCore
    dirty: boolean
}

export function usePresetDraft({ api, ws, dirty }: UsePresetDraftArgs) {
    const {
        openGenRef,
        sessionRef,
        session,
        setSession,
        drafts,
        setDrafts,
        setError,
        setStatus,
        setDetailLoading,
        setEditorTab,
        confirmDiscard
    } = ws

    /**
     * While parsing or structured write-back has failed, form controls must be
     * disabled instead of silently swallowing further edits.
     */
    const structuredEditingBlocked = isStructuredEditingBlocked(session)

    const editorTitle = session
        ? session.isDraft
            ? session.filename.trim() || '未命名草稿'
            : session.filename
        : '未选择预设'

    const editorMeta = session
        ? `${sourceLabel(session.source)} · 结构化编辑${
              session.isDraft ? ' · 草稿' : ''
          }${session.parseError ? ' · 编辑受限' : ''}`
        : '选择左侧预设，或新建 / 导入'

    const canSave =
        !!session &&
        dirty &&
        !session.parseError &&
        (!session.isDraft || session.filename.trim().length > 0)

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
            setDrafts((prev) => [
                draft,
                ...prev.filter((d) => d.id !== draft.id)
            ])
            setSession(draft)
            setEditorTab(defaultTabForSource(source))
            setStatus('')
            setError('')
            setDetailLoading(false)
        },
        [confirmDiscard]
    )

    const patchSession = (next: DraftSession) => {
        setSession(next)
        if (next.isDraft) {
            // Upsert, not map: an edited draft that is missing from the list
            // would be silently resurrectated from its stale copy the next time
            // the user opens it, and would escape the unsaved-work check.
            setDrafts((draftsPrev) =>
                draftsPrev.some((d) => d.id === next.id)
                    ? draftsPrev.map((d) => (d.id === next.id ? next : d))
                    : [next, ...draftsPrev]
            )
        }
        sessionRef.current = next
    }

    const updateField = (path: string, value: unknown) => {
        const prev = sessionRef.current
        if (!prev) return
        // A blocked patch returns the same session. Refuse it here instead of
        // clearing status in a way that reads as "the edit was accepted".
        if (isStructuredEditingBlocked(prev)) return
        const next = applyStructuredPatch(prev, path, value)
        patchSession(next)
        setError(next.parseError)
        setStatus('')
    }

    const updateRawText = (rawText: string) => {
        const prev = sessionRef.current
        if (!prev) return
        const next = applyRawTextEdit(prev, rawText)
        patchSession(next)
        setError('')
        setStatus('')
    }

    const applyGeneratedText = useCallback((rawText: string) => {
        const prev = sessionRef.current
        if (!prev) return
        patchSession(applyRawTextEdit(prev, rawText))
        setStatus('AI 已写入当前草稿（未保存）')
        setError('')
    }, [])

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

    /**
     * The missing counterpart of "save": a draft only exists in memory, so this
     * is the one path that can drop it. `deleteSession` cannot serve here — it
     * deletes a file from disk.
     */
    const discardDraft = () => {
        const current = sessionRef.current
        if (!current?.isDraft) return

        if (isSessionDirty(current)) {
            const ok = window.confirm(
                `确认丢弃草稿 "${
                    current.filename.trim() || '未命名草稿'
                }"？该草稿尚未保存到磁盘，丢弃后无法恢复。`
            )
            if (!ok) return
        }

        openGenRef.current += 1
        setDrafts((prev) => prev.filter((d) => d.id !== current.id))
        sessionRef.current = null
        setSession(null)
        setDetailLoading(false)
        setStatus('已丢弃草稿')
        setError('')
    }

    return {
        structuredEditingBlocked,
        editorTitle,
        editorMeta,
        canSave,
        loadDetail,
        openPreset,
        startCreate,
        updateField,
        updateRawText,
        applyGeneratedText,
        updateFilename,
        resetEditor,
        discardDraft
    }
}
