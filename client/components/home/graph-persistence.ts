import type { HubModuleId } from '../../types'
import type { Point } from './graph-geometry'
import {
    clampNumber,
    detailFontSizeStorageKey,
    graphZoomMax,
    graphZoomMin,
    graphZoomStorageKey,
    isPoint,
    positionStorageKey,
    rangeStorageKey
} from './graph-types'

export const loadPersistedFontSize = (): number | null => {
    try {
        const raw = window.localStorage.getItem(detailFontSizeStorageKey)
        if (!raw) return null

        const val = Number(raw)
        if (val >= 12 && val <= 20) return val
        return null
    } catch {
        window.localStorage.removeItem(detailFontSizeStorageKey)
        return null
    }
}

export const savePersistedFontSize = (val: number) => {
    try {
        window.localStorage.setItem(detailFontSizeStorageKey, String(val))
    } catch {
        // Ignore failures
    }
}

export const loadPersistedPositions = (
    moduleIds: HubModuleId[]
): Partial<Record<HubModuleId, Point>> => {
    const result: Partial<Record<HubModuleId, Point>> = {}

    try {
        const raw = window.localStorage.getItem(positionStorageKey)
        if (!raw) return result

        const data = JSON.parse(raw) as Partial<Record<HubModuleId, Point>>
        for (const id of moduleIds) {
            const point = data[id]
            if (!isPoint(point)) continue
            result[id] = { ...point }
        }
    } catch {
        window.localStorage.removeItem(positionStorageKey)
    }

    return result
}

export const savePersistedPositions = (
    positions: Partial<Record<HubModuleId, Point>>,
    moduleIds: HubModuleId[]
) => {
    const data: Partial<Record<HubModuleId, Point>> = {}

    for (const id of moduleIds) {
        const point = positions[id]
        if (point) data[id] = { ...point }
    }

    try {
        window.localStorage.setItem(positionStorageKey, JSON.stringify(data))
    } catch {
        // Ignore storage failures; dragging should still work for this session.
    }
}

export const loadPersistedRange = (options: {
    defaultRadius: number
    minRadius: number
    maxRadius: number
}): number | null => {
    try {
        const raw = window.localStorage.getItem(rangeStorageKey)
        if (!raw) return null

        const value = Number(raw)
        if (!Number.isFinite(value)) return null
        const radius =
            value <= 160 ? options.defaultRadius * (value / 100) : value

        return clampNumber(radius, options.minRadius, options.maxRadius)
    } catch {
        window.localStorage.removeItem(rangeStorageKey)
        return null
    }
}

export const savePersistedRange = (radiusPx: number) => {
    try {
        window.localStorage.setItem(
            rangeStorageKey,
            String(Math.round(radiusPx))
        )
    } catch {
        // Ignore storage failures; the control should still work for this session.
    }
}

export const loadPersistedGraphZoom = (): number | null => {
    try {
        const raw = window.localStorage.getItem(graphZoomStorageKey)
        if (!raw) return null

        const value = Number(raw)
        if (!Number.isFinite(value)) return null
        return clampNumber(value, graphZoomMin, graphZoomMax)
    } catch {
        window.localStorage.removeItem(graphZoomStorageKey)
        return null
    }
}

export const savePersistedGraphZoom = (zoom: number) => {
    try {
        window.localStorage.setItem(graphZoomStorageKey, String(zoom))
    } catch {
        // Ignore storage failures; wheel zoom should still work for this session.
    }
}

export const clearPersistedGraphState = () => {
    try {
        window.localStorage.removeItem(positionStorageKey)
        window.localStorage.removeItem(rangeStorageKey)
        window.localStorage.removeItem(detailFontSizeStorageKey)
        window.localStorage.removeItem(graphZoomStorageKey)
    } catch {
        // Ignore storage failures; the visible graph has still been reset.
    }
}
