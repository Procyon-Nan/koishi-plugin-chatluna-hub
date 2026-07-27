import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { dump, load } from 'js-yaml'

import {
    emptyCharacterPreset,
    emptyCorePreset,
    newCharacterPresetDraft,
    newCorePresetDraft,
    promptContentPreview
} from '../client/modules/core/preset-island/lib/preset-types.ts'
import {
    parsePresetYaml,
    serializePresetData,
    setAtPath
} from '../client/modules/core/preset-island/lib/serialize.ts'
import {
    applyStructuredPatch,
    createDraftSession,
    isStructuredEditingBlocked
} from '../client/modules/core/preset-island/lib/draft-store.ts'
import type { PresetSource } from '../client/modules/core/preset-island/lib/types.ts'
import type { StructuredPreset } from '../client/modules/core/preset-island/lib/preset-types.ts'

/**
 * Regression suite for the "form edit silently corrupts the user's preset file"
 * class of bug: every case below fails against the pre-fix normalizer.
 *
 * The reference for what a preset may legally contain is ChatLuna itself:
 * `packages/core/src/llm-core/prompt/preset_prompt_parse.ts` (accepted roles,
 * complex message content) and `packages/core/src/llm-core/prompt/type.ts`
 * (`isRoleBook` / `isRoleBookConfig` splitting `world_lores`).
 */

type Loose = Record<string, any>

const parseOk = (text: string, source: PresetSource): Loose => {
    const outcome = parsePresetYaml(text, source)
    if (!outcome.ok) {
        assert.fail(`expected a successful parse, got: ${outcome.error}`)
    }
    return outcome.data as Loose
}

const parseFail = (text: string, source: PresetSource): string => {
    const outcome = parsePresetYaml(text, source)
    if (outcome.ok) {
        assert.fail(
            `expected a parse failure, got: ${JSON.stringify(outcome.data)}`
        )
    }
    return outcome.error
}

/** parse → serialize → parse, the exact path a form edit + save takes. */
const roundTrip = (text: string, source: PresetSource) => {
    const first = parseOk(text, source)
    const dumped = serializePresetData(first as StructuredPreset, source)
    const second = parseOk(dumped, source)
    return { first, dumped, second }
}

describe('prompt roles survive the round-trip', () => {
    // ChatLuna maps assistant/ai/model -> AIMessage, user/human -> HumanMessage,
    // system -> SystemMessage. The pre-fix normalizer kept only user/assistant
    // and collapsed ai/model/human/system into 'system'.
    const ROLES_YAML = `
keywords: [role-test]
prompts:
  - role: system
    content: 系统提示
  - role: user
    content: 用户提示
  - role: assistant
    content: 助手提示
  - role: ai
    content: ai 提示
  - role: model
    content: model 提示
  - role: human
    content: human 提示
`

    test('all six roles ChatLuna accepts are kept verbatim', () => {
        const data = parseOk(ROLES_YAML, 'core')

        assert.deepEqual(
            data.prompts.map((prompt: Loose) => prompt.role),
            ['system', 'user', 'assistant', 'ai', 'model', 'human']
        )
    })

    test('roles are still intact after serialize + re-parse', () => {
        const { second } = roundTrip(ROLES_YAML, 'core')

        assert.deepEqual(
            second.prompts.map((prompt: Loose) => prompt.role),
            ['system', 'user', 'assistant', 'ai', 'model', 'human']
        )
        assert.deepEqual(
            second.prompts.map((prompt: Loose) => prompt.content),
            [
                '系统提示',
                '用户提示',
                '助手提示',
                'ai 提示',
                'model 提示',
                'human 提示'
            ]
        )
    })

    test('an unsupported role remains visible to the guarded form', () => {
        const { first, second } = roundTrip(
            'prompts:\n  - role: wizard\n    content: x\n',
            'core'
        )

        assert.equal(first.prompts[0].role, 'wizard')
        assert.equal(second.prompts[0].role, 'wizard')
    })

    test('a missing role still receives the required system default', () => {
        const data = parseOk('prompts:\n  - content: x\n', 'core')

        assert.equal(data.prompts[0].role, 'system')
    })
})

