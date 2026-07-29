/**
 * In-memory DraftBuffer + ChatLuna StructuredTool factories for one-click
 * preset generation. Tools never touch the filesystem.
 */
import { DynamicStructuredTool } from '@langchain/core/tools'
import { dump, load } from 'js-yaml'
import { z } from 'zod'
import { isRecord } from '../shared'
import {
    AI_PROMPT_ROLES,
    type ChatLunaCorePresetSource,
    PROMPT_ROLE_SET,
    PROMPT_ROLES
} from './preset-files'
import type {
    PresetGenerateCharacterFormat,
    PresetGenerateMainFormat
} from './preset-generate-types'

export interface DraftBuffer {
    source: ChatLunaCorePresetSource
    data: Record<string, unknown>
    rawText: string
    /** Set after a successful replace* tool write. */
    writeSucceeded: boolean
    warnings: string[]
}

export interface GenerateToolBundle {
    tools: ChatLunaToolLike[]
    buffer: DraftBuffer
}

interface ChatLunaToolLike {
    name: string
    description: string
    createTool: (params: { embeddings?: unknown }) => unknown
    selector: () => boolean
}

type YamlValue = Record<string, unknown>

const SENSITIVE_KEY =
    /^(api[_-]?key|api[_-]?token|api[_-]?url|token|password|secret)$/i

/** Character budget for any draft text handed to the model. */
export const GENERATE_TEXT_LIMIT = 4000

/**
 * Hard ceiling on the draft YAML accepted by a generation request. YAML aliases
 * expand multiplicatively once the draft is dumped with `noRefs: true`, so the
 * raw input has to be bounded before it is parsed.
 */
const MAX_RAW_TEXT_LENGTH = 512 * 1024

/**
 * Ceiling on the alias-expanded node count of a parsed draft. `load()` keeps
 * aliases as shared references (cheap), while `dump(..., { noRefs: true })`
 * materializes every reference — so MAX_RAW_TEXT_LENGTH alone does not bound
 * the output, because each extra alias level multiplies the expansion.
 */
const MAX_DRAFT_NODES = 200_000

/** Ceiling on draft nesting, so the walk below cannot exhaust the JS stack. */
const MAX_DRAFT_DEPTH = 64

/**
 * UTF-16 code-unit budget for expanded string values and object keys. This is
 * mirrored by MAX_PRESET_EXPANDED_CONTENT_LENGTH in the client serializer.
 */
const MAX_DRAFT_EXPANDED_CONTENT_LENGTH = 8 * 1024 * 1024

/** Hard ceiling on serialized YAML returned to the client. */
const MAX_DRAFT_OUTPUT_LENGTH = 8 * 1024 * 1024

/** Truncate a string to `max` characters, marking it when it was cut. */
export const limitText = (
    value: unknown,
    max = GENERATE_TEXT_LIMIT
): string => {
    if (typeof value !== 'string' || !value) return ''
    return value.length > max ? `${value.slice(0, max)}…` : value
}

/**
 * Count the nodes a parsed draft expands to once aliases are materialized,
 * aborting as soon as the cap is passed. Shared references are deliberately NOT
 * memoized: counting them once would miss exactly the amplification this
 * guards against.
 */
const assertDraftWithinLimits = (value: unknown) => {
    let remaining = MAX_DRAFT_NODES
    let remainingContent = MAX_DRAFT_EXPANDED_CONTENT_LENGTH

    const consumeContent = (length: number) => {
        if (length > remainingContent) {
            throw new Error(
                `预设草稿展开后内容过大（超过 ${
                    MAX_DRAFT_EXPANDED_CONTENT_LENGTH / 1024 / 1024
                } MiB，可能包含 YAML 别名放大），请精简后重试。`
            )
        }
        remainingContent -= length
    }

    const walk = (node: unknown, depth: number) => {
        if (depth > MAX_DRAFT_DEPTH) {
            throw new Error('预设草稿嵌套层级过深，请精简后重试。')
        }
        if (remaining <= 0) {
            throw new Error(
                '预设草稿展开后结构过大（可能包含 YAML 别名放大），请精简后重试。'
            )
        }
        remaining -= 1

        if (typeof node === 'string') {
            consumeContent(node.length)
            return
        }
        if (node instanceof RegExp) {
            consumeContent(node.source.length)
            return
        }
        if (!node || typeof node !== 'object' || node instanceof Date) return
        if (Array.isArray(node)) {
            for (const item of node) walk(item, depth + 1)
            return
        }
        for (const [key, child] of Object.entries(
            node as Record<string, unknown>
        )) {
            consumeContent(key.length)
            walk(child, depth + 1)
        }
    }

    walk(value, 0)
}

