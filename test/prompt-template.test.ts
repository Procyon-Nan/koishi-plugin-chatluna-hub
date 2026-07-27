import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
    analyzeTemplate,
    getTemplateDefinitions
} from '../client/modules/core/preset-island/lib/prompt-template.ts'
import type {
    TemplateCompletionDefinition,
    TemplateEditorContext
} from '../client/modules/core/preset-island/lib/prompt-template.ts'

/**
 * The completion catalog is a hand-maintained data table, so these are
 * self-consistency guards: no entry may shadow another in the same context,
 * every entry must be recognized by the analyzer that ships beside it, and the
 * upstream built-ins must stay listed.
 */

/**
 * Every member of the `TemplateEditorContext` union. Types are erased at
 * runtime, so this list is pinned by hand; the `contexts` coverage case below
 * fails if a definition starts referencing a context missing from it.
 */
const ALL_CONTEXTS: TemplateEditorContext[] = [
    'prompt',
    'format-user',
    'world-lore',
    'author-note',
    'knowledge',
    'memory',
    'character-system',
    'character-input',
    'character-preset',
    'main-preset',
    'generic'
]

const ALLOWED_TYPES = new Set(['variable', 'function', 'keyword'])

/**
 * The providers ChatLuna registers in
 * `packages/core/src/services/prompt_renderer.ts`. They are registered on the
 * renderer itself, so they are available in every editing context and the
 * catalog must offer all of them everywhere.
 */
const UPSTREAM_BUILTINS = [
    'date',
    'isodate',
    'isotime',
    'pick',
    'random',
    'roll',
    'timeDiff',
    'time_UTC',
    'url',
    'weekday'
]

/** Definitions are module-level singletons, so identity dedupes the catalog. */
const collectCatalog = (): TemplateCompletionDefinition[] => {
    const seen = new Set<TemplateCompletionDefinition>()
    for (const context of ALL_CONTEXTS) {
        for (const definition of getTemplateDefinitions(context)) {
            seen.add(definition)
        }
    }
    return [...seen]
}

const contextsOf = (
    definition: TemplateCompletionDefinition
): TemplateEditorContext[] => definition.contexts ?? ALL_CONTEXTS

/** `${name}` is snippet placeholder syntax, not template syntax. */
const PLACEHOLDER = /\$\{([^}]*)\}/g

const fillPlaceholders = (snippet: string): string =>
    snippet.replace(PLACEHOLDER, '$1')

const stripPlaceholders = (snippet: string): string =>
    snippet.replace(PLACEHOLDER, '')

const countOf = (text: string, character: string): number =>
    [...text].filter((item) => item === character).length

describe('catalog entries are well formed', () => {
    test('every entry has a label and a detail', () => {
        for (const definition of collectCatalog()) {
            assert.equal(
                typeof definition.label === 'string' &&
                    definition.label.length > 0,
                true,
                `entry with detail "${definition.detail}" has no label`
            )
            assert.equal(
                typeof definition.detail === 'string' &&
                    definition.detail.length > 0,
                true,
                `entry "${definition.label}" has no detail`
            )
        }
    })

    test('every entry uses an allowed type', () => {
        for (const definition of collectCatalog()) {
            assert.equal(
                ALLOWED_TYPES.has(definition.type),
                true,
                `entry "${definition.label}" has type "${definition.type}"`
            )
        }
    })

    test('variable and function labels are usable identifiers', () => {
        for (const definition of collectCatalog()) {
            if (definition.type === 'keyword') continue
            assert.match(
                definition.label,
                /^[A-Za-z_$][A-Za-z0-9_$]*$/,
                `"${definition.label}" cannot be typed inside {}`
            )
        }
    })

    test('every keyword entry carries a snippet', () => {
        for (const definition of collectCatalog()) {
            if (definition.type !== 'keyword') continue
            assert.equal(
                typeof definition.snippet === 'string' &&
                    definition.snippet.length > 0,
                true,
                `control keyword "${definition.label}" has no snippet`
            )
        }
    })
})

describe('labels do not collide', () => {
    test('no context offers the same label twice', () => {
        for (const context of ALL_CONTEXTS) {
            const labels = getTemplateDefinitions(context).map(
                (definition) => definition.label
            )
            const duplicates = labels.filter(
                (label, index) => labels.indexOf(label) !== index
            )

            assert.deepEqual(
                [...new Set(duplicates)],
                [],
                `context "${context}" offers duplicate labels`
            )
        }
    })

    test('a label reused by several entries has disjoint context sets', () => {
        const byLabel = new Map<string, TemplateCompletionDefinition[]>()
        for (const definition of collectCatalog()) {
            const bucket = byLabel.get(definition.label) ?? []
            bucket.push(definition)
            byLabel.set(definition.label, bucket)
        }

        for (const [label, definitions] of byLabel) {
            if (definitions.length < 2) continue

            const used = new Set<TemplateEditorContext>()
            for (const definition of definitions) {
                for (const context of contextsOf(definition)) {
                    assert.equal(
                        used.has(context),
                        false,
                        `label "${label}" is declared twice for context "${context}"`
                    )
                    used.add(context)
                }
            }
        }
    })
})

