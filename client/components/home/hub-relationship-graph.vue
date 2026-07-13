<template>
    <section
        ref="stageRef"
        class="relationship-home"
        @wheel="handleGraphWheel"
    >
        <div class="graph-container-box">
            <header class="graph-header">
                <h1>ChatLuna Hub</h1>
                <p>ChatLuna &#29983;&#24577;&#32593;&#32476;</p>
            </header>

            <aside class="ecosystem-meter" aria-label="ChatLuna ecosystem plugins">
                <span>ChatLuna &#29983;&#24577;&#25554;&#20214;</span>
                <strong>{{ availableEcosystemCount }} / {{ ecosystemModuleCount }}</strong>
                <small>&#21487;&#29992; / &#20840;&#37096;</small>
            </aside>

            <aside class="range-control" aria-label="ChatLuna effective range">
                <div class="range-control-row">
                    <input
                        :value="Math.round(effectiveRangeRadiusPx)"
                        type="range"
                        :min="effectiveRangeMinRadiusPx"
                        :max="Math.round(effectiveRangeMaxRadiusPx)"
                        step="4"
                        aria-label="&#35843;&#25972; ChatLuna &#26377;&#25928;&#33539;&#22260;"
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
                        &#37325;&#32622;
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
                    <defs>
                        <filter id="hub-graph-glow" x="-45%" y="-45%" width="190%" height="190%">
                            <feGaussianBlur stdDeviation="4" result="blur" />
                            <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

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
                        <svg
                            class="chatluna-mark"
                            viewBox="0 0 96 96"
                            aria-hidden="true"
                            focusable="false"
                        >
                            <path
                                d="M45 20C25 20 12 32 12 49c0 17 14 29 34 29 6 0 13-1 18-4l16 8-5-17c4-5 7-10 7-17 0-16-14-28-37-28Z"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="6"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                            <g fill="currentColor">
                                <circle cx="36" cy="62" r="2.5" />
                                <circle cx="46" cy="63" r="2.5" />
                                <circle cx="56" cy="61" r="2.5" />
                                <circle cx="65" cy="57" r="2.5" />
                                <circle cx="42" cy="72" r="2.5" />
                                <circle cx="52" cy="72" r="2.5" />
                                <circle cx="62" cy="69" r="2.5" />
                                <circle cx="69" cy="64" r="2.5" />
                                <circle cx="59" cy="50" r="2.5" />
                                <circle cx="67" cy="45" r="2.5" />
                                <circle cx="72" cy="38" r="2.5" />
                                <circle cx="73" cy="50" r="2.5" />
                            </g>
                        </svg>
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
                        <svg
                            v-if="node.id === 'agent'"
                            class="agent-mark"
                            viewBox="0 0 96 96"
                            aria-hidden="true"
                            focusable="false"
                        >
                            <path
                                d="M48 18v10M34 28h28c11 0 18 7 18 18v16c0 11-7 18-18 18H34c-11 0-18-7-18-18V46c0-11 7-18 18-18Z"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="6"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                            <circle cx="36" cy="54" r="5" fill="currentColor" />
                            <circle cx="60" cy="54" r="5" fill="currentColor" />
                            <path
                                d="M38 67h20"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="6"
                                stroke-linecap="round"
                            />
                            <circle cx="48" cy="14" r="4" fill="currentColor" />
                        </svg>
                        <svg
                            v-else-if="node.id === 'mediaLuna'"
                            class="palette-mark"
                            viewBox="0 0 96 96"
                            aria-hidden="true"
                            focusable="false"
                        >
                            <path
                                d="M47 16c-18 0-32 12-32 29 0 20 15 35 36 35h4c6 0 10-4 10-9 0-3-1-5-3-7-2-2-3-4-3-7 0-5 4-8 9-8h5c6 0 9-4 9-9 0-14-14-24-35-24Z"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="6"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                            <circle cx="34" cy="38" r="4" fill="currentColor" />
                            <circle cx="48" cy="31" r="4" fill="currentColor" />
                            <circle cx="62" cy="38" r="4" fill="currentColor" />
                            <circle cx="39" cy="55" r="4" fill="currentColor" />
                        </svg>
                        <MemesLunaIcon
                            v-else-if="node.id === 'memesLuna'"
                            class="memesluna-mark"
                        />
                        <TreeOfLifeIcon
                            v-else-if="node.id === 'livingMemory'"
                            class="livingmemory-mark"
                            style="width: 36px; height: 36px; color: currentColor;"
                        />
                        <el-icon v-else :size="34">
                            <component :is="resolveIcon(node.icon)" />
                        </el-icon>
                    </span>
                    <span class="node-title">{{ node.title }}</span>
                    <span class="node-status">
                        {{ resolveNodeStatus(node) }}
                    </span>
                </button>
                </div>
            </div>
        </div>

        <!-- 悬浮型模块详情面板 -->
        <div
            class="hub-module-detail-panel"
            :style="{ '--detail-font-size': `${detailFontSizePx}px` }"
        >
            <el-scrollbar class="detail-panel-scroll">
                <div class="detail-panel-content">
                    <transition name="fade-slide" mode="out-in">
                        <div
                            v-if="activeModuleDetail && activeDetailModule"
                            :key="activeDetailModuleId"
                            class="detail-card-inner"
                        >
                            <div class="detail-card-header">
                                <div class="detail-icon" :style="{ '--detail-tone': activeDetailModule.id === 'chatluna' ? 'var(--k-color-primary)' : getTone(activeDetailModule) }">
                                    <svg
                                        v-if="activeDetailModule.id === 'chatluna'"
                                        class="chatluna-mark mini"
                                        viewBox="0 0 96 96"
                                    >
                                        <path
                                            d="M45 20C25 20 12 32 12 49c0 17 14 29 34 29 6 0 13-1 18-4l16 8-5-17c4-5 7-10 7-17 0-16-14-28-37-28Z"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="6"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                        />
                                        <g fill="currentColor">
                                            <circle cx="36" cy="62" r="2.5" />
                                            <circle cx="46" cy="63" r="2.5" />
                                            <circle cx="56" cy="61" r="2.5" />
                                            <circle cx="65" cy="57" r="2.5" />
                                            <circle cx="42" cy="72" r="2.5" />
                                            <circle cx="52" cy="72" r="2.5" />
                                            <circle cx="62" cy="69" r="2.5" />
                                            <circle cx="69" cy="64" r="2.5" />
                                            <circle cx="59" cy="50" r="2.5" />
                                            <circle cx="67" cy="45" r="2.5" />
                                            <circle cx="72" cy="38" r="2.5" />
                                            <circle cx="73" cy="50" r="2.5" />
                                        </g>
                                    </svg>
                                    <svg
                                        v-else-if="activeDetailModule.id === 'agent'"
                                        class="agent-mark mini"
                                        viewBox="0 0 96 96"
                                    >
                                        <path
                                            d="M48 18v10M34 28h28c11 0 18 7 18 18v16c0 11-7 18-18 18H34c-11 0-18-7-18-18V46c0-11 7-18 18-18Z"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="6"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                        />
                                        <circle cx="36" cy="54" r="5" fill="currentColor" />
                                        <circle cx="60" cy="54" r="5" fill="currentColor" />
                                        <path
                                            d="M38 67h20"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="6"
                                            stroke-linecap="round"
                                        />
                                        <circle cx="48" cy="14" r="4" fill="currentColor" />
                                    </svg>
                                    <svg
                                        v-else-if="activeDetailModule.id === 'mediaLuna'"
                                        class="palette-mark mini"
                                        viewBox="0 0 96 96"
                                    >
                                        <path
                                            d="M47 16c-18 0-32 12-32 29 0 20 15 35 36 35h4c6 0 10-4 10-9 0-3-1-5-3-7-2-2-3-4-3-7 0-5 4-8 9-8h5c6 0 9-4 9-9 0-14-14-24-35-24Z"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="6"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                        />
                                        <circle cx="34" cy="38" r="4" fill="currentColor" />
                                        <circle cx="48" cy="31" r="4" fill="currentColor" />
                                        <circle cx="62" cy="38" r="4" fill="currentColor" />
                                        <circle cx="39" cy="55" r="4" fill="currentColor" />
                                    </svg>
                                    <MemesLunaIcon
                                        v-else-if="activeDetailModule.id === 'memesLuna'"
                                        class="memesluna-mark mini"
                                    />
                                    <TreeOfLifeIcon
                                        v-else-if="activeDetailModule.id === 'livingMemory'"
                                        class="livingmemory-mark mini"
                                        style="width: 22px; height: 22px; color: currentColor;"
                                    />
                                    <el-icon v-else :size="22">
                                        <component :is="resolveIcon(activeDetailModule.icon)" />
                                    </el-icon>
                                </div>
                                <div class="header-titles">
                                    <span class="detail-tag" :class="activeDetailModule.group">
                                        {{ activeDetailModule.group === 'core' ? 'Core' : 'Ecosystem' }}
                                    </span>
                                    <h3>{{ activeModuleDetail.title }}</h3>
                                    <span class="detail-subtitle">{{ activeModuleDetail.subtitle }}</span>
                                </div>
                            </div>

                            <div class="detail-status-indicator" :class="{ 'is-active': isHubModuleStatusActive(activeDetailModule) }">
                                <el-icon :size="15">
                                    <component :is="isHubModuleStatusActive(activeDetailModule) ? icons.Connection : icons.Collection" />
                                </el-icon>
                                <span>
                                    {{ getDetailStatusText(activeDetailModule) }}
                                </span>
                            </div>

                            <p class="detail-description">
                                {{ activeModuleDetail.description }}
                            </p>

                            <div class="detail-section">
                                <h4>功能特性</h4>
                                <ul class="detail-features">
                                    <li v-for="feat in activeModuleDetail.features" :key="feat">
                                        <el-icon :size="12" class="feat-dot">
                                            <Guide />
                                        </el-icon>
                                        <span>{{ feat }}</span>
                                    </li>
                                </ul>
                            </div>

                            <div v-if="activeModuleDetail.tip" class="detail-tip">
                                <el-icon :size="14" class="tip-icon">
                                    <Operation />
                                </el-icon>
                                <p>{{ activeModuleDetail.tip }}</p>
                            </div>
                        </div>

                        <!-- 默认展示说明 -->
                        <div v-else class="detail-card-default">
                            <div class="default-icon">
                                <el-icon :size="38">
                                    <Guide />
                                </el-icon>
                            </div>
                            <h3>ChatLuna生态网络图谱</h3>
                            <p>
                                ChatLuna 的核心功能、插件 WebUI 与插件配置入口
                            </p>
                            <div class="guide-steps">
                                <div class="step-item">
                                    <span class="step-num">1</span>
                                    <p>将鼠标悬停在任意节点上，即可在此卡片中显示该节点所属插件的功能与介绍</p>
                                </div>
                                <div class="step-item"></div>
                                <div class="step-item">
                                    <span class="step-num">2</span>
                                    <p>按住鼠标左键可以拖动节点。拖动 ChatLuna 主节点时，各子节点会被间接拖动；拖动子节点时，不会影响其他节点的位置</p>
                                </div>
                                <div class="step-item"></div>
                                <div class="step-item">
                                    <span class="step-num">3</span>
                                    <p>支持开关控制的生态节点被拖动到距离主节点过远的位置时，该节点所属插件将会被关闭</p>
                                </div>
                                <div class="step-item"></div>
                                <div class="step-item">
                                    <span class="step-num">4</span>
                                    <p>未安装、未配置和多配置节点不会触发插件开关操作</p>
                                </div>
                                <div class="step-item"></div>
                                <div class="step-item">
                                    <span class="step-num">5</span>
                                    <p>如果节点位置混乱，请活用页面左下角的重置按钮</p>
                                </div>
                            </div>
                        </div>
                    </transition>
                </div>
            </el-scrollbar>

            <!-- 文本大小调节器 -->
            <div class="font-size-adjuster" @pointerdown.stop>
                <el-icon :size="13"><Operation /></el-icon>
                <input
                    v-model="detailFontSizePx"
                    type="range"
                    min="12"
                    max="20"
                    step="1"
                    aria-label="调节卡片字体大小"
                    @change="savePersistedFontSize(detailFontSizePx)"
                />
                <span>{{ detailFontSizePx }}px</span>
            </div>
        </div>
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
    ref,
    type Component
} from 'vue'
import {
    ChatRound,
    Collection,
    Connection,
    DataAnalysis,
    Guide,
    Link,
    Message,
    Operation,
    Picture,
    Search,
    Star,
    TrendCharts,
    UserFilled
} from '@element-plus/icons-vue'
import MemesLunaIcon from '../../icons/memesluna.vue'
import TreeOfLifeIcon from '../../icons/tree-of-life.vue'
import {
    canOpenHubModule,
    canOpenHubModuleMarket,
    canToggleHubModule,
    isHubModuleDisabled,
    isHubModuleStatusActive
} from '../../module-access'
import { moduleDetails, type ModuleDetail } from '../../module-catalog'
import type {
    HubModuleIconName,
    HubModuleId,
    HubModuleItem
} from '../../types'
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
import {
    clearPersistedGraphState,
    loadPersistedFontSize,
    loadPersistedGraphZoom,
    loadPersistedPositions,
    loadPersistedRange,
    savePersistedFontSize,
    savePersistedGraphZoom,
    savePersistedPositions,
    savePersistedRange
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
    graphZoomMax,
    graphZoomMin,
    type DragState,
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

const icons = {
    ChatRound,
    Collection,
    Connection,
    DataAnalysis,
    Link,
    Message,
    Picture,
    Search,
    Star,
    TrendCharts,
    UserFilled,
    MemesLunaEmoji: MemesLunaIcon
} satisfies Record<HubModuleIconName, Component>

const stageRef = ref<HTMLElement | null>(null)
const draggingId = ref<HubModuleId | null>(null)
const effectiveRangeRadiusInput = ref(0)
const effectiveRangePreviewVisible = ref(false)
const graphZoom = ref(1)
const stageSize = reactive({
    width: graphViewBoxWidth,
    height: graphViewBoxHeight
})
const nodePositions = reactive<Partial<Record<HubModuleId, Point>>>({})
const carriedVisuals = reactive<Partial<Record<HubModuleId, Point>>>({})
const carriedVelocities: Partial<Record<HubModuleId, Point>> = {}
const physicsStates: PhysicsState[] = []

const {
    togglePending,
    toggleErrors,
    setModuleEnabled,
    disposeToggleErrors
} = useModuleToggle()

let dragState: DragState | null = null
let lastAnimationTime = 0
let effectiveRangePreviewHideTimer = 0
let rangeControlPointerActive = false

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

const isOrbitActive = computed(
    () =>
        props.animationsEnabled &&
        draggingId.value === null &&
        !rangeControlPointerActive
)

const graphViewportStyle = computed(
    () =>
        ({
            '--graph-zoom': graphZoom.value.toFixed(3)
        }) as Record<string, string>
)

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

const resolveIcon = (icon: HubModuleIconName) => icons[icon]

const isNodePending = (id: HubModuleId) => Boolean(togglePending[id])
const isNodeOutOfRange = (node: GraphNode) => {
    return canToggleHubModule(node) && !isPointWithinEffectiveRange(node)
}

const getNodeTitle = (node: GraphNode) => {
    return toggleErrors[node.id] ?? node.reason ?? node.title
}

const resolveNodeStatus = (node: GraphNode) => {
    return getNodeStatus(node, togglePending[node.id], Boolean(toggleErrors[node.id]))
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

const handleRangeControlInput = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    effectiveRangeRadiusInput.value = clampNumber(
        Number(input.value),
        effectiveRangeMinRadiusPx,
        effectiveRangeMaxRadiusPx.value
    )
    showEffectiveRangePreview()
    if (!rangeControlPointerActive) scheduleEffectiveRangePreviewHide()
    savePersistedRange(effectiveRangeRadiusPx.value)
}

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
    window.removeEventListener('pointercancel', handleRangeControlInteractionEnd)
}