describe('complex message content survives the round-trip', () => {
    // A LangChain MessageContentComplex[]. The pre-fix normalizer required a
    // string and replaced anything else with '', destroying the image part.
    const COMPLEX_YAML = `
keywords: [vision]
prompts:
  - role: user
    content:
      - type: text
        text: 请描述这张图片
      - type: image_url
        image_url:
          url: https://example.com/a.png
          detail: high
`

    const EXPECTED_CONTENT = [
        { type: 'text', text: '请描述这张图片' },
        {
            type: 'image_url',
            image_url: { url: 'https://example.com/a.png', detail: 'high' }
        }
    ]

    test('the content array is kept verbatim', () => {
        const data = parseOk(COMPLEX_YAML, 'core')

        assert.deepEqual(data.prompts[0].content, EXPECTED_CONTENT)
    })

    test('the content array survives serialize + re-parse', () => {
        const { second, dumped } = roundTrip(COMPLEX_YAML, 'core')

        assert.deepEqual(second.prompts[0].content, EXPECTED_CONTENT)
        assert.match(dumped, /image_url/)
    })

    test('a non-text content shape is kept for the guarded form fallback', () => {
        const data = parseOk(
            'prompts:\n  - role: user\n    content:\n      nested: 1\n',
            'core'
        )

        assert.deepEqual(data.prompts[0].content, { nested: 1 })
    })

    test('non-string role and content scalars survive the round-trip', () => {
        const { first, second } = roundTrip(
            'prompts:\n  - role:\n      vendor: custom\n    content: 42\n',
            'core'
        )

        assert.deepEqual(first.prompts[0].role, { vendor: 'custom' })
        assert.equal(first.prompts[0].content, 42)
        assert.deepEqual(second.prompts[0], first.prompts[0])
    })

    test('a malformed complex-content part has a safe read-only preview', () => {
        assert.equal(
            promptContentPreview([
                null,
                7,
                { type: 'text', text: 'kept' },
                { type: 'image_url' },
                { vendor: true }
            ]),
            '[unknown]\n[unknown]\nkept\n[image_url]\n[unknown]'
        )
    })
})

describe('world_lores keeps the global config element intact', () => {
    // ChatLuna's isRoleBook() treats an element carrying BOTH keywords and
    // content as a lore entry; anything else is the global lore config. The
    // pre-fix normalizer injected keywords: [] and content: '' into every
    // element, turning the config element into an empty junk entry.
    const LORE_YAML = `
keywords: [lore-test]
world_lores:
  - scanDepth: 3
    recursiveScan: true
    maxRecursionDepth: 2
    tokenLimit: 1000
  - keywords: [魔法, magic]
    content: 这个世界的魔法体系说明
    insertPosition: before_char_defs
    enabled: true
`

    test('the config element gains neither keywords nor content', () => {
        const [config] = parseOk(LORE_YAML, 'core').world_lores

        assert.equal(
            'keywords' in config,
            false,
            'keywords must not be injected into the global lore config'
        )
        assert.equal(
            'content' in config,
            false,
            'content must not be injected into the global lore config'
        )
        assert.deepEqual(config, {
            scanDepth: 3,
            recursiveScan: true,
            maxRecursionDepth: 2,
            tokenLimit: 1000
        })
    })

    test('a real lore entry is still normalized', () => {
        const [, entry] = parseOk(LORE_YAML, 'core').world_lores

        assert.deepEqual(entry.keywords, ['魔法', 'magic'])
        assert.equal(entry.content, '这个世界的魔法体系说明')
        assert.equal(entry.insertPosition, 'before_char_defs')
        assert.equal(entry.enabled, true)
    })

    test('the split survives serialize + re-parse', () => {
        const { second } = roundTrip(LORE_YAML, 'core')

        assert.equal('keywords' in second.world_lores[0], false)
        assert.equal('content' in second.world_lores[0], false)
        assert.deepEqual(second.world_lores[1].keywords, ['魔法', 'magic'])
    })

    test('string keywords stay a string instead of becoming an array', () => {
        const data = parseOk(
            'world_lores:\n  - keywords: 单个关键词\n    content: 内容\n',
            'core'
        )

        assert.equal(data.world_lores[0].keywords, '单个关键词')
    })
})

