import { dump, load } from 'js-yaml'
import type { PresetSource } from './types'
import {
    emptyCharacterPreset,
    emptyCorePreset,
    type CharacterPresetTemplate,
    type RawPreset,
    type StructuredPreset
} from './preset-types'

export interface ParseResult {
    ok: true
    data: StructuredPreset
}

export interface ParseError {
    ok: false
    error: string
}

export type ParseOutcome = ParseResult | ParseError

const asObject = (value: unknown): Record<string, unknown> | null => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null
    }
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) return null
    return value as Record<string, unknown>
}

const toStringArray = (value: unknown): string[] => {
    if (typeof value === 'string') {
        return value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
    }
    if (!Array.isArray(value)) return []
    return value
        .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '')))
        .filter(Boolean)
}

const normalizeWorldLoreKeywords = (value: unknown): string | string[] => {
    if (typeof value === 'string') return value
    if (!Array.isArray(value)) return []
    return value.map((item) => {
        if (typeof item === 'string') return item
        if (item instanceof RegExp) return item.source
        return String(item ?? '')
    })
}

const CORE_KNOWN_KEYS = new Set([
    'keywords',
    'prompts',
    'format_user_prompt',
    'version',
    'world_lores',
    'authors_note',
    'knowledge',
    'config'
])

const CHARACTER_KNOWN_KEYS = new Set([
    'name',
    'nick_name',
    'input',
    'system',
    'status',
    'mute_keyword',
    'path',
    'description',
    'personality',
    'hobbies',
    'dialogue_examples',
    'chat_style',
    'chat_behavior',
    'relationship',
    'stickers',
    'bot_id',
    'owner_id'
])

/** Keep unknown top-level keys so form edit → save does not strip extensions. */
const preserveUnknownKeys = (
    obj: Record<string, unknown>,
    known: Set<string>
): Record<string, unknown> => {
    const extras: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
        if (!known.has(key) && value !== undefined) extras[key] = value
    }
    return extras
}

/** Normalize parsed YAML into form-friendly structured data. */
export const normalizeCorePreset = (raw: unknown): RawPreset => {
    const obj = asObject(raw) ?? {}
    const prompts = Array.isArray(obj.prompts)
        ? obj.prompts
              .map((item) => {
                  const row = asObject(item)
                  if (!row) return null
                  const role =
                      row.role === 'user' || row.role === 'assistant'
                          ? row.role
                          : 'system'
                  return {
                      role,
                      content: typeof row.content === 'string' ? row.content : '',
                      ...(typeof row.type === 'string'
                          ? {
                                type: row.type as RawPreset['prompts'][number]['type']
                            }
                          : {})
                  }
              })
              .filter(Boolean) as RawPreset['prompts']
        : []

    const world_lores = Array.isArray(obj.world_lores)
        ? obj.world_lores
              .map((item) => {
                  const row = asObject(item)
                  if (!row) return null
                  return {
                      ...row,
                      keywords: normalizeWorldLoreKeywords(row.keywords),
                      content:
                          typeof row.content === 'string' ? row.content : ''
                  }
              })
              .filter(Boolean) as RawPreset['world_lores']
        : undefined

    return {
        ...preserveUnknownKeys(obj, CORE_KNOWN_KEYS),
        keywords: toStringArray(obj.keywords),
        prompts:
            prompts.length > 0
                ? prompts
                : [{ role: 'system', content: '' }],
        ...(typeof obj.format_user_prompt === 'string'
            ? { format_user_prompt: obj.format_user_prompt }
            : {}),
        ...(typeof obj.version === 'string' ? { version: obj.version } : {}),
        ...(world_lores ? { world_lores } : {}),
        ...(asObject(obj.authors_note)
            ? { authors_note: obj.authors_note as RawPreset['authors_note'] }
            : {}),
        ...(asObject(obj.knowledge)
            ? { knowledge: obj.knowledge as RawPreset['knowledge'] }
            : {}),
        ...(asObject(obj.config)
            ? { config: obj.config as RawPreset['config'] }
            : {})
    }
}