const handleRangeControlInteractionStart = () => {
    detachRangeControlPointerListeners()
    rangeControlPointerActive = true
    showEffectiveRangePreview()
    window.addEventListener('pointerup', handleRangeControlInteractionEnd)
    window.addEventListener('pointercancel', handleRangeControlInteractionEnd)
}

const handleRangeControlInteractionEnd = () => {
    detachRangeControlPointerListeners()
    rangeControlPointerActive = false
    scheduleEffectiveRangePreviewHide()
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

    const target = sortedModules.value.find((item) => item.id === dragState!.id)
    if (!dragState.moved && target) selectModule(target)
    if (dragState.moved) {
        if (target) {
            const finalPosition =
                carriedVisuals[target.id] ?? nodePositions[target.id]

            if (finalPosition) nodePositions[target.id] = { ...finalPosition }
            if (finalPosition) carriedVisuals[target.id] = { ...finalPosition }
            carriedVelocities[target.id] = { x: 0, y: 0 }

            if (target.id === 'chatluna') {
                for (const item of ecosystemModules.value) {
                    void reconcileModuleBoundary(item)
                }
            } else {
                void reconcileModuleBoundary(target)
            }
        }

        savePersistedPositions(
            nodePositions,
            sortedModules.value.map((item) => item.id)
        )
    }

    dragState = null
    draggingId.value = null
    detachDragListeners()
}

