import assert from 'node:assert/strict'
import { test } from 'node:test'

/**
 * Existence proof for the test setup: this file only passes if Node strips the
 * TypeScript annotations below and the runner picks up `test/**\/*.test.ts`.
 * Real cases live in sibling files; see readme.md in this directory.
 */
test('runner executes TypeScript sources', () => {
    const sum: number = 1 + 1

    assert.equal(sum, 2)
})
