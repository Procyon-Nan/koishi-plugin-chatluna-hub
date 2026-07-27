import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { load } from 'js-yaml'

import {
    GENERATE_TEXT_LIMIT,
    createDraftBuffer,
    limitText,
    serializeDraftBuffer
} from '../src/webui/core/preset-generate-tools.ts'

/**
 * Guards on the draft ingestion path of the one-click generation flow.
 *
 * `createDraftBuffer` and `serializeDraftBuffer` are the public entries to the
 * private raw, node, depth, expanded-content and output limits, so every case
 * drives a real request path rather than the guards in isolation.
 *
 * Why a byte cap alone is not enough: `load()` keeps a YAML alias as a shared
 * reference, so parsing is cheap, but `serializeDraftBuffer` dumps with
 * `noRefs: true`, which materializes every reference. The expansion grows
 * exponentially with alias depth while the text grows linearly with it, so a
 * sub-kilobyte document can encode a billion nodes.
 */

const RAW_TEXT_LIMIT = 512 * 1024
const NODE_LIMIT = 200_000
const EXPANDED_CONTENT_LIMIT = 8 * 1024 * 1024

/** `l0` holds plain scalars; every later level aliases the previous one. */
const buildAliasBomb = (levels: number, fanOut: number): string => {
    const lines = [`l0: &l0 [${Array(fanOut).fill('x').join(',')}]`]
    for (let level = 1; level < levels; level += 1) {
        const refs = Array(fanOut)
            .fill(`*l${level - 1}`)
            .join(',')
        lines.push(`l${level}: &l${level} [${refs}]`)
    }
    lines.push(`root: *l${levels - 1}`)
    return `${lines.join('\n')}\n`
}

const buildNestedSequence = (depth: number): string =>
    `root: ${'['.repeat(depth)}1${']'.repeat(depth)}\n`

const buildLongScalarAliasBomb = (): string => {
    const scalar = 'x'.repeat(300_000)
    const aliases = Array(30).fill('*shared').join(', ')
    return `shared: &shared ${scalar}\ncopies: [${aliases}]\n`
}

const buildLongKeyAliasBomb = (): string => {
    const key = 'k'.repeat(1000)
    const aliases = Array(9000).fill('*shared').join(', ')
    return `shared: &shared\n  ${key}: x\ncopies: [${aliases}]\n`
}

const REALISTIC_CORE_PRESET = `
keywords: [助手, assistant, 小助手]
version: 1.0
format_user_prompt: '{sender}: {prompt}'
prompts:
  - role: system
    content: |-
      你是一个乐于助人的中文助手。
      回答要简洁、准确，不要编造事实。
      当你不确定时，请直接说明。
    type: personality
  - role: user
    content: 你好
  - role: assistant
    content: 你好，有什么可以帮你的吗？
world_lores:
  - scanDepth: 3
    recursiveScan: true
  - keywords: [北境, north]
    content: 北境常年积雪，居民以狩猎为生。
    insertPosition: before_char_defs
    order: 10
authors_note:
  content: 保持角色一致性。
  insertPosition: in_chat
  insertDepth: 3
knowledge:
  knowledge: [handbook, faq]
  prompt: 参考资料如下
config:
  longMemoryPrompt: 以下是长期记忆
  postHandler:
    prefix: '<message>'
    postfix: '</message>'
`

const REALISTIC_CHARACTER_PRESET = `
name: 小助手
nick_name: [小助, 助手]
status: 在线
input: |-
  <status>{status}</status>
  <think>思考内容</think>
  <message>{prompt}</message>
system: |-
  你是群聊中的一个角色，名字叫小助手。
  请以自然的口吻参与对话。
bot_id: 3345618715
mute_keyword: [闭嘴, 安静]
description: 一个用于测试的角色
`

describe('raw text size cap', () => {
    test('a draft one character over the cap is rejected', () => {
        const oversized = `note: ${'a'.repeat(RAW_TEXT_LIMIT)}`

        assert.ok(oversized.length > RAW_TEXT_LIMIT)
        assert.throws(
            () => createDraftBuffer('core', oversized),
            /预设草稿过大/
        )
    })

    test('a draft exactly at the cap is accepted', () => {
        const exact = `note: ${'a'.repeat(RAW_TEXT_LIMIT - 7)}\n`

        assert.equal(exact.length, RAW_TEXT_LIMIT)
        const buffer = createDraftBuffer('core', exact)
        assert.equal(String(buffer.data.note).length, RAW_TEXT_LIMIT - 7)
    })
})

