/** Structured preset shapes (source main ↔ hub core at boundary only). */

export interface RawPreset {
    keywords: string[]
    prompts: BaseMessage[]
    format_user_prompt?: string
    world_lores?: RawWorldLore[]
    version?: string
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

export interface RawWorldLore {
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

export interface BaseMessage {
    role: 'user' | 'system' | 'assistant'
    type?: 'personality' | 'description' | 'first_message' | 'scenario'
    content: string
}

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
    bot_id?: string
    owner_id?: string
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
    keywords: ['new-preset'],
    prompts: [{ role: 'system', content: '在这里输入预设内容' }]
})

export const emptyCharacterPreset = (): CharacterPresetTemplate => ({
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
