<template>
    <section
        ref="stageRef"
        class="relationship-home"
        @wheel="handleGraphWheel"
    >
        <div class="graph-container-box">
            <header class="graph-header">
                <span class="graph-kicker">Relationship map</span>
                <h1>ChatLuna Hub</h1>
                <p>ChatLuna 生态网络</p>
            </header>

            <aside class="ecosystem-meter" aria-label="ChatLuna ecosystem plugins">
                <span class="meter-label">生态插件</span>
                <strong>{{ availableEcosystemCount }} / {{ ecosystemModuleCount }}</strong>
                <span class="meter-hint">可用 / 全部</span>
            </aside>

            <aside class="range-control" aria-label="ChatLuna effective range">
                <span class="range-control-label">有效范围</span>
                <div class="range-control-row">
                    <input
                        :value="Math.round(effectiveRangeRadiusPx)"
                        type="range"
                        :min="effectiveRangeMinRadiusPx"
                        :max="Math.round(effectiveRangeMaxRadiusPx)"
                        step="4"
                        aria-label="调整 ChatLuna 有效范围"
                        @input="handleRangeControlInput"
                        @pointerdown="handleRangeControlInteractionStart"
                        @pointerup="handleRangeControlInteractionEnd"
                        @pointercancel="handleRangeControlInteractionEnd"
                    />
                    <button
                        class="range-reset-button"
                        type="button"
                        @click="handleResetGraphDefaults"
                    >
                        重置
                    </button>
                </div>
            </aside>

            <div
                class="graph-stage"
                :class="{
                    'animations-enabled': props.animationsEnabled,
                    'orbit-active': isOrbitActive
                }"
            >
                <div class="graph-viewport" :style="graphViewportStyle">
                <svg
                    class="graph-svg"
                    :viewBox="`0 0 ${graphViewBoxWidth} ${graphViewBoxHeight}`"
                    overflow="visible"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    focusable="false"
                >
                    <ellipse
                        v-if="effectiveRange && effectiveRangePreviewVisible"
                        class="effective-range"
                        :cx="effectiveRange.cx"
                        :cy="effectiveRange.cy"
                        :rx="effectiveRange.rx"
                        :ry="effectiveRange.ry"
                    />

                    <g v-if="coreNode" class="edge-layer">
                        <path
                            v-for="edge in edges"
                            :key="edge.id"
                            class="graph-edge edge-base"
                            :class="{
                                disabled: edge.muted,
                                risky: edge.risk > 0
                            }"
                            :style="edgeStyle(edge)"
                            :d="edge.path"
                        />
                        <path
                            v-for="edge in edges"
                            :key="`${edge.id}-flow`"
                            class="graph-edge edge-flow"
                            :class="{
                                disabled: edge.muted,
                                risky: edge.risk > 0
                            }"
                            :style="edgeStyle(edge)"
                            :d="edge.path"
                        />
                    </g>
                </svg>

                <button
                    v-if="coreNode"
                    class="graph-node core"
                    :class="{ dragging: draggingId === coreNode.id }"
                    :style="nodeStyle(coreNode)"
                    :title="coreNode.title"
                    type="button"
                    @pointerdown="handleNodePointerDown($event, coreNode)"
                    @pointerenter="focusedNodeId = coreNode.id"
                    @pointerleave="handleNodePointerLeave(coreNode.id)"
                >
                    <span class="node-disc">
                        <span class="node-glow" />
                        <graph-node-mark
                            :module-id="coreNode.id"
                            :icon="coreNode.icon"
                        />
                    </span>
                    <span class="node-title">{{ coreNode.title }}</span>
                    <span class="node-status">Core</span>
                </button>

                <button
                    v-for="node in satelliteNodes"
                    :key="node.id"
                    class="graph-node satellite"
                    :class="{
                        disabled: isHubModuleDisabled(node),
                        configurable: node.entryType === 'config',
                        dragging: draggingId === node.id,
                        pending: isNodePending(node.id),
                        'out-of-range': isNodeOutOfRange(node)
                    }"
                    :style="nodeStyle(node)"
                    :title="getNodeTitle(node)"
                    :aria-disabled="
                        isHubModuleDisabled(node) && !canOpenHubModuleMarket(node)
                    "
                    type="button"
                    @pointerdown="handleNodePointerDown($event, node)"
                    @pointerenter="focusedNodeId = node.id"
                    @pointerleave="handleNodePointerLeave(node.id)"
                >
                    <span class="node-disc">
                        <span class="node-glow" />
                        <graph-node-mark
                            :module-id="node.id"
                            :icon="node.icon"
                        />
                    </span>
                    <span class="node-title">{{ node.title }}</span>
                    <span class="node-status">
                        {{ resolveNodeStatus(node) }}
                    </span>
                </button>
                </div>
            </div>
        </div>

        <graph-detail-panel
            :module="activeDetailModule"
            :module-detail="activeModuleDetail"
            :detail-tone="activeDetailTone"
            :status-active="activeDetailStatusActive"
            :status-text="activeDetailStatusText"
            :font-size-px="detailFontSizePx"
            @update:font-size-px="detailFontSizePx = $event"
            @save-font-size="savePersistedFontSize"
        />
    </section>
