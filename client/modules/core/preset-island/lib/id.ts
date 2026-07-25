import type { PresetSource } from './types'

const DRAFT_PREFIX = 'draft:'

export const sourceLabel = (source: PresetSource): string =>
    source === 'character' ? 'Character 预设' : '主插件预设'

export const isDraftId = (id: string): boolean => id.startsWith(DRAFT_PREFIX)

export const createDraftId = (source: PresetSource): string => {
    const uuid =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

    return `${DRAFT_PREFIX}${source}:${uuid}`
}
