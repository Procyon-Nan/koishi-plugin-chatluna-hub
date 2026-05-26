import fs from 'fs/promises'
import path from 'path'
import type { Context } from 'koishi'

export type ChatLunaCoreModelType =
    | 'llm'
    | 'embeddings'
    | 'reranker'
    | 'unknown'

export interface ChatLunaCoreModelItem {
    id: string
    name: string
    fullName: string
    platform: string
    type: ChatLunaCoreModelType
    maxTokens: number | null
    capabilities: string[]
}

export interface ChatLunaCoreModelSummary {
    total: number
    llm: number
    embeddings: number
    reranker: number
    unknown: number
}

export interface ChatLunaCoreModelListResult {
    models: ChatLunaCoreModelItem[]
    platforms: string[]
    summary: ChatLunaCoreModelSummary
    updatedAt: string
    reason?: string
}

export interface ChatLunaCorePresetSummary {
    keywords: string[]
    promptCount: number
    version?: string
}

export type ChatLunaCorePresetSource = 'core' | 'character'

export interface ChatLunaCorePresetListItem extends ChatLunaCorePresetSummary {
    id: string
    source: ChatLunaCorePresetSource
    sourceLabel: string
    filename: string
    updatedAt: string | null
    size: number | null
}

export interface ChatLunaCorePresetListResult {
    presets: ChatLunaCorePresetListItem[]
    updatedAt: string
    reason?: string
}

export interface ChatLunaCorePresetDetail {
    preset: ChatLunaCorePresetListItem
    rawText: string
}

export interface ChatLunaCorePresetValidationResult
    extends ChatLunaCorePresetSummary {
    valid: boolean
    error?: string
}

export interface ChatLunaCorePresetGetInput {
    id: string
}

export interface ChatLunaCorePresetValidateInput {
    source?: ChatLunaCorePresetSource
    rawText: string
}

export interface ChatLunaCorePresetCreateInput {
    source?: ChatLunaCorePresetSource
    filename: string
    rawText: string
}

export interface ChatLunaCorePresetUpdateInput {
    id: string
    rawText: string
}

interface ChatLunaLikeService {
    platform?: {
        listAllModels?: (type: number) => {
            value?: unknown
        }
    }
    preset?: ChatLunaPresetServiceLike
}

interface ChatLunaPresetServiceLike {
    getAllPreset?: (concatKeyword?: boolean) => {
        value?: unknown
    }
    getPreset?: (
        triggerKeyword: string,
        throwError?: boolean
    ) => {
        value?: unknown
    }
    resolvePresetDir?: () => string
    loadAllPreset?: () => Promise<void>
}

interface ChatLunaCharacterLikeService {
    preset?: ChatLunaCharacterPresetServiceLike
}

interface ChatLunaCharacterPresetServiceLike {
    resolvePresetDir?: () => string
    loadAllPreset?: () => Promise<void>
}

interface RawPlatformModelInfo {
    name?: unknown
    platform?: unknown
    type?: unknown
    maxTokens?: unknown
    capabilities?: unknown
    toModelName?: unknown
}

interface RawPresetTemplateLike {
    triggerKeyword?: unknown
    messages?: unknown
    path?: unknown
    rawText?: unknown
    version?: unknown
}

type YamlLoad = (rawText: string) => unknown

const modelTypeOrder: Record<ChatLunaCoreModelType, number> = {
    llm: 0,
    embeddings: 1,
    reranker: 2,
    unknown: 3
}

const emptySummary = (): ChatLunaCoreModelSummary => ({
    total: 0,
    llm: 0,
    embeddings: 0,
    reranker: 0,
    unknown: 0
})

const coerceReason = (error: unknown) => {
    if (error instanceof Error) return error.message
    return String(error)
}

const emptyPresetSummary = (): ChatLunaCorePresetSummary => ({
    keywords: [],
    promptCount: 0
})

const presetSourceLabels: Record<ChatLunaCorePresetSource, string> = {
    core: '主插件预设',
    character: 'Character 预设'
}

const coerceModelType = (value: unknown): ChatLunaCoreModelType => {
    if (value === 1 || value === 'llm') return 'llm'
    if (value === 2 || value === 'embedding' || value === 'embeddings') {
        return 'embeddings'
    }
    if (value === 3 || value === 'reranker' || value === 'rerank') {
        return 'reranker'
    }

    return 'unknown'
}

