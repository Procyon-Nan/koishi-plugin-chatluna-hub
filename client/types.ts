import type { DataService } from '@koishijs/plugin-console'

export type HubModuleGroup = 'core' | 'ecosystem'
export type HubModuleId =
    | 'chatluna'
    | 'agent'
    | 'livingMemory'
    | 'mediaLuna'
    | 'memesLuna'

export interface HubModuleItem {
    id: HubModuleId
    group: HubModuleGroup
    title: string
    icon: string
    order: number
    configured: boolean
    available: boolean
    reason?: string
    activityId?: string
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

export interface HubConsoleData {
    modules: HubModuleItem[]
}

declare module '@koishijs/plugin-console' {
    interface Events {
        'chatluna-hub/module/set-enabled': (
            moduleId: HubModuleId,
            enabled: boolean
        ) => Promise<HubModuleToggleResult>
    }
}

declare module '@koishijs/plugin-console' {
    namespace Console {
        interface Services {
            chatluna_hub_webui: DataService<HubConsoleData>
        }
    }
}
