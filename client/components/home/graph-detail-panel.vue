<template>
    <aside
        class="hub-module-detail-panel"
        :style="{ '--detail-font-size': `${fontSizePx}px` }"
        aria-label="模块说明"
    >
        <el-scrollbar class="detail-panel-scroll">
            <div class="detail-panel-content">
                <transition name="fade-slide" mode="out-in">
                    <div
                        v-if="moduleDetail && module"
                        :key="module.id"
                        class="detail-body"
                    >
                        <div class="detail-heading">
                            <div
                                class="detail-icon"
                                :style="{ '--detail-tone': detailTone }"
                            >
                                <graph-node-mark
                                    :module-id="module.id"
                                    :icon="module.icon"
                                />
                            </div>
                            <h3>{{ moduleDetail.title }}</h3>
                            <span class="detail-subtitle">
                                {{ moduleDetail.subtitle }}
                            </span>
                        </div>

                        <div
                            class="detail-status-indicator"
                            :class="{ 'is-active': statusActive }"
                        >
                            <span>{{ statusText }}</span>
                        </div>

                        <p class="detail-description">
                            {{ moduleDetail.description }}
                        </p>

                        <div class="detail-section">
                            <h4>功能特性</h4>
                            <ul class="detail-features">
                                <li
                                    v-for="feat in moduleDetail.features"
                                    :key="feat"
                                >
                                    <el-icon :size="12" class="feat-dot">
                                        <Guide />
                                    </el-icon>
                                    <span>{{ feat }}</span>
                                </li>
                            </ul>
                        </div>

                        <div v-if="moduleDetail.tip" class="detail-tip">
                            <el-icon :size="14" class="tip-icon">
                                <Operation />
                            </el-icon>
                            <p>{{ moduleDetail.tip }}</p>
                        </div>
                    </div>

                    <div v-else class="detail-body detail-default">
                        <div class="detail-heading">
                            <div class="default-icon">
                                <el-icon>
                                    <Guide />
                                </el-icon>
                            </div>
                            <h3>ChatLuna 生态网络图谱</h3>
                            <span class="detail-subtitle">
                                ChatLuna 的核心功能、插件 WebUI 与插件配置入口
                            </span>
                        </div>
                        <div class="guide-steps">
                            <div class="step-item">
                                <span class="step-num">1</span>
                                <p>将鼠标悬停在任意节点上，即可在此卡片中显示该节点所属插件的功能与介绍</p>
                            </div>
                            <div class="step-item">
                                <span class="step-num">2</span>
                                <p>每个节点都可以通过点击进入该插件的 WebUI / 插件配置页面</p>
                            </div>
                            <div class="step-item">
                                <span class="step-num">3</span>
                                <p>每个节点都可以长按拖动。拖动 ChatLuna 主节点时，各子节点会被间接拖动；拖动子节点时，不会影响其他节点的位置</p>
                            </div>
                            <div class="step-item">
                                <span class="step-num">4</span>
                                <p>插件节点被拖动到距离 ChatLuna 主节点过远的位置时，该插件将会被关闭。将其拉近 ChatLuna 主节点即可重新开启</p>
                            </div>
                            <div class="step-item">
                                <span class="step-num">5</span>
                                <p>当布局混乱或希望重新显示此页面时，请活用页面左下角的重置按钮</p>
                            </div>
                        </div>
                    </div>
                </transition>
            </div>
        </el-scrollbar>

        <div class="font-size-adjuster" @pointerdown.stop>
            <el-icon :size="13"><Operation /></el-icon>
            <input
                :value="fontSizePx"
                type="range"
                min="12"
                max="20"
                step="1"
                aria-label="调节说明区字体大小"
                @input="handleFontSizeInput"
                @change="handleFontSizeChange"
            />
            <span>{{ fontSizePx }}px</span>
        </div>
    </aside>
</template>

<script setup lang="ts">
import { Guide, Operation } from '@element-plus/icons-vue'
import type { ModuleDetail } from '../../module-catalog'
import type { HubModuleItem } from '../../types'
import GraphNodeMark from './graph-node-mark.vue'

defineProps<{
    module: HubModuleItem | null
    moduleDetail: ModuleDetail | null
    detailTone: string
    statusActive: boolean
    statusText: string
    fontSizePx: number
}>()

const emit = defineEmits<{
    'update:fontSizePx': [value: number]
    'save-font-size': [value: number]
}>()

const readFontSize = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    return Number(input.value)
}

const handleFontSizeInput = (event: Event) => {
    emit('update:fontSizePx', readFontSize(event))
}

const handleFontSizeChange = (event: Event) => {
    const value = readFontSize(event)
    emit('update:fontSizePx', value)
    emit('save-font-size', value)
}
</script>
