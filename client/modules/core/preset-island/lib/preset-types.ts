/** Structured preset shapes (source main ↔ hub core at boundary only). */

export interface RawPreset {
    keywords: string[]
    prompts: BaseMessage[]
    format_user_prompt?: string
    world_lores?: RawWorldLore[]
    /** YAML keeps an unquoted `version: 1.0` as a number. */
    version?: string | number
    authors_note?: AuthorsNote
    knowledge?: KnowledgeConfig
    config?: {
        longMemoryPrompt?: string
        loreBooksPrompt?: string
        longMemoryExtractPrompt?: string
        longMemoryNewQuestionPrompt?: string
        postHandler?: PostHandler
    }
}

export type WorldLoreInsertPosition =
    | 'before_char_defs'
    | 'after_char_defs'
    | 'before_scenario'
    | 'after_scenario'
    | 'before_example_messages'
    | 'after_example_messages'

/** A world lore entry: ChatLuna's `isRoleBook` requires both keys to be present. */
export interface RawWorldLoreEntry {
    keywords: string | string[]
    content: string
    insertPosition?: WorldLoreInsertPosition
    scanDepth?: number
    recursiveScan?: boolean
    maxRecursionDepth?: number
    matchWholeWord?: boolean
    constant?: boolean
    caseSensitive?: boolean
    enabled?: boolean
    order?: number
    tokenLimit?: number
}

/**
 * The global lore config element (`isRoleBookConfig`): any `world_lores` item
 * without `keywords` / `content`. Unknown keys survive the round-trip as-is.
 */
export interface RawWorldLoreConfig {
    keywords?: undefined
    content?: undefined
    insertPosition?: WorldLoreInsertPosition
    scanDepth?: number
    recursiveScan?: boolean
    maxRecursionDepth?: number
    tokenLimit?: number
    [key: string]: unknown
}

export type RawWorldLore = RawWorldLoreEntry | RawWorldLoreConfig

/** ChatLuna's `isRoleBook`: an element carrying both keys is a lore entry. */
export const isWorldLoreEntry = (
    value: unknown
): value is RawWorldLoreEntry => {
    if (typeof value !== 'object' || value === null) return false
    return 'keywords' in value && 'content' in value
}

/** Roles ChatLuna accepts: ai/model build an AIMessage, human a HumanMessage. */
export type PromptRole =
    | 'system'
    | 'user'
    | 'assistant'
    | 'ai'
    | 'model'
    | 'human'

/** One element of a LangChain `MessageContentComplex[]` content. */
export interface PromptContentPart {
    type: string
    [key: string]: unknown
}

export type PromptContent = string | PromptContentPart[]

export interface BaseMessage {
    role: PromptRole
    type?: 'personality' | 'description' | 'first_message' | 'scenario'
    content: PromptContent
}

/**
 * Shape guards for the form layer. Parsing never trims a value to fit its
 * declared type, so a key typed as an object may hold any YAML shape. Read a
 * field through the matching guard before rendering it.
 */
export const isRenderableText = (value: unknown): value is string =>
    typeof value === 'string'

export const isRenderableObject = (
    value: unknown
): value is Record<string, unknown> => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false
    }

    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
}

export const isRenderableList = (value: unknown): value is unknown[] =>
    Array.isArray(value)

/** Complex content has no text form; the form editor must show it read-only. */
export const isPlainTextContent = (content: PromptContent): content is string =>
    isRenderableText(content)

/**
 * Read-only preview of a complex content: keeps the `text` parts and marks the
 * rest by type. Lossy by design, so it only takes the complex branch — the text
 * it returns must never be written back into the preset.
 */
export const promptContentPreview = (parts: readonly unknown[]): string =>
    parts
        .map((part) => {
            if (!isRenderableObject(part)) return '[unknown]'
            if (typeof part.text === 'string') return part.text
            return typeof part.type === 'string'
                ? `[${part.type}]`
                : '[unknown]'
        })
        .join('\n')

export interface PostHandler {
    prefix: string
    postfix: string
    censor?: boolean
    variables?: Record<string, string>
}

export interface KnowledgeConfig {
    knowledge: string[] | string
    prompt?: string
}

export interface AuthorsNote {
    content: string
    insertPosition?: 'after_char_defs' | 'in_chat'
    insertDepth?: number
    insertFrequency?: number
}

export interface CharacterPresetTemplate {
    name: string
    status?: string
    nick_name: string[]
    input: string
    system: string
    mute_keyword?: string[]
    path?: string
    /** YAML keeps unquoted ids such as `bot_id: 3345618715` as numbers. */
    bot_id?: string | number
    owner_id?: string | number
    description?: string
    personality?: string
    hobbies?: string
    dialogue_examples?: string
    chat_style?: string
    chat_behavior?: string
    relationship?: string
    stickers?: string
}

export type StructuredPreset = RawPreset | CharacterPresetTemplate

export const emptyCorePreset = (): RawPreset => ({
    keywords: [],
    prompts: []
})

export const emptyCharacterPreset = (): CharacterPresetTemplate => ({
    name: '',
    nick_name: [],
    input: '',
    system: ''
})

/** Placeholder content for a brand new draft, never for an existing document. */
export const newCorePresetDraft = (): RawPreset => ({
    keywords: ['new-preset'],
    prompts: [{ role: 'system', content: '在这里输入预设内容' }]
})

export const newCharacterPresetDraft = (): CharacterPresetTemplate => ({
    name: 'new-character',
    nick_name: ['new-character'],
    input: '在这里输入角色输入模板',
    system: '在这里输入角色系统设定'
})

export const isRawPreset = (obj: unknown): obj is RawPreset => {
    if (typeof obj !== 'object' || obj === null) return false
    return 'keywords' in obj && 'prompts' in obj
}

export const isCharacterPresetTemplate = (
    obj: unknown
): obj is CharacterPresetTemplate => {
    if (typeof obj !== 'object' || obj === null) return false
    return 'name' in obj && 'input' in obj && 'system' in obj
}

export const keywordList = (value: string | string[] | undefined): string[] => {
    if (value == null) return []
    if (typeof value === 'string') return value ? [value] : []
    return value.map(String)
}