describe('numeric scalars are not dropped', () => {
    test('an unquoted core version stays a number', () => {
        const data = parseOk('version: 1.0\nkeywords: [x]\n', 'core')

        assert.equal(data.version, 1)
        assert.equal(typeof data.version, 'number')
    })

    test('a quoted core version stays a string', () => {
        const data = parseOk("version: '2.0'\nkeywords: [x]\n", 'core')

        assert.equal(data.version, '2.0')
        assert.equal(typeof data.version, 'string')
    })

    test('numeric bot_id / owner_id survive on a character preset', () => {
        const data = parseOk(
            'name: 小助手\ninput: i\nsystem: s\nbot_id: 3345618715\nowner_id: 123\n',
            'character'
        )

        assert.equal(data.bot_id, 3345618715)
        assert.equal(typeof data.bot_id, 'number')
        assert.equal(data.owner_id, 123)
        assert.equal(typeof data.owner_id, 'number')
    })

    test('numeric ids survive serialize + re-parse', () => {
        const { second, dumped } = roundTrip(
            'name: 小助手\ninput: i\nsystem: s\nbot_id: 3345618715\n',
            'character'
        )

        assert.equal(second.bot_id, 3345618715)
        assert.equal(typeof second.bot_id, 'number')
        assert.match(dumped, /bot_id: 3345618715/)
    })

    test('a numeric required text field keeps its value as text', () => {
        const data = parseOk('name: 12345\ninput: i\nsystem: s\n', 'character')

        assert.equal(data.name, '12345')
    })
})

describe('unknown keys survive the round-trip', () => {
    const EXTRA_YAML = `
keywords: [extras]
prompts:
  - role: system
    content: 内容
    weight: 5
    custom_flag: true
    x_vendor:
      nested: value
extra_root: 顶层未知字符串
extra_object:
  a: 1
  b: [2, 3]
`

    test('unknown top-level keys are kept', () => {
        const data = parseOk(EXTRA_YAML, 'core')

        assert.equal(data.extra_root, '顶层未知字符串')
        assert.deepEqual(data.extra_object, { a: 1, b: [2, 3] })
    })

    test('unknown keys on a prompt element are kept', () => {
        const [prompt] = parseOk(EXTRA_YAML, 'core').prompts

        assert.equal(prompt.weight, 5)
        assert.equal(prompt.custom_flag, true)
        assert.deepEqual(prompt.x_vendor, { nested: 'value' })
    })

    test('both survive serialize + re-parse', () => {
        const { second } = roundTrip(EXTRA_YAML, 'core')

        assert.equal(second.extra_root, '顶层未知字符串')
        assert.deepEqual(second.extra_object, { a: 1, b: [2, 3] })
        assert.equal(second.prompts[0].weight, 5)
        assert.equal(second.prompts[0].custom_flag, true)
        assert.deepEqual(second.prompts[0].x_vendor, { nested: 'value' })
    })

    test('unknown keys on a character preset are kept', () => {
        const data = parseOk(
            'name: n\ninput: i\nsystem: s\nvendor_field: 保留我\n',
            'character'
        )

        assert.equal(data.vendor_field, '保留我')
    })
})

describe('known keys holding an unexpected value are not deleted', () => {
    test('a numeric format_user_prompt is kept as-is', () => {
        const data = parseOk('keywords: [x]\nformat_user_prompt: 123\n', 'core')

        assert.equal(data.format_user_prompt, 123)
    })

    test('a boolean knowledge value is kept as-is', () => {
        const data = parseOk('keywords: [x]\nknowledge: false\n', 'core')

        assert.equal(data.knowledge, false)
    })

    test('a numeric character status is kept as-is', () => {
        const data = parseOk(
            'name: n\ninput: i\nsystem: s\nstatus: 42\n',
            'character'
        )

        assert.equal(data.status, 42)
    })

    test('the rescued scalar survives serialize + re-parse', () => {
        const { second } = roundTrip(
            'keywords: [x]\nformat_user_prompt: 123\n',
            'core'
        )

        assert.equal(second.format_user_prompt, 123)
    })

    // The earlier trade-off — rescue scalars, drop a malformed object/array
    // because the form cannot render one — has been replaced by "the normalizer
    // deletes nothing". Shape trimming is now the components' job: they read
    // every field through the `isRenderable*` guards in preset-types, so an
    // unrenderable value stops at the form instead of being erased from the file.
    test('a malformed object/array on a known key is kept as-is', () => {
        const data = parseOk('keywords: [x]\nauthors_note: [1, 2, 3]\n', 'core')

        assert.deepEqual(data.authors_note, [1, 2, 3])
    })
})

/**
 * The two describes below are two halves of one boundary, and they are written
 * apart on purpose: the first pins the shapes the normalizer must NOT touch, the
 * second pins the rewrites it must still perform. Widening either rule without
 * looking at the other is how this file gets broken, so a change that makes one
 * group pass by breaking the other is the failure these cases exist to report.
 */
