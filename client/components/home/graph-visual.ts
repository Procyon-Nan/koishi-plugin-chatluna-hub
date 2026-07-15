import type { HubModuleId, HubModuleItem } from '../../types'
import type { GraphNode, ToggleDirection } from './graph-types'

/** ChatLuna core — purple family (icon, edge, live halo). */
export const coreNodeTone =
    'color-mix(in srgb, #c084fc, #7c3aed 42%)'

/** Outer config-ring satellites — shared light blue. */
export const configNodeTone = '#7dd3fc'

/**
 * Inner webui-ring brand colors.
 * Keep agent / mediaLuna / memesLuna; reassign livingMemory + affinity.
 */
const webuiToneById: Partial<Record<HubModuleId, string>> = {
    agent: 'var(--k-color-success)',
    mediaLuna: 'var(--k-color-warning)',
    memesLuna: 'var(--k-color-danger)',
    livingMemory: '#2563eb',
    affinity: '#e879f9'
}

export const getActiveTone = (id: HubModuleId) => {
    if (id === 'chatluna') return coreNodeTone
    return webuiToneById[id] ?? configNodeTone
}

export const getTone = (item: HubModuleItem) => {
    if (!item.installed) return 'var(--k-text-light)'
    if (item.configStatus === 'not-configured') return 'var(--k-text-light)'
    if (item.configStatus === 'multiple') return 'var(--k-color-warning)'
    if (!item.available) return 'var(--k-text-light)'
    if (item.id === 'chatluna') return coreNodeTone
    if (item.ring === 'config') return configNodeTone
    return getActiveTone(item.id)
}

export const getEdgeColor = (node: GraphNode, risk: number) => {
    const base =
        node.entryType === 'config'
            ? configNodeTone
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
    if (id === 'affinity') return -5.4
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
