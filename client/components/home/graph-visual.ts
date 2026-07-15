import type { HubModuleId, HubModuleItem } from '../../types'
import type { GraphNode, ToggleDirection } from './graph-types'

export const getTone = (item: HubModuleItem) => {
    if (!item.installed) return 'var(--k-text-light)'
    if (item.configStatus === 'not-configured') return 'var(--k-text-light)'
    if (item.configStatus === 'multiple') return 'var(--k-color-warning)'
    if (!item.available) return 'var(--k-text-light)'
    if (item.id === 'agent') return 'var(--k-color-success)'
    if (item.id === 'livingMemory') return 'var(--k-color-primary)'
    if (item.id === 'mediaLuna') return 'var(--k-color-warning)'
    if (item.id === 'memesLuna') return 'var(--k-color-danger)'
    return 'var(--k-color-primary)'
}

export const getActiveTone = (id: HubModuleId) => {
    if (id === 'agent') return 'var(--k-color-success)'
    if (id === 'livingMemory') return 'var(--k-color-primary)'
    if (id === 'mediaLuna') return 'var(--k-color-warning)'
    if (id === 'memesLuna') return 'var(--k-color-danger)'
    return 'var(--k-color-primary)'
}

export const getEdgeColor = (node: GraphNode, risk: number) => {
    const base =
        node.entryType === 'config'
            ? node.tone
            : node.available
              ? node.tone
              : getActiveTone(node.id)
    if (risk <= 0) return base

    return `color-mix(in srgb, ${base}, var(--k-color-danger) ${Math.round(
        risk * 100
    )}%)`
}

export const getFloatDelay = (id: HubModuleId) => {
    if (id === 'agent') return -0.8
    if (id === 'livingMemory') return -2.2
    if (id === 'mediaLuna') return -3.4
    if (id === 'memesLuna') return -4.6
    return 0
}

export const getNodeStatus = (
    node: GraphNode,
    pending: ToggleDirection | undefined,
    hasError: boolean
) => {
    if (pending === 'enable') return 'Enabling...'
    if (pending === 'disable') return 'Disabling...'
    if (hasError) return 'Action failed'
    if (node.id === 'chatluna') return 'Core'
    if (!node.installed) return '未安装'
    if (node.configStatus === 'not-configured') return '未配置'
    if (node.configStatus === 'multiple') return '多配置'
    if (node.entryType === 'config' && !node.toggleable) return '配置'

    return node.available ? 'Ready' : 'Not enabled'
}

export const getDetailStatusText = (item: HubModuleItem) => {
    if (item.id === 'chatluna') return '运行中'
    if (!item.installed) return '未安装'
    if (item.configStatus === 'not-configured') return '未配置'
    if (item.configStatus === 'multiple') return '存在多份配置'
    if (item.entryType === 'config' && !item.toggleable) return '插件配置入口'

    return item.available ? '已启用' : '未启用'
}