describe('shapes the normalizer cannot express are kept verbatim', () => {
    // Same "delete nothing" decision as above, applied to the keys that are
    // written unconditionally. `keepDroppedValues` cannot rescue those — they are
    // always present in the output — so the guard runs before the conversion and
    // hands the original value back when the shape does not fit.
    test('a mapping in keywords is kept instead of becoming []', () => {
        const data = parseOk('keywords:\n  a: 1\n', 'core')

        assert.deepEqual(data.keywords, { a: 1 })
    })

    test('a scalar prompts is kept instead of becoming a prompt row', () => {
        const data = parseOk('prompts: oops\n', 'core')

        assert.equal(data.prompts, 'oops')
    })

    test('a mapping in a required character text field is kept', () => {
        const data = parseOk('name:\n  a: 1\ninput:\n  a: 1\n', 'character')

        assert.deepEqual(data.name, { a: 1 })
        assert.deepEqual(data.input, { a: 1 })
    })

    test('an array in system is kept instead of becoming an empty string', () => {
        const data = parseOk('name: n\nsystem:\n  - a\n', 'character')

        assert.deepEqual(data.system, ['a'])
    })

    test('a mapping in nick_name or mute_keyword is kept', () => {
        const data = parseOk(
            'name: n\nnick_name:\n  a: 1\nmute_keyword:\n  a: 1\n',
            'character'
        )

        assert.deepEqual(data.nick_name, { a: 1 })
        assert.deepEqual(data.mute_keyword, { a: 1 })
    })

    // What the group is ultimately for: a document the form cannot render is
    // still written back byte for byte, so opening and saving it is a no-op.
    test('a malformed core document round-trips byte-identically', () => {
        const text = 'keywords:\n  a: 1\nprompts: oops\n'
        const { first, second, dumped } = roundTrip(text, 'core')

        assert.equal(dumped, text)
        assert.deepEqual(second, first)
    })

    test('a malformed character document round-trips byte-identically', () => {
        const text =
            'name:\n  a: 1\nnick_name:\n  b: 2\ninput: 输入\nsystem: 系统\n'
        const { first, second, dumped } = roundTrip(text, 'character')

        assert.equal(dumped, text)
        assert.deepEqual(second, first)
    })
})

describe('conversions the normalizer is still expected to make', () => {
    test('a comma-separated keywords scalar becomes an array', () => {
        assert.deepEqual(parseOk('keywords: a,b\n', 'core').keywords, [
            'a',
            'b'
        ])
    })

    test('a lone keywords scalar becomes a single-item array', () => {
        assert.deepEqual(parseOk('keywords: 5\n', 'core').keywords, ['5'])
    })

    test('an empty keywords key becomes an empty array', () => {
        // YAML reads a valueless key as null, which means "no value" rather than
        // "a value of a shape we must preserve".
        assert.deepEqual(parseOk('keywords:\n', 'core').keywords, [])
    })

    // The text-side twin of the `name:\n  a: 1` case above: a scalar can be
    // rendered as text without inventing or losing anything, a mapping cannot.
    test('a numeric name becomes text', () => {
        const data = parseOk('name: 123\ninput: i\nsystem: s\n', 'character')

        assert.equal(data.name, '123')
    })
})

