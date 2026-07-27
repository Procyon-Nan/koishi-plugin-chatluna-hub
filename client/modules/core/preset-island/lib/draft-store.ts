import { createDraftId, sourceLabel } from './id'
import {
    emptyCharacterPreset,
    emptyCorePreset,
    isCharacterPresetTemplate,
    isRawPreset,
    isRenderableList,
    isRenderableText,
    newCharacterPresetDraft,
    newCorePresetDraft,
    type CharacterPresetTemplate,
    type RawPreset,
    type StructuredPreset
} from './preset-types'
import { parsePresetYaml, serializePresetData, setAtPath } from './serialize'
import type {
    DraftSession,
    PresetDetail,
    PresetListItem,
    PresetSource
} from './types'
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

    // Placeholder content belongs to this entry only: an existing document must
    // never gain sample keywords or prompts just by being opened.
    const structured =
        source === 'character'
            ? newCharacterPresetDraft()
            : newCorePresetDraft()
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

/**
 * True while YAML parsing or a structured write-back failed. The form tabs then
 * render state that cannot safely be written to `rawText`, so they are read-only.
 */
export const isStructuredEditingBlocked = (
    session: DraftSession | null
): boolean => !!session && session.parseError.length > 0

export const applyStructuredPatch = (
    session: DraftSession,
    path: string,
    value: unknown
): DraftSession => {
    // Re-serializing the stale structure here would overwrite the raw text the
    // user is still fixing, so a patch on unparseable YAML is a no-op.
    if (isStructuredEditingBlocked(session)) return session

    const base =
        session.structured ??
        (session.source === 'character'
            ? emptyCharacterPreset()
            : emptyCorePreset())

    try {
        const structured = setAtPath(base, path, value) as StructuredPreset
        const rawText = serializePresetData(structured, session.source)

        return {
            ...session,
            structured,
            rawText,
            parseError: ''
        }
    } catch (error) {
        const detail =
            error instanceof Error && error.message
                ? error.message
                : '无法序列化结构化草稿'
        return {
            ...session,
            parseError: `结构化写回失败：${detail}`
        }
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

const CHARACTER_SECTION_KEYS = ['input', 'system', 'output', 'mute_keyword']

/**
 * Parsing always writes `input` / `system`, so key presence alone would count a
 * section the user never filled in.
 */
const hasSectionContent = (value: unknown): boolean => {
    if (value == null || value === '') return false
    return !(Array.isArray(value) && value.length === 0)
}

/**
 * List hints read from the parsed structure. A value may hold a preserved
 * malformed shape, so anything that is not text or a list counts as empty: the
 * list row only displays these.
 */
const structuredListHints = (
    structured: StructuredPreset,
    source: PresetSource
): { keywords: string[]; promptCount: number } => {
    if (source === 'character') {
        const name = asCharacterPreset(structured, source)?.name
        const label = isRenderableText(name) ? name.trim() : ''
        return {
            keywords: label ? [label] : [],
            promptCount: Object.entries(structured).filter(
                ([key, value]) =>
                    CHARACTER_SECTION_KEYS.includes(key) &&
                    hasSectionContent(value)
            ).length
        }
    }

    const core = asCorePreset(structured, source)
    const keywords = core?.keywords
    const prompts = core?.prompts

    return {
        keywords: isRenderableList(keywords)
            ? keywords.filter(isRenderableText)
            : [],
        promptCount: isRenderableList(prompts) ? prompts.length : 0
    }
}

export const draftAsListItem = (session: DraftSession): PresetListItem => {
    // The parsed structure is the source of truth; the raw-text scraper is only
    // a fallback for a document that has no structure because it failed to parse.
    const hints = session.structured
        ? structuredListHints(session.structured, session.source)
        : extractListHints(session.rawText, session.source)

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
