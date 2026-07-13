import { ref, type Ref } from 'vue'
import {
    savePersistedGraphZoom,
    savePersistedRange
} from './graph-persistence'
import {
    clampNumber,
    effectiveRangeMinRadiusPx,
    graphZoomMax,
    graphZoomMin
} from './graph-types'

export interface UseGraphStageControlsOptions {
    graphZoom: Ref<number>
    effectiveRangeRadiusInput: Ref<number>
    effectiveRangeRadiusPx: Ref<number>
    effectiveRangeMaxRadiusPx: Ref<number>
    stageHeight: () => number
    isDragActive: () => boolean
}

export const useGraphStageControls = (
    options: UseGraphStageControlsOptions
) => {
    const {
        graphZoom,
        effectiveRangeRadiusInput,
        effectiveRangeRadiusPx,
        effectiveRangeMaxRadiusPx,
        stageHeight,
        isDragActive
    } = options

    const effectiveRangePreviewVisible = ref(false)
    const rangeControlPointerActive = ref(false)
    let effectiveRangePreviewHideTimer = 0

    const clearEffectiveRangePreviewHideTimer = () => {
        if (!effectiveRangePreviewHideTimer) return
        window.clearTimeout(effectiveRangePreviewHideTimer)
        effectiveRangePreviewHideTimer = 0
    }

    const showEffectiveRangePreview = () => {
        clearEffectiveRangePreviewHideTimer()
        effectiveRangePreviewVisible.value = true
    }

    const scheduleEffectiveRangePreviewHide = () => {
        clearEffectiveRangePreviewHideTimer()
        effectiveRangePreviewHideTimer = window.setTimeout(() => {
            effectiveRangePreviewVisible.value = false
            effectiveRangePreviewHideTimer = 0
        }, 760)
    }

    const detachRangeControlPointerListeners = () => {
        window.removeEventListener('pointerup', handleRangeControlInteractionEnd)
        window.removeEventListener(
            'pointercancel',
            handleRangeControlInteractionEnd
        )
    }

    const handleRangeControlInput = (event: Event) => {
        const input = event.currentTarget as HTMLInputElement
        effectiveRangeRadiusInput.value = clampNumber(
            Number(input.value),
            effectiveRangeMinRadiusPx,
            effectiveRangeMaxRadiusPx.value
        )
        showEffectiveRangePreview()
        if (!rangeControlPointerActive.value) {
            scheduleEffectiveRangePreviewHide()
        }
        savePersistedRange(effectiveRangeRadiusPx.value)
    }

    const handleRangeControlInteractionStart = () => {
        detachRangeControlPointerListeners()
        rangeControlPointerActive.value = true
        showEffectiveRangePreview()
        window.addEventListener('pointerup', handleRangeControlInteractionEnd)
        window.addEventListener(
            'pointercancel',
            handleRangeControlInteractionEnd
        )
    }

    const handleRangeControlInteractionEnd = () => {
        detachRangeControlPointerListeners()
        rangeControlPointerActive.value = false
        scheduleEffectiveRangePreviewHide()
    }

    const setGraphZoom = (value: number) => {
        const clamped = clampNumber(value, graphZoomMin, graphZoomMax)
        graphZoom.value = Math.round(clamped * 1000) / 1000
    }

    const shouldIgnoreGraphWheel = (target: EventTarget | null) => {
        if (!(target instanceof Element)) return false

        return Boolean(
            target.closest('.hub-module-detail-panel') ||
                target.closest('.range-control')
        )
    }

    const normalizeWheelDelta = (event: WheelEvent) => {
        if (event.deltaMode === 1) return event.deltaY * 16
        if (event.deltaMode === 2) return event.deltaY * stageHeight()

        return event.deltaY
    }

    const handleGraphWheel = (event: WheelEvent) => {
        if (isDragActive() || rangeControlPointerActive.value) return
        if (shouldIgnoreGraphWheel(event.target)) return

        const delta = normalizeWheelDelta(event)
        if (!Number.isFinite(delta) || delta === 0) return

        const previous = graphZoom.value
        setGraphZoom(graphZoom.value * Math.exp(-delta * 0.0012))
        if (graphZoom.value !== previous) {
            event.preventDefault()
            savePersistedGraphZoom(graphZoom.value)
        }
    }

    const resetStageControlState = () => {
        rangeControlPointerActive.value = false
        detachRangeControlPointerListeners()
        clearEffectiveRangePreviewHideTimer()
        effectiveRangePreviewVisible.value = false
    }

    return {
        effectiveRangePreviewVisible,
        rangeControlPointerActive,
        handleRangeControlInput,
        handleRangeControlInteractionStart,
        handleRangeControlInteractionEnd,
        handleGraphWheel,
        setGraphZoom,
        resetStageControlState
    }
}
