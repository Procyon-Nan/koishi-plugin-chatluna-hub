import { dump, load } from 'js-yaml'
import type { PresetSource } from './types'
import {
    emptyCharacterPreset,
    emptyCorePreset,
    isWorldLoreEntry,
    type CharacterPresetTemplate,
    type PromptContent,
    type PromptContentPart,
    type PromptRole,
    type RawPreset,
    type RawWorldLore,
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

const hasOwn = (value: object, key: PropertyKey): boolean =>
    Object.prototype.hasOwnProperty.call(value, key)

const defineOwn = (
    target: Record<string, unknown>,
    key: string,
    value: unknown
): void => {
    Object.defineProperty(target, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true
    })
}

const asObject = (value: unknown): Record<string, unknown> | null => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null
    }
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) return null
    return value as Record<string, unknown>
}

const isScalar = (value: unknown): value is string | number | boolean =>
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'

const toStringArray = (value: unknown): string[] => {
    if (typeof value === 'string') {
        return value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
    }
    // A lone scalar becomes a single item instead of being erased.
    if (!Array.isArray(value)) return isScalar(value) ? [String(value)] : []
    return value
        .map((item) =>
            typeof item === 'string' ? item.trim() : String(item ?? '')
        )
        .filter(Boolean)
}

/**
 * `world_lores[].keywords` is `string | string[]`, so a lone value stays a lone
 * value here instead of becoming a one-item array. Every branch below is a
 * conversion `isStringListLike` vouches for; guarding the call is what keeps it
 * that way (see the note on that predicate).
 */
const normalizeWorldLoreKeywords = (value: unknown): string | string[] => {
    if (typeof value === 'string') return value
    // A lone scalar becomes text instead of being erased, as in `toStringArray`.
    if (!Array.isArray(value)) return isScalar(value) ? String(value) : []
    return value.map((item) =>
        typeof item === 'string' ? item : String(item ?? '')
    )
}

/** Keep a YAML scalar as-is: `version: 1.0` and `bot_id: 123` are not strings. */
const presetScalar = (value: unknown): string | number | undefined => {
    if (typeof value === 'string' || typeof value === 'number') return value
    return undefined
}

/** A required text field: a non-string scalar keeps its value instead of vanishing. */
const requiredText = (value: unknown): string => {
    if (typeof value === 'string') return value
    return isScalar(value) ? String(value) : ''
}

/** YAML writes an empty key as null; both mean "no value", not "lost value". */
const isMissing = (value: unknown): boolean => value == null

/** Shapes `requiredText` can express, and the elements `toStringArray` can. */
const isTextLike = (value: unknown): boolean =>
    isMissing(value) || isScalar(value)

/**
 * Shapes `toStringArray` and `normalizeWorldLoreKeywords` can express without
 * inventing or dropping data. The element check is the point: `String({ a: 1 })`
 * would rewrite a mapping to `[object Object]`, a loss that is both
 * unrecoverable and invisible in a diff. One non-scalar element therefore keeps
 * the whole array untouched. Every conversion to a string list goes through
 * this guard — core `keywords`, `nick_name`, `mute_keyword` and
 * `world_lores[].keywords` alike.
 */
const isStringListLike = (value: unknown): boolean => {
    if (isMissing(value) || isScalar(value)) return true
    return Array.isArray(value) && value.every(isTextLike)
}

/**
 * Normalize a value, or hand it back untouched when its shape is outside what
 * the normalizer can express (an object where text is expected, and so on).
 * Unconditional keys need this because `keepDroppedValues` cannot rescue a key
 * that is always written: this layer deletes nothing, and the form layer guards
 * the shape with the `isRenderable*` predicates instead.
 */
const normalizeOrKeep = <T>(
    value: unknown,
    canNormalize: (value: unknown) => boolean,
    normalize: (value: unknown) => T
): T => (canNormalize(value) ? normalize(value) : (value as T))

/** ChatLuna maps ai/model to AIMessage and human to HumanMessage. */
const PROMPT_ROLES = new Set<string>([
    'assistant',
    'ai',
    'model',
    'user',
    'human',
    'system'
])

const normalizePromptRole = (value: unknown): PromptRole =>
    typeof value === 'string' && PROMPT_ROLES.has(value)
        ? (value as PromptRole)
        : 'system'

/** Plain text or a LangChain `MessageContentComplex[]`; never rewrite the latter. */
const normalizePromptContent = (value: unknown): PromptContent => {
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return value as PromptContentPart[]
    return ''
}

// An unsupported string is still an uneditable value: preserving it lets the
// select guard surface the problem instead of silently rewriting it to system.
const isPromptRoleLike = (value: unknown): boolean =>
    isMissing(value) || (typeof value === 'string' && PROMPT_ROLES.has(value))

const isPromptContentLike = (value: unknown): boolean =>
    isMissing(value) || typeof value === 'string' || Array.isArray(value)

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
    const extras = Object.create(null) as Record<string, unknown>
    for (const [key, value] of Object.entries(obj)) {
        if (!known.has(key) && value !== undefined) {
            defineOwn(extras, key, value)
        }
    }
    return extras
}