describe('an array with a non-scalar element is kept whole', () => {
    // `String({ a: 1 })` is '[object Object]' — a rewrite, not a drop, so no
    // later layer can undo it and the diff shows a plausible-looking string
    // instead of a hole. The element check that prevents it lives in the list
    // guard, shared by all four fields that convert to a string array: core
    // `keywords`, `nick_name`, `mute_keyword`, and `world_lores[].keywords`.
    test('keywords holding a mapping element is kept as-is', () => {
        const data = parseOk('keywords:\n  - a: 1\n', 'core')

        assert.deepEqual(data.keywords, [{ a: 1 }])
    })

    test('nick_name and mute_keyword behave the same way', () => {
        const data = parseOk(
            'name: n\nnick_name:\n  - a: 1\nmute_keyword:\n  - a: 1\n',
            'character'
        )

        assert.deepEqual(data.nick_name, [{ a: 1 }])
        assert.deepEqual(data.mute_keyword, [{ a: 1 }])
    })

    test('one bad element does not rewrite its good siblings', () => {
        const data = parseOk('keywords: [猫娘, {a: 1}]\n', 'core')

        assert.deepEqual(data.keywords, ['猫娘', { a: 1 }])
    })

    // The fourth conversion site, and the one that used to convert unguarded:
    // a lore entry's keywords went straight through the string coercion, so a
    // per-keyword mapping (a regex rule, a vendor extension) was rewritten.
    test('world_lores keywords holding a mapping element is kept as-is', () => {
        const data = parseOk(
            'world_lores:\n  - keywords: [北境, {regex: ^hi$}]\n    content: 内容\n',
            'core'
        )

        assert.deepEqual(data.world_lores[0].keywords, [
            '北境',
            { regex: '^hi$' }
        ])
    })

    test('a mapping in world_lores keywords is kept instead of becoming []', () => {
        const data = parseOk(
            'world_lores:\n  - keywords:\n      a: 1\n    content: 内容\n',
            'core'
        )

        assert.deepEqual(data.world_lores[0].keywords, { a: 1 })
    })

    // Anchored on the source bytes rather than on `roundTrip`: this corruption
    // happens during the parse, so `first` already carries it and comparing a
    // re-parse against it would only prove the damage is stable. The file the
    // user opened is the sole independent witness.
    test('a lore keyword mapping survives back into the saved file', () => {
        const text = `keywords: []
prompts: []
world_lores:
  - keywords:
      - 北境
      - regex: ^hi$
    content: 北境常年积雪。
`
        const data = parseOk(text, 'core')
        const dumped = serializePresetData(data as StructuredPreset, 'core')

        assert.equal(dumped, text)
        assert.doesNotMatch(dumped, /\[object Object\]/)
    })

    test('an all-scalar world_lores keywords list is still coerced', () => {
        const data = parseOk(
            'world_lores:\n  - keywords: [1, 北境]\n    content: 内容\n',
            'core'
        )

        assert.deepEqual(data.world_lores[0].keywords, ['1', '北境'])
    })

    // The other side of that guard: element-wise checking must not turn into
    // "never convert an array".
    test('an all-scalar array is still coerced to strings', () => {
        assert.deepEqual(parseOk('keywords: [1, 2]\n', 'core').keywords, [
            '1',
            '2'
        ])
    })

    test('a null element counts as missing, not as a foreign shape', () => {
        assert.deepEqual(parseOk('keywords:\n  - a\n  -\n', 'core').keywords, [
            'a'
        ])
    })
})

describe('empty input yields an empty preset, never a placeholder draft', () => {
    test('empty core text parses to the empty core preset', () => {
        const data = parseOk('', 'core')

        assert.deepEqual(data, { keywords: [], prompts: [] })
        assert.deepEqual(data, emptyCorePreset())
    })

    test('whitespace-only core text parses to the empty core preset', () => {
        const data = parseOk('   \n\t \n', 'core')

        // Compared against a literal, not against emptyCorePreset(): asserting
        // the factory against itself would hold whatever the factory returns.
        assert.deepEqual(data, { keywords: [], prompts: [] })
        assert.deepEqual(data, emptyCorePreset())
    })

    test('empty core text does not produce the new-draft placeholder', () => {
        const data = parseOk('', 'core')

        assert.notDeepEqual(data, newCorePresetDraft())
        assert.equal(data.keywords.includes('new-preset'), false)
    })

    test('empty character text parses to the empty character preset', () => {
        const data = parseOk('', 'character')

        assert.deepEqual(data, {
            name: '',
            nick_name: [],
            input: '',
            system: ''
        })
        assert.deepEqual(data, emptyCharacterPreset())
    })

    test('empty character text does not produce the new-draft placeholder', () => {
        const data = parseOk('', 'character')

        assert.notDeepEqual(data, newCharacterPresetDraft())
        assert.equal(data.name.includes('new-character'), false)
    })

    // The placeholder factories still exist for the "create a new file" button;
    // they simply must not be reachable from parsing an existing document.
    test('the new-draft factories still return placeholder content', () => {
        assert.deepEqual(newCorePresetDraft().keywords, ['new-preset'])
        assert.equal(newCharacterPresetDraft().name, 'new-character')
    })
})