const detachDragListeners = () => {
    window.removeEventListener('pointermove', handleDragMove)
    window.removeEventListener('pointerup', handleDragEnd)
    window.removeEventListener('pointercancel', handleDragEnd)
}

const resetActiveInteractionState = () => {
    dragState = null
    draggingId.value = null
    rangeControlPointerActive = false
    detachDragListeners()
    detachRangeControlPointerListeners()
    clearEffectiveRangePreviewHideTimer()
    effectiveRangePreviewVisible.value = false
}

const getBasePosition = (node: GraphNode): Point => {
    const item = sortedModules.value.find((module) => module.id === node.id)
    if (item) {
        const visual = node.id === 'chatluna' ? undefined : carriedVisuals[node.id]
        return visual ? { ...visual } : getBasePositionForItem(item)
    }

    return {
        x: node.x,
        y: node.y
    }
}

const getBasePositionForItem = (item: HubModuleItem): Point => {
    const stored = nodePositions[item.id]
    if (stored) return { ...stored }
    if (item.id === 'chatluna') return getDefaultCorePosition()

    return getDefaultSatellitePosition(item)
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

const buildPhysicsContext = (): PhysicsTickContext | null => {
    if (!coreNode.value || !coreModule.value) return null

    return {
        physicsStates,
        core: coreNode.value,
        coreModule: coreModule.value,
        ecosystemModules: ecosystemModules.value,
        draggingId: draggingId.value,
        dragMoved: Boolean(dragState?.moved),
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
    if (event.deltaMode === 2) return event.deltaY * stageSize.height

    return event.deltaY
}

const handleGraphWheel = (event: WheelEvent) => {
    if (dragState || rangeControlPointerActive) return
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
    disposeToggleErrors()
})
</script>


<style scoped>
.relationship-home {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 560px;
    overflow: hidden;
    color: var(--k-text-dark);
    background: transparent;
}

.relationship-home::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background-image: radial-gradient(
        color-mix(in srgb, var(--k-text-light), transparent 64%) 1px,
        transparent 1.4px
    );
    background-size: 24px 24px;
    background-position: -12px -12px;
    -webkit-mask-image: radial-gradient(ellipse 78% 78% at 50% 48%, #000 35%, transparent 92%);
    mask-image: radial-gradient(ellipse 78% 78% at 50% 48%, #000 35%, transparent 92%);
    opacity: 0.5;
}

.graph-container-box {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    z-index: 1;
}

.hub-module-detail-panel {
    position: absolute;
    bottom: 24px;
    right: 28px;
    width: 500px;
    height: 800px; /* Fixed height so size is not affected by text content */
    border: 1px solid var(--k-color-divider);
    border-radius: 16px;
    background: var(--k-card-bg);
    box-shadow: var(--k-card-shadow);
    display: flex;
    flex-direction: column;
    z-index: 5;
    transition: all 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
}

.detail-panel-scroll {
    flex: 1;
    min-height: 0;
}

.detail-panel-content {
    box-sizing: border-box;
    padding: 22px 20px 24px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch; /* Stretch child elements to fill container width to keep margin padding consistent */
}

.detail-card-inner {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    text-align: left;
    gap: 16px;
    width: 100%;
    will-change: transform, opacity;
}

.detail-card-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 12px;
    width: 100%;
}

.detail-icon {
    width: 54px;
    height: 54px;
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    display: grid;
    place-items: center;
    color: var(--detail-tone);
    background: var(--k-hover-bg);
}

.detail-icon .chatluna-mark.mini,
.detail-icon .agent-mark.mini,
.detail-icon .palette-mark.mini,
.detail-icon .memesluna-mark.mini {
    width: 32px;
    height: 32px;
}

.header-titles {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 6px;
    width: 100%;
}

.detail-tag {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    padding: 3px 8px;
    border-radius: 4px;
    line-height: 1;
}

.detail-tag.core {
    color: var(--k-color-primary);
    background: color-mix(in srgb, var(--k-color-primary), transparent 90%);
    border: 1px solid color-mix(in srgb, var(--k-color-primary), transparent 78%);
}

.detail-tag.ecosystem {
    color: var(--k-color-success);
    background: color-mix(in srgb, var(--k-color-success), transparent 90%);
    border: 1px solid color-mix(in srgb, var(--k-color-success), transparent 78%);
}

.header-titles h3 {
    margin: 0;
    font-size: calc(var(--detail-font-size) + 4px);
    font-weight: 760;
    color: var(--k-text-dark);
    line-height: 1.25;
}

.detail-subtitle {
    font-size: calc(var(--detail-font-size) - 2px);
    color: var(--k-text-normal); /* Changed from var(--k-text-light) to var(--k-text-normal) for better readability */
    font-weight: 550;
}

.detail-status-indicator {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: calc(var(--detail-font-size) - 1.5px);
    font-weight: 600;
    color: var(--k-text-dark); /* Changed from var(--k-text-light) to var(--k-text-dark) for better readability */
    background: var(--k-hover-bg);
    border: 1px solid var(--k-color-divider);
    width: fit-content;
    align-self: center; /* Keep the status indicator badge centered */
}

.detail-status-indicator.is-active {
    color: var(--k-color-success);
    background: color-mix(in srgb, var(--k-color-success), transparent 93%);
    border-color: color-mix(in srgb, var(--k-color-success), transparent 82%);
}

.detail-description {
    margin: 0;
    font-size: var(--detail-font-size);
    line-height: 1.6;
    color: var(--k-text-dark); /* Changed from var(--k-text-normal) to var(--k-text-dark) for higher contrast */
}

.detail-section {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    gap: 8px;
    width: 100%;
}

.detail-section h4 {
    margin: 0;
    font-size: calc(var(--detail-font-size) - 1.5px);
    font-weight: 700;
    color: var(--k-text-normal); /* Changed from var(--k-text-light) to var(--k-text-normal) for better readability */
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.detail-features {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    gap: 6px;
    width: 100%;
}

.detail-features li {
    display: inline-flex;
    align-items: flex-start;
    justify-content: flex-start;
    gap: 8px;
    font-size: calc(var(--detail-font-size) - 0.5px);
    color: var(--k-text-dark); /* Changed from var(--k-text-normal) to var(--k-text-dark) for higher contrast */
    line-height: 1.4;
}

.feat-dot {
    color: var(--k-color-primary);
    flex-shrink: 0;
    margin-top: 3px; /* Align checkmark icon with first line of multiline feature text */
}

.detail-tip {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    text-align: left;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--k-color-warning), transparent 94%);
    border: 1px solid color-mix(in srgb, var(--k-color-warning), transparent 84%);
    color: color-mix(in srgb, var(--k-color-warning), var(--k-text-dark) 34%);
    width: 100%;
    box-sizing: border-box;
}

