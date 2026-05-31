/**
 * Preset identity, path safety, and YAML validation. Preset ids are encoded as
 * `source:filename` and never expose absolute paths to the client; every path
 * that touches the filesystem is resolved through {@link resolvePresetFile},
 * which refuses to escape the preset directory.
 */
import path from 'path'
import { isRecord } from '../shared'

export interface ChatLunaCorePresetSummary {
    keywords: string[]
    promptCount: number
    version?: string
}

export type ChatLunaCorePresetSource = 'core' | 'character'

export const presetSourceLabels: Record<ChatLunaCorePresetSource, string> = {
    core: '主插件预设',
    character: 'Character 预设'
}

export const emptyPresetSummary = (): ChatLunaCorePresetSummary => ({
    keywords: [],
    promptCount: 0
})

export const normalizePresetSource = (
    source?: ChatLunaCorePresetSource
): ChatLunaCorePresetSource => {
    return source === 'character' ? 'character' : 'core'
}

export const encodePresetId = (
    source: ChatLunaCorePresetSource,
    filename: string
): string => {
    return `${source}:${filename}`
}

export const parsePresetId = (
    id: string
): { source: ChatLunaCorePresetSource; filename: string } => {
    const [source, ...filenameParts] = id.split(':')

    if (
        (source === 'core' || source === 'character') &&
        filenameParts.length > 0
    ) {
        return {
            source: normalizePresetSource(source),
            filename: filenameParts.join(':')
        }
    }

    return { source: 'core', filename: id }
}

/** Supported file extensions per preset source. */
export const presetExtensions = (
    source: ChatLunaCorePresetSource
): Set<string> => {
    return source === 'character'
        ? new Set(['.yml'])
        : new Set(['.yml', '.txt'])
}

/**
 * Validate a user-supplied filename and append a default extension when none is
 * given. Rejects path separators, absolute paths, and unsupported extensions.
 */
export const normalizePresetFilename = (
    filename: string,
    source: ChatLunaCorePresetSource
): string => {
    const trimmed = filename.trim()

    if (!trimmed) {
        throw new Error('Preset filename is required.')
    }

    if (
        trimmed.includes('/') ||
        trimmed.includes('\\') ||
        path.isAbsolute(trimmed) ||
        /^[a-zA-Z]:/.test(trimmed)
    ) {
        throw new Error('Preset filename must be a plain file name.')
    }

    const ext = path.extname(trimmed).toLowerCase()
    const normalized = ext ? trimmed : `${trimmed}.yml`
    const normalizedExt = path.extname(normalized).toLowerCase()

    if (source === 'character') {
        if (normalizedExt !== '.yml') {
            throw new Error('Character preset filename must end with .yml.')
        }

        return normalized
    }

    if (normalizedExt !== '.yml' && normalizedExt !== '.txt') {
        throw new Error('Preset filename must end with .yml or .txt.')
    }

    return normalized
}

/**
 * Resolve a preset file inside its directory, guaranteeing the result cannot
 * escape `presetDir` via traversal.
 */
export const resolvePresetFile = (
    presetDir: string,
    filename: string,
    source: ChatLunaCorePresetSource
): { filename: string; filePath: string } => {
    const normalized = normalizePresetFilename(filename, source)
    const root = path.resolve(presetDir)
    const filePath = path.resolve(root, normalized)

    if (!filePath.startsWith(`${root}${path.sep}`)) {
        throw new Error('Preset filename points outside the preset directory.')
    }

    return { filename: normalized, filePath }
}

type YamlLoad = (rawText: string) => unknown

const loadYamlParser = async (): Promise<YamlLoad> => {
    const moduleName = 'js-yaml'
    const module = (await import(moduleName)) as {
        load?: unknown
        default?: { load?: unknown }
    }
    const load = module.load ?? module.default?.load

    if (typeof load !== 'function') {
        throw new Error('YAML parser is not available.')
    }

    return load as YamlLoad
}

const toStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return []

    return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
}

const validPromptRoles = new Set([
    'assistant',
    'ai',
    'model',
    'user',
    'human',
    'system'
])

const parseCorePreset = (preset: unknown): ChatLunaCorePresetSummary => {
    if (!isRecord(preset)) {
        throw new Error('Preset YAML must be an object.')
    }

    const keywords = toStringArray(preset.keywords)
    const prompts = Array.isArray(preset.prompts) ? preset.prompts : []

    if (!keywords.length) {
        throw new Error('Preset must contain at least one keyword.')
    }

    if (prompts.length < 1) {
        throw new Error('Preset must contain at least one prompt.')
    }

    for (const [index, prompt] of prompts.entries()) {
        if (!isRecord(prompt)) {
            throw new Error(`Prompt #${index + 1} must be an object.`)
        }

        if (
            typeof prompt.role !== 'string' ||
            !validPromptRoles.has(prompt.role)
        ) {
            throw new Error(`Prompt #${index + 1} has an invalid role.`)
        }

        if (prompt.content == null) {
            throw new Error(`Prompt #${index + 1} must contain content.`)
        }
    }

    return {
        keywords,
        promptCount: prompts.length,
        version: typeof preset.version === 'string' ? preset.version : undefined
    }
}

const parseCharacterPreset = (preset: unknown): ChatLunaCorePresetSummary => {
    if (!isRecord(preset)) {
        throw new Error('Character preset YAML must be an object.')
    }

    const name = typeof preset.name === 'string' ? preset.name.trim() : ''
    const input = typeof preset.input === 'string' ? preset.input : ''
    const system = typeof preset.system === 'string' ? preset.system : ''

    if (!name) {
        throw new Error('Character preset must contain a name.')
    }

    if (!input.trim()) {
        throw new Error('Character preset must contain input.')
    }

    if (!system.trim()) {
        throw new Error('Character preset must contain system.')
    }

    if (
        preset.nick_name != null &&
        (!Array.isArray(preset.nick_name) ||
            preset.nick_name.some((item) => typeof item !== 'string'))
    ) {
        throw new Error('Character preset nick_name must be a string array.')
    }

    return { keywords: [name], promptCount: 2 }
}

/** Parse and validate preset YAML, returning its summary or throwing. */
export const parsePresetRawText = async (
    rawText: string,
    source: ChatLunaCorePresetSource
): Promise<ChatLunaCorePresetSummary> => {
    const preset = (await loadYamlParser())(rawText)

    return source === 'character'
        ? parseCharacterPreset(preset)
        : parseCorePreset(preset)
}

/** Best-effort summary; returns an empty summary instead of throwing. */
export const summarizePresetRawText = async (
    rawText: string,
    source: ChatLunaCorePresetSource
): Promise<ChatLunaCorePresetSummary> => {
    try {
        return await parsePresetRawText(rawText, source)
    } catch {
        return emptyPresetSummary()
    }
}