</template>

<script setup lang="ts">
import {
    computed,
    onActivated,
    onBeforeUnmount,
    onDeactivated,
    onMounted,
    reactive,
    ref
} from 'vue'
import {
    canOpenHubModule,
    canOpenHubModuleMarket,
    canToggleHubModule,
    isHubModuleDisabled,
    isHubModuleStatusActive
} from '../../module-access'
import { moduleDetails, type ModuleDetail } from '../../module-catalog'
import type { HubModuleId, HubModuleItem } from '../../types'
import GraphDetailPanel from './graph-detail-panel.vue'
import {
    createOrbitPosition,
    createStagePointFromScreenDelta,
    getScreenDistance,
    graphViewBoxHeight,
    graphViewBoxWidth,
    toScreenDelta,
    toScreenPoint,
    toStagePoint,
    type Point
} from './graph-geometry'
import GraphNodeMark from './graph-node-mark.vue'
import {
    clearPersistedGraphState,
    loadPersistedFontSize,
    loadPersistedGraphZoom,
    loadPersistedPositions,
    loadPersistedRange,
    savePersistedFontSize,
    savePersistedPositions
} from './graph-persistence'
import { tickCarriedNodes, type PhysicsTickContext } from './graph-physics'
import { createGraphRuntime } from './graph-runtime'
import {
    clampNumber,
    clearRecord,
    coreNodeMetrics,
    defaultDetailFontSizePx,
    effectiveRangeMinRadiusPx,
    getDefaultCorePosition,
    getSatelliteNodeMetrics,
    type GraphEdge,
    type GraphNode,
    type PhysicsState
} from './graph-types'
import {
    getDetailStatusText,
    getEdgeColor,
    getFloatDelay,
    getNodeStatus,
    getTone
} from './graph-visual'
import { useGraphDrag } from './use-graph-drag'
import { useGraphStageControls } from './use-graph-stage-controls'
import { useModuleToggle } from './use-module-toggle'

const props = withDefaults(
    defineProps<{
        modules: HubModuleItem[]
        animationsEnabled?: boolean
    }>(),
    {
        animationsEnabled: true
    }
)

const emit = defineEmits<{
    select: [id: HubModuleId]
}>()