.tip-icon {
    flex-shrink: 0;
    color: var(--k-color-warning);
    margin-top: 2px; /* Align icon vertically with first line of tip description */
}

.detail-tip p {
    flex: 1 1 auto;
    min-width: 0;
    margin: 0;
    font-size: calc(var(--detail-font-size) - 1.5px);
    line-height: 1.5;
    overflow-wrap: anywhere;
}

.detail-card-default {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    text-align: left;
    padding: 8px 4px;
    height: 100%;
    width: 100%;
}

.default-icon {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--k-color-primary), transparent 92%);
    color: var(--k-color-primary);
    display: grid;
    place-items: center;
    margin-bottom: 16px;
    align-self: center; /* Center the icon at the top of default explanation */
}

.detail-card-default h3 {
    margin: 0 0 12px;
    font-size: calc(var(--detail-font-size) + 4px);
    font-weight: 760;
    color: var(--k-text-dark);
    text-align: center; /* Center only the main title */
}

.detail-card-default p {
    margin: 0 0 20px;
    font-size: var(--detail-font-size);
    line-height: 1.6;
    color: var(--k-text-normal); /* Changed from var(--k-text-light) to var(--k-text-normal) for better readability */
}

.guide-steps {
    display: flex;
    flex-direction: column;
    gap: 12px;
    text-align: left;
    align-items: stretch;
    width: 100%;
}