describe('declared contexts are known', () => {
    test('no entry references an unknown context', () => {
        const known = new Set<string>(ALL_CONTEXTS)

        for (const definition of collectCatalog()) {
            if (definition.contexts == null) continue
            for (const context of definition.contexts) {
                assert.equal(
                    known.has(context),
                    true,
                    `entry "${definition.label}" references unknown context "${context}"`
                )
            }
        }
    })

    test('every known context is referenced by at least one entry', () => {
        const referenced = new Set<string>()
        for (const definition of collectCatalog()) {
            for (const context of definition.contexts ?? []) {
                referenced.add(context)
            }
        }

        assert.deepEqual(
            ALL_CONTEXTS.filter((context) => !referenced.has(context)),
            [],
            'a context in the union is never used by any definition'
        )
    })

    test('every context yields a non-empty completion list', () => {
        for (const context of ALL_CONTEXTS) {
            assert.ok(
                getTemplateDefinitions(context).length > 0,
                `context "${context}" offers no completions`
            )
        }
    })
})

describe('snippets are syntactically sound', () => {
    const snippetEntries = () =>
        collectCatalog().filter((definition) => definition.snippet != null)

    test('the catalog actually contains snippets to check', () => {
        assert.ok(snippetEntries().length >= 8)
    })

    test('placeholder syntax is complete', () => {
        for (const { label, snippet } of snippetEntries()) {
            const openings = snippet!.split('${').length - 1
            const matches = snippet!.match(PLACEHOLDER) ?? []

            assert.equal(
                matches.length,
                openings,
                `snippet "${label}" has an unterminated \${...} placeholder`
            )
            assert.equal(
                countOf(snippet!, '$'),
                openings,
                `snippet "${label}" has a $ that does not open a placeholder`
            )
        }
    })

    test('braces balance once the snippet is inserted after the typed {', () => {
        for (const { label, snippet } of snippetEntries()) {
            const text = `{${stripPlaceholders(snippet!)}`
            let depth = 0

            for (const character of text) {
                if (character === '{') depth += 1
                if (character === '}') depth -= 1
                assert.ok(
                    depth >= 0,
                    `snippet "${label}" closes a brace that was never opened`
                )
            }

            assert.equal(
                depth,
                0,
                `snippet "${label}" leaves ${depth} brace(s) open`
            )
        }
    })

    test('parentheses and quotes are paired', () => {
        for (const { label, snippet } of snippetEntries()) {
            const text = stripPlaceholders(snippet!)

            assert.equal(
                countOf(text, '('),
                countOf(text, ')'),
                `snippet "${label}" has unbalanced parentheses`
            )
            assert.equal(
                countOf(text, "'") % 2,
                0,
                `snippet "${label}" has an odd number of single quotes`
            )
            assert.equal(
                countOf(text, '"') % 2,
                0,
                `snippet "${label}" has an odd number of double quotes`
            )
        }
    })
})

describe('the analyzer recognizes everything the catalog offers', () => {
    test('every variable and function label analyzes as a known expression', () => {
        for (const context of ALL_CONTEXTS) {
            for (const definition of getTemplateDefinitions(context)) {
                if (definition.type === 'keyword') continue

                const ranges = analyzeTemplate(`{${definition.label}}`, context)

                assert.equal(ranges.length, 1)
                assert.equal(
                    ranges[0].kind,
                    'expression',
                    `"${definition.label}" is offered in "${context}" but the ` +
                        `analyzer reports it as "${ranges[0].kind}": ${ranges[0].message}`
                )
            }
        }
    })

    test('every snippet analyzes without an error range', () => {
        for (const context of ALL_CONTEXTS) {
            for (const definition of getTemplateDefinitions(context)) {
                if (definition.snippet == null) continue

                const source = `{${fillPlaceholders(definition.snippet)}`
                const ranges = analyzeTemplate(source, context)
                const failure = ranges.find((range) => range.kind === 'error')

                assert.equal(
                    failure,
                    undefined,
                    `snippet "${definition.label}" in "${context}" produced an ` +
                        `error: ${failure?.message} (source: ${JSON.stringify(source)})`
                )
                assert.ok(ranges.length > 0)
            }
        }
    })

    test('a control snippet opens a control range, not an expression', () => {
        for (const definition of getTemplateDefinitions('generic')) {
            if (definition.type !== 'keyword') continue

            const [first] = analyzeTemplate(
                `{${fillPlaceholders(definition.snippet!)}`,
                'generic'
            )

            assert.equal(
                first.kind,
                'control',
                `keyword "${definition.label}" did not open a control block`
            )
        }
    })

    test('a name outside the catalog is reported as unknown', () => {
        const [range] = analyzeTemplate(
            '{definitely_not_a_variable}',
            'generic'
        )

        assert.equal(range.kind, 'unknown')
    })
})

describe('upstream built-ins stay listed', () => {
    test('all ten registered providers are offered in every context', () => {
        for (const context of ALL_CONTEXTS) {
            const labels = new Set(
                getTemplateDefinitions(context).map(
                    (definition) => definition.label
                )
            )
            const missing = UPSTREAM_BUILTINS.filter(
                (name) => !labels.has(name)
            )

            assert.deepEqual(
                missing,
                [],
                `context "${context}" is missing upstream built-ins`
            )
        }
    })

    test('the pinned list still has exactly ten entries', () => {
        assert.equal(UPSTREAM_BUILTINS.length, 10)
        assert.equal(new Set(UPSTREAM_BUILTINS).size, 10)
    })

    test('the control keywords are offered in every context', () => {
        const expected = [
            'if',
            'if / else',
            'if / elseif / else',
            'for',
            'while',
            'repeat'
        ]

        for (const context of ALL_CONTEXTS) {
            const keywords = getTemplateDefinitions(context)
                .filter((definition) => definition.type === 'keyword')
                .map((definition) => definition.label)

            assert.deepEqual(keywords, expected)
        }
    })
})