const coerceString = (value: unknown) => {
    return typeof value === 'string' ? value : ''
}

const coerceCapabilities = (value: unknown) => {
    if (!Array.isArray(value)) return []

    return Array.from(
        new Set(
            value
                .map((item) => (typeof item === 'string' ? item : String(item)))
                .filter(Boolean)
        )
    )
}

const coerceMaxTokens = (value: unknown) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null

    return value
}

const normalizeModel = (
    raw: RawPlatformModelInfo,
    index: number
): ChatLunaCoreModelItem | null => {
    const name = coerceString(raw.name)
    const platform = coerceString(raw.platform)

    if (!name || !platform) return null

    const fullName =
        typeof raw.toModelName === 'function'
            ? String(raw.toModelName())
            : `${platform}/${name}`

    return {
        id: fullName || `${platform}:${name}:${index}`,
        name,
        fullName,
        platform,
        type: coerceModelType(raw.type),
        maxTokens: coerceMaxTokens(raw.maxTokens),
        capabilities: coerceCapabilities(raw.capabilities)
    }
}

const sortModels = (
    left: ChatLunaCoreModelItem,
    right: ChatLunaCoreModelItem
) => {
    const platformOrder = left.platform.localeCompare(right.platform, undefined, {
        numeric: true,
        sensitivity: 'base'
    })

    if (platformOrder !== 0) return platformOrder

    const typeOrder = modelTypeOrder[left.type] - modelTypeOrder[right.type]
    if (typeOrder !== 0) return typeOrder

    return left.name.localeCompare(right.name, undefined, {
        numeric: true,
        sensitivity: 'base'
    })
}

const summarizeModels = (
    models: ChatLunaCoreModelItem[]
): ChatLunaCoreModelSummary => {
    const summary = emptySummary()

    for (const model of models) {
        summary.total += 1
        summary[model.type] += 1
    }

    return summary
}

export const listChatLunaCoreModels = (
    ctx: Context
): ChatLunaCoreModelListResult => {
    const chatluna = ctx.get('chatluna') as ChatLunaLikeService | undefined
    const listAllModels = chatluna?.platform?.listAllModels

    if (!listAllModels) {
        return {
            models: [],
            platforms: [],
            summary: emptySummary(),
            updatedAt: new Date().toISOString(),
            reason: 'ChatLuna service is not available.'
        }
    }

    let source: unknown

    try {
        source = listAllModels.call(chatluna.platform, 0)?.value
    } catch (error) {
        return {
            models: [],
            platforms: [],
            summary: emptySummary(),
            updatedAt: new Date().toISOString(),
            reason: coerceReason(error)
        }
    }

    const rawModels = Array.isArray(source) ? source : []
    const models = rawModels
        .map((item, index) =>
            normalizeModel(item as RawPlatformModelInfo, index)
        )
        .filter((item): item is ChatLunaCoreModelItem => Boolean(item))
        .sort(sortModels)

    return {
        models,
        platforms: Array.from(new Set(models.map((item) => item.platform))).sort(
            (left, right) =>
                left.localeCompare(right, undefined, {
                    numeric: true,
                    sensitivity: 'base'
                })
        ),
        summary: summarizeModels(models),
        updatedAt: new Date().toISOString()
    }
}

const getPresetService = (ctx: Context) => {
    const chatluna = ctx.get('chatluna') as ChatLunaLikeService | undefined
    const preset = chatluna?.preset

    if (
        !preset ||
        !preset.getAllPreset ||
        !preset.getPreset ||
        !preset.resolvePresetDir ||
        !preset.loadAllPreset
    ) {
        throw new Error('ChatLuna preset service is not available.')
    }

    return preset
}

const getCharacterPresetService = (ctx: Context) => {
    const character = ctx.get('chatluna_character') as
        | ChatLunaCharacterLikeService
        | undefined

    return character?.preset
}

const normalizePresetSource = (
    source?: ChatLunaCorePresetSource
): ChatLunaCorePresetSource => {
    return source === 'character' ? 'character' : 'core'
}

const encodePresetId = (
    source: ChatLunaCorePresetSource,
    filename: string
) => {
    return `${source}:${filename}`
}