describe('parse → serialize → parse is stable', () => {
    const RICH_CORE_YAML = `
keywords: [助手, assistant]
version: 1.0
format_user_prompt: '{sender}: {prompt}'
prompts:
  - role: system
    content: 你是一个助手。
    type: personality
  - role: human
    content: 你好
  - role: ai
    content: 你好，有什么可以帮你的？
  - role: user
    content:
      - type: text
        text: 看看这个
      - type: image_url
        image_url:
          url: https://example.com/b.png
world_lores:
  - scanDepth: 2
    recursiveScan: false
  - keywords: [北境]
    content: 北境常年积雪。
    order: 10
authors_note:
  content: 保持简洁。
  insertPosition: in_chat
  insertDepth: 3
knowledge:
  knowledge: [handbook]
  prompt: 参考资料如下
config:
  longMemoryPrompt: 长期记忆
  postHandler:
    prefix: '<'
    postfix: '>'
    censor: false
vendor_extension:
  keep: me
`

    const RICH_CHARACTER_YAML = `
name: 小助手
nick_name: [小助, 助手]
status: 在线
input: |-
  <status>{status}</status>
  <message>{prompt}</message>
system: 你是群聊中的一个角色。
bot_id: 3345618715
owner_id: 123456
mute_keyword: [闭嘴, 安静]
description: 一个测试角色
vendor_extension: 保留
`

    test('a rich core preset is byte-stable after one normalization', () => {
        const { first, second, dumped } = roundTrip(RICH_CORE_YAML, 'core')

        assert.deepEqual(second, first)
        assert.equal(
            serializePresetData(second as StructuredPreset, 'core'),
            dumped,
            'a second serialize must reproduce the same YAML'
        )
    })

    test('the rich core preset keeps its distinctive values', () => {
        const { second } = roundTrip(RICH_CORE_YAML, 'core')

        assert.deepEqual(
            second.prompts.map((prompt: Loose) => prompt.role),
            ['system', 'human', 'ai', 'user']
        )
        assert.equal(second.prompts[0].type, 'personality')
        assert.equal(second.prompts[3].content[1].type, 'image_url')
        assert.equal(second.version, 1)
        assert.equal('keywords' in second.world_lores[0], false)
        assert.deepEqual(second.vendor_extension, { keep: 'me' })
        assert.equal(second.authors_note.insertDepth, 3)
        assert.equal(second.config.postHandler.prefix, '<')
    })

    test('a rich character preset is byte-stable after one normalization', () => {
        const { first, second, dumped } = roundTrip(
            RICH_CHARACTER_YAML,
            'character'
        )

        assert.deepEqual(second, first)
        assert.equal(
            serializePresetData(second as StructuredPreset, 'character'),
            dumped
        )
        assert.equal(second.bot_id, 3345618715)
        assert.deepEqual(second.nick_name, ['小助', '助手'])
        assert.equal(second.vendor_extension, '保留')
    })
})

describe('__proto__ and timestamp values survive normalization', () => {
    const SPECIAL_VALUES_YAML = `
"__proto__":
  top: kept
vendor_extension:
  "__proto__":
    nested: kept
  created_at: 2025-03-04T05:06:07.000Z
prompts: []
`

    test('top-level and nested __proto__ remain own data properties', () => {
        const { first, second } = roundTrip(SPECIAL_VALUES_YAML, 'core')

        for (const data of [first, second]) {
            assert.equal(Object.hasOwn(data, '__proto__'), true)
            assert.deepEqual(data.__proto__, { top: 'kept' })
            assert.equal(
                Object.hasOwn(data.vendor_extension, '__proto__'),
                true
            )
            assert.deepEqual(data.vendor_extension.__proto__, {
                nested: 'kept'
            })
        }
        assert.equal((Object.prototype as Loose).top, undefined)
        assert.equal((Object.prototype as Loose).nested, undefined)
    })

    test('a structured field edit does not drop either __proto__ property', () => {
        const session = createDraftSession(
            'core',
            SPECIAL_VALUES_YAML,
            'special.yml'
        )
        const next = applyStructuredPatch(session, 'keywords', ['updated'])
        const data = parseOk(next.rawText, 'core')

        assert.equal(next.parseError, '')
        assert.equal(Object.hasOwn(data, '__proto__'), true)
        assert.deepEqual(data.__proto__, { top: 'kept' })
        assert.equal(Object.hasOwn(data.vendor_extension, '__proto__'), true)
        assert.deepEqual(data.vendor_extension.__proto__, { nested: 'kept' })
    })

    test('setting a nested __proto__ path creates data, not a prototype', () => {
        const data = setAtPath({} as Loose, 'vendor.__proto__.flag', 'kept')

        assert.equal(Object.hasOwn(data.vendor, '__proto__'), true)
        assert.deepEqual(data.vendor.__proto__, { flag: 'kept' })
        assert.equal((Object.prototype as Loose).flag, undefined)
    })

    test('timestamp values keep their instant across the round-trip', () => {
        const { first, second } = roundTrip(SPECIAL_VALUES_YAML, 'core')
        const before = first.vendor_extension.created_at
        const after = second.vendor_extension.created_at

        assert.ok(before instanceof Date)
        assert.ok(after instanceof Date)
        assert.equal(after.getTime(), before.getTime())
    })

    test('a timestamp on a known mapping key is preserved as data', () => {
        const { first, second } = roundTrip(
            'config: 2025-03-04T05:06:07.000Z\nprompts: []\n',
            'core'
        )

        assert.ok(first.config instanceof Date)
        assert.ok(second.config instanceof Date)
        assert.equal(second.config.getTime(), first.config.getTime())
    })
})

