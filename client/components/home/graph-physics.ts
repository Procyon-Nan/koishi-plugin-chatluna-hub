import { canToggleHubModule } from '../../module-access'
import type { HubModuleId, HubModuleItem } from '../../types'
import {
    createStagePointFromScreenDelta,
    getScreenDistance,
    projectStagePointToRadius,
    rotateStagePoint,
    toScreenDelta,
    type Point,
    type StageSize
} from './graph-geometry'
import {
    coreNodeMetrics,
    getSatelliteNodeMetrics,
    orbitSpeedRad,
    type PhysicsState,
    type ToggleDirection
} from './graph-types'

export interface PhysicsTickContext {
    physicsStates: PhysicsState[]
    core: Point & { radius?: number }
    coreModule: HubModuleItem
    ecosystemModules: HubModuleItem[]
    draggingId: HubModuleId | null
    dragMoved: boolean
    stageSize: StageSize
    effectiveRangeRadiusPx: number
    isOrbitActive: boolean
    togglePending: Partial<Record<HubModuleId, ToggleDirection>>
    carriedVisuals: Partial<Record<HubModuleId, Point>>
    carriedVelocities: Partial<Record<HubModuleId, Point>>
    nodePositions: Partial<Record<HubModuleId, Point>>
    getBasePositionForItem: (item: HubModuleItem) => Point
}

export const syncPhysicsStates = (ctx: PhysicsTickContext) => {
    const { physicsStates, core, coreModule, ecosystemModules, draggingId } =
        ctx

    if (physicsStates.length === 0) {
        physicsStates.push({
            id: 'chatluna',
            x: core.x,
            y: core.y,
            vx: 0,
            vy: 0,
            radius: coreNodeMetrics.radius,
            isDragging: draggingId === 'chatluna',
            isCore: true,
            available: true,
            item: coreModule
        })
    } else {
        const state = physicsStates[0]
        state.x = core.x
        state.y = core.y
        state.isDragging = draggingId === 'chatluna'
        state.item = coreModule
    }

    while (physicsStates.length - 1 > ecosystemModules.length) {
        physicsStates.pop()
    }

    for (let i = 0; i < ecosystemModules.length; i++) {
        const item = ecosystemModules[i]
        const id = item.id
        const isDragging = draggingId === id
        const base = ctx.getBasePositionForItem(item)
        const current = ctx.carriedVisuals[id] ?? { ...base }
        const velocity = ctx.carriedVelocities[id] ?? { x: 0, y: 0 }

        const stateIndex = i + 1
        if (stateIndex >= physicsStates.length) {
            physicsStates.push({
                id,
                x: current.x,
                y: current.y,
                vx: isDragging ? 0 : velocity.x,
                vy: isDragging ? 0 : velocity.y,
                radius: getSatelliteNodeMetrics(item).radius,
                isDragging,
                isCore: false,
                available: item.available,
                item
            })
        } else {
            const state = physicsStates[stateIndex]
            state.id = id
            state.x = current.x
            state.y = current.y
            state.vx = isDragging ? 0 : velocity.x
            state.vy = isDragging ? 0 : velocity.y
            state.radius = getSatelliteNodeMetrics(item).radius
            state.isDragging = isDragging
            state.available = item.available
            state.item = item
        }
    }
}

export const tickCarriedNodes = (
    ctx: PhysicsTickContext,
    deltaFrames: number
) => {
    const {
        physicsStates,
        core,
        draggingId,
        stageSize,
        effectiveRangeRadiusPx,
        isOrbitActive,
        togglePending,
        carriedVisuals,
        carriedVelocities,
        nodePositions,
        dragMoved
    } = ctx

    syncPhysicsStates(ctx)

    const draggingCore = draggingId === 'chatluna'
    const statesCount = physicsStates.length

    for (let i = 0; i < statesCount; i++) {
        const state = physicsStates[i]
        if (state.isCore || state.isDragging) continue

        if (isOrbitActive) {
            const speed = orbitSpeedRad * deltaFrames
            const nextPosition = rotateStagePoint(
                state,
                core,
                speed,
                stageSize
            )

            state.x = nextPosition.x
            state.y = nextPosition.y
            state.vx = 0
            state.vy = 0
            continue
        }

        if (!draggingCore) {
            state.vx = 0
            state.vy = 0
            continue
        }

        const damping = 0.90
        state.vx *= Math.pow(damping, deltaFrames)
        state.vy *= Math.pow(damping, deltaFrames)

        state.x += state.vx * deltaFrames
        state.y += state.vy * deltaFrames
    }

    if (!isOrbitActive) {
        for (let iteration = 0; iteration < 2; iteration++) {
            for (let i = 0; i < statesCount; i++) {
                for (let j = i + 1; j < statesCount; j++) {
                    const a = physicsStates[i]
                    const b = physicsStates[j]

                    const delta = toScreenDelta(a, b, stageSize)
                    const distPx = Math.hypot(delta.x, delta.y)
                    const minDistancePx = a.radius + b.radius + 16

                    if (distPx < minDistancePx) {
                        const overlapPx = minDistancePx - distPx
                        const nx = delta.x / (distPx || 1)
                        const ny = delta.y / (distPx || 1)

                        const push = createStagePointFromScreenDelta(
                            { x: 0, y: 0 },
                            {
                                x: overlapPx * nx,
                                y: overlapPx * ny
                            },
                            stageSize
                        )

                        const aStatic =
                            a.isDragging ||
                            (a.isCore && draggingId === 'chatluna')
                        const bStatic =
                            b.isDragging ||
                            (b.isCore && draggingId === 'chatluna')

                        if (aStatic && !bStatic) {
                            b.x += push.x
                            b.y += push.y
                            if (!b.isDragging) {
                                b.vx += push.x * 0.1
                                b.vy += push.y * 0.1
                            }
                        } else if (!aStatic && bStatic) {
                            a.x -= push.x
                            a.y -= push.y
                            if (!a.isDragging) {
                                a.vx -= push.x * 0.1
                                a.vy -= push.y * 0.1
                            }
                        } else if (!aStatic && !bStatic) {
                            a.x -= push.x * 0.5
                            a.y -= push.y * 0.5
                            b.x += push.x * 0.5
                            b.y += push.y * 0.5

                            a.vx -= push.x * 0.05
                            a.vy -= push.y * 0.05
                            b.vx += push.x * 0.05
                            b.vy += push.y * 0.05
                        }
                    }
                }
            }
        }
    }

    for (let i = 0; i < statesCount; i++) {
        const state = physicsStates[i]
        if (state.isCore) continue

        const id = state.id
        const isDisabling = togglePending[id] === 'disable'
        if (
            canToggleHubModule(state.item) &&
            state.available &&
            !isDisabling &&
            !state.isDragging
        ) {
            const distPx = getScreenDistance(state, core, stageSize)
            const rangePx = effectiveRangeRadiusPx

            if (distPx > rangePx) {
                const target = projectStagePointToRadius(
                    state,
                    core,
                    rangePx,
                    stageSize
                )

                if (draggingCore) {
                    state.vx = (target.x - state.x) / deltaFrames
                    state.vy = (target.y - state.y) / deltaFrames
                }

                state.x = target.x
                state.y = target.y
            }
        }

        const position = { x: state.x, y: state.y }
        let velocity = carriedVelocities[id]
        if (!velocity) {
            carriedVelocities[id] = { x: state.vx, y: state.vy }
        } else {
            velocity.x = state.vx
            velocity.y = state.vy
        }
        carriedVisuals[id] = position

        if (draggingCore && dragMoved) {
            nodePositions[id] = position
        }
    }
}
