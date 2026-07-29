import { useState, type ChangeEvent, type RefObject } from 'react'
import { defaultTabForSource } from '../components/editor-tabs'
import {
    createDraftSession,
    errorMessage,
    serializeSession,
    sessionFromDetail
} from '../lib/draft-store'
import type { PresetHubApi } from '../lib/hub-api'
import { sourceLabel } from '../lib/id'
import { downloadYaml } from '../lib/serialize'
import type { DraftSession, PresetListItem } from '../lib/types'
import {
    detectPresetSource,
    isYamlFilename,
    readLocalYamlFile
} from '../lib/yaml'
import type { WorkspaceCore } from './use-preset-draft'

export interface UsePresetPersistenceArgs {
    api: PresetHubApi
    ws: WorkspaceCore
    fetchList: () => Promise<PresetListItem[] | null>
    loadDetail: (
        id: string,
        errorFallback: string
    ) => Promise<'ok' | 'error' | 'stale'>
    fileInputRef: RefObject<HTMLInputElement>
}

export function usePresetPersistence({
    api,
    ws,
    fetchList,
    loadDetail,
    fileInputRef
}: UsePresetPersistenceArgs) {
    const {
        openGenRef,
        sessionRef,
        setSession,
        setDrafts,
        setError,
        setStatus,
        setDetailLoading,
        setEditorTab,
        confirmDiscard
    } = ws

    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)

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
            setError(`YAML 解析错误，请先修复后再保存：${current.parseError}`)
            return
        }

        // The user may open another preset while the write is in flight; the
        // result must then not land on whatever they are editing now.
        const gen = openGenRef.current
        setSaving(true)
        setError('')
        setStatus('')

        try {
            // Exactly what goes to disk. Anything typed after this point is
            // newer than the file, so the response must not replace it.
            const sent = serializeSession(current)
            const detail = current.isDraft
                ? await api.create({
                      source: current.source,
                      filename: current.filename.trim(),
                      rawText: sent
                  })
                : await api.update({
                      id: current.id,
                      rawText: sent
                  })

            // The draft is only dropped once the response has been turned into
            // a session: a malformed detail throws here, and the draft is the
            // sole copy of the user's work.
            const savedSession = sessionFromDetail(detail)
            if (current.isDraft) {
                setDrafts((prev) => prev.filter((d) => d.id !== current.id))
            }

            // Two independent races, neither implying the other: `openGenRef`
            // says the editor moved to another preset, `local.rawText` says it
            // is still the same preset but the text moved on.
            const stale = gen !== openGenRef.current
            const local = sessionRef.current
            const keptEditing = !stale && !!local && local.rawText !== sent

            if (!stale) {
                const next =
                    keptEditing && local
                        ? {
                              ...savedSession,
                              // Id / filename / source come from the server, the
                              // text and its parse state stay the user's, and the
                              // baseline is what was written — so `dirty` and 还原
                              // both refer to the file that now exists on disk.
                              structured: local.structured,
                              rawText: local.rawText,
                              parseError: local.parseError,
                              baselineRawText: sent
                          }
                        : savedSession
                sessionRef.current = next
                setSession(next)
            }
            await fetchList()
            if (stale) return
            setStatus(keptEditing ? '已保存，保存期间的修改尚未保存' : '已保存')
        } catch (err) {
            if (gen !== openGenRef.current) return
            setError(errorMessage(err, '保存预设失败'))
        } finally {
            setSaving(false)
        }
    }

    const deleteSession = async () => {
        const current = sessionRef.current
        if (!current || current.isDraft) return

        const ok = window.confirm(
            `确认删除预设文件 "${current.filename}"？此操作会从 Koishi data 目录中删除该文件，且不可撤销。`
        )
        if (!ok) return

        // Same generation guard as `saveSession`: after an await the editor may
        // hold a different preset, which must not be closed by this deletion.
        const gen = openGenRef.current
        setDeleting(true)
        setError('')
        setStatus('')

        try {
            await api.delete({ id: current.id })
            if (gen !== openGenRef.current) {
                await fetchList()
                return
            }

            openGenRef.current += 1
            sessionRef.current = null
            setSession(null)
            const nextList = await fetchList()
            if (nextList?.[0]) {
                await loadDetail(nextList[0].id, '加载预设内容失败')
            }
            setStatus('已删除')
        } catch (err) {
            if (gen !== openGenRef.current) return
            setError(errorMessage(err, '删除预设失败'))
        } finally {
            setDeleting(false)
        }
    }

    const onImportClick = () => {
        fileInputRef.current?.click()
    }

    const onImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return

        if (
            !isYamlFilename(file.name) &&
            !file.name.toLowerCase().endsWith('.txt')
        ) {
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

    return {
        saving,
        deleting,
        saveSession,
        deleteSession,
        onImportClick,
        onImportFile,
        exportSession
    }
}