describe('YAML anchors are expanded, never re-emitted as aliases', () => {
    const ANCHOR_YAML = `
keywords: [anchors]
shared_block: &shared
  tone: 正式
  length: 简短
copy_block: *shared
prompts:
  - role: system
    content: &line 共享的一行
  - role: user
    content: *line
`

    test('the parsed data really does hold a shared reference', () => {
        const data = parseOk(ANCHOR_YAML, 'core')

        assert.equal(
            data.shared_block,
            data.copy_block,
            'js-yaml keeps an alias as the same object; this is the input the ' +
                'serializer has to defuse'
        )
        assert.match(
            dump(data, { noRefs: false }),
            /[&*]ref_\d/,
            'a plain dump of that data would emit an anchor/alias pair'
        )
    })

    test('the serialized output contains no anchor or alias', () => {
        const data = parseOk(ANCHOR_YAML, 'core')
        const dumped = serializePresetData(data as StructuredPreset, 'core')

        assert.doesNotMatch(dumped, /[&*]ref_\d/)
        assert.doesNotMatch(dumped, /^\s*\w+:\s*[&*]\S/m)
    })

    test('re-parsing yields equal but independent copies', () => {
        const { second } = roundTrip(ANCHOR_YAML, 'core')

        assert.deepEqual(second.shared_block, second.copy_block)
        assert.notEqual(
            second.shared_block,
            second.copy_block,
            'the two blocks must be independent objects after the round-trip'
        )
        assert.equal(second.prompts[0].content, '共享的一行')
        assert.equal(second.prompts[1].content, '共享的一行')
    })
})

/**
 * `load()` keeps a YAML alias as a shared reference, so parsing stays linear in
 * the document, but `serializePresetData` rebuilds every object it walks and so
 * materializes each reference once per path reaching it. The expansion grows
 * exponentially with alias depth while the text grows linearly: a sub-kilobyte
 * file can encode a billion nodes and freeze the browser tab on the first form
 * edit. The server-side twin of this suite is `test/preset-generate-tools.test.ts`.
 */