.step-item {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    text-align: left;
    gap: 10px;
    width: 100%;
}

.step-num {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--k-hover-bg);
    border: 1px solid var(--k-color-divider);
    font-size: 10px;
    font-weight: 700;
    display: grid;
    place-items: center;
    color: var(--k-text-normal);
    flex-shrink: 0;
    margin-top: 2px; /* Align number badge with first line of step text */
}

.step-item p {
    margin: 0;
    font-size: calc(var(--detail-font-size) - 1px);
    line-height: 1.5;
    color: var(--k-text-dark); /* Changed from var(--k-text-normal) to var(--k-text-dark) for higher contrast */
}

.font-size-adjuster {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 14px;
    border-top: 1px solid var(--k-color-divider);
    background: color-mix(in srgb, var(--k-card-bg), var(--k-hover-bg) 35%);
    font-size: 11px;
    color: var(--k-text-light);
    user-select: none;
    box-sizing: border-box;
    width: 100%;
}

.font-size-adjuster input {
    flex: 1;
    min-width: 0;
    height: 3px;
    accent-color: var(--k-color-primary);
    cursor: pointer;
}

.font-size-adjuster span {
    font-weight: 700;
    min-width: 32px;
    text-align: right;
    font-family: monospace;
}

/* Animations */
.fade-slide-enter-active,
.fade-slide-leave-active {
    transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from {
    opacity: 0;
    transform: translateX(10px);
}

.fade-slide-leave-to {
    opacity: 0;
    transform: translateX(-10px);
}

.graph-header,
.ecosystem-meter,
.range-control {
    position: absolute;
    z-index: 4;
}

.graph-header {
    top: 24px;
    left: 28px;
    max-width: min(420px, calc(100% - 240px));
}

.graph-header h1 {
    margin: 0;
    font-size: 30px;
    line-height: 1.15;
    font-weight: 800;
    letter-spacing: 0.2px;
    color: var(--k-text-dark);
}

.graph-header p {
    margin: 10px 0 0;
    color: var(--k-text-light);
    font-size: 14px;
    line-height: 1.45;
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.graph-header p::before {
    content: "";
    width: 22px;
    height: 2px;
    border-radius: 2px;
    background: var(--k-color-divider);
}

.ecosystem-meter {
    top: 24px;
    right: 28px;
    min-width: 150px;
    padding: 12px 14px;
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    display: grid;
    gap: 4px;
    color: var(--k-text-dark);
    background: var(--k-card-bg);
    box-shadow: var(--k-card-shadow);
}

.ecosystem-meter span,
.ecosystem-meter small {
    color: var(--k-text-light);
    font-size: 12px;
    line-height: 1.2;
}

.ecosystem-meter strong {
    font-size: 24px;
    line-height: 1.1;
    font-weight: 800;
    color: var(--k-color-primary);
}

.range-control {
    left: max(24px, env(safe-area-inset-left, 0px));
    bottom: max(24px, env(safe-area-inset-bottom, 0px));
    box-sizing: border-box;
    width: min(260px, calc(100% - 36px));
    padding: 10px 12px;
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    background: var(--k-card-bg);
    box-shadow: var(--k-card-shadow);
}

.range-control-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
}

.range-control input {
    width: 100%;
    min-width: 0;
    accent-color: var(--k-color-primary);
    cursor: pointer;
}

.range-reset-button {
    height: 28px;
    padding: 0 10px;
    border: 1px solid var(--k-color-divider);
    border-radius: 8px;
    color: var(--k-text-dark);
    background: color-mix(in srgb, var(--k-card-bg), var(--k-color-primary) 6%);
    font-size: 12px;
    font-weight: 650;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    transition:
        border-color 0.16s ease,
        color 0.16s ease,
        background 0.16s ease;
}

.range-reset-button:hover,
.range-reset-button:focus-visible {
    border-color: color-mix(in srgb, var(--k-color-primary), var(--k-color-divider) 34%);
    color: var(--k-color-primary);
    background: color-mix(in srgb, var(--k-card-bg), var(--k-color-primary) 12%);
}

.range-reset-button:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--k-color-primary), transparent 38%);
    outline-offset: 2px;
}

