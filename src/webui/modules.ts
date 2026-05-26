import type { Context } from 'koishi'

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

export interface HubModuleDefinition
    extends Omit<HubModuleItem, 'available' | 'configured' | 'reason'> {
    pluginName?: string
}

interface RuntimeScope {
    plugin?: unknown
    name?: string
    key?: string
    status?: number
    isActive?: boolean
    children?: RuntimeScope[]
}

interface RuntimeContext {
    loader?: {
        keyFor?: (plugin: unknown) => string | undefined
        config?: {
            plugins?: Record<string, unknown>
        }
    }
    registry?: {
        values?: () => Iterable<RuntimeScope>
    }
}

export const moduleDefinitions: HubModuleDefinition[] = [
    {
        id: 'chatluna',
        group: 'core',
        title: 'ChatLuna',
        icon: 'ChatRound',
        order: 0
    },
    {
        id: 'agent',
        group: 'ecosystem',
        title: 'Agent',
        icon: 'Connection',
        order: 10,
        pluginName: 'chatluna-agent',
        activityId: 'chatluna-agent'
    },
    {
        id: 'livingMemory',
        group: 'ecosystem',
        title: 'Living Memory',
        icon: 'Collection',
        order: 20,
        pluginName: 'chatluna-livingmemory',
        activityId: 'chatluna-livingmemory'
    },
    {
        id: 'mediaLuna',
        group: 'ecosystem',
        title: 'media-luna',
        icon: 'Palette',
        order: 30,
        pluginName: 'media-luna',
        activityId: 'media-luna'
    },
    {
        id: 'memesLuna',
        group: 'ecosystem',
        title: 'memesluna',
        icon: 'MemesLunaEmoji',
        order: 40,
        pluginName: 'memesluna',
        activityId: 'memesluna'
    }
]

export const getHubModuleDefinition = (id: HubModuleId) => {
    return moduleDefinitions.find((item) => item.id === id)
}

export const isToggleableHubModule = (id: HubModuleId) => {
    const definition = getHubModuleDefinition(id)

    return definition?.group === 'ecosystem' && Boolean(definition.pluginName)
}

const normalizePluginName = (name: string | undefined) => {
    return name
        ?.replace(/^@koishijs\/plugin-/, '')
        .replace(/^@[^/]+\/koishi-plugin-/, '')
        .replace(/^koishi-plugin-/, '')
        .replace(/^@[^/]+\//, '')
        .toLowerCase()
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const getActiveConfigKey = (key: string) => {
    return key.startsWith('~') ? key.slice(1) : key
}

const getPluginNameFromConfigKey = (key: string) => {
    const activeKey = getActiveConfigKey(key)
    const [name] = activeKey.split(':', 1)

    return normalizePluginName(name)
}

const hasPluginConfigEntry = (
    config: Record<string, unknown>,
    pluginName: string
): boolean => {
    const target = normalizePluginName(pluginName)
    if (!target) return false

    for (const [key, value] of Object.entries(config)) {
        if (key.startsWith('$')) continue

        const plugin = getPluginNameFromConfigKey(key)
        if (plugin === target) return true

        if (plugin !== 'group' || !isRecord(value)) continue
        if (hasPluginConfigEntry(value, pluginName)) return true
    }

    return false
}

const isPluginConfigured = (ctx: Context, pluginName: string) => {
    const runtimeCtx = ctx as Context & RuntimeContext
    const plugins = runtimeCtx.loader?.config?.plugins

    return Boolean(plugins && hasPluginConfigEntry(plugins, pluginName))
}

const isScopeRunning = (scope: RuntimeScope) => {
    if (scope.status !== undefined) {
        if (scope.status === 3 || scope.status === 4) return false
        return scope.status === 1 || scope.status === 2 || scope.isActive === true
    }

    return scope.isActive === true
}

const isRuntimeRunning = (scope: RuntimeScope) => {
    if (scope.children?.length) {
        return scope.children.some(isScopeRunning)
    }

    return isScopeRunning(scope)
}

const getPluginExportName = (plugin: unknown) => {
    if (!plugin || typeof plugin !== 'object') return

    const name = (plugin as { name?: unknown }).name
    return typeof name === 'string' ? name : undefined
}

const getRuntimePluginNames = (ctx: RuntimeContext, scope: RuntimeScope) => {
    return [
        ctx.loader?.keyFor?.(scope.plugin),
        getPluginExportName(scope.plugin),
        scope.name,
        scope.key
    ]
        .map(normalizePluginName)
        .filter((name): name is string => Boolean(name))
}

const isPluginRunning = (ctx: Context, pluginName: string) => {
    const runtimeCtx = ctx as Context & RuntimeContext
    const target = normalizePluginName(pluginName)
    if (!target) return false

    for (const scope of runtimeCtx.registry?.values?.() ?? []) {
        const names = getRuntimePluginNames(runtimeCtx, scope)
        if (!names.includes(target)) continue
        if (isRuntimeRunning(scope)) return true
    }

    return false
}

export const createHubModules = (ctx: Context): HubModuleItem[] => {
    return moduleDefinitions.map(({ pluginName, ...definition }) => {
        const configured = pluginName
            ? isPluginConfigured(ctx, pluginName)
            : true
        const available = pluginName ? isPluginRunning(ctx, pluginName) : true
        let reason: string | undefined

        if (!available) {
            reason = configured
                ? `Enable ${pluginName} to open this module.`
                : `${pluginName} is not installed or configured.`
        }

        return {
            ...definition,
            configured,
            available,
            reason
        }
    })
}