/**
 * Re-attach every known key whose value failed its type guard, whatever its
 * shape. This layer never trims data to fit the form: a malformed object or
 * array reaches the components as-is, and rendering safety is their job (see
 * the `isRenderable*` guards in preset-types).
 */
const keepDroppedValues = <T extends object>(
    obj: Record<string, unknown>,
    normalized: T
): T => {
    const out = normalized as Record<string, unknown>
    for (const [key, value] of Object.entries(obj)) {
        if (hasOwn(out, key) || value === undefined) continue
        defineOwn(out, key, value)
    }
    return normalized
}

/** Normalize parsed YAML into form-friendly structured data. */
export const normalizeCorePreset = (raw: unknown): RawPreset => {
    const obj = asObject(raw) ?? {}
    const prompts = Array.isArray(obj.prompts)
        ? (obj.prompts
              .map((item) => {
                  const row = asObject(item)
                  if (!row) return null
                  return {
                      ...row,
                      role: normalizeOrKeep<PromptRole>(
                          row.role,
                          isPromptRoleLike,
                          normalizePromptRole
                      ),
                      content: normalizeOrKeep<PromptContent>(
                          row.content,
                          isPromptContentLike,
                          normalizePromptContent
                      ),
                      ...(typeof row.type === 'string'
                          ? {
                                type: row.type as RawPreset['prompts'][number]['type']
                            }
                          : {})
                  }
              })
              // Intentional boundary, not an oversight: every ChatLuna producer
              // writes mappings here, so a non-mapping element can only be a
              // hand-written typo, and dropping it is visible at once as a
              // missing message row. Preserving it would mean widening the
              // element type through every form component.
              .filter(Boolean) as RawPreset['prompts'])
        : []

    const world_lores = Array.isArray(obj.world_lores)
        ? (obj.world_lores
              .map((item) => {
                  const row = asObject(item)
                  if (!row) return null
                  // ChatLuna splits world_lores by `isRoleBook`: an element
                  // without keywords + content is the global lore config, and
                  // adding those keys would turn it into an empty junk entry.
                  if (!isWorldLoreEntry(row)) return row as RawWorldLore
                  return {
                      ...row,
                      keywords: normalizeOrKeep(
                          row.keywords,
                          isStringListLike,
                          normalizeWorldLoreKeywords
                      )
                  } as RawWorldLore
              })
              // Same intentional boundary as `prompts`: a non-mapping element
              // has no legitimate producer, and its loss is visible in the list.
              .filter(Boolean) as RawPreset['world_lores'])
        : undefined

    const version = presetScalar(obj.version)

    return keepDroppedValues(obj, {
        ...preserveUnknownKeys(obj, CORE_KNOWN_KEYS),
        keywords: normalizeOrKeep(
            obj.keywords,
            isStringListLike,
            toStringArray
        ),
        // No placeholder row here: injecting one would rewrite a user file that
        // legitimately has `prompts: []`. The form renders its own empty state.
        prompts: normalizeOrKeep(
            obj.prompts,
            (value) => isMissing(value) || Array.isArray(value),
            () => prompts
        ),
        ...(typeof obj.format_user_prompt === 'string'
            ? { format_user_prompt: obj.format_user_prompt }
            : {}),
        ...(version !== undefined ? { version } : {}),
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
    })
}

