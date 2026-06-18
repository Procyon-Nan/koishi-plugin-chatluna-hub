import type { Context } from 'koishi'
import {
    findPluginConfigMatches,
    getLoader,
    normalizePluginName,
    type PluginConfigMatch
} from './loader'
import { canResolveAnyPackage } from './package-resolver'

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
    config: HubConsoleConfig
}

export interface HubConsoleConfig {
    hideDependencyGraphEntry: boolean
}

export interface HubModuleDefinition extends Omit<
    HubModuleItem,
    | 'available'
    | 'configPath'
    | 'configStatus'
    | 'configured'
    | 'installed'
    | 'reason'
> {}

export interface HubModuleRuntimeState {
    installed: boolean
    configured: boolean
    available: boolean
    configStatus: HubModuleConfigStatus
    matches: PluginConfigMatch[]
    configPath?: string
    routePath?: string
    reason?: string
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
    }
    registry?: {
        values?: () => Iterable<RuntimeScope>
    }
}

interface ConfigModuleDefinitionInput {
    id: HubModuleId
    title: string
    icon: HubModuleIconName
    order: number
    pluginName: string
}

const defineConfigModule = (
    definition: ConfigModuleDefinitionInput
): HubModuleDefinition => ({
    ...definition,
    group: 'ecosystem',
    entryType: 'config',
    ring: 'config',
    toggleable: true
})

const configModuleDefinitions = [
    defineConfigModule({
        id: 'character',
        title: 'Character',
        icon: 'UserFilled',
        order: 110,
        pluginName: 'chatluna-character'
    }),
    defineConfigModule({
        id: 'multimodalService',
        title: 'Multimodal Service',
        icon: 'Picture',
        order: 120,
        pluginName: 'chatluna-multimodal-service'
    }),
    defineConfigModule({
        id: 'usage',
        title: 'Usage',
        icon: 'TrendCharts',
        order: 130,
        pluginName: 'chatluna-usage'
    }),
    defineConfigModule({
        id: 'groupAnalysis',
        title: 'Group Analysis',
        icon: 'DataAnalysis',
        order: 140,
        pluginName: 'chatluna-group-analysis'
    }),
    defineConfigModule({
        id: 'affinity',
        title: 'Affinity',
        icon: 'Star',
        order: 150,
        pluginName: 'chatluna-affinity'
    }),
    defineConfigModule({
        id: 'searchService',
        title: 'Search Service',
        icon: 'Search',
        order: 160,
        pluginName: 'chatluna-search-service'
    }),
    defineConfigModule({
        id: 'forwardMsg',
        title: 'Forward Msg',
        icon: 'Message',
        order: 170,
        pluginName: 'chatluna-forward-msg'
    }),
    defineConfigModule({
        id: 'llmWebSearch',
        title: 'LLM Web Search',
        icon: 'Link',
        order: 180,
        pluginName: 'chatluna-llm-web-search'
    })
]

export const moduleDefinitions: HubModuleDefinition[] = [
    {
        id: 'chatluna',
        group: 'core',
        entryType: 'hub',
        ring: 'core',
        title: 'ChatLuna',
        icon: 'ChatRound',
        order: 0,
        toggleable: false
    },
    {
        id: 'agent',
        group: 'ecosystem',
        entryType: 'webui',
        ring: 'webui',
        title: 'Agent',
        icon: 'Connection',
        order: 10,
        pluginName: 'chatluna-agent',
        activityId: 'chatluna-agent',
        routePath: '/chatluna-agent',
        toggleable: true
    },
    {
        id: 'livingMemory',
        group: 'ecosystem',
        entryType: 'webui',
        ring: 'webui',
        title: 'Living Memory',
        icon: 'Collection',
        order: 20,
        pluginName: 'chatluna-livingmemory',
        activityId: 'chatluna-livingmemory',
        routePath: '/chatluna-livingmemory',
        toggleable: true
    },
    {
        id: 'mediaLuna',
        group: 'ecosystem',
        entryType: 'webui',
        ring: 'webui',
        title: 'media-luna',
        icon: 'Palette',
        order: 30,
        pluginName: 'media-luna',
        activityId: 'media-luna',
        routePath: '/media-luna',
        toggleable: true
    },
    {
        id: 'memesLuna',
        group: 'ecosystem',
        entryType: 'webui',
        ring: 'webui',
        title: 'memesluna',
        icon: 'MemesLunaEmoji',
        order: 40,
        pluginName: 'memesluna',
        activityId: 'memesluna',
        routePath: '/memesluna/',
        toggleable: true
    },
    ...configModuleDefinitions
]

