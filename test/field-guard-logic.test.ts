import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
    readBoolean,
    readNumber,
    readObject,
    readOneOf,
    shapePreview
} from '../client/modules/core/preset-island/lib/field-guard-logic.ts'

describe('scalar field readers preserve uneditable YAML shapes', () => {
    test('number fields accept only finite numbers and missing values', () => {
        assert.equal(readNumber(undefined), '')
        assert.equal(readNumber(null), '')
        assert.equal(readNumber(12), 12)
        assert.equal(readNumber({ value: 12 }), null)
        assert.equal(readNumber([12]), null)
        assert.equal(readNumber('12'), null)
        assert.equal(readNumber(Number.POSITIVE_INFINITY), null)
    })

    test('boolean fields do not coerce strings or containers', () => {
        assert.equal(readBoolean(undefined), '')
        assert.equal(readBoolean(false), false)
        assert.equal(readBoolean(true), true)
        assert.equal(readBoolean('false'), null)
        assert.equal(readBoolean({ value: false }), null)
        assert.equal(readBoolean([false]), null)
    })

    test('enum fields reject unknown values without choosing a fallback', () => {
        const allowed = ['before', 'after'] as const

        assert.equal(readOneOf(undefined, allowed), '')
        assert.equal(readOneOf('before', allowed), 'before')
        assert.equal(readOneOf('unknown', allowed), null)
        assert.equal(readOneOf(1, allowed), null)
        assert.equal(readOneOf({ value: 'before' }, allowed), null)
        assert.equal(readOneOf(['before'], allowed), null)
    })

    test('mapping fields reject Date instances and accept null-prototype maps', () => {
        const mapping = Object.create(null) as Record<string, unknown>
        mapping.kept = true

        assert.equal(readObject(new Date('2025-03-04T05:06:07.000Z')), null)
        assert.equal(readObject(mapping), mapping)
    })
})

describe('shapePreview stays within its traversal budget', () => {
    test('a large string is truncated while it is being read', () => {
        const preview = shapePreview(`head-${'x'.repeat(10_000)}-tail`, 24)

        assert.equal(preview.length, 25)
        assert.equal(preview.endsWith('…'), true)
        assert.equal(preview.includes('tail'), false)
    })

    test('cyclic values render a marker instead of throwing', () => {
        const value: Record<string, unknown> = { name: 'root' }
        value.self = value

        assert.match(shapePreview(value), /\[Circular\]/)
    })

    test('later properties are not read after the budget is exhausted', () => {
        let laterWasRead = false
        const value: Record<string, unknown> = {
            first: 'x'.repeat(100)
        }
        Object.defineProperty(value, 'later', {
            enumerable: true,
            get() {
                laterWasRead = true
                throw new Error('later getter must not run')
            }
        })

        assert.equal(shapePreview(value, 20).endsWith('…'), true)
        assert.equal(laterWasRead, false)
    })
})