const focusedNodeId = ref<HubModuleId | null>(null)
const lastActiveNodeId = ref<HubModuleId | null>(null)
const detailFontSizePx = ref(defaultDetailFontSizePx)
const stageRef = ref<HTMLElement | null>(null)
const draggingId = ref<HubModuleId | null>(null)
const effectiveRangeRadiusInput = ref(0)
const graphZoom = ref(1)
const stageSize = reactive({
    width: graphViewBoxWidth,
    height: graphViewBoxHeight
})
const nodePositions = reactive<Partial<Record<HubModuleId, Point>>>({})
const carriedVisuals = reactive<Partial<Record<HubModuleId, Point>>>({})
const carriedVelocities: Partial<Record<HubModuleId, Point>> = {}
const physicsStates: PhysicsState[] = []

const { togglePending, toggleErrors, setModuleEnabled } = useModuleToggle()

let lastAnimationTime = 0

const sortedModules = computed(() =>
    props.modules.slice().sort((left, right) => left.order - right.order)
)
const coreModule = computed(
    () => sortedModules.value.find((item) => item.id === 'chatluna') ?? null
)
const ecosystemModules = computed(() =>
    sortedModules.value.filter((item) => item.id !== 'chatluna')
)
const ecosystemModuleCount = computed(() => ecosystemModules.value.length)
const availableEcosystemCount = computed(
    () => ecosystemModules.value.filter((item) => item.available).length
)
const webuiModules = computed(() =>
    ecosystemModules.value.filter((item) => item.ring !== 'config')
)
const configModules = computed(() =>
    ecosystemModules.value.filter((item) => item.ring === 'config')
)

const activeDetailModuleId = computed<HubModuleId | null>(() => {
    return focusedNodeId.value || draggingId.value || lastActiveNodeId.value
})

const activeDetailModule = computed(() => {
    if (!activeDetailModuleId.value) return null
    return (
        sortedModules.value.find(
            (item) => item.id === activeDetailModuleId.value
        ) ?? null
    )
})

const activeModuleDetail = computed<ModuleDetail | null>(() => {
    const id = activeDetailModuleId.value
    return id ? moduleDetails[id] : null
})

const activeDetailTone = computed(() => {
    if (!activeDetailModule.value) return 'var(--k-color-primary)'
    if (activeDetailModule.value.id === 'chatluna') {
        return 'var(--k-color-primary)'
    }
    return getTone(activeDetailModule.value)
})

const activeDetailStatusActive = computed(() => {
    if (!activeDetailModule.value) return false
    return isHubModuleStatusActive(activeDetailModule.value)
})

const activeDetailStatusText = computed(() => {
    if (!activeDetailModule.value) return ''
    return getDetailStatusText(activeDetailModule.value)
})

const coreNode = computed<GraphNode | null>(() => {
    if (!coreModule.value) return null
    const base = nodePositions[coreModule.value.id] ?? getDefaultCorePosition()

    return {
        ...coreModule.value,
        x: base.x,
        y: base.y,
        size: coreNodeMetrics.size,
        radius: coreNodeMetrics.radius,
        tone: 'color-mix(in srgb, var(--k-color-primary), mediumpurple 58%)'
    }
})

const defaultEffectiveRangeRadiusPx = computed(() =>
    clampNumber(
        Math.min(stageSize.width, stageSize.height) * 0.52,
        effectiveRangeMinRadiusPx,
        720
    )
)

const effectiveRangeMaxRadiusPx = computed(() => {
    const centerX = stageSize.width * 0.5
    const centerY = stageSize.height * 0.5
    const maxDistance = Math.max(
        Math.hypot(centerX, centerY),
        Math.hypot(stageSize.width - centerX, centerY),
        Math.hypot(centerX, stageSize.height - centerY),
        Math.hypot(stageSize.width - centerX, stageSize.height - centerY)
    )

    return Math.max(effectiveRangeMinRadiusPx, Math.ceil(maxDistance + 24))
})

const effectiveRangeRadiusPx = computed(() =>
    clampNumber(
        effectiveRangeRadiusInput.value || defaultEffectiveRangeRadiusPx.value,
        effectiveRangeMinRadiusPx,
        effectiveRangeMaxRadiusPx.value
    )
)