const createWriteGuard = () => {
    let claimed = false
    let succeeded = false

    return {
        claim() {
            if (succeeded) {
                throw new Error('生成写入已成功完成，拒绝重复写入')
            }
            if (claimed) {
                throw new Error(
                    '生成写入正在进行或本轮已占用，拒绝并行重复调用'
                )
            }
            claimed = true
        },
        markSuccess() {
            succeeded = true
            claimed = true
        },
        releaseOnFailure() {
            if (!succeeded) claimed = false
        }
    }
}

const asObject = (value: unknown): YamlValue => {
    if (!isRecord(value)) {
        throw new Error('Preset YAML must be an object.')
    }
    return value
}

export const createDraftBuffer = (
    source: ChatLunaCorePresetSource,
    rawText: string
): DraftBuffer => {
    if (rawText.length > MAX_RAW_TEXT_LENGTH) {
        throw new Error(
            `预设草稿过大（超过 ${MAX_RAW_TEXT_LENGTH / 1024} KB），请精简后重试。`
        )
    }

    const text = rawText.trim()
    let data: YamlValue = {}

    if (text) {
        const loaded = load(rawText)
        data = asObject(loaded)
        assertDraftWithinLimits(data)
    }

    return {
        source,
        data,
        rawText: rawText || '',
        writeSucceeded: false,
        warnings: []
    }
}

/**
 * `noRefs: true` is load-bearing here, not boilerplate. This dumps the parsed
 * object graph as-is, so shared references coming out of `load()` would
 * otherwise be re-emitted as YAML anchors/aliases and the draft handed back to
 * the user would carry the amplification with it. It is also what makes the
 * expanded node and content budgets necessary: with `noRefs` every alias is
 * materialized, so neither input length nor node count alone bounds the output.
 * (The client's `serialize.ts#forYaml` rebuilds every object before dumping,
 * so the `noRefs` over there really is redundant — this one is not.)
 */
export const serializeDraftBuffer = (buffer: DraftBuffer): string => {
    assertDraftWithinLimits(buffer.data)
    const output =
        dump(buffer.data, {
            lineWidth: -1,
            noRefs: true,
            sortKeys: false
        }).trimEnd() + '\n'

    if (output.length > MAX_DRAFT_OUTPUT_LENGTH) {
        throw new Error(
            `预设草稿序列化结果过大（超过 ${
                MAX_DRAFT_OUTPUT_LENGTH / 1024 / 1024
            } MiB），请精简后重试。`
        )
    }
    return output
}

const assertNoSensitiveKeys = (value: unknown, pathLabel = 'root') => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
        value.forEach((item, index) =>
            assertNoSensitiveKeys(item, `${pathLabel}[${index}]`)
        )
        return
    }
    for (const [key, child] of Object.entries(
        value as Record<string, unknown>
    )) {
        if (SENSITIVE_KEY.test(key)) {
            throw new Error(`禁止写入凭证字段：${pathLabel}.${key}`)
        }
        assertNoSensitiveKeys(child, `${pathLabel}.${key}`)
    }
}

const toStringArray = (value: unknown, field: string): string[] => {
    if (!Array.isArray(value) || value.length < 1) {
        throw new Error(`${field} 必须是非空字符串数组`)
    }
    return value.map((item, index) => {
        if (typeof item !== 'string' || !item.trim()) {
            throw new Error(`${field}[${index}] 必须是非空字符串`)
        }
        return item.trim()
    })
}