const parsePresetId = (
    id: string
): {
    source: ChatLunaCorePresetSource
    filename: string
} => {
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

    return {
        source: 'core',
        filename: id
    }
}

const getFallbackPresetDir = (
    ctx: Context,
    source: ChatLunaCorePresetSource
) => {
    const relative =
        source === 'character'
            ? 'data/chathub/character/presets'
            : 'data/chathub/presets'

    return path.resolve(ctx.baseDir, relative)
}

const resolvePresetSourceDir = (
    ctx: Context,
    source: ChatLunaCorePresetSource
) => {
    if (source === 'character') {
        return (
            getCharacterPresetService(ctx)?.resolvePresetDir?.() ??
            getFallbackPresetDir(ctx, source)
        )
    }

    const chatluna = ctx.get('chatluna') as ChatLunaLikeService | undefined

    return (
        chatluna?.preset?.resolvePresetDir?.() ??
        getFallbackPresetDir(ctx, source)
    )
}

const reloadPresetSource = async (
    ctx: Context,
    source: ChatLunaCorePresetSource
) => {
    if (source === 'character') {
        await getCharacterPresetService(ctx)?.loadAllPreset?.()
        return
    }

    await getPresetService(ctx).loadAllPreset!()
}

const toStringArray = (value: unknown) => {
    if (!Array.isArray(value)) return []

    return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const normalizePresetFilename = (
    filename: string,
    source: ChatLunaCorePresetSource
) => {
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

const resolvePresetFile = (
    presetDir: string,
    filename: string,
    source: ChatLunaCorePresetSource
) => {
    const normalized = normalizePresetFilename(filename, source)
    const root = path.resolve(presetDir)
    const filePath = path.resolve(root, normalized)

    if (!filePath.startsWith(`${root}${path.sep}`)) {
        throw new Error('Preset filename points outside the preset directory.')
    }

    return {
        filename: normalized,
        filePath
    }
}

const loadYamlParser = async (): Promise<YamlLoad> => {
    const moduleName = 'js-yaml'
    const module = (await import(moduleName)) as {
        load?: unknown
        default?: {
            load?: unknown
        }
    }
    const load = module.load ?? module.default?.load

    if (typeof load !== 'function') {
        throw new Error('YAML parser is not available.')
    }

    return load as YamlLoad
}

const parseCorePresetRawText = async (rawText: string) => {
    const load = await loadYamlParser()
    const preset = load(rawText)

    if (!isRecord(preset)) {
        throw new Error('Preset YAML must be an object.')
    }

    const keywords = toStringArray(preset.keywords)
    const prompts = Array.isArray(preset.prompts) ? preset.prompts : []
    const summary: ChatLunaCorePresetSummary = {
        keywords,
        promptCount: prompts.length,
        version:
            typeof preset.version === 'string' ? preset.version : undefined
    }

    if (!summary.keywords.length) {
        throw new Error('Preset must contain at least one keyword.')
    }

    if (summary.promptCount < 1) {
        throw new Error('Preset must contain at least one prompt.')
    }

    const validRoles = new Set([
        'assistant',
        'ai',
        'model',
        'user',
        'human',
        'system'
    ])

    for (const [index, prompt] of prompts.entries()) {
        if (!isRecord(prompt)) {
            throw new Error(`Prompt #${index + 1} must be an object.`)
        }

        if (
            typeof prompt.role !== 'string' ||
            !validRoles.has(prompt.role)
        ) {
            throw new Error(`Prompt #${index + 1} has an invalid role.`)
        }

        if (prompt.content == null) {
            throw new Error(`Prompt #${index + 1} must contain content.`)
        }
    }

    return {
        summary
    }
}

const parseCharacterPresetRawText = async (rawText: string) => {
    const load = await loadYamlParser()
    const preset = load(rawText)

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

    return {
        summary: {
            keywords: [name],
            promptCount: 2
        } satisfies ChatLunaCorePresetSummary
    }
}

const parsePresetRawText = async (
    rawText: string,
    source: ChatLunaCorePresetSource
) => {
    return source === 'character'
        ? parseCharacterPresetRawText(rawText)
        : parseCorePresetRawText(rawText)
}

const summarizePresetRawText = async (
    rawText: string,
    source: ChatLunaCorePresetSource
) => {
    try {
        return (await parsePresetRawText(rawText, source)).summary
    } catch {
        return emptyPresetSummary()
    }
}

const getCachedPresets = (service: ChatLunaPresetServiceLike) => {
    const names = service.getAllPreset?.(false)?.value
    if (!Array.isArray(names)) return []

    const presets: RawPresetTemplateLike[] = []

    for (const name of names) {
        if (typeof name !== 'string') continue

        const preset = service.getPreset?.(name, false)?.value
        if (!preset || typeof preset !== 'object') continue

        presets.push(preset as RawPresetTemplateLike)
    }

    return presets
}

const getPresetFileStat = async (filePath: string) => {
    try {
        const stat = await fs.stat(filePath)

        return {
            updatedAt: stat.mtime.toISOString(),
            size: stat.size
        }
    } catch {
        return {
            updatedAt: null,
            size: null
        }
    }
}

const listPresetDirectoryItems = async (
    source: ChatLunaCorePresetSource,
    presetDir: string
) => {
    let files: string[]

    try {
        files = await fs.readdir(presetDir)
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
        throw error
    }

    const supportedExtensions =
        source === 'character' ? new Set(['.yml']) : new Set(['.yml', '.txt'])

    const items = await Promise.all(
        files
            .filter((file) =>
                supportedExtensions.has(path.extname(file).toLowerCase())
            )
            .map(async (file) => {
                const { filename, filePath } = resolvePresetFile(
                    presetDir,
                    file,
                    source
                )
                const [rawText, stat] = await Promise.all([
                    fs.readFile(filePath, 'utf-8'),
                    getPresetFileStat(filePath)
                ])
                const summary = await summarizePresetRawText(rawText, source)

                return {
                    id: encodePresetId(source, filename),
                    source,
                    sourceLabel: presetSourceLabels[source],
                    filename,
                    ...summary,
                    ...stat
                }
            })
    )

    return items.sort((left, right) =>
        left.filename.localeCompare(right.filename, undefined, {
            numeric: true,
            sensitivity: 'base'
        })
    )
}

const ensureUniqueCorePresetKeywords = async (
    service: ChatLunaPresetServiceLike,
    keywords: string[],
    currentFilename?: string
) => {
    const presetDir = service.resolvePresetDir!()
    const target = new Set(keywords)

    for (const preset of getCachedPresets(service)) {
        const presetPath = typeof preset.path === 'string' ? preset.path : ''
        const filename = presetPath ? path.basename(presetPath) : ''
        if (currentFilename && filename === currentFilename) continue

        const conflict = toStringArray(preset.triggerKeyword).find((keyword) =>
            target.has(keyword)
        )

        if (conflict) {
            const source = filename || path.basename(presetDir)
            throw new Error(
                `Preset keyword "${conflict}" already exists in ${source}.`
            )
        }
    }
}

const ensureUniqueCharacterPresetKeywords = async (
    ctx: Context,
    keywords: string[],
    currentFilename?: string
) => {
    const presetDir = resolvePresetSourceDir(ctx, 'character')
    const target = new Set(keywords)
    let files: string[]

    try {
        files = await fs.readdir(presetDir)
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
        throw error
    }

    for (const file of files) {
        if (path.extname(file).toLowerCase() !== '.yml') continue
        if (currentFilename && file === currentFilename) continue

        const { filePath } = resolvePresetFile(presetDir, file, 'character')
        const rawText = await fs.readFile(filePath, 'utf-8')
        const summary = await summarizePresetRawText(rawText, 'character')
        const conflict = summary.keywords.find((keyword) =>
            target.has(keyword)
        )

        if (conflict) {
            throw new Error(
                `Character preset name "${conflict}" already exists in ${file}.`
            )
        }
    }
}

const ensureUniquePresetKeywords = async (
    ctx: Context,
    source: ChatLunaCorePresetSource,
    keywords: string[],
    currentFilename?: string
) => {
    if (source === 'character') {
        await ensureUniqueCharacterPresetKeywords(
            ctx,
            keywords,
            currentFilename
        )
        return
    }

    const service = getPresetService(ctx)
    await ensureUniqueCorePresetKeywords(service, keywords, currentFilename)
}

export const listChatLunaCorePresets = async (
    ctx: Context
): Promise<ChatLunaCorePresetListResult> => {
    const presets: ChatLunaCorePresetListItem[] = []
    const reasons: string[] = []

    try {
        await reloadPresetSource(ctx, 'core')
        presets.push(
            ...(await listPresetDirectoryItems(
                'core',
                resolvePresetSourceDir(ctx, 'core')
            ))
        )
    } catch (error) {
        reasons.push(`主插件预设：${coerceReason(error)}`)
    }

    try {
        await reloadPresetSource(ctx, 'character')
        presets.push(
            ...(await listPresetDirectoryItems(
                'character',
                resolvePresetSourceDir(ctx, 'character')
            ))
        )
    } catch (error) {
        reasons.push(`Character 预设：${coerceReason(error)}`)
    }

    presets.sort((left, right) => {
        const sourceOrder =
            (left.source === 'core' ? 0 : 1) -
            (right.source === 'core' ? 0 : 1)

        if (sourceOrder !== 0) return sourceOrder

        return left.filename.localeCompare(right.filename, undefined, {
            numeric: true,
            sensitivity: 'base'
        })
    })

    return {
        presets,
        updatedAt: new Date().toISOString(),
        reason: reasons.length ? reasons.join('；') : undefined
    }
}

export const getChatLunaCorePreset = async (
    ctx: Context,
    input: ChatLunaCorePresetGetInput
): Promise<ChatLunaCorePresetDetail> => {
    const presetId = parsePresetId(input.id)
    const presetDir = resolvePresetSourceDir(ctx, presetId.source)
    const { filename, filePath } = resolvePresetFile(
        presetDir,
        presetId.filename,
        presetId.source
    )
    const rawText = await fs.readFile(filePath, 'utf-8')
    const summary = await summarizePresetRawText(rawText, presetId.source)
    const stat = await getPresetFileStat(filePath)

    return {
        rawText,
        preset: {
            id: encodePresetId(presetId.source, filename),
            source: presetId.source,
            sourceLabel: presetSourceLabels[presetId.source],
            filename,
            ...summary,
            ...stat
        }
    }
}

export const validateChatLunaCorePreset = async (
    input: ChatLunaCorePresetValidateInput
): Promise<ChatLunaCorePresetValidationResult> => {
    try {
        const { summary } = await parsePresetRawText(
            input.rawText,
            normalizePresetSource(input.source)
        )

        return {
            valid: true,
            ...summary
        }
    } catch (error) {
        return {
            valid: false,
            ...emptyPresetSummary(),
            error: coerceReason(error)
        }
    }
}

export const createChatLunaCorePreset = async (
    ctx: Context,
    input: ChatLunaCorePresetCreateInput
): Promise<ChatLunaCorePresetDetail> => {
    const source = normalizePresetSource(input.source)
    const presetDir = resolvePresetSourceDir(ctx, source)
    const { filename, filePath } = resolvePresetFile(
        presetDir,
        input.filename,
        source
    )

    await fs.mkdir(presetDir, { recursive: true })

    try {
        await fs.access(filePath)
        throw new Error(`Preset file "${filename}" already exists.`)
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error
        }
    }

    const { summary } = await parsePresetRawText(input.rawText, source)
    await reloadPresetSource(ctx, source)
    await ensureUniquePresetKeywords(ctx, source, summary.keywords)
    await fs.writeFile(filePath, input.rawText, 'utf-8')
    await reloadPresetSource(ctx, source)

    return getChatLunaCorePreset(ctx, { id: encodePresetId(source, filename) })
}

export const updateChatLunaCorePreset = async (
    ctx: Context,
    input: ChatLunaCorePresetUpdateInput
): Promise<ChatLunaCorePresetDetail> => {
    const presetId = parsePresetId(input.id)
    const presetDir = resolvePresetSourceDir(ctx, presetId.source)
    const { filename, filePath } = resolvePresetFile(
        presetDir,
        presetId.filename,
        presetId.source
    )

    await fs.access(filePath)

    const { summary } = await parsePresetRawText(
        input.rawText,
        presetId.source
    )
    await reloadPresetSource(ctx, presetId.source)
    await ensureUniquePresetKeywords(
        ctx,
        presetId.source,
        summary.keywords,
        filename
    )
    await fs.writeFile(filePath, input.rawText, 'utf-8')
    await reloadPresetSource(ctx, presetId.source)

    return getChatLunaCorePreset(ctx, {
        id: encodePresetId(presetId.source, filename)
    })
}