const effectiveRange = computed(() => {
    if (!coreNode.value) return null

    return {
        cx: coreNode.value.x,
        cy: coreNode.value.y,
        rx: effectiveRangeRadiusPx.value * (graphViewBoxWidth / stageSize.width),
        ry:
            effectiveRangeRadiusPx.value *
            (graphViewBoxHeight / stageSize.height)
    }
})

const getDefaultSatellitePosition = (item: HubModuleItem): Point => {
    const core = getDefaultCorePosition()
    const list =
        item.ring === 'config' ? configModules.value : webuiModules.value
    const index = Math.max(0, list.findIndex((module) => module.id === item.id))
    const count = Math.max(1, list.length)
    const angle = ((2 * Math.PI) / count) * index - Math.PI / 2
    const metrics = getSatelliteNodeMetrics(item)

    return createOrbitPosition(core, angle, metrics.orbitRadiusPx, stageSize)
}

const getVisualPosition = (id: HubModuleId, base: Point): Point => {
    const visual = carriedVisuals[id]
    return visual ? { ...visual } : base
}

const satelliteNodes = computed<GraphNode[]>(() => {
    return ecosystemModules.value.map((item) => {
        const base = nodePositions[item.id] ?? getDefaultSatellitePosition(item)
        const visual = getVisualPosition(item.id, base)
        const metrics = getSatelliteNodeMetrics(item)

        return {
            ...item,
            x: visual.x,
            y: visual.y,
            size: metrics.size,
            radius: metrics.radius,
            tone: getTone(item)
        }
    })
})

const createEdge = (from: GraphNode, to: GraphNode) => {
    const delta = toScreenDelta(from, to, stageSize)
    const length = Math.hypot(delta.x, delta.y) || 1
    const unit = {
        x: delta.x / length,
        y: delta.y / length
    }
    const start = createStagePointFromScreenDelta(
        from,
        {
            x: unit.x * from.radius,
            y: unit.y * from.radius
        },
        stageSize
    )
    const end = createStagePointFromScreenDelta(
        to,
        {
            x: -unit.x * to.radius,
            y: -unit.y * to.radius
        },
        stageSize
    )

    return {
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y
    }
}

const createEdgePath = (edge: {
    x1: number
    y1: number
    x2: number
    y2: number
}) => {
    return `M ${edge.x1} ${edge.y1} L ${edge.x2} ${edge.y2}`
}

const getEdgeRisk = (node: GraphNode) => {
    if (!coreNode.value || draggingId.value !== node.id) return 0

    const distance = getScreenDistance(node, coreNode.value, stageSize)
    const radius = effectiveRangeRadiusPx.value
    const start = radius * 0.72

    return clampNumber((distance - start) / (radius - start), 0, 1)
}

const edges = computed<GraphEdge[]>(() => {
    if (!coreNode.value) return []

    return satelliteNodes.value.map((node) => {
        const edge = createEdge(coreNode.value!, node)
        const risk = getEdgeRisk(node)

        return {
            id: node.id,
            available: node.available,
            muted: isHubModuleDisabled(node) && draggingId.value !== node.id,
            risk,
            color: getEdgeColor(node, risk),
            path: createEdgePath(edge),
            ...edge
        }
    })
})

const isPointWithinEffectiveRange = (point: Point) => {
    if (!coreNode.value) return true

    return (
        getScreenDistance(point, coreNode.value, stageSize) <=
        effectiveRangeRadiusPx.value
    )
}

const nodeStyle = (node: GraphNode) => {
    const point = toScreenPoint(node, stageSize)

    return {
        '--node-px': `${point.x}px`,
        '--node-py': `${point.y}px`,
        '--node-size': `${node.size}px`,
        '--node-tone': node.tone,
        '--float-delay': `${getFloatDelay(node.id)}s`
    } as Record<string, string>
}