const validateMainCore = (preset: YamlValue, requireFormatPrompt: boolean) => {
    const keywords = toStringArray(preset.keywords, 'keywords')
    const prompts = Array.isArray(preset.prompts) ? preset.prompts : []

    if (prompts.length < 1) {
        throw new Error('prompts 不能为空')
    }

    let hasSystem = false
    for (const [index, prompt] of prompts.entries()) {
        if (!isRecord(prompt)) {
            throw new Error(`prompts[${index}] 必须是对象`)
        }
        const role = prompt.role
        if (typeof role !== 'string' || !PROMPT_ROLE_SET.has(role)) {
            throw new Error(
                `prompts[${index}] 的 role 无效，可选值：${PROMPT_ROLES.join('、')}`
            )
        }
        if (role === 'system') hasSystem = true
        // Content is required to be a plain string here, unlike the preset
        // parser which also accepts LangChain complex-content arrays: this
        // validator only ever sees `replaceGeneratedMainPreset` output, whose
        // schema is string-only, and that tool replaces `prompts` wholesale.
        // A seeded draft's complex content is therefore discarded by a
        // successful generation — widening this check alone would not preserve
        // it, the tool schema would have to carry it through first.
        if (typeof prompt.content !== 'string' || !prompt.content.trim()) {
            throw new Error(`prompts[${index}] 缺少有效 content`)
        }
    }

    if (!hasSystem) {
        throw new Error('至少需要一条 system prompt')
    }

    const formatPrompt = preset.format_user_prompt
    if (requireFormatPrompt) {
        if (
            typeof formatPrompt !== 'string' ||
            !formatPrompt.includes('{prompt}')
        ) {
            throw new Error('format_user_prompt 必须包含 {prompt}')
        }
    } else if (
        typeof formatPrompt === 'string' &&
        formatPrompt.length > 0 &&
        !formatPrompt.includes('{prompt}')
    ) {
        throw new Error('format_user_prompt 必须包含 {prompt}')
    }

    return keywords
}

/**
 * A soft check on the generated system prompt. The generation instructions are
 * written in English, so hints match on notation the model reproduces verbatim
 * instead of on localized wording, and each carries a full readable sentence —
 * warnings are surfaced to the user as-is.
 */
interface SystemPromptHint {
    pattern: RegExp
    warning: string
}

const MARKDOWN_SYSTEM_HINTS: SystemPromptHint[] = [
    {
        pattern: /!\[/,
        warning: 'system prompt 未说明 Markdown 图片写法 ![desc](https://url)'
    },
    {
        pattern: /(?<!!)\[[^\]\n]*\]\([^)\n]*\)/,
        warning:
            'system prompt 未说明 Markdown 文件链接写法 [name](https://url)'
    },
    {
        pattern: /@\S/,
        warning: 'system prompt 未说明 @昵称 形式的提及写法'
    },
    {
        pattern: /---/,
        warning: 'system prompt 未说明使用 --- 或空行分隔多段内容'
    }
]

/**
 * Resource elements the Koishi instructions list as available but never
 * require, so a missing mention is a warning rather than a hard failure.
 */
const KOISHI_RESOURCE_TAGS = ['<img', '<at', '<file']

const KOISHI_INLINE_TAGS = [
    '<b>',
    '<strong>',
    '<i>',
    '<em>',
    '<u>',
    '<ins>',
    '<s>',
    '<del>',
    '<code>',
    '<sup>',
    '<sub>',
    '<p>'
]

const isMessageElementSequence = (content: string) => {
    const messagePattern = /<message(?:\s[^>]*)?>[\s\S]*?<\/message>/gi
    const messages = content.match(messagePattern) || []
    return messages.length > 0 && !content.replace(messagePattern, '').trim()
}

const validateMainFormat = (
    preset: YamlValue,
    format: PresetGenerateMainFormat
): string[] => {
    const prompts = Array.isArray(preset.prompts) ? preset.prompts : []
    const system = prompts
        .filter((item) => isRecord(item) && item.role === 'system')
        .map((item) => String((item as YamlValue).content ?? ''))
        .join('\n')
    // 'ai' and 'model' are assistant examples too — upstream maps all three to
    // an AIMessage, so matching only 'assistant' would reject a preset whose
    // examples the runtime reads as assistant turns.
    const assistant = prompts.filter(
        (item) =>
            isRecord(item) &&
            typeof item.role === 'string' &&
            AI_PROMPT_ROLES.has(item.role)
    ) as YamlValue[]

    if (format === 'markdown') {
        if (!system.toLowerCase().includes('markdown')) {
            throw new Error('system prompt 缺少 Markdown 输出约束')
        }
        if (assistant.length === 0) {
            throw new Error('Markdown 格式至少需要一条 assistant 示例')
        }
        if (
            assistant.some((message) =>
                /<(?:message|img|at|file)(?:\s|>)/i.test(
                    String(message.content ?? '')
                )
            )
        ) {
            throw new Error('Markdown assistant 示例不能混入 Koishi 消息元素')
        }
        return MARKDOWN_SYSTEM_HINTS.filter(
            (hint) => !hint.pattern.test(system)
        ).map((hint) => hint.warning)
    }

    // Only <message> is mandated by the Koishi instructions; the resource and
    // inline tags are merely listed as available, so their absence degrades to
    // a warning instead of burning one of the few retry steps on a hard reject.
    if (!system.includes('<message')) {
        throw new Error('Koishi 格式要求 system prompt 明确约束 <message> 元素')
    }
    if (assistant.length < 2) {
        throw new Error('Koishi 格式至少需要两条 assistant 示例')
    }
    if (
        assistant.some(
            (message) =>
                !isMessageElementSequence(String(message.content ?? ''))
        )
    ) {
        throw new Error('Koishi assistant 示例必须完全由 message 标签构成')
    }

    const warnings: string[] = []
    const missingResourceTags = KOISHI_RESOURCE_TAGS.filter(
        (tag) => !system.includes(tag)
    )
    if (missingResourceTags.length > 0) {
        warnings.push(
            `system prompt 未说明可选的资源元素：${missingResourceTags
                .map((tag) => `${tag}>`)
                .join('、')}`
        )
    }
    if (!KOISHI_INLINE_TAGS.some((tag) => system.includes(tag))) {
        warnings.push(
            'system prompt 未列出可用的行内样式标签（b/strong/i/em/u/ins/s/del/code/sup/sub/p）'
        )
    }
    return warnings
}