export const normalizeCharacterPreset = (
    raw: unknown
): CharacterPresetTemplate => {
    const obj = asObject(raw) ?? {}
    const bot_id = presetScalar(obj.bot_id)
    const owner_id = presetScalar(obj.owner_id)

    return keepDroppedValues(obj, {
        ...preserveUnknownKeys(obj, CHARACTER_KNOWN_KEYS),
        // The four keys below are non-optional in the upstream template type, so
        // writing an empty value completes a required field rather than adding
        // content — the opposite of injecting a placeholder prompt row.
        name: normalizeOrKeep(obj.name, isTextLike, requiredText),
        nick_name: normalizeOrKeep(
            obj.nick_name,
            isStringListLike,
            toStringArray
        ),
        input: normalizeOrKeep(obj.input, isTextLike, requiredText),
        system: normalizeOrKeep(obj.system, isTextLike, requiredText),
        ...(typeof obj.status === 'string' ? { status: obj.status } : {}),
        ...(obj.mute_keyword != null
            ? {
                  mute_keyword: normalizeOrKeep(
                      obj.mute_keyword,
                      isStringListLike,
                      toStringArray
                  )
              }
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
        ...(bot_id !== undefined ? { bot_id } : {}),
        ...(owner_id !== undefined ? { owner_id } : {})
    })
}

/**
 * Ceiling on the alias-expanded node count of a parsed document. `load()` keeps
 * a YAML alias as a shared reference, so parsing is linear in the text, while
 * `forYaml` rebuilds every object it walks and so materializes each reference
 * once per path that reaches it. The expansion grows exponentially with alias
 * depth while the document grows linearly, so a sub-kilobyte file can encode a
 * billion nodes and freeze the tab on the first form edit. Bounding the raw text
 * would not help: the amplification, not the input size, is what has to be
 * capped. Mirrors MAX_DRAFT_NODES in `src/webui/core/preset-generate-tools.ts`.
 */
const MAX_PRESET_NODES = 200_000

/** Ceiling on nesting, so the walk below cannot exhaust the JS stack. */
const MAX_PRESET_DEPTH = 64

/**
 * UTF-16 code-unit budget for expanded string values and object keys. A single
 * large scalar or key can otherwise be repeated by aliases while staying far
 * below the node cap. Mirrors MAX_DRAFT_EXPANDED_CONTENT_LENGTH on the server.
 */
const MAX_PRESET_EXPANDED_CONTENT_LENGTH = 8 * 1024 * 1024

/** Hard ceiling on the YAML text returned to the editor. */
const MAX_PRESET_OUTPUT_LENGTH = 8 * 1024 * 1024

/**
 * The reason a parsed document is outside those ceilings, or '' when it fits.
 * Counting stops at the first violation instead of totalling the graph first:
 * a walk that visited the whole expansion would itself be the exponential cost
 * this guards against, so the check is O(cap) rather than O(expansion). Shared
 * references are deliberately not memoized — visiting each one once is exactly
 * what would hide the amplification.
 */
const findBudgetViolation = (root: unknown): string => {
    let remaining = MAX_PRESET_NODES
    let remainingContent = MAX_PRESET_EXPANDED_CONTENT_LENGTH

    const consumeContent = (length: number): string => {
        if (length > remainingContent) {
            return `预设展开后内容过大（超过 ${
                MAX_PRESET_EXPANDED_CONTENT_LENGTH / 1024 / 1024
            } MiB，可能包含 YAML 别名放大），已停止处理`
        }
        remainingContent -= length
        return ''
    }

    const walk = (node: unknown, depth: number): string => {
        if (depth > MAX_PRESET_DEPTH) return '预设嵌套层级过深，已停止解析'
        if (remaining <= 0) {
            return '预设展开后结构过大（可能包含 YAML 别名放大），已停止解析以避免页面卡死'
        }
        remaining -= 1

        if (typeof node === 'string') return consumeContent(node.length)
        if (node instanceof RegExp) return consumeContent(node.source.length)
        if (!node || typeof node !== 'object' || node instanceof Date) return ''
        if (Array.isArray(node)) {
            for (const child of node) {
                const violation = walk(child, depth + 1)
                if (violation) return violation
            }
            return ''
        }

        for (const [key, child] of Object.entries(
            node as Record<string, unknown>
        )) {
            const keyViolation = consumeContent(key.length)
            if (keyViolation) return keyViolation
            const childViolation = walk(child, depth + 1)
            if (childViolation) return childViolation
        }
        return ''
    }

    return walk(root, 0)
}

const assertPresetWithinLimits = (value: unknown): void => {
    const violation = findBudgetViolation(value)
    if (violation) throw new Error(violation)
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

    // Reported like any other parse failure: the caller keeps `rawText` as it
    // is and only blocks the form, so an over-budget document is never trimmed
    // or rewritten — the user can still fix it in the YAML tab.
    const violation = findBudgetViolation(loaded)
    if (violation) return { ok: false, error: violation }

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

    const out = Object.create(null) as Record<string, unknown>
    for (const [key, child] of Object.entries(
        value as Record<string, unknown>
    )) {
        if (child === undefined) continue
        defineOwn(out, key, forYaml(child))
    }
    return out
}

export const serializePresetData = (
    data: StructuredPreset,
    source: PresetSource
): string => {
    assertPresetWithinLimits(data)
    const payload =
        source === 'character'
            ? forYaml(data as CharacterPresetTemplate)
            : forYaml(data as RawPreset)

    const output =
        dump(payload, {
            lineWidth: -1,
            noRefs: true,
            sortKeys: false
        }).trimEnd() + '\n'

    if (output.length > MAX_PRESET_OUTPUT_LENGTH) {
        throw new Error(
            `预设序列化结果过大（超过 ${
                MAX_PRESET_OUTPUT_LENGTH / 1024 / 1024
            } MiB），已停止写回`
        )
    }
    return output
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
        const isArrayKey =
            key !== '' && Number.isInteger(index) && String(index) === key

        if (isArrayKey) {
            const list = Array.isArray(input) ? [...input] : []
            list[index] = clone(list[index], depth + 1)
            return list
        }

        const obj: Record<string, unknown> = {}
        if (
            typeof input === 'object' &&
            input !== null &&
            !Array.isArray(input)
        ) {
            for (const [entryKey, child] of Object.entries(
                input as Record<string, unknown>
            )) {
                defineOwn(obj, entryKey, child)
            }
        }
        const current = hasOwn(obj, key) ? obj[key] : undefined
        defineOwn(obj, key, clone(current, depth + 1))
        return obj
    }

    return clone(root, 0) as T
}