export const getHubModuleDefinition = (id: HubModuleId) => {
    return moduleDefinitions.find((item) => item.id === id)
}

export const isToggleableHubModule = (id: HubModuleId) => {
    const definition = getHubModuleDefinition(id)

    return definition?.toggleable === true && Boolean(definition.pluginName)
}

const getPluginConfigMatches = (
    ctx: Context,
    pluginName: string
): PluginConfigMatch[] => {
    const loader = getLoader(ctx)
    const plugins = loader?.config?.plugins
    if (!plugins) return []

    const matches: PluginConfigMatch[] = []
    findPluginConfigMatches(plugins, pluginName, loader.entry, matches)

    return matches
}

const isScopeRunning = (scope: RuntimeScope) => {
    if (scope.status !== undefined) {
        if (scope.status === 3 || scope.status === 4) return false
        return (
            scope.status === 1 || scope.status === 2 || scope.isActive === true
        )
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

const resolveCandidatePluginNames = (pluginName: string) => {
    const normalized = normalizePluginName(pluginName)
    if (!normalized) return [pluginName]

    return Array.from(
        new Set([
            pluginName,
            normalized,
            `koishi-plugin-${normalized}`,
            `@koishijs/plugin-${normalized}`
        ])
    )
}

const isPluginInstalled = (ctx: Context, pluginName: string) => {
    return canResolveAnyPackage(ctx, resolveCandidatePluginNames(pluginName))
}

const getConfigStatus = (
    pluginName: string | undefined,
    installed: boolean,
    matchCount: number
): HubModuleConfigStatus => {
    if (!pluginName) return 'none'
    if (!installed) return 'missing-package'
    if (matchCount === 0) return 'not-configured'
    if (matchCount === 1) return 'single'
    return 'multiple'
}

const createUnavailableReason = (
    pluginName: string | undefined,
    configStatus: HubModuleConfigStatus,
    available: boolean
) => {
    if (!pluginName) return
    if (configStatus === 'missing-package') {
        return `${pluginName} is not installed.`
    }
    if (configStatus === 'not-configured') {
        return `${pluginName} is not configured.`
    }
    if (configStatus === 'multiple') {
        return `${pluginName} has multiple config entries.`
    }
    if (!available) return `Enable ${pluginName} to open this module.`
}

const getModuleRoutePath = (
    definition: HubModuleDefinition,
    configPath: string | undefined
) => {
    if (definition.entryType === 'config' && configPath) {
        return `/plugins/${configPath}`
    }

    return definition.routePath
}

export const resolveHubModuleState = async (
    ctx: Context,
    definition: HubModuleDefinition
): Promise<HubModuleRuntimeState> => {
    const pluginName = definition.pluginName
    const matches = pluginName ? getPluginConfigMatches(ctx, pluginName) : []
    const matchCount = matches.length
    const installed = pluginName ? isPluginInstalled(ctx, pluginName) : true
    const configured = pluginName ? matchCount > 0 : true
    const available = pluginName ? isPluginRunning(ctx, pluginName) : true
    const configStatus = getConfigStatus(pluginName, installed, matchCount)
    const configPath = configStatus === 'single' ? matches[0].path : undefined
    const routePath = getModuleRoutePath(definition, configPath)
    const reason = createUnavailableReason(pluginName, configStatus, available)

    return {
        installed,
        configured,
        available,
        configStatus,
        matches,
        configPath,
        routePath,
        reason
    }
}

export const createHubModules = async (
    ctx: Context
): Promise<HubModuleItem[]> => {
    return Promise.all(
        moduleDefinitions.map(async (definition) => {
            const state = await resolveHubModuleState(ctx, definition)

            return {
                ...definition,
                installed: state.installed,
                configured: state.configured,
                available: state.available,
                configStatus: state.configStatus,
                configPath: state.configPath,
                routePath: state.routePath,
                reason: state.reason
            }
        })
    )
}
