import type { DraftSession } from './types'

/**
 * Pure decision extracted from `usePresetPersistence.saveSession`. The save flow
 * races against two independent user actions — opening another preset, and
 * keeping typing in the same one — and this function turns four snapshots taken
 * around the await into the verdict the hook acts on. Holding it here, away from
 * the side effects, is what lets the race be unit-tested without React.
 *
 *  - `gen` / `openGen`: the editor's generation counter captured before the
 *    request and re-read after. A mismatch means the editor moved to another
 *    preset while the write was in flight.
 *  - `sent`: the exact bytes written. Anything typed after this is newer than
 *    the file, so the server reply must not replace it.
 *  - `local`: the session on screen once the reply lands.
 */
export interface SaveOutcome {
    stale: boolean
    keptEditing: boolean
    /** The session to install, or `null` when stale (another preset is open). */
    next: DraftSession | null
}

export function resolveSaveOutcome(args: {
    gen: number
    openGen: number
    local: DraftSession | null
    sent: string
    savedSession: DraftSession
}): SaveOutcome {
    const stale = args.gen !== args.openGen
    const keptEditing =
        !stale && !!args.local && args.local.rawText !== args.sent

    const next = stale
        ? null
        : keptEditing && args.local
            ? {
                  ...args.savedSession,
                  // Id / filename / source come from the server; the text and
                  // its parse state stay the user's, and the baseline is what
                  // was written — so `dirty` and 还原 both refer to the file
                  // that now exists on disk.
                  structured: args.local.structured,
                  rawText: args.local.rawText,
                  parseError: args.local.parseError,
                  baselineRawText: args.sent
              }
            : args.savedSession

    return { stale, keptEditing, next }
}

export type GenerateDoneReason = 'switched' | 'edited'

export interface GenerateDoneOutcome {
    apply: boolean
    reason: GenerateDoneReason | null
}

/**
 * Pure decision extracted from the `done` branch of
 * `usePresetGenerate.applyEvent`. A `done` event may arrive after the user
 * switched preset or kept typing, and the generated text must overwrite the
 * draft only when neither happened. Comparing both the session id and the raw
 * text is what stops a late completion from clobbering the user's keystrokes.
 */
export function resolveGenerateDone(args: {
    jobSessionId: string | null
    optionsSessionId: string | null
    jobRaw: string | null
    optionsRaw: string | null
}): GenerateDoneOutcome {
    const stillSameSession =
        !!args.jobSessionId &&
        args.jobSessionId === (args.optionsSessionId ?? null)
    const draftWasNotEdited = args.jobRaw === args.optionsRaw

    if (stillSameSession && draftWasNotEdited) {
        return { apply: true, reason: null }
    }
    return {
        apply: false,
        reason: stillSameSession ? 'edited' : 'switched'
    }
}

export type GenerateEventRoute = 'drop' | 'buffer' | 'apply'

/**
 * Pure decision extracted from `usePresetGenerate.handleGenerateEvent`. A
 * broadcast event for any client's job reaches this hook; the routing here
 * decides whether to drop it, hold it until the start reply reveals this job's
 * server id, or apply it. Extracted so the "event arrives before the start
 * reply" path is unit-testable.
 */
export function routeGenerateEvent(args: {
    eventRequestId: string | undefined
    generating: boolean
    currentRequestId: string | null
}): GenerateEventRoute {
    if (!args.eventRequestId) return 'drop'
    if (!args.generating) return 'drop'
    if (args.currentRequestId === null) return 'buffer'
    if (args.currentRequestId !== args.eventRequestId) return 'drop'
    return 'apply'
}
