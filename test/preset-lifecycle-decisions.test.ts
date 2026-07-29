import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
    resolveGenerateDone,
    resolveSaveOutcome,
    routeGenerateEvent
} from '../client/modules/core/preset-island/lib/lifecycle-decisions.ts'
import type { DraftSession } from '../client/modules/core/preset-island/lib/types.ts'

/**
 * The preset editor's most error-prone logic is the race handling inside the
 * save and generate flows. Those decisions used to live inline in the React
 * hooks (untestable under this harness, which has no React/DOM); they have been
 * extracted into the pure functions above. These cases pin the invariants the
 * hook comments describe — every one maps to a scenario that can only lose the
 * user's work if it silently regresses.
 */

const session = (overrides: Partial<DraftSession> = {}): DraftSession => ({
    id: 'core:preset.yml',
    source: 'core',
    filename: 'preset.yml',
    structured: null,
    rawText: 'baseline',
    baselineRawText: 'baseline',
    parseError: '',
    isDraft: false,
    ...overrides
})

describe('resolveSaveOutcome', () => {
    test('a clean save installs the server session as-is', () => {
        const saved = session({ rawText: 'baseline', baselineRawText: 'baseline' })

        const result = resolveSaveOutcome({
            gen: 3,
            openGen: 3,
            local: session({ rawText: 'baseline' }),
            sent: 'baseline',
            savedSession: saved
        })

        assert.equal(result.stale, false)
        assert.equal(result.keptEditing, false)
        assert.equal(result.next, saved)
    })

    test('typing during the write merges the newer text onto the server reply', () => {
        // The server stored exactly `sent`; the user then typed one more line.
        const saved = session({ rawText: 'sent' })
        const local = session({ rawText: 'sent\n# extra', parseError: '' })

        const result = resolveSaveOutcome({
            gen: 1,
            openGen: 1,
            local,
            sent: 'sent',
            savedSession: saved
        })

        assert.equal(result.stale, false)
        assert.equal(result.keptEditing, true)
        assert.notEqual(result.next, saved)
        assert.equal(result.next!.rawText, 'sent\n# extra')
        // Id / filename / source still come from the server.
        assert.equal(result.next!.id, saved.id)
        assert.equal(result.next!.filename, saved.filename)
        // The baseline is what hit disk, so the new edit stays "dirty".
        assert.equal(result.next!.baselineRawText, 'sent')
        assert.equal(result.next!.parseError, local.parseError)
    })

    test('switching preset during the write is stale and installs nothing', () => {
        const result = resolveSaveOutcome({
            gen: 2,
            openGen: 3,
            local: session({ rawText: 'sent' }),
            sent: 'sent',
            savedSession: session()
        })

        assert.equal(result.stale, true)
        assert.equal(result.keptEditing, false)
        assert.equal(result.next, null)
    })

    test('stale takes precedence over a concurrent edit', () => {
        const result = resolveSaveOutcome({
            gen: 2,
            openGen: 5,
            local: session({ rawText: 'typed after send' }),
            sent: 'sent',
            savedSession: session()
        })

        assert.equal(result.stale, true)
        assert.equal(result.keptEditing, false)
        assert.equal(result.next, null)
    })

    test('no session open on return and not stale is a clean save', () => {
        const saved = session()

        const result = resolveSaveOutcome({
            gen: 1,
            openGen: 1,
            local: null,
            sent: 'sent',
            savedSession: saved
        })

        assert.equal(result.stale, false)
        assert.equal(result.keptEditing, false)
        assert.equal(result.next, saved)
    })
})

describe('resolveGenerateDone', () => {
    test('same preset and untouched draft applies the generated text', () => {
        const result = resolveGenerateDone({
            jobSessionId: 'core:a.yml',
            optionsSessionId: 'core:a.yml',
            jobRaw: 'r',
            optionsRaw: 'r'
        })

        assert.deepEqual(result, { apply: true, reason: null })
    })

    test('switching preset while generating discards as "switched"', () => {
        const result = resolveGenerateDone({
            jobSessionId: 'core:a.yml',
            optionsSessionId: 'core:b.yml',
            jobRaw: 'r',
            optionsRaw: 'r'
        })

        assert.deepEqual(result, { apply: false, reason: 'switched' })
    })

    test('editing the draft while generating discards as "edited"', () => {
        const result = resolveGenerateDone({
            jobSessionId: 'core:a.yml',
            optionsSessionId: 'core:a.yml',
            jobRaw: 'original',
            optionsRaw: 'edited meanwhile'
        })

        assert.deepEqual(result, { apply: false, reason: 'edited' })
    })

    test('a job that never recorded its session id never applies', () => {
        const result = resolveGenerateDone({
            jobSessionId: null,
            optionsSessionId: 'core:a.yml',
            jobRaw: 'r',
            optionsRaw: 'r'
        })

        assert.deepEqual(result, { apply: false, reason: 'switched' })
    })

    test('a missing options id does not satisfy the same-session check', () => {
        const result = resolveGenerateDone({
            jobSessionId: 'core:a.yml',
            optionsSessionId: null,
            jobRaw: 'r',
            optionsRaw: 'r'
        })

        assert.deepEqual(result, { apply: false, reason: 'switched' })
    })
})

describe('routeGenerateEvent', () => {
    test('an event without a requestId is dropped', () => {
        assert.equal(
            routeGenerateEvent({
                eventRequestId: undefined,
                generating: true,
                currentRequestId: 'abc'
            }),
            'drop'
        )
    })

    test('an event while no job is generating is dropped', () => {
        assert.equal(
            routeGenerateEvent({
                eventRequestId: 'abc',
                generating: false,
                currentRequestId: 'abc'
            }),
            'drop'
        )
    })

    test('an event arriving before the start reply is buffered', () => {
        // The "done arrives before start" path: the job is live but its server
        // id is still unknown, so the event must wait, not be applied or lost.
        assert.equal(
            routeGenerateEvent({
                eventRequestId: 'abc',
                generating: true,
                currentRequestId: null
            }),
            'buffer'
        )
    })

    test('an event from another job is dropped', () => {
        assert.equal(
            routeGenerateEvent({
                eventRequestId: 'other',
                generating: true,
                currentRequestId: 'abc'
            }),
            'drop'
        )
    })

    test('an event whose id matches the live job is applied', () => {
        assert.equal(
            routeGenerateEvent({
                eventRequestId: 'abc',
                generating: true,
                currentRequestId: 'abc'
            }),
            'apply'
        )
    })
})