const validateCharacterCore = (
    preset: YamlValue,
    format: PresetGenerateCharacterFormat
) => {
    const name = typeof preset.name === 'string' ? preset.name.trim() : ''
    if (!name) throw new Error('name 不能为空')

    toStringArray(preset.nick_name, 'nick_name')

    const input = typeof preset.input === 'string' ? preset.input : ''
    const system = typeof preset.system === 'string' ? preset.system : ''
    if (!input.trim()) throw new Error('input 不能为空')
    if (!system.trim()) throw new Error('system 不能为空')

    if (
        preset.mute_keyword != null &&
        (!Array.isArray(preset.mute_keyword) ||
            preset.mute_keyword.some((item) => typeof item !== 'string'))
    ) {
        throw new Error('mute_keyword 必须是字符串数组')
    }

    if (format === 'standard') {
        const missingTags = [
            'status',
            'think',
            'action',
            'output',
            'message'
        ].filter(
            (tag) => !input.includes(`<${tag}>`) || !input.includes(`</${tag}>`)
        )
        if (missingTags.length > 0) {
            throw new Error(
                `标准格式缺少 XML 文本块：${missingTags.join(', ')}`
            )
        }
    } else if (format === 'tool-call') {
        if (input.includes('<action>') || input.includes('<output>')) {
            throw new Error(
                '工具调用格式不能包含标准格式的 action/output 文本块'
            )
        }
    }
}

const toolResult = (payload: Record<string, unknown>): string => {
    return JSON.stringify(payload)
}

const describeTool = (tool: DynamicStructuredTool): ChatLunaToolLike => ({
    name: tool.name,
    description: tool.description,
    createTool: () => tool,
    selector: () => true
})