const edgeStyle = (edge: GraphEdge) =>
    ({
        color: edge.color
    }) as Record<string, string>

const isNodePending = (id: HubModuleId) => Boolean(togglePending[id])
const isNodeOutOfRange = (node: GraphNode) => {
    return canToggleHubModule(node) && !isPointWithinEffectiveRange(node)
}

const getNodeTitle = (node: GraphNode) => {
    return toggleErrors[node.id] ?? node.reason ?? node.title
}

const resolveNodeStatus = (node: GraphNode) => {
    return getNodeStatus(
        node,
        togglePending[node.id],
        Boolean(toggleErrors[node.id])
    )
}

const selectModule = (item: HubModuleItem) => {
    if (isNodePending(item.id)) return
    if (!canOpenHubModule(item) && !canOpenHubModuleMarket(item)) return
    emit('select', item.id)
}

const handleNodePointerLeave = (id: HubModuleId) => {
    if (focusedNodeId.value === id) {
        lastActiveNodeId.value = id
        focusedNodeId.value = null
    }
}

const getBasePositionForItem = (item: HubModuleItem): Point => {
    const stored = nodePositions[item.id]
    if (stored) return { ...stored }
    if (item.id === 'chatluna') return getDefaultCorePosition()

    return getDefaultSatellitePosition(item)
}

const getBasePosition = (node: GraphNode): Point => {
    const item = sortedModules.value.find((module) => module.id === node.id)
    if (item) {
        const visual =
            node.id === 'chatluna' ? undefined : carriedVisuals[node.id]
        return visual ? { ...visual } : getBasePositionForItem(item)
    }

    return {
        x: node.x,
        y: node.y
    }
}

const reconcileModuleBoundary = async (item: HubModuleItem) => {
    if (item.id === 'chatluna' || item.group !== 'ecosystem') return
    if (togglePending[item.id]) return
    if (!canToggleHubModule(item)) return

    const point = getBasePositionForItem(item)
    const withinRange = isPointWithinEffectiveRange(point)

    if (item.available && !withinRange) {
        await setModuleEnabled(item, false)
    } else if (!item.available && withinRange) {
        await setModuleEnabled(item, true)
    }
}

const eventToPoint = (event: PointerEvent): Point | null => {
    const rect = stageRef.value?.getBoundingClientRect()
    if (!rect?.width || !rect.height) return null

    const centerX = rect.width * 0.5
    const centerY = rect.height * 0.5
    const visualX = event.clientX - rect.left
    const visualY = event.clientY - rect.top
    const logicalX = centerX + (visualX - centerX) / graphZoom.value
    const logicalY = centerY + (visualY - centerY) / graphZoom.value

    return toStagePoint({ x: logicalX, y: logicalY }, rect)
}

const {
    handleNodePointerDown,
    resetDragState,
    isDragActive,
    isDragMoved
} = useGraphDrag({
    draggingId,
    nodePositions,
    carriedVisuals,
    carriedVelocities,
    eventToPoint,
    getBasePosition,
    findModule: (id) => sortedModules.value.find((item) => item.id === id),
    onSelect: selectModule,
    onDragMovedEnd: (target) => {
        if (target.id === 'chatluna') {
            for (const item of ecosystemModules.value) {
                void reconcileModuleBoundary(item)
            }
        } else {
            void reconcileModuleBoundary(target)
        }
    },
    onPersistPositions: () => {
        savePersistedPositions(
            nodePositions,
            sortedModules.value.map((item) => item.id)
        )
    }
})

const {
    effectiveRangePreviewVisible,
    rangeControlPointerActive,
    handleRangeControlInput,
    handleRangeControlInteractionStart,
    handleRangeControlInteractionEnd,
    handleGraphWheel,
    setGraphZoom,
    resetStageControlState
} = useGraphStageControls({
    graphZoom,
    effectiveRangeRadiusInput,
    effectiveRangeRadiusPx,
    effectiveRangeMaxRadiusPx,
    stageHeight: () => stageSize.height,
    isDragActive
})

