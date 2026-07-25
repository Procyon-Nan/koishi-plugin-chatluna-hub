import { createDraftId, sourceLabel } from './id'
import {
    emptyCharacterPreset,
    emptyCorePreset,
    isCharacterPresetTemplate,
    isRawPreset,
    type CharacterPresetTemplate,
    type RawPreset,
    type StructuredPreset
} from './preset-types'
import { parsePresetYaml, serializePresetData, setAtPath } from './serialize'
import { createStructuredTemplate } from './templates'
import type { DraftSession, PresetDetail, PresetListItem, PresetSource } from './types'
import { extractListHints } from './yaml'

export const buildSessionFields = (
    source: PresetSource,
    rawText: string
): Pick<DraftSession, 'structured' | 'rawText' | 'parseError'> => {
    const parsed = parsePresetYaml(rawText, source)
    if (!parsed.ok) {
        return {
            structured: null,
            rawText,
            parseError: parsed.error
        }
    }

    return {
        structured: parsed.data,
        rawText,
        parseError: ''
    }
}

export const createDraftSession = (
    source: PresetSource,
    rawText?: string,
    filename = ''
): DraftSession => {
    if (rawText != null) {
        const fields = buildSessionFields(source, rawText)
        return {
            id: createDraftId(source),
            source,
            filename,
            baselineRawText: rawText,
            isDraft: true,
            ...fields
        }
    }

    const structured = createStructuredTemplate(source)
    const text = serializePresetData(structured, source)
    return {
        id: createDraftId(source),
        source,
        filename,
        structured,
        rawText: text,
        baselineRawText: text,
        parseError: '',
        isDraft: true
    }
}

export const sessionFromDetail = (detail: PresetDetail): DraftSession => {
    const fields = buildSessionFields(detail.preset.source, detail.rawText)
    return {
        id: detail.preset.id,
        source: detail.preset.source,
        filename: detail.preset.filename,
        baselineRawText: detail.rawText,
        isDraft: false,
        ...fields
    }
}

export const isSessionDirty = (session: DraftSession | null): boolean => {
    if (!session) return false
    if (session.rawText !== session.baselineRawText) return true
    // Unsaved draft: any filename means user intends to create a file.
    if (session.isDraft && session.filename.trim().length > 0) return true
    return false
}

export const applyStructuredPatch = (
    session: DraftSession,
    path: string,
    value: unknown
): DraftSession => {
    const base =
        session.structured ??
        (session.source === 'character'
            ? emptyCharacterPreset()
            : emptyCorePreset())

    const structured = setAtPath(base, path, value) as StructuredPreset
    const rawText = serializePresetData(structured, session.source)

    return {
        ...session,
        structured,
        rawText,
        parseError: ''
    }
}

export const applyRawTextEdit = (
    session: DraftSession,
    rawText: string
): DraftSession => {
    const parsed = parsePresetYaml(rawText, session.source)
    if (!parsed.ok) {
        return {
            ...session,
            rawText,
            parseError: parsed.error
            // keep previous structured
        }
    }

    return {
        ...session,
        rawText,
        structured: parsed.data,
        parseError: ''
    }
}

/** Persist the current document text. Form patches keep `rawText` in sync. */
export const serializeSession = (session: DraftSession): string => {
    return session.rawText
}

export const asCorePreset = (
    data: StructuredPreset | null,
    source?: PresetSource
): RawPreset | null => {
    if (!data) return null
    if (source === 'character') return null
    if (source === 'core' || isRawPreset(data)) return data as RawPreset
    return null
}

export const asCharacterPreset = (
    data: StructuredPreset | null,
    source?: PresetSource
): CharacterPresetTemplate | null => {
    if (!data) return null
    if (source === 'core') return null
    if (source === 'character' || isCharacterPresetTemplate(data)) {
        return data as CharacterPresetTemplate
    }
    return null
}

export const draftAsListItem = (session: DraftSession): PresetListItem => {
    const hints = extractListHints(session.rawText, session.source)

    return {
        id: session.id,
        source: session.source,
        sourceLabel: sourceLabel(session.source),
        filename: session.filename.trim() || '(未命名草稿)',
        keywords: hints.keywords,
        promptCount: hints.promptCount,
        updatedAt: null,
        size: null
    }
}

export const mergeListWithDrafts = (
    serverPresets: PresetListItem[],
    drafts: DraftSession[]
): PresetListItem[] => {
    const draftItems = drafts
        .filter((draft) => draft.isDraft)
        .map(draftAsListItem)

    return [...draftItems, ...serverPresets]
}

export const errorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message) return error.message
    if (typeof error === 'string' && error) return error
    return fallback
}