.graph-stage,
.graph-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
}

.graph-stage {
    z-index: 1;
}

.graph-viewport {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    transform: scale(var(--graph-zoom, 1));
    transform-origin: 50% 50%;
    will-change: transform;
}

.graph-svg {
    overflow: visible;
}

.edge-layer {
    color: var(--k-color-primary);
    --disabled-edge-tone: color-mix(
        in srgb,
        var(--k-text-light),
        var(--k-color-divider) 42%
    );
}

.effective-range {
    fill: none;
    stroke: color-mix(in srgb, var(--k-color-primary), var(--k-color-divider) 56%);
    stroke-width: 1.2;
    stroke-dasharray: 10 14;
    opacity: 0.58;
    vector-effect: non-scaling-stroke;
    pointer-events: none;
}

.graph-edge {
    fill: none;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
}

.edge-base {
    stroke: color-mix(in srgb, currentColor, var(--k-color-divider) 36%);
    stroke-width: 1.6;
    opacity: 0.55;
    transition:
        opacity 0.16s ease,
        stroke 0.16s ease,
        stroke-width 0.16s ease;
}

.edge-flow {
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-dasharray: 20 150;
    stroke-dashoffset: 0;
    opacity: 0;
    filter: none;
    animation: none;
    transition:
        opacity 0.16s ease,
        stroke 0.16s ease;
}