const isOrbitActive = computed(
    () =>
        props.animationsEnabled &&
        draggingId.value === null &&
        !rangeControlPointerActive.value
)

const graphViewportStyle = computed(
    () =>
        ({
            '--graph-zoom': graphZoom.value.toFixed(3)
        }) as Record<string, string>
)

const resetActiveInteractionState = () => {
    resetDragState()
    resetStageControlState()
}

const handleResetGraphDefaults = () => {
    resetActiveInteractionState()
    effectiveRangeRadiusInput.value = 0
    detailFontSizePx.value = defaultDetailFontSizePx
    graphZoom.value = 1
    lastActiveNodeId.value = null
    clearRecord(nodePositions)
    clearTransientOrbitState()
    clearPersistedGraphState()
}

const buildPhysicsContext = (): PhysicsTickContext | null => {
    if (!coreNode.value || !coreModule.value) return null

    return {
        physicsStates,
        core: coreNode.value,
        coreModule: coreModule.value,
        ecosystemModules: ecosystemModules.value,
        draggingId: draggingId.value,
        dragMoved: isDragMoved(),
        stageSize,
        effectiveRangeRadiusPx: effectiveRangeRadiusPx.value,
        isOrbitActive: isOrbitActive.value,
        togglePending,
        carriedVisuals,
        carriedVelocities,
        nodePositions,
        getBasePositionForItem
    }
}

const tickAnimation = (time: number) => {
    if (!props.animationsEnabled && draggingId.value !== 'chatluna') {
        lastAnimationTime = 0
        return
    }

    const deltaFrames = lastAnimationTime
        ? clampNumber((time - lastAnimationTime) / 16.667, 0.45, 2.2)
        : 1

    lastAnimationTime = time
    const ctx = buildPhysicsContext()
    if (ctx) tickCarriedNodes(ctx, deltaFrames)
}

const clearTransientOrbitState = () => {
    clearRecord(carriedVisuals)
    clearRecord(carriedVelocities)
    physicsStates.splice(0, physicsStates.length)
    lastAnimationTime = 0
}

const refreshStageSize = () => {
    const rect = stageRef.value!.getBoundingClientRect()

    stageSize.width = rect.width
    stageSize.height = rect.height
}

const graphRuntime = createGraphRuntime({
    getStageElement: () => stageRef.value!,
    refreshStageSize,
    clearTransientState: clearTransientOrbitState,
    tickFrame: tickAnimation
})

onMounted(() => {
    const zoom = loadPersistedGraphZoom()
    if (zoom != null) setGraphZoom(zoom)

    const positions = loadPersistedPositions(
        sortedModules.value.map((item) => item.id)
    )
    for (const [id, point] of Object.entries(positions) as [
        HubModuleId,
        Point
    ][]) {
        nodePositions[id] = point
    }

    const range = loadPersistedRange({
        defaultRadius: defaultEffectiveRangeRadiusPx.value,
        minRadius: effectiveRangeMinRadiusPx,
        maxRadius: effectiveRangeMaxRadiusPx.value
    })
    if (range != null) effectiveRangeRadiusInput.value = range

    const fontSize = loadPersistedFontSize()
    if (fontSize != null) detailFontSizePx.value = fontSize

    graphRuntime.start()
})

onActivated(() => {
    graphRuntime.start()
})

onDeactivated(() => {
    resetActiveInteractionState()
    graphRuntime.stop()
})

onBeforeUnmount(() => {
    resetActiveInteractionState()
    graphRuntime.stop()
})
</script>

<!--
  Unscoped on purpose: mark + detail panel live in child components.
  Class names are graph-specific (relationship-home / graph-node / hub-module-detail-panel).
-->
<style src="./hub-relationship-graph.css"></style>