describe('YAML alias amplification is rejected, not expanded', () => {
    test('js-yaml itself accepts the bomb, so the guard is what stops it', () => {
        const bomb = buildAliasBomb(7, 10)
        const loaded = load(bomb) as Record<string, unknown>

        // Proof the parser is not the protection: it returns instantly because
        // aliases stay shared references rather than being materialized.
        assert.equal(loaded.l6, loaded.root)
        assert.ok(Array.isArray(loaded.root))
    })

    test('a 10^7-node alias bomb is rejected by the node cap', () => {
        const bomb = buildAliasBomb(7, 10)

        assert.ok(
            bomb.length < 1024,
            `bomb should stay tiny, was ${bomb.length} bytes`
        )
        assert.throws(() => createDraftBuffer('core', bomb), /结构过大/)
    })

    test('a ~10^9-node alias bomb under 1 KB is rejected in bounded time', () => {
        const bomb = buildAliasBomb(15, 4)
        const expandedNodes = 4 ** 15

        assert.ok(bomb.length < 1024)
        assert.ok(expandedNodes > 1e9)

        const startedAt = Date.now()
        assert.throws(() => createDraftBuffer('core', bomb), /结构过大/)
        const elapsed = Date.now() - startedAt

        // The walk aborts at MAX_DRAFT_NODES, so its cost is bounded by the cap
        // and not by the bomb's expansion. Anything that actually materialized
        // 10^9 nodes would exhaust memory long before this bound.
        assert.ok(
            elapsed < 5000,
            `guard must abort at the cap, took ${elapsed}ms`
        )
    })

    test('the rejection message names the alias amplification cause', () => {
        assert.throws(() => createDraftBuffer('core', buildAliasBomb(7, 10)), {
            message: /YAML 别名放大/
        })
    })

    test('long aliased strings are charged on every expanded path', () => {
        const bomb = buildLongScalarAliasBomb()

        assert.ok(bomb.length < RAW_TEXT_LIMIT)
        assert.throws(() => createDraftBuffer('core', bomb), /展开后内容过大/)
    })

    test('long object keys are charged on every expanded path', () => {
        const bomb = buildLongKeyAliasBomb()

        assert.ok(bomb.length < 128 * 1024)
        assert.throws(() => createDraftBuffer('core', bomb), /展开后内容过大/)
    })
})

describe('node count cap', () => {
    test('a plain draft over the node cap is rejected without any alias', () => {
        const wide = `root: [${Array(NODE_LIMIT + 5)
            .fill('1')
            .join(',')}]\n`

        assert.ok(
            wide.length < RAW_TEXT_LIMIT,
            'this case must be rejected by the node cap, not the byte cap'
        )
        assert.equal(wide.includes('*'), false)
        assert.throws(() => createDraftBuffer('core', wide), /结构过大/)
    })

    test('a plain draft under the node cap is accepted', () => {
        const wide = `root: [${Array(100_000).fill('1').join(',')}]\n`

        const buffer = createDraftBuffer('core', wide)
        assert.equal((buffer.data.root as unknown[]).length, 100_000)
    })
})

describe('nesting depth cap', () => {
    test('a draft nested past the depth cap is rejected', () => {
        assert.throws(
            () => createDraftBuffer('core', buildNestedSequence(70)),
            /嵌套层级过深/
        )
    })

    test('a deeply but legally nested draft is accepted', () => {
        const buffer = createDraftBuffer('core', buildNestedSequence(60))

        assert.ok(Array.isArray(buffer.data.root))
    })

    test('the depth guard reports depth, not size', () => {
        const deep = buildNestedSequence(70)

        assert.ok(deep.length < 1024)
        assert.throws(() => createDraftBuffer('core', deep), {
            message: /嵌套层级过深/
        })
    })
})

