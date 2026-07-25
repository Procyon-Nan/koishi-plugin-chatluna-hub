/**
 * In-memory DraftBuffer + ChatLuna StructuredTool factories for one-click
 * preset generation. Tools never touch the filesystem.
 */
import { DynamicStructuredTool } from '@langchain/core/tools'
import { dump, load } from 'js-yaml'
import { z } from 'zod'
import { isRecord } from '../shared'
import type { ChatLunaCorePresetSource } from './preset-files'
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
    description?: string
    createTool: (params: { embeddings?: unknown }) => unknown
    selector: () => boolean
}

type YamlValue = Record<string, unknown>

const SENSITIVE_KEY =
    /^(api[_-]?key|api[_-]?token|api[_-]?url|token|password|secret)$/i

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
        },
        get hasSucceeded() {
            return succeeded
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
    const text = rawText.trim()
    let data: YamlValue = {}

    if (text) {
        const loaded = load(rawText)
        data = asObject(loaded)
    }

    return {
        source,
        data,
        rawText: rawText || '',
        writeSucceeded: false,
        warnings: []
    }
}

export const serializeDraftBuffer = (buffer: DraftBuffer): string => {
    return (
        dump(buffer.data, {
            lineWidth: -1,
            noRefs: true,
            sortKeys: false
        }).trimEnd() + '\n'
    )
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
        if (
            role !== 'system' &&
            role !== 'user' &&
            role !== 'assistant' &&
            role !== 'human' &&
            role !== 'ai' &&
            role !== 'model'
        ) {
            throw new Error(`prompts[${index}] 的 role 无效`)
        }
        if (role === 'system') hasSystem = true
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
    const assistant = prompts.filter(
        (item) => isRecord(item) && item.role === 'assistant'
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
        return ['![', '[文件名]', '@昵称', '---'].filter(
            (rule) => !system.includes(rule)
        )
    }

    const coreTags = ['<message', '<img', '<at', '<file']
    const missingCoreTags = coreTags.filter((tag) => !system.includes(tag))
    if (missingCoreTags.length > 0) {
        throw new Error(
            `Koishi 核心元素规则不完整：${missingCoreTags.join(', ')}`
        )
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
    return [
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
    ].filter((tag) => !system.includes(tag))
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

export const createGenerateTools = (options: {
    buffer: DraftBuffer
    mainFormat?: PresetGenerateMainFormat
    characterFormat?: PresetGenerateCharacterFormat
}): GenerateToolBundle => {
    const buffer = options.buffer
    const writeGuard = createWriteGuard()

    const baseMessageSchema = z.object({
        role: z.enum(['system', 'user', 'assistant']),
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
                rawText: serializeDraftBuffer(buffer)
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
                buffer.rawText = serializeDraftBuffer(buffer)
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
            if ('path' in input) {
                throw new Error('不允许修改 path')
            }

            writeGuard.claim()
            try {
                const next: YamlValue = {
                    ...buffer.data,
                    ...input,
                    mute_keyword: Array.isArray(input.mute_keyword)
                        ? input.mute_keyword
                        : [],
                    path: buffer.data.path
                }
                validateCharacterCore(next, options.characterFormat)
                buffer.data = next
                buffer.rawText = serializeDraftBuffer(buffer)
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

    const tools: ChatLunaToolLike[] = [
        {
            name: 'readGeneratedDraft',
            description:
                'Read the current in-memory draft buffer. Use source=current for full YAML or source=summary for a short overview.',
            createTool: () => readDraftTool,
            selector: () => true
        }
    ]

    if (buffer.source === 'core') {
        tools.push({
            name: 'replaceGeneratedMainPreset',
            description:
                'Replace core main-preset fields: keywords, prompts, ' +
                'format_user_prompt. Preserves world_lores, authors_note, ' +
                'knowledge, config, version. Call exactly once.',
            createTool: () => replaceMainTool,
            selector: () => true
        })
    } else {
        tools.push({
            name: 'replaceGeneratedCharacterPreset',
            description:
                'Replace character disguise fields in the in-memory draft. Always preserves path. Call exactly once.',
            createTool: () => replaceCharacterTool,
            selector: () => true
        })
    }

    return { tools, buffer }
}
