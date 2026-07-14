import type { HubModuleId, HubModuleItem } from '../../types'
import type { Point } from './graph-geometry'

export type { Point }

export interface GraphNode extends HubModuleItem {
    x: number
    y: number
    size: number
    radius: number
    tone: string
}

export interface GraphEdge {
    id: HubModuleId
    available: boolean
    muted: boolean
    /** Outer config-ring edge (dim by default until hover/drag). */
    config: boolean
    /** Node focused or dragged — raise config-edge emphasis. */
    emphasized: boolean
    risk: number
    color: string
    path: string
    x1: number
    y1: number
    x2: number
    y2: number
}

export interface DragState {
    id: HubModuleId
    pointerId: number
    startClientX: number
    startClientY: number
    startPoint: Point
    startPosition: Point
    moved: boolean
}

export type ToggleDirection = 'enable' | 'disable'

export interface SatelliteNodeMetrics {
    size: number
    radius: number
    orbitRadiusPx: number
}

export interface PhysicsState {
    id: HubModuleId
    x: number
    y: number
    vx: number
    vy: number
    radius: number
    isDragging: boolean
    isCore: boolean
    available: boolean
    item: HubModuleItem
}

/** 第一层有 WebUI 插件节点到 ChatLuna 主节点中心的默认距离，单位为屏幕像素。 */
export const orbitRadiusPx = 190

/** 第二层无 WebUI 插件节点到 ChatLuna 主节点中心的默认距离，单位为屏幕像素。 */
export const configOrbitRadiusPx = 360

/**
 * Rotation speed in radians per frame (at 60fps)
 * 自转的速度 (单位: 弧度/帧)
 */
export const orbitSpeedRad = 0.001

export const coreNodeMetrics = {
    size: 148,
    radius: 74
}

export const webuiNodeMetrics: SatelliteNodeMetrics = {
    size: 110,
    radius: 55,
    orbitRadiusPx
}

export const configNodeMetrics: SatelliteNodeMetrics = {
    size: 100,
    radius: 50,
    orbitRadiusPx: configOrbitRadiusPx
}

export const positionStorageKey = 'chatluna-hub:relationship-node-positions:v2'
export const rangeStorageKey = 'chatluna-hub:relationship-effective-range:v1'
export const detailFontSizeStorageKey = 'chatluna-hub:detail-font-size:v1'
export const graphZoomStorageKey = 'chatluna-hub:relationship-graph-zoom:v1'

export const effectiveRangeMinRadiusPx = 260
export const graphZoomMin = 0.5
export const graphZoomMax = 1.5
export const defaultDetailFontSizePx = 18

export const getDefaultCorePosition = (): Point => ({
    x: 350,
    y: 280
})

export const clampNumber = (value: number, min: number, max: number) => {
    return Math.min(max, Math.max(min, value))
}

export const getSatelliteNodeMetrics = (item: HubModuleItem) => {
    return item.ring === 'config' ? configNodeMetrics : webuiNodeMetrics
}

export const isPoint = (value: unknown): value is Point => {
    if (!value || typeof value !== 'object') return false

    const point = value as Partial<Point>
    return Number.isFinite(point.x) && Number.isFinite(point.y)
}

export const clearRecord = <T,>(record: Partial<Record<HubModuleId, T>>) => {
    for (const key of Object.keys(record) as HubModuleId[]) {
        delete record[key]
    }
}
