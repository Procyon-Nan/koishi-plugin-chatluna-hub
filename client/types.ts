import type { DataService } from '@koishijs/plugin-console'

export type HubModuleGroup = 'core' | 'ecosystem'
export type HubModuleId =
    | 'chatluna'
    | 'agent'
    | 'livingMemory'
    | 'mediaLuna'
    | 'memesLuna'
    | 'character'
    | 'multimodalService'
    | 'usage'
    | 'groupAnalysis'
    | 'affinity'
    | 'searchService'
    | 'forwardMsg'
    | 'llmWebSearch'
    | 'longMemory'
    | 'pluginCommon'
    | 'vectorStoreService'
    | 'storageService'
    | 'toolbox'

export type HubModuleIconName =
    | 'ChatRound'
    | 'Collection'
    | 'Connection'
    | 'Palette'
    | 'MemesLunaEmoji'
    | 'UserFilled'
    | 'Picture'
    | 'TrendCharts'
    | 'DataAnalysis'
    | 'Star'
    | 'Search'
    | 'Message'
    | 'Link'

export type HubModuleEntryType = 'hub' | 'webui' | 'config'
export type HubModuleRing = 'core' | 'webui' | 'config'
export type HubModuleConfigStatus =
    | 'none'
    | 'missing-package'
    | 'not-configured'
    | 'single'
    | 'multiple'

export interface HubModuleItem {
    id: HubModuleId
    group: HubModuleGroup
    entryType: HubModuleEntryType
    ring: HubModuleRing
    title: string
    icon: HubModuleIconName
    order: number
    installed: boolean
    configured: boolean
    available: boolean
    toggleable: boolean
    configStatus: HubModuleConfigStatus
    pluginName?: string
    configPath?: string
    routePath?: string
    reason?: string
    activityId?: string
    marketPackageName?: string
}

export type HubModuleToggleStatus =
    | 'enabled'
    | 'disabled'
    | 'not-configured'
    | 'ambiguous'
    | 'failed'

export interface HubModuleToggleResult {
    ok: boolean
    moduleId: HubModuleId
    enabled: boolean
    status: HubModuleToggleStatus
    reason?: string
}

export type HubModuleCreateConfigStatus =
    | 'created'
    | 'exists'
    | 'not-installed'
    | 'ambiguous'
    | 'failed'

export interface HubModuleCreateConfigResult {
    ok: boolean
    moduleId: HubModuleId
    status: HubModuleCreateConfigStatus
    configPath?: string
    routePath?: string
    reason?: string
}

export interface HubConsoleData {
    modules: HubModuleItem[]
    config: HubConsoleConfig
}

export interface HubConsoleConfig {
    hideDependencyGraphEntry: boolean
    enableHomeGraphAnimations: boolean
}

declare module '@koishijs/plugin-console' {
    interface Events {
        'chatluna-hub/module/set-enabled': (
            moduleId: HubModuleId,
            enabled: boolean
        ) => Promise<HubModuleToggleResult>
        'chatluna-hub/module/create-config': (
            moduleId: HubModuleId
        ) => Promise<HubModuleCreateConfigResult>
    }
}

declare module '@koishijs/plugin-console' {
    namespace Console {
        interface Services {
            chatluna_hub_webui: DataService<HubConsoleData>
        }
    }
}