export const createGenerateTools = (options: {
    buffer: DraftBuffer
    mainFormat?: PresetGenerateMainFormat
    characterFormat?: PresetGenerateCharacterFormat
}): GenerateToolBundle => {
    const buffer = options.buffer
    const writeGuard = createWriteGuard()

    const baseMessageSchema = z.object({
        role: z.enum(PROMPT_ROLES),
        type: z
            .enum(['personality', 'description', 'first_message', 'scenario'])
            .optional(),
        content: z.string().min(1)
    })

    const replaceMainSchema = z.object({
        keywords: z.array(z.string().min(1)).min(1),
        prompts: z.array(baseMessageSchema).min(1),
        format_user_prompt: z.string().min(1)
    })

    const replaceCharacterSchema = z.object({
        name: z.string().min(1),
        nick_name: z.array(z.string().min(1)).min(1),
        input: z.string().min(1),
        system: z.string().min(1),
        status: z.string().min(1),
        mute_keyword: z.array(z.string()).optional(),
        bot_id: z.string().optional(),
        owner_id: z.string().optional(),
        description: z.string().optional(),
        personality: z.string().optional(),
        hobbies: z.string().optional(),
        dialogue_examples: z.string().optional(),
        chat_style: z.string().optional(),
        chat_behavior: z.string().optional(),
        relationship: z.string().optional(),
        stickers: z.string().optional()
    })

    const readDraftSchema = z.object({
        source: z
            .enum(['current', 'summary'])
            .default('current')
            .describe('current = full YAML, summary = keywords/fields only')
    })

    const readDraftTool = new DynamicStructuredTool({
        name: 'readGeneratedDraft',
        description:
            'Read the current in-memory draft buffer. Use source=current for full YAML or source=summary for a short overview.',
        schema: readDraftSchema,
        func: async (input) => {
            const source = input.source === 'summary' ? 'summary' : 'current'
            if (source === 'summary') {
                if (buffer.source === 'character') {
                    return toolResult({
                        ok: true,
                        source: buffer.source,
                        name: buffer.data.name,
                        nick_name: buffer.data.nick_name,
                        hasInput: Boolean(buffer.data.input),
                        hasSystem: Boolean(buffer.data.system)
                    })
                }
                return toolResult({
                    ok: true,
                    source: buffer.source,
                    keywords: buffer.data.keywords,
                    promptCount: Array.isArray(buffer.data.prompts)
                        ? buffer.data.prompts.length
                        : 0,
                    hasFormatUserPrompt: Boolean(buffer.data.format_user_prompt)
                })
            }

            return toolResult({
                ok: true,
                source: buffer.source,
                rawText: limitText(serializeDraftBuffer(buffer))
            })
        }
    })

    const replaceMainTool = new DynamicStructuredTool({
        name: 'replaceGeneratedMainPreset',
        description:
            'Replace core main-preset fields: keywords, prompts, ' +
            'format_user_prompt. Preserves world_lores, authors_note, ' +
            'knowledge, config, version. Call exactly once.',
        schema: replaceMainSchema,
        func: async (input) => {
            assertNoSensitiveKeys(input)
            if (!options.mainFormat) {
                throw new Error(
                    'replaceGeneratedMainPreset 仅在主插件生成流程中可用'
                )
            }
            if (buffer.source !== 'core') {
                throw new Error(
                    '当前不是主插件预设，无法调用 replaceGeneratedMainPreset'
                )
            }

            writeGuard.claim()
            try {
                const keywords = Array.from(
                    new Set(toStringArray(input.keywords, 'keywords'))
                )
                const next: YamlValue = {
                    ...buffer.data,
                    keywords,
                    prompts: input.prompts,
                    format_user_prompt: input.format_user_prompt
                }
                validateMainCore(next, true)
                const warnings = validateMainFormat(next, options.mainFormat)
                buffer.data = next
                buffer.writeSucceeded = true
                buffer.warnings = warnings
                writeGuard.markSuccess()
                return toolResult({
                    ok: true,
                    message: '已生成并应用主插件预设核心字段',
                    warnings,
                    changedFields: ['keywords', 'prompts', 'format_user_prompt']
                })
            } catch (error) {
                writeGuard.releaseOnFailure()
                throw error
            }
        }
    })

    const replaceCharacterTool = new DynamicStructuredTool({
        name: 'replaceGeneratedCharacterPreset',
        description:
            'Replace character disguise fields in the in-memory draft. Always preserves path. Call exactly once.',
        schema: replaceCharacterSchema,
        func: async (input) => {
            assertNoSensitiveKeys(input)
            if (!options.characterFormat) {
                throw new Error(
                    'replaceGeneratedCharacterPreset 仅在 Character 生成流程中可用'
                )
            }
            if (buffer.source !== 'character') {
                throw new Error(
                    '当前不是伪装预设，无法调用 replaceGeneratedCharacterPreset'
                )
            }

            writeGuard.claim()
            try {
                const next: YamlValue = {
                    ...buffer.data,
                    ...input,
                    mute_keyword: Array.isArray(input.mute_keyword)
                        ? input.mute_keyword
                        : buffer.data.mute_keyword,
                    path: buffer.data.path
                }
                validateCharacterCore(next, options.characterFormat)
                buffer.data = next
                buffer.writeSucceeded = true
                buffer.warnings = []
                writeGuard.markSuccess()
                return toolResult({
                    ok: true,
                    message: '已生成并应用伪装预设',
                    changedFields: [
                        'name',
                        'nick_name',
                        'input',
                        'system',
                        'status',
                        'mute_keyword'
                    ]
                })
            } catch (error) {
                writeGuard.releaseOnFailure()
                throw error
            }
        }
    })

    const tools: ChatLunaToolLike[] = [describeTool(readDraftTool)]

    if (buffer.source === 'core') {
        tools.push(describeTool(replaceMainTool))
    } else {
        tools.push(describeTool(replaceCharacterTool))
    }

    return { tools, buffer }
}