export const normalizeCharacterPreset = (
    raw: unknown
): CharacterPresetTemplate => {
    const obj = asObject(raw) ?? {}
    return {
        ...preserveUnknownKeys(obj, CHARACTER_KNOWN_KEYS),
        name: typeof obj.name === 'string' ? obj.name : '',
        nick_name: toStringArray(obj.nick_name),
        input: typeof obj.input === 'string' ? obj.input : '',
        system: typeof obj.system === 'string' ? obj.system : '',
        ...(typeof obj.status === 'string' ? { status: obj.status } : {}),
        ...(obj.mute_keyword != null
            ? { mute_keyword: toStringArray(obj.mute_keyword) }
            : {}),
        ...(typeof obj.path === 'string' ? { path: obj.path } : {}),
        ...(typeof obj.description === 'string'
            ? { description: obj.description }
            : {}),
        ...(typeof obj.personality === 'string'
            ? { personality: obj.personality }
            : {}),
        ...(typeof obj.hobbies === 'string' ? { hobbies: obj.hobbies } : {}),
        ...(typeof obj.dialogue_examples === 'string'
            ? { dialogue_examples: obj.dialogue_examples }
            : {}),
        ...(typeof obj.chat_style === 'string'
            ? { chat_style: obj.chat_style }
            : {}),
        ...(typeof obj.chat_behavior === 'string'
            ? { chat_behavior: obj.chat_behavior }
            : {}),
        ...(typeof obj.relationship === 'string'
            ? { relationship: obj.relationship }
            : {}),
        ...(typeof obj.stickers === 'string' ? { stickers: obj.stickers } : {}),
        ...(typeof obj.bot_id === 'string' ? { bot_id: obj.bot_id } : {}),
        ...(typeof obj.owner_id === 'string' ? { owner_id: obj.owner_id } : {})
    }
}

export const parsePresetYaml = (
    rawText: string,
    source: PresetSource
): ParseOutcome => {
    const text = rawText.trim()
    if (!text) {
        return {
            ok: true,
            data:
                source === 'character'
                    ? emptyCharacterPreset()
                    : emptyCorePreset()
        }
    }

    let loaded: unknown
    try {
        loaded = load(rawText)
    } catch (err) {
        return {
            ok: false,
            error:
                err instanceof Error
                    ? `YAML 解析失败：${err.message}`
                    : 'YAML 解析失败'
        }
    }

    if (!asObject(loaded)) {
        return {
            ok: false,
            error: 'YAML 根节点必须是键值映射，不能是标量或数组'
        }
    }

    if (source === 'character') {
        return { ok: true, data: normalizeCharacterPreset(loaded) }
    }

    return { ok: true, data: normalizeCorePreset(loaded) }
}

/** Normalize values that js-yaml cannot dump (e.g. RegExp). */
const forYaml = (value: unknown): unknown => {
    if (value == null) return value
    if (value instanceof RegExp) return value.source
    if (value instanceof Date) return value
    if (Array.isArray(value)) return value.map(forYaml)
    if (typeof value !== 'object') return value

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) return value

    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (child === undefined) continue
        out[key] = forYaml(child)
    }
    return out
}

export const serializePresetData = (
    data: StructuredPreset,
    source: PresetSource
): string => {
    const payload =
        source === 'character'
            ? forYaml(data as CharacterPresetTemplate)
            : forYaml(data as RawPreset)

    return (
        dump(payload, {
            lineWidth: -1,
            noRefs: true,
            sortKeys: false
        }).trimEnd() + '\n'
    )
}

export const downloadYaml = (content: string, filename: string): void => {
    const safe = (filename || 'preset.yml').replace(/[\\/:*?"<>|]/g, '_')
    const name = /\.(ya?ml|txt)$/i.test(safe) ? safe : `${safe}.yml`
    const url = URL.createObjectURL(
        new Blob([content], { type: 'application/yaml;charset=utf-8' })
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
}

/** Immutable nested set: supports `a.b.0.c` paths. */
export const setAtPath = <T>(root: T, path: string, value: unknown): T => {
    const keys = path.split('.').filter(Boolean)
    if (keys.length === 0) return value as T

    const clone = (input: unknown, depth: number): unknown => {
        if (depth >= keys.length) return value
        const key = keys[depth]
        const index = Number(key)
        const isArrayKey = key !== '' && Number.isInteger(index) && String(index) === key

        if (isArrayKey) {
            const list = Array.isArray(input) ? [...input] : []
            list[index] = clone(list[index], depth + 1)
            return list
        }

        const obj =
            typeof input === 'object' && input !== null && !Array.isArray(input)
                ? { ...(input as Record<string, unknown>) }
                : {}
        obj[key] = clone(obj[key], depth + 1)
        return obj
    }

    return clone(root, 0) as T
}
