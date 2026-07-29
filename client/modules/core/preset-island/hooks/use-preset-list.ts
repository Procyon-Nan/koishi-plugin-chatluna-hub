import { useCallback, useMemo, useState } from 'react'
import { errorMessage, mergeListWithDrafts } from '../lib/draft-store'
import type { PresetHubApi } from '../lib/hub-api'
import type { DraftSession, PresetListItem } from '../lib/types'

export interface UsePresetListArgs {
    api: PresetHubApi
    drafts: DraftSession[]
    keyword: string
    /**
     * Mirrors the workspace error banner. `fetchList` clears it on start and
     * sets it on failure, exactly as the monolithic hook did — the banner is
     * owned by the composer but driven from here.
     */
    notifyError: (message: string) => void
}

export function usePresetList({ api, drafts, keyword, notifyError }: UsePresetListArgs) {
    const [presets, setPresets] = useState<PresetListItem[]>([])
    const [listReason, setListReason] = useState('')
    const [listError, setListError] = useState('')
    const [listLoading, setListLoading] = useState(false)

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
    const characterCount = presets.filter(
        (p) => p.source === 'character'
    ).length

    const fetchList = useCallback(async () => {
        setListLoading(true)
        notifyError('')

        try {
            const result = await api.list()
            setPresets(result.presets)
            setListReason(result.reason ?? '')
            setListError('')
            return result.presets
        } catch (err) {
            const message = errorMessage(err, '加载预设列表失败')
            // A failed request and an empty directory both render zero rows;
            // only this flag lets the list tell "backend is down" from "no
            // presets yet". The last good `presets` is kept on purpose.
            notifyError(message)
            setListError(message)
            return null
        } finally {
            setListLoading(false)
        }
    }, [api, notifyError])

    return {
        presets,
        listReason,
        listError,
        listLoading,
        filtered,
        coreCount,
        characterCount,
        fetchList
    }
}
