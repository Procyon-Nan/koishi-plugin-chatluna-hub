import type { Ref } from 'vue'
import type { HubModuleId, HubModuleItem } from '../../types'
import type { Point } from './graph-geometry'
import type { DragState, GraphNode } from './graph-types'

export interface UseGraphDragOptions {
    draggingId: Ref<HubModuleId | null>
    nodePositions: Partial<Record<HubModuleId, Point>>
    carriedVisuals: Partial<Record<HubModuleId, Point>>
    carriedVelocities: Partial<Record<HubModuleId, Point>>
    eventToPoint: (event: PointerEvent) => Point | null
    getBasePosition: (node: GraphNode) => Point
    findModule: (id: HubModuleId) => HubModuleItem | undefined
    onSelect: (item: HubModuleItem) => void
    onDragMovedEnd: (item: HubModuleItem) => void
    onPersistPositions: () => void
}

export const useGraphDrag = (options: UseGraphDragOptions) => {
    const {
        draggingId,
        nodePositions,
        carriedVisuals,
        carriedVelocities,
        eventToPoint,
        getBasePosition,
        findModule,
        onSelect,
        onDragMovedEnd,
        onPersistPositions
    } = options

    let dragState: DragState | null = null

    const detachDragListeners = () => {
        window.removeEventListener('pointermove', handleDragMove)
        window.removeEventListener('pointerup', handleDragEnd)
        window.removeEventListener('pointercancel', handleDragEnd)
    }

    const handleNodePointerDown = (event: PointerEvent, node: GraphNode) => {
        if (event.button !== 0) return

        const point = eventToPoint(event)
        if (!point) return

        event.preventDefault()
        dragState = {
            id: node.id,
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startPoint: point,
            startPosition: getBasePosition(node),
            moved: false
        }
        draggingId.value = node.id

        if (node.id !== 'chatluna') {
            carriedVisuals[node.id] = dragState.startPosition
            carriedVelocities[node.id] = { x: 0, y: 0 }
        }

        window.addEventListener('pointermove', handleDragMove)
        window.addEventListener('pointerup', handleDragEnd)
        window.addEventListener('pointercancel', handleDragEnd)
    }

    const handleDragMove = (event: PointerEvent) => {
        if (!dragState || dragState.pointerId !== event.pointerId) return

        const point = eventToPoint(event)
        if (!point) return

        const clientDistance = Math.hypot(
            event.clientX - dragState.startClientX,
            event.clientY - dragState.startClientY
        )

        if (clientDistance > 4) dragState.moved = true
        if (!dragState.moved) return

        const nextPoint = {
            x: dragState.startPosition.x + point.x - dragState.startPoint.x,
            y: dragState.startPosition.y + point.y - dragState.startPoint.y
        }

        nodePositions[dragState.id] = nextPoint
        carriedVisuals[dragState.id] = nextPoint
        carriedVelocities[dragState.id] = { x: 0, y: 0 }
    }

    const handleDragEnd = (event: PointerEvent) => {
        if (!dragState || dragState.pointerId !== event.pointerId) return

        const target = findModule(dragState.id)
        if (!dragState.moved && target) onSelect(target)
        if (dragState.moved) {
            if (target) {
                const finalPosition =
                    carriedVisuals[target.id] ?? nodePositions[target.id]

                if (finalPosition) nodePositions[target.id] = { ...finalPosition }
                if (finalPosition) carriedVisuals[target.id] = { ...finalPosition }
                carriedVelocities[target.id] = { x: 0, y: 0 }
                onDragMovedEnd(target)
            }

            onPersistPositions()
        }

        dragState = null
        draggingId.value = null
        detachDragListeners()
    }

    const resetDragState = () => {
        dragState = null
        draggingId.value = null
        detachDragListeners()
    }

    const isDragActive = () => dragState !== null
    const isDragMoved = () => Boolean(dragState?.moved)

    return {
        handleNodePointerDown,
        resetDragState,
        isDragActive,
        isDragMoved
    }
}
