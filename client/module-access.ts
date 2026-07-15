import type { HubModuleItem } from './types'

export const canOpenHubModule = (item: HubModuleItem) => {
    if (item.entryType === 'hub') return item.available
    if (item.entryType === 'webui') {
        return item.available && Boolean(item.routePath)
    }

    return (
        item.installed &&
        item.configStatus === 'single' &&
        Boolean(item.routePath)
    )
}

export const canOpenHubModuleMarket = (
    item: HubModuleItem
): item is HubModuleItem & { marketPackageName: string } => {
    return (
        item.group === 'ecosystem' &&
        !item.installed &&
        Boolean(item.marketPackageName)
    )
}

/** Installed config-ring plugin with no loader entry yet — create then open. */
export const canCreateHubModuleConfig = (item: HubModuleItem) => {
    return (
        item.entryType === 'config' &&
        item.installed &&
        item.configStatus === 'not-configured' &&
        Boolean(item.pluginName)
    )
}

export const canToggleHubModule = (item: HubModuleItem) => {
    return item.toggleable && item.installed && item.configStatus === 'single'
}

export const isHubModuleDisabled = (item: HubModuleItem) => {
    if (!item.installed) return true
    if (item.configStatus === 'not-configured') return true
    if (item.entryType === 'config' && !item.toggleable) return false

    return !item.available
}

export const isHubModuleStatusActive = (item: HubModuleItem) => {
    if (item.id === 'chatluna') return true
    if (item.entryType === 'config' && !item.toggleable) {
        return item.installed && item.configStatus === 'single'
    }

    return item.available
}
