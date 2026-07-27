import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
    createDraftSession,
    draftAsListItem
} from '../client/modules/core/preset-island/lib/draft-store.ts'
import type { PresetSource } from '../client/modules/core/preset-island/lib/types.ts'

/**
 * The sidebar row for an open draft: keywords (or the character name) plus a
 * section/prompt count.
 *
 * `draftAsListItem` reads those from the parsed structure and falls back to the
 * raw-text scraper in `yaml.ts` only when the document has no structure at all,
 * i.e. when it failed to parse. That fallback is a regex over the text, so it
 * can see a block sequence and nothing else: every scalar and inline-array form
 * below rendered an empty keyword list while the scraper was the only source.
 *
 * Cases here drive the public `createDraftSession` → `draftAsListItem` path, the
 * one the workspace hook uses; `structuredListHints` itself is module-private.
 */

const hintsFor = (source: PresetSource, rawText: string) => {
    const session = createDraftSession(source, rawText, 'draft.yml')
    const item = draftAsListItem(session)

    return {
        parseError: session.parseError,
        keywords: item.keywords,
        promptCount: item.promptCount
    }
}

describe('core keyword hints read every YAML shape, not just block lists', () => {
    test('a scalar keywords value is listed', () => {
        assert.deepEqual(hintsFor('core', 'keywords: 猫娘\n').keywords, [
            '猫娘'
        ])
    })

    test('an inline array is listed', () => {
        assert.deepEqual(hintsFor('core', 'keywords: [猫娘, cat]\n').keywords, [
            '猫娘',
            'cat'
        ])
    })

    test('a comma-separated scalar is split into items', () => {
        assert.deepEqual(hintsFor('core', 'keywords: 猫娘,cat\n').keywords, [
            '猫娘',
            'cat'
        ])
    })

    test('a block list still resolves the same way', () => {
        assert.deepEqual(
            hintsFor('core', 'keywords:\n  - 猫娘\n  - cat\n').keywords,
            ['猫娘', 'cat']
        )
    })

    // Parsing preserves a malformed shape instead of trimming it, so the list
    // row is one of the places that has to cope with a non-list value.
    test('a mapping yields no keywords instead of throwing', () => {
        assert.deepEqual(hintsFor('core', 'keywords:\n  a: 1\n').keywords, [])
    })

    test('a non-text element is skipped while its siblings are listed', () => {
        assert.deepEqual(
            hintsFor('core', 'keywords: [猫娘, {a: 1}]\n').keywords,
            ['猫娘']
        )
    })
})

describe('core promptCount comes from the parsed prompts array', () => {
    const TWO_PROMPTS = `
keywords: [x]
prompts:
  - role: system
    content: a
  - role: user
    content: b
`

    test('each prompt row counts once', () => {
        const hints = hintsFor('core', TWO_PROMPTS)

        assert.equal(hints.promptCount, 2)
    })

    test('a malformed prompts value counts as zero', () => {
        const hints = hintsFor('core', 'keywords: [x]\nprompts: oops\n')

        assert.equal(hints.promptCount, 0)
    })
})

describe('character hints label the row with the name', () => {
    test('the name becomes the single label', () => {
        assert.deepEqual(hintsFor('character', 'name: 小助手\n').keywords, [
            '小助手'
        ])
    })

    // The scraper read `name:` plus the next line's text, so a mapping name
    // produced the label 'a: 1'. Only a string is renderable as a label.
    test('a mapping name yields no label rather than a scraped fragment', () => {
        const hints = hintsFor('character', 'name:\n  a: 1\ninput: 输入\n')

        assert.deepEqual(hints.keywords, [])
    })
})

describe('character promptCount counts filled sections only', () => {
    const FOUR_SECTION_KEYS = `
name: 小助手
input: 输入
system: 系统
mute_keyword: [闭嘴]
output: ''
`

    // Parsing always writes `input` and `system`, so counting key presence would
    // put every character preset at 2 before the user typed anything.
    test('name plus input counts one section', () => {
        assert.equal(
            hintsFor('character', 'name: 小助手\ninput: 输入\n').promptCount,
            1
        )
    })

    test('a section present but empty is not counted', () => {
        assert.equal(
            hintsFor('character', 'name: 小助手\ninput: 输入\nsystem:\n')
                .promptCount,
            1
        )
    })

    test('four section keys with three filled count three', () => {
        const hints = hintsFor('character', FOUR_SECTION_KEYS)

        assert.equal(hints.promptCount, 3)
    })

    test('a name-only draft counts no sections', () => {
        assert.equal(hintsFor('character', 'name: 小助手\n').promptCount, 0)
    })
})

describe('a document that fails to parse falls back to the text scraper', () => {
    // An unterminated double-quoted scalar: js-yaml throws, so the session has
    // no structure at all and the row has nothing but the text to work from.
    const BROKEN_BLOCK_KEYWORDS = `
keywords:
  - 猫娘
prompts:
  - role: system
    content: "unclosed
`

    const BROKEN_SCALAR_KEYWORDS = `
keywords: 猫娘
prompts:
  - role: system
    content: "unclosed
`

    test('a broken core document still shows scraped hints', () => {
        const hints = hintsFor('core', BROKEN_BLOCK_KEYWORDS)

        assert.match(hints.parseError, /YAML 解析失败/)
        assert.deepEqual(hints.keywords, ['猫娘'])
        assert.equal(hints.promptCount, 1)
    })

    // Proof that this really is the scraper and not the structure: a scalar
    // keywords resolves in the structured path but is invisible to the regex, so
    // an empty list here is what identifies the branch that ran. It also records
    // the cost of the fallback, which is the reason it is the fallback.
    test('the fallback keeps the scraper blind spot for scalar keywords', () => {
        const hints = hintsFor('core', BROKEN_SCALAR_KEYWORDS)

        assert.match(hints.parseError, /YAML 解析失败/)
        assert.deepEqual(hints.keywords, [])
        assert.equal(hints.promptCount, 1)
    })

    test('a broken character document still shows the scraped name', () => {
        const hints = hintsFor('character', 'name: 小助手\ninput: "unclosed\n')

        assert.match(hints.parseError, /YAML 解析失败/)
        assert.deepEqual(hints.keywords, ['小助手'])
        assert.equal(hints.promptCount, 1)
    })
})
