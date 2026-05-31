/**
 * Type definitions for the ChatLuna adapter management feature, shared between
 * the read (list) and write (mutation) paths and the RPC contract.
 */

/**
 * The credential shape an adapter config uses:
 * - api-endpoint-enabled: apiKeys = [apiKey, apiEndpoint, enabled][]（多数海外平台）
 * - api-enabled:          apiKeys = [apiKey, enabled][]（国内单凭据平台，无 endpoint）
 * - endpoint-enabled:     apiEndpoints = [apiEndpoint, enabled][]（ollama，无 apiKey）
 * - opaque:               结构特殊，本页仅只读展示，引导至原生配置（dify、spark）
 */
export type ChatLunaAdapterCredentialKind =
    | 'api-endpoint-enabled'
    | 'api-enabled'
    | 'endpoint-enabled'
    | 'opaque'

export interface ChatLunaAdapterDescriptor {
    id: string
    title: string
    pluginName: string
    platformDefault: string
    platformConfigurable: boolean
    credentialKind: ChatLunaAdapterCredentialKind
    credentialField: string
    endpointPlaceholder?: string
}

export interface ChatLunaAdapterCredentialEntry {
    apiKey: string
    apiEndpoint: string
    enabled: boolean
}

export type ChatLunaAdapterStatus =
    | 'running'
    | 'configured'
    | 'available'
    | 'unsupported'

export interface ChatLunaAdapterInstance {
    /** 以条目的 activeKey（去除 ~ 前缀）作为稳定唯一标识。 */
    instanceKey: string
    adapterId: string
    title: string
    pluginName: string
    credentialKind: ChatLunaAdapterCredentialKind
    platformConfigurable: boolean
    endpointPlaceholder?: string
    disabled: boolean
    platform: string
    credentials: ChatLunaAdapterCredentialEntry[]
    extraConfig: Record<string, unknown>
    modelCount: number
    status: ChatLunaAdapterStatus
}

export interface ChatLunaAdapterType {
    id: string
    title: string
    pluginName: string
    credentialKind: ChatLunaAdapterCredentialKind
    platformConfigurable: boolean
    endpointPlaceholder?: string
    platformDefault: string
    instanceCount: number
    canCreate: boolean
    createReason?: string
}

export interface ChatLunaAdapterListResult {
    instances: ChatLunaAdapterInstance[]
    types: ChatLunaAdapterType[]
    /** platform 名 → adapter 标题，用于模型列表展示适配器名称。 */
    platformMap: Record<string, string>
    writable: boolean
    updatedAt: string
    reason?: string
}

export interface ChatLunaAdapterSaveInput {
    adapterId: string
    /** 不传则新建实例；传则更新该 activeKey 对应实例。 */
    instanceKey?: string
    platform?: string
    credentials: ChatLunaAdapterCredentialEntry[]
}

export interface ChatLunaAdapterToggleInput {
    instanceKey: string
    enabled: boolean
}

export interface ChatLunaAdapterDeleteInput {
    instanceKey: string
}

export interface ChatLunaAdapterMutationResult {
    ok: boolean
    instanceKey?: string
    status?: ChatLunaAdapterStatus
    reason?: string
}