.animations-enabled .edge-flow {
    opacity: 0.64;
    filter: url(#hub-graph-glow);
    animation: edge-flow 3.4s linear infinite;
}

.edge-base.risky {
    stroke-width: 2.4;
    opacity: 0.82;
}

.animations-enabled .edge-flow.risky {
    opacity: 0.82;
}

.graph-edge.disabled {
    stroke: var(--disabled-edge-tone);
    filter: none;
    animation: none;
}

.edge-base.disabled {
    opacity: 0.42;
}

.edge-flow.disabled {
    opacity: 0;
}

/* Removed .edge-joint styles since joint circles are deleted */

.graph-node {
    position: absolute;
    left: 0;
    top: 0;
    width: calc(var(--node-size) + 42px);
    min-height: calc(var(--node-size) + 50px);
    padding: 0;
    border: 0;
    display: grid;
    justify-items: center;
    align-content: start;
    gap: 8px;
    color: var(--k-text-dark);
    background: transparent;
    cursor: pointer;
    touch-action: none;
    user-select: none;
    /* Compositor-only positioning: translate by absolute px every frame, then
       center the node without triggering layout. */
    transform:
        translate(var(--node-px, 0px), var(--node-py, 0px))
        translate(-50%, calc(var(--node-size) / -2));
    will-change: transform;
    transition: opacity 0.2s ease;
}

.graph-node:focus-visible {
    outline: 2px solid var(--node-tone);
    outline-offset: 6px;
}

.graph-node.dragging {
    cursor: grabbing;
    transition-duration: 0.01ms;
}

.graph-node.core,
.graph-node.satellite {
    cursor: grab;
}

.graph-node.disabled {
    opacity: 0.52;
}

.graph-node.pending {
    opacity: 0.72;
}

.graph-node.out-of-range .node-status {
    color: var(--k-color-danger);
}

.node-disc {
    position: relative;
    width: var(--node-size);
    height: var(--node-size);
    border: 1px solid color-mix(in srgb, var(--node-tone), var(--k-color-divider) 34%);
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: var(--node-tone);
    background:
        radial-gradient(circle at 50% 34%, color-mix(in srgb, var(--k-card-bg), var(--node-tone) 12%), transparent 58%),
        color-mix(in srgb, var(--k-card-bg), var(--node-tone) 8%);
    /* Static shadow: painted once into the node's compositor layer, so orbital
       motion just translates the cached texture instead of repainting it. The
       breathing feel is carried by .node-glow (opacity/scale only). */
    box-shadow:
        0 0 0 1px color-mix(in srgb, var(--k-card-bg), transparent 46%) inset,
        0 16px 34px color-mix(in srgb, var(--k-text-dark), transparent 88%),
        0 0 28px color-mix(in srgb, var(--node-tone), transparent 72%);
    overflow: hidden;
}

.graph-node.configurable .node-disc {
    border-style: dashed;
    border-color: color-mix(in srgb, var(--node-tone), var(--k-color-divider) 18%);
    background:
        radial-gradient(circle at 50% 34%, color-mix(in srgb, var(--k-card-bg), var(--node-tone) 6%), transparent 58%),
        color-mix(in srgb, var(--k-card-bg), var(--k-hover-bg) 42%);
    box-shadow:
        0 0 0 1px color-mix(in srgb, var(--k-card-bg), transparent 54%) inset,
        0 12px 24px color-mix(in srgb, var(--k-text-dark), transparent 92%);
}

.graph-node.configurable .node-glow {
    opacity: 0.18;
    animation: none;
}

.graph-node.configurable .node-status {
    color: color-mix(in srgb, var(--k-text-light), var(--node-tone) 20%);
}

.animations-enabled .satellite:not(.dragging) .node-disc {
    animation: node-float 6.8s ease-in-out infinite;
    animation-delay: var(--float-delay);
}

.orbit-active .satellite:not(.dragging) .node-disc {
    /* Suppress the idle float while the node is already moving along its orbit */
    animation: none !important;
}

.node-disc::after {
    content: "";
    position: absolute;
    inset: 17%;
    border-radius: inherit;
    border: 1px solid color-mix(in srgb, var(--node-tone), transparent 70%);
    opacity: 0.72;
}

.node-glow {
    position: absolute;
    inset: -18%;
    border-radius: inherit;
    background: radial-gradient(circle, color-mix(in srgb, var(--node-tone), transparent 72%), transparent 68%);
    opacity: 0.54;
    animation: none;
}

.animations-enabled .node-glow {
    animation: glow-pulse 3.8s ease-in-out infinite;
}

.core .node-disc {
    box-shadow:
        0 0 0 1px color-mix(in srgb, var(--node-tone), transparent 58%) inset,
        0 18px 42px color-mix(in srgb, var(--k-text-dark), transparent 88%),
        0 0 26px color-mix(in srgb, var(--node-tone), transparent 50%),
        0 0 64px color-mix(in srgb, var(--node-tone), transparent 70%);
}

.chatluna-mark,
.agent-mark,
.palette-mark,
.memesluna-mark,
.node-disc .el-icon {
    position: relative;
    z-index: 1;
}

.chatluna-mark {
    width: 74px;
    height: 74px;
    color: currentColor;
}

.agent-mark {
    width: 58px;
    height: 58px;
    color: currentColor;
}

.palette-mark {
    width: 58px;
    height: 58px;
    color: currentColor;
}

.memesluna-mark {
    width: 58px;
    height: 58px;
    color: currentColor;
}

.node-title,
.node-status {
    max-width: 168px;
    overflow-wrap: anywhere;
    text-align: center;
}

.node-title {
    color: var(--k-text-dark);
    font-size: 14px;
    line-height: 1.2;
    font-weight: 700;
}

.node-status {
    color: var(--k-text-light);
    font-size: 12px;
    line-height: 1.2;
}

@keyframes edge-flow {
    to {
        stroke-dashoffset: -170;
    }
}

/* Removed @keyframes joint-pulse since joint circles are deleted */

@keyframes node-float {
    0%,
    100% {
        transform: translateY(0);
    }

    50% {
        transform: translateY(-3px);
    }
}

@keyframes glow-pulse {
    0%,
    100% {
        opacity: 0.38;
        transform: scale(0.94);
    }

    50% {
        opacity: 0.72;
        transform: scale(1.08);
    }
}

@media (max-width: 1024px) {
    .hub-module-detail-panel {
        position: absolute;
        bottom: 24px;
        right: 28px;
        left: 28px;
        width: auto;
        max-height: 250px;
    }
}

@media (max-width: 768px) {
    .relationship-home {
        min-height: 520px;
    }

    .graph-header {
        top: 16px;
        left: 16px;
        max-width: calc(100% - 190px);
    }

    .graph-header h1 {
        font-size: 24px;
    }

    .ecosystem-meter {
        top: 16px;
        right: 16px;
        min-width: 126px;
    }

    .range-control {
        left: max(14px, env(safe-area-inset-left, 0px));
        bottom: max(14px, env(safe-area-inset-bottom, 0px));
        width: min(248px, calc(100% - 28px));
        z-index: 6; /* Float above the detail card on mobile if overlapping */
    }

    .hub-module-detail-panel {
        bottom: max(14px, env(safe-area-inset-bottom, 0px));
        right: 14px;
        left: 14px;
        max-height: 200px;
        border-radius: 10px;
    }

    .detail-panel-content {
        padding: 16px 14px 18px;
    }

    .chatluna-mark {
        width: 68px;
        height: 68px;
    }

    .agent-mark {
        width: 52px;
        height: 52px;
    }

    .palette-mark,
    .memesluna-mark {
        width: 52px;
        height: 52px;
    }

    .node-title,
    .node-status {
        max-width: 126px;
    }
}

@media (max-width: 520px) {
    .graph-header {
        max-width: calc(100% - 32px);
    }

    .ecosystem-meter {
        top: 92px;
        left: 16px;
        right: auto;
    }
}

@media (prefers-reduced-motion: reduce) {
    .edge-flow,
    .node-disc,
    .node-glow {
        animation: none !important;
    }

    .graph-node {
        transition-duration: 0.01ms !important;
    }

}
</style>