describe('legitimate drafts are not rejected', () => {
    test('a realistic core preset passes', () => {
        const buffer = createDraftBuffer('core', REALISTIC_CORE_PRESET)

        assert.deepEqual(buffer.data.keywords, ['助手', 'assistant', '小助手'])
        assert.equal((buffer.data.prompts as unknown[]).length, 3)
        assert.equal(buffer.writeSucceeded, false)
        assert.deepEqual(buffer.warnings, [])
    })

    test('a realistic character preset passes', () => {
        const buffer = createDraftBuffer(
            'character',
            REALISTIC_CHARACTER_PRESET
        )

        assert.equal(buffer.data.name, '小助手')
        assert.equal(buffer.data.bot_id, 3345618715)
    })

    test('an empty draft yields an empty object without parsing', () => {
        const buffer = createDraftBuffer('core', '   \n  ')

        assert.deepEqual(buffer.data, {})
        assert.equal(buffer.rawText, '   \n  ')
    })

    test('a large but ordinary preset passes', () => {
        // 300 lore entries with 400-character bodies: ~130 KB and ~2000 nodes,
        // i.e. far past what a human writes by hand yet nowhere near the caps.
        const entries = Array.from(
            { length: 300 },
            (_unused, index) =>
                `  - keywords: [关键词${index}]\n` +
                `    content: ${'设定内容。'.repeat(80)}\n` +
                `    order: ${index}\n`
        ).join('')
        const large = `keywords: [big]\nworld_lores:\n${entries}`

        assert.ok(large.length > 100_000)
        assert.ok(large.length < RAW_TEXT_LIMIT)

        const buffer = createDraftBuffer('core', large)
        assert.equal((buffer.data.world_lores as unknown[]).length, 300)
    })

    test('a 400 KiB ordinary scalar parses and serializes', () => {
        const large = `note: ${'x'.repeat(400 * 1024)}\n`
        const buffer = createDraftBuffer('core', large)
        const dumped = serializeDraftBuffer(buffer)

        assert.equal(String(buffer.data.note).length, 400 * 1024)
        assert.ok(dumped.length < EXPANDED_CONTENT_LIMIT)
    })

    test('a non-object root is rejected as malformed', () => {
        assert.throws(
            () => createDraftBuffer('core', 'just a string\n'),
            /must be an object/
        )
    })
})

describe('serializeDraftBuffer emits no aliases', () => {
    test('a shared reference is expanded instead of aliased', () => {
        const buffer = createDraftBuffer(
            'core',
            'keywords: [x]\nshared: &s {tone: 正式}\ncopy: *s\n'
        )

        // Unlike the client serializer, this one dumps buffer.data directly,
        // so `noRefs: true` is the only thing breaking the shared reference.
        assert.equal(buffer.data.shared, buffer.data.copy)

        const dumped = serializeDraftBuffer(buffer)
        assert.doesNotMatch(dumped, /[&*]ref_\d/)

        const reloaded = load(dumped) as Record<string, unknown>
        assert.deepEqual(reloaded.shared, reloaded.copy)
        assert.notEqual(reloaded.shared, reloaded.copy)
    })

    test('output ends with exactly one trailing newline', () => {
        const buffer = createDraftBuffer('core', 'keywords: [x]\n')
        const dumped = serializeDraftBuffer(buffer)

        assert.equal(dumped.endsWith('\n'), true)
        assert.equal(dumped.endsWith('\n\n'), false)
    })

    test('a post-parse expanded string graph is rejected before dumping', () => {
        const buffer = createDraftBuffer('core', 'keywords: [x]\n')
        const scalar = 'x'.repeat(300_000)
        buffer.data.copies = Array(30).fill(scalar)

        assert.throws(() => serializeDraftBuffer(buffer), /展开后内容过大/)
    })

    test('actual dumped output is checked after escaping', () => {
        const buffer = createDraftBuffer('core', 'keywords: [x]\n')
        buffer.data.escaped = '\u0001'.repeat(2_200_000)

        assert.throws(() => serializeDraftBuffer(buffer), /序列化结果过大/)
    })
})

describe('limitText', () => {
    test('text within the budget is untouched', () => {
        assert.equal(limitText('短文本'), '短文本')
    })

    test('text past the budget is truncated and marked', () => {
        const truncated = limitText('a'.repeat(GENERATE_TEXT_LIMIT + 10))

        assert.equal(truncated.length, GENERATE_TEXT_LIMIT + 1)
        assert.equal(truncated.endsWith('…'), true)
    })

    test('a custom budget is honoured', () => {
        assert.equal(limitText('abcdef', 3), 'abc…')
    })

    test('non-string input becomes an empty string', () => {
        assert.equal(limitText(undefined), '')
        assert.equal(limitText(123), '')
        assert.equal(limitText(''), '')
    })
})
