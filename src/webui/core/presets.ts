/**
 * Preset CRUD for the Hub preset page. Supports two sources — ChatLuna core
 * presets and Character presets — resolving each source's directory from the
 * owning service with a `data/chathub/...` fallback. Filesystem writes are
 * constrained to the resolved preset directory by {@link resolvePresetFile}.
 */
import fs from 'fs/promises'
import path from 'path'
import type { Context } from 'koishi'
import { coerceReason, naturalCompare } from '../shared'
import {
    type ChatLunaCharacterLikeService,
    type ChatLunaPresetServiceLike,
    getChatLuna
} from './chatluna-service'
import {
    type ChatLunaCorePresetSource,
    type ChatLunaCorePresetSummary,
    emptyPresetSummary,
    encodePresetId,
    normalizePresetSource,
    parsePresetId,
    parsePresetRawText,
    presetExtensions,
    presetSourceLabels,
    resolvePresetFile,
    summarizePresetRawText
} from './preset-files'

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

export interface ChatLunaCorePresetValidationResult extends ChatLunaCorePresetSummary {
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

export interface ChatLunaCorePresetDeleteInput {
    id: string
}

interface RawPresetTemplateLike {
    triggerKeyword?: unknown
    messages?: unknown
    path?: unknown
    rawText?: unknown
    version?: unknown
}

const getPresetService = (ctx: Context): ChatLunaPresetServiceLike => {
    const preset = getChatLuna(ctx)?.preset

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

const getFallbackPresetDir = (
    ctx: Context,
    source: ChatLunaCorePresetSource
): string => {
    const relative =
        source === 'character'
            ? 'data/chathub/character/presets'
            : 'data/chathub/presets'

    return path.resolve(ctx.baseDir, relative)
}

const resolvePresetSourceDir = (
    ctx: Context,
    source: ChatLunaCorePresetSource
): string => {
    const resolved =
        source === 'character'
            ? getCharacterPresetService(ctx)?.resolvePresetDir?.()
            : getChatLuna(ctx)?.preset?.resolvePresetDir?.()

    return resolved ?? getFallbackPresetDir(ctx, source)
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

const getPresetFileStat = async (filePath: string) => {
    try {
        const stat = await fs.stat(filePath)

        return { updatedAt: stat.mtime.toISOString(), size: stat.size }
    } catch {
        return { updatedAt: null, size: null }
    }
}

const buildListItem = async (
    source: ChatLunaCorePresetSource,
    presetDir: string,
    file: string
): Promise<ChatLunaCorePresetListItem> => {
    const { filename, filePath } = resolvePresetFile(presetDir, file, source)
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
}

const listPresetDirectoryItems = async (
    source: ChatLunaCorePresetSource,
    presetDir: string
): Promise<ChatLunaCorePresetListItem[]> => {
    let files: string[]

    try {
        files = await fs.readdir(presetDir)
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
        throw error
    }

    const extensions = presetExtensions(source)
    const items = await Promise.all(
        files
            .filter((file) => extensions.has(path.extname(file).toLowerCase()))
            .map((file) => buildListItem(source, presetDir, file))
    )

    return items.sort((left, right) =>
        naturalCompare(left.filename, right.filename)
    )
}

/**
 * Core presets are loaded into ChatLuna's preset service, so we check the
 * in-memory cache for keyword conflicts (cheaper, and reflects pending loads).
 */
const ensureUniqueCorePresetKeywords = (
    service: ChatLunaPresetServiceLike,
    keywords: string[],
    currentFilename?: string
) => {
    const presetDir = service.resolvePresetDir!()
    const target = new Set(keywords)
    const names = service.getAllPreset?.(false)?.value
    if (!Array.isArray(names)) return

    for (const name of names) {
        if (typeof name !== 'string') continue

        const value = service.getPreset?.(name, false)?.value
        if (!value || typeof value !== 'object') continue

        const preset = value as RawPresetTemplateLike
        const presetPath = typeof preset.path === 'string' ? preset.path : ''
        const filename = presetPath ? path.basename(presetPath) : ''
        if (currentFilename && filename === currentFilename) continue

        const triggers = Array.isArray(preset.triggerKeyword)
            ? preset.triggerKeyword.filter(
                  (item): item is string => typeof item === 'string'
              )
            : []
        const conflict = triggers.find((keyword) => target.has(keyword))

        if (conflict) {
            const owner = filename || path.basename(presetDir)
            throw new Error(
                `Preset keyword "${conflict}" already exists in ${owner}.`
            )
        }
    }
}

/**
 * Character presets are not in the core preset cache, so we scan the directory
 * directly for keyword (name) conflicts.
 */
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
        const conflict = summary.keywords.find((keyword) => target.has(keyword))

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

    ensureUniqueCorePresetKeywords(
        getPresetService(ctx),
        keywords,
        currentFilename
    )
}

export const listChatLunaCorePresets = async (
    ctx: Context
): Promise<ChatLunaCorePresetListResult> => {
    const presets: ChatLunaCorePresetListItem[] = []
    const reasons: string[] = []

    const collect = async (source: ChatLunaCorePresetSource, label: string) => {
        try {
            await reloadPresetSource(ctx, source)
            presets.push(
                ...(await listPresetDirectoryItems(
                    source,
                    resolvePresetSourceDir(ctx, source)
                ))
            )
        } catch (error) {
            reasons.push(`${label}：${coerceReason(error)}`)
        }
    }

    await collect('core', presetSourceLabels.core)
    await collect('character', presetSourceLabels.character)

    presets.sort((left, right) => {
        const sourceOrder =
            (left.source === 'core' ? 0 : 1) - (right.source === 'core' ? 0 : 1)

        if (sourceOrder !== 0) return sourceOrder
        return naturalCompare(left.filename, right.filename)
    })

    return {
        presets,
        updatedAt: new Date().toISOString(),
        reason: reasons.length ? reasons.join('；') : undefined
    }
}

/** Read a single preset's raw text plus its summary and file stat. */
const readPresetDetail = async (
    ctx: Context,
    source: ChatLunaCorePresetSource,
    rawFilename: string
): Promise<ChatLunaCorePresetDetail> => {
    const presetDir = resolvePresetSourceDir(ctx, source)
    const { filename, filePath } = resolvePresetFile(
        presetDir,
        rawFilename,
        source
    )
    const rawText = await fs.readFile(filePath, 'utf-8')
    const summary = await summarizePresetRawText(rawText, source)
    const stat = await getPresetFileStat(filePath)

    return {
        rawText,
        preset: {
            id: encodePresetId(source, filename),
            source,
            sourceLabel: presetSourceLabels[source],
            filename,
            ...summary,
            ...stat
        }
    }
}

export const getChatLunaCorePreset = async (
    ctx: Context,
    input: ChatLunaCorePresetGetInput
): Promise<ChatLunaCorePresetDetail> => {
    const { source, filename } = parsePresetId(input.id)

    return readPresetDetail(ctx, source, filename)
}

export const validateChatLunaCorePreset = async (
    input: ChatLunaCorePresetValidateInput
): Promise<ChatLunaCorePresetValidationResult> => {
    try {
        const summary = await parsePresetRawText(
            input.rawText,
            normalizePresetSource(input.source)
        )

        return { valid: true, ...summary }
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

    const summary = await parsePresetRawText(input.rawText, source)
    await reloadPresetSource(ctx, source)
    await ensureUniquePresetKeywords(ctx, source, summary.keywords)
    await fs.writeFile(filePath, input.rawText, 'utf-8')
    await reloadPresetSource(ctx, source)

    return readPresetDetail(ctx, source, filename)
}

export const updateChatLunaCorePreset = async (
    ctx: Context,
    input: ChatLunaCorePresetUpdateInput
): Promise<ChatLunaCorePresetDetail> => {
    const { source, filename: rawFilename } = parsePresetId(input.id)
    const presetDir = resolvePresetSourceDir(ctx, source)
    const { filename, filePath } = resolvePresetFile(
        presetDir,
        rawFilename,
        source
    )

    await fs.access(filePath)

    const summary = await parsePresetRawText(input.rawText, source)
    await reloadPresetSource(ctx, source)
    await ensureUniquePresetKeywords(ctx, source, summary.keywords, filename)
    await fs.writeFile(filePath, input.rawText, 'utf-8')
    await reloadPresetSource(ctx, source)

    return readPresetDetail(ctx, source, filename)
}

export const deleteChatLunaCorePreset = async (
    ctx: Context,
    input: ChatLunaCorePresetDeleteInput
): Promise<{ success: true }> => {
    const { source, filename } = parsePresetId(input.id)
    const presetDir = resolvePresetSourceDir(ctx, source)
    const { filePath } = resolvePresetFile(presetDir, filename, source)

    await fs.unlink(filePath)

    try {
        await reloadPresetSource(ctx, source)
    } catch {
        // The file is already gone; a later list refresh surfaces reload issues.
    }

    return { success: true }
}
