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
                                    mini
                                />
                            </div>
                            <span class="detail-tag" :class="module.group">
                                {{ module.group === 'core' ? 'Core' : 'Ecosystem' }}
                            </span>
                            <h3>{{ moduleDetail.title }}</h3>
                            <span class="detail-subtitle">
                                {{ moduleDetail.subtitle }}
                            </span>
                        </div>

                        <div
                            class="detail-status-indicator"
                            :class="{ 'is-active': statusActive }"
                        >
                            <el-icon :size="14">
                                <component
                                    :is="statusActive ? Connection : Collection"
                                />
                            </el-icon>
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
                                <el-icon :size="20">
                                    <Guide />
                                </el-icon>
                            </div>
                            <h3>生态网络图谱</h3>
                            <span class="detail-subtitle">
                                浏览 Core、WebUI 与配置入口；悬停节点查看说明。
                            </span>
                        </div>
                        <div class="guide-steps">
                            <div class="step-item">
                                <span class="step-num">1</span>
                                <p>悬停节点：右侧显示插件说明与状态</p>
                            </div>
                            <div class="step-item">
                                <span class="step-num">2</span>
                                <p>拖动节点：主节点带动卫星；卫星可单独定位</p>
                            </div>
                            <div class="step-item">
                                <span class="step-num">3</span>
                                <p>拖出有效范围：可切换的生态插件将被关闭</p>
                            </div>
                            <div class="step-item">
                                <span class="step-num">4</span>
                                <p>未安装 / 未配置 / 多配置：不触发开关</p>
                            </div>
                            <div class="step-item">
                                <span class="step-num">5</span>
                                <p>布局混乱时，使用左下角「重置」</p>
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
import { Collection, Connection, Guide, Operation } from '@element-plus/icons-vue'
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
