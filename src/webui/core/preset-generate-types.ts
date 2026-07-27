import type { ChatLunaCorePresetSource } from './preset-files'

export type PresetGenerateMainFormat = 'markdown' | 'koishi'
export type PresetGenerateCharacterFormat = 'tool-call' | 'standard'
export type PresetGenerateFormat =
    | PresetGenerateMainFormat
    | PresetGenerateCharacterFormat

export type PresetGenerateEventKind =
    | 'token'
    | 'step'
    | 'done'
    | 'error'
    | 'aborted'

export interface ChatLunaCorePresetGenerateStartInput {
    /**
     * Ignored by the server, which always allocates its own id and returns it
     * in {@link ChatLunaCorePresetGenerateStartResult}. That keeps the cancel
     * handle unguessable and collision-free, but it does not isolate clients
     * from each other: the id is broadcast with every progress event and cancel
     * does not check the caller. See `startChatLunaCorePresetGenerate`.
     */
    requestId?: string
    /** Model fullName, e.g. `openai/gpt-4o`. */
    model: string
    source: ChatLunaCorePresetSource
    format: PresetGenerateFormat
    /** Full current draft YAML snapshot (works for draft: ids). */
    rawText: string
}

export interface ChatLunaCorePresetGenerateStartResult {
    requestId: string
}

export interface ChatLunaCorePresetGenerateCancelInput {
    requestId: string
}

export interface ChatLunaCorePresetGenerateCancelResult {
    ok: true
}

export interface ChatLunaCorePresetGenerateEventBase {
    requestId: string
    kind: PresetGenerateEventKind
}

export interface ChatLunaCorePresetGenerateTokenEvent extends ChatLunaCorePresetGenerateEventBase {
    kind: 'token'
    token: string
}

export interface ChatLunaCorePresetGenerateStepEvent extends ChatLunaCorePresetGenerateEventBase {
    kind: 'step'
    stepType: string
    summary: string
}

export interface ChatLunaCorePresetGenerateDoneEvent extends ChatLunaCorePresetGenerateEventBase {
    kind: 'done'
    rawText: string
    warnings?: string[]
}

export interface ChatLunaCorePresetGenerateErrorEvent extends ChatLunaCorePresetGenerateEventBase {
    kind: 'error'
    error: string
}

export interface ChatLunaCorePresetGenerateAbortedEvent extends ChatLunaCorePresetGenerateEventBase {
    kind: 'aborted'
}

export type ChatLunaCorePresetGenerateEvent =
    | ChatLunaCorePresetGenerateTokenEvent
    | ChatLunaCorePresetGenerateStepEvent
    | ChatLunaCorePresetGenerateDoneEvent
    | ChatLunaCorePresetGenerateErrorEvent
    | ChatLunaCorePresetGenerateAbortedEvent
