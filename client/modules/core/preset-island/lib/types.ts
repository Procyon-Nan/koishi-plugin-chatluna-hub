import type {
    ChatLunaCorePresetCreateInput,
    ChatLunaCorePresetDeleteInput,
    ChatLunaCorePresetDetail,
    ChatLunaCorePresetGetInput,
    ChatLunaCorePresetListItem,
    ChatLunaCorePresetListResult,
    ChatLunaCorePresetSource,
    ChatLunaCorePresetUpdateInput
} from '../../types'
import type { StructuredPreset } from './preset-types'

export type PresetSource = ChatLunaCorePresetSource
export type PresetListItem = ChatLunaCorePresetListItem
export type PresetDetail = ChatLunaCorePresetDetail
export type PresetListResult = ChatLunaCorePresetListResult
export type PresetCreateInput = ChatLunaCorePresetCreateInput
export type PresetUpdateInput = ChatLunaCorePresetUpdateInput
export type PresetDeleteInput = ChatLunaCorePresetDeleteInput
export type PresetGetInput = ChatLunaCorePresetGetInput

export interface DraftSession {
    id: string
    source: PresetSource
    filename: string
    /** Last successfully parsed structured draft; kept when YAML parse fails. */
    structured: StructuredPreset | null
    rawText: string
    baselineRawText: string
    parseError: string
    isDraft: boolean
}

export interface PresetIslandOptions {
    /** Optional custom RPC invoke; defaults to @koishijs/client send. */
    invoke?: <T = unknown>(event: string, payload?: unknown) => Promise<T>
}