describe('YAML alias amplification is rejected, not expanded', () => {
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

    test('js-yaml itself accepts the bomb, so the guard is what stops it', () => {
        const bomb = buildAliasBomb(7, 10)
        const loaded = dump(load(bomb) as Loose, { noRefs: false })

        // Proof the parser is not the protection: it returns instantly, and
        // re-dumping with references intact stays tiny. Only materialization
        // pays the expansion.
        assert.ok(
            loaded.length < 4096,
            `re-dump stayed at ${loaded.length} bytes`
        )
    })

    test('a 10^6-node bomb under 1 KB is rejected by the node cap', () => {
        const bomb = buildAliasBomb(7, 10)

        assert.ok(
            bomb.length < 1024,
            `bomb should stay tiny, was ${bomb.length} bytes`
        )
        assert.match(parseFail(bomb, 'core'), /结构过大/)
    })

    test('the rejection names the alias amplification cause', () => {
        assert.match(parseFail(buildAliasBomb(7, 10), 'core'), /YAML 别名放大/)
    })

    test('long aliased strings are charged on every expanded path', () => {
        const bomb = buildLongScalarAliasBomb()

        assert.ok(bomb.length < 512 * 1024)
        assert.match(parseFail(bomb, 'core'), /展开后内容过大/)
    })

    test('long object keys are charged on every expanded path', () => {
        const bomb = buildLongKeyAliasBomb()

        assert.ok(bomb.length < 128 * 1024)
        assert.match(parseFail(bomb, 'core'), /展开后内容过大/)
    })

    test('a ~10^9-node bomb is rejected in bounded time', () => {
        const bomb = buildAliasBomb(15, 4)

        assert.ok(bomb.length < 1024)
        assert.ok(4 ** 15 > 1e9)

        const startedAt = Date.now()
        const error = parseFail(bomb, 'core')
        const elapsed = Date.now() - startedAt

        assert.match(error, /结构过大/)
        // Counting aborts at the cap, so the cost is bounded by the cap and not
        // by the expansion. An implementation that totalled the nodes first
        // would itself have to materialize 10^9 of them to answer.
        assert.ok(
            elapsed < 5000,
            `guard must abort at the cap, took ${elapsed}ms`
        )
    })

    test('a rejected document yields no structure, so its text is kept', () => {
        const outcome = parsePresetYaml(buildAliasBomb(15, 4), 'core')

        // The zero-data-loss contract: an over-budget document is reported like
        // any other parse failure, so the caller keeps `rawText` verbatim and
        // only the structured form is blocked. Nothing is trimmed or dropped.
        assert.equal(outcome.ok, false)
        assert.equal('data' in outcome, false)
    })

    test('nesting past the depth cap is reported, not stack-overflowed', () => {
        const deep = `root: ${'['.repeat(200)}1${']'.repeat(200)}\n`

        assert.match(parseFail(deep, 'core'), /嵌套层级过深/)
    })

    // The other side of the cap: it targets amplification, not aliases, so a
    // document whose expansion fits the budget must still work exactly as
    // before — see the anchor group above for the full behaviour.
    test('an aliased document within the caps still parses and serializes', () => {
        const modest = buildAliasBomb(8, 2)
        const data = parseOk(modest, 'core')
        const dumped = serializePresetData(data as StructuredPreset, 'core')

        assert.equal(data.root.length, 2)
        assert.doesNotMatch(dumped, /[&*]ref_\d/)
    })

    test('a 600 KiB ordinary preset remains below the expanded budget', () => {
        const rawText = `prompts: []\nnote: ${'x'.repeat(600 * 1024)}\n`
        const data = parseOk(rawText, 'core')
        const dumped = serializePresetData(data as StructuredPreset, 'core')

        assert.equal(data.note.length, 600 * 1024)
        assert.ok(dumped.length < EXPANDED_CONTENT_LIMIT)
    })

    test('the direct serializer rejects a post-parse expanded string graph', () => {
        const scalar = 'x'.repeat(300_000)
        const data = {
            keywords: [],
            prompts: [],
            copies: Array(30).fill(scalar)
        } as unknown as StructuredPreset

        assert.throws(() => serializePresetData(data, 'core'), /展开后内容过大/)
    })

    test('actual dumped output is checked after escaping', () => {
        const data = {
            keywords: [],
            prompts: [],
            escaped: '\u0001'.repeat(2_200_000)
        } as unknown as StructuredPreset

        assert.throws(() => serializePresetData(data, 'core'), /序列化结果过大/)
    })
})

describe('structured write-back failure is non-destructive', () => {
    test('raw text and structure stay unchanged and editing becomes locked', () => {
        const session = createDraftSession(
            'core',
            'keywords: [safe]\nprompts: []\n',
            'safe.yml'
        )
        const next = applyStructuredPatch(
            session,
            'oversized',
            'x'.repeat(8 * 1024 * 1024 + 1)
        )

        assert.equal(next.rawText, session.rawText)
        assert.equal(next.structured, session.structured)
        assert.match(next.parseError, /结构化写回失败.*展开后内容过大/)
        assert.equal(isStructuredEditingBlocked(next), true)
    })
})

describe('malformed input is reported instead of silently emptied', () => {
    test('broken YAML returns a parse error', () => {
        const error = parseFail('keywords: [unclosed\n', 'core')

        assert.match(error, /YAML 解析失败/)
    })

    test('a scalar root is rejected', () => {
        assert.match(
            parseFail('just a string\n', 'core'),
            /根节点必须是键值映射/
        )
    })

    test('an array root is rejected', () => {
        assert.match(parseFail('- a\n- b\n', 'core'), /根节点必须是键值映射/)
    })
})
