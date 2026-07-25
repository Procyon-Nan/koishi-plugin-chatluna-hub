import { send } from '@koishijs/client'
import type {
    ChatLunaCoreModelListResult,
    ChatLunaCorePresetGenerateCancelInput,
    ChatLunaCorePresetGenerateCancelResult,
    ChatLunaCorePresetGenerateStartInput,
    ChatLunaCorePresetGenerateStartResult
} from '../../types'
import type {
    PresetCreateInput,
    PresetDeleteInput,
    PresetDetail,
    PresetGetInput,
    PresetListResult,
    PresetUpdateInput
} from './types'

export type HubInvoke = <T = unknown>(
    event: string,
    payload?: unknown
) => Promise<T>

const defaultInvoke: HubInvoke = async (event, payload) => {
    const invoke = send as (
        type: string,
        ...args: unknown[]
    ) => Promise<unknown>
    return (await invoke(
        event,
        ...(payload === undefined ? [] : [payload])
    )) as never
}

export interface PresetHubApi {
    list(): Promise<PresetListResult>
    get(input: PresetGetInput): Promise<PresetDetail>
    create(input: PresetCreateInput): Promise<PresetDetail>
    update(input: PresetUpdateInput): Promise<PresetDetail>
    delete(input: PresetDeleteInput): Promise<{ success: true }>
    listModels(): Promise<ChatLunaCoreModelListResult>
    startGenerate(
        input: ChatLunaCorePresetGenerateStartInput
    ): Promise<ChatLunaCorePresetGenerateStartResult>
    cancelGenerate(
        input: ChatLunaCorePresetGenerateCancelInput
    ): Promise<ChatLunaCorePresetGenerateCancelResult>
}

export const createPresetHubApi = (
    invoke: HubInvoke = defaultInvoke
): PresetHubApi => ({
    list: () => invoke('chatluna-hub/core/presets/list'),
    get: (input) => invoke('chatluna-hub/core/presets/get', input),
    create: (input) => invoke('chatluna-hub/core/presets/create', input),
    update: (input) => invoke('chatluna-hub/core/presets/update', input),
    delete: (input) => invoke('chatluna-hub/core/presets/delete', input),
    listModels: () => invoke('chatluna-hub/core/models/list'),
    startGenerate: (input) =>
        invoke('chatluna-hub/core/presets/generate/start', input),
    cancelGenerate: (input) =>
        invoke('chatluna-hub/core/presets/generate/cancel', input)
})
