<template>
    <div
        class="hub-module-detail-panel"
        :style="{ '--detail-font-size': `${fontSizePx}px` }"
    >
        <el-scrollbar class="detail-panel-scroll">
            <div class="detail-panel-content">
                <transition name="fade-slide" mode="out-in">
                    <div
                        v-if="moduleDetail && module"
                        :key="module.id"
                        class="detail-card-inner"
                    >
                        <div class="detail-card-header">
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
                            <div class="header-titles">
                                <span class="detail-tag" :class="module.group">
                                    {{ module.group === 'core' ? 'Core' : 'Ecosystem' }}
                                </span>
                                <h3>{{ moduleDetail.title }}</h3>
                                <span class="detail-subtitle">
                                    {{ moduleDetail.subtitle }}
                                </span>
                            </div>
                        </div>

                        <div
                            class="detail-status-indicator"
                            :class="{ 'is-active': statusActive }"
                        >
                            <el-icon :size="15">
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
                                <p>
                                    将鼠标悬停在任意节点上，即可在此卡片中显示该节点所属插件的功能与介绍
                                </p>
                            </div>
                            <div class="step-item"></div>
                            <div class="step-item">
                                <span class="step-num">2</span>
                                <p>
                                    按住鼠标左键可以拖动节点。拖动 ChatLuna
                                    主节点时，各子节点会被间接拖动；拖动子节点时，不会影响其他节点的位置
                                </p>
                            </div>
                            <div class="step-item"></div>
                            <div class="step-item">
                                <span class="step-num">3</span>
                                <p>
                                    支持开关控制的生态节点被拖动到距离主节点过远的位置时，该节点所属插件将会被关闭
                                </p>
                            </div>
                            <div class="step-item"></div>
                            <div class="step-item">
                                <span class="step-num">4</span>
                                <p>
                                    未安装、未配置和多配置节点不会触发插件开关操作
                                </p>
                            </div>
                            <div class="step-item"></div>
                            <div class="step-item">
                                <span class="step-num">5</span>
                                <p>
                                    如果节点位置混乱，请活用页面左下角的重置按钮
                                </p>
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
                aria-label="调节卡片字体大小"
                @input="handleFontSizeInput"
                @change="handleFontSizeChange"
            />
            <span>{{ fontSizePx }}px</span>
        </div>
    </div>
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
