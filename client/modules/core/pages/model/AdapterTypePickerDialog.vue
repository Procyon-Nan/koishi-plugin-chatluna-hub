<template>
    <el-dialog
        v-model="visible"
        width="480px"
        class="chatluna-picker-dialog"
        align-center
        append-to-body
        :show-close="false"
    >
        <div class="picker-header">
            <h3>添加新的模型适配器</h3>
            <el-button
                class="header-close-btn"
                text
                circle
                :icon="Close"
                @click="visible = false"
            />
        </div>

        <div class="picker-body">
            <div
                class="adapter-list-wrapper"
                @wheel.prevent="handleWheel"
                @pointerdown="handlePointerDown"
                @pointerup="handlePointerUp"
                @pointercancel="resetSwipeState"
                @click.capture="handleListClick"
            >
                <Transition :name="transitionName" mode="out-in">
                    <div :key="currentPage" class="adapter-list">
                        <button
                            v-for="type in currentPageItems"
                            :key="type.id"
                            type="button"
                            class="adapter-tile-btn"
                            :class="{
                                'is-disabled': !type.canCreate,
                                'is-missing': !type.installed
                            }"
                            :aria-disabled="!type.canCreate"
                            :title="type.createReason"
                            @click="emit('choose', type)"
                        >
                            <div class="tile-avatar">{{ typeInitial(type) }}</div>
                            <div class="tile-info">
                                <span class="tile-name">{{ type.title }}</span>
                            </div>

                            <span v-if="!type.installed" class="tile-badge badge-missing">
                                未安装
                            </span>
                            <span v-else-if="type.instanceCount > 0" class="tile-badge badge-count">
                                已配置 {{ type.instanceCount }}
                            </span>
                            <span v-else-if="!type.canCreate" class="tile-badge badge-disabled">
                                已存在
                            </span>
                            <el-icon v-else class="tile-arrow"><ArrowRight /></el-icon>
                        </button>
                    </div>
                </Transition>
            </div>

            <div class="pagination-footer">
                <span class="page-indicator">{{ currentPage }} / {{ totalPages }}</span>
            </div>
        </div>
    </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElButton, ElDialog, ElIcon } from 'element-plus'
import { ArrowRight, Close } from '@element-plus/icons-vue'
import type { ChatLunaAdapterType } from '../../types'

const props = defineProps<{
    types: ChatLunaAdapterType[]
}>()

const emit = defineEmits<{
    (event: 'choose', type: ChatLunaAdapterType): void
}>()

const visible = defineModel<boolean>('visible', { required: true })

const currentPage = ref(1)
const itemsPerPage = 6
const transitionName = ref('slide-next')
const swipeStart = ref<{ id: number; x: number; y: number } | null>(null)
const suppressedClick = ref<{ x: number; y: number; expiresAt: number } | null>(
    null
)

const swipeMinDistancePx = 56
const clickSuppressDistancePx = 24
const clickSuppressDurationMs = 350

const totalPages = computed(() => {
    return Math.max(1, Math.ceil(props.types.length / itemsPerPage))
})

const currentPageItems = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage
    const end = start + itemsPerPage
    return props.types.slice(start, end)
})

const typeInitial = (type: ChatLunaAdapterType) => {
    const source = type.title || type.platformDefault || '?'
    return source.trim().charAt(0).toUpperCase()
}

const goToNextPage = () => {
    if (currentPage.value >= totalPages.value) return false
    transitionName.value = 'slide-next'
    currentPage.value++
    return true
}

const goToPreviousPage = () => {
    if (currentPage.value <= 1) return false
    transitionName.value = 'slide-prev'
    currentPage.value--
    return true
}

const handleWheel = (event: WheelEvent) => {
    if (event.deltaY > 0) {
        goToNextPage()
    } else if (event.deltaY < 0) {
        goToPreviousPage()
    }
}

const handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    swipeStart.value = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY
    }
}

const handlePointerUp = (event: PointerEvent) => {
    const start = swipeStart.value
    swipeStart.value = null
    if (!start || start.id !== event.pointerId) return

    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    const isHorizontalSwipe =
        Math.abs(deltaX) >= swipeMinDistancePx &&
        Math.abs(deltaX) > Math.abs(deltaY) * 1.2

    if (!isHorizontalSwipe) return

    suppressClickFromSwipe(event)
    if (deltaX < 0) {
        goToNextPage()
    } else {
        goToPreviousPage()
    }
}

const resetSwipeState = () => {
    swipeStart.value = null
}

const suppressClickFromSwipe = (event: PointerEvent) => {
    suppressedClick.value = {
        x: event.clientX,
        y: event.clientY,
        expiresAt: window.performance.now() + clickSuppressDurationMs
    }

    window.setTimeout(() => {
        const current = suppressedClick.value
        if (current && current.expiresAt <= window.performance.now()) {
            suppressedClick.value = null
        }
    }, clickSuppressDurationMs)
}

const handleListClick = (event: MouseEvent) => {
    const click = suppressedClick.value
    if (!click) return

    const isExpired = click.expiresAt <= window.performance.now()
    const isSwipeClick =
        Math.abs(event.clientX - click.x) <= clickSuppressDistancePx &&
        Math.abs(event.clientY - click.y) <= clickSuppressDistancePx

    if (isExpired || !isSwipeClick) {
        suppressedClick.value = null
        return
    }

    suppressedClick.value = null
    event.preventDefault()
    event.stopPropagation()
}

watch(visible, (val) => {
    if (!val) {
        currentPage.value = 1
        transitionName.value = 'slide-next'
        resetSwipeState()
        suppressedClick.value = null
    }
})

watch(totalPages, (pageCount) => {
    if (currentPage.value > pageCount) {
        currentPage.value = pageCount
    }
})
</script>

<style>
.el-dialog.chatluna-picker-dialog {
    border-radius: 16px !important;
    overflow: hidden !important;
    background: var(--k-card-bg) !important;
    border: 1px solid var(--k-color-divider) !important;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35) !important;
}

.el-dialog.chatluna-picker-dialog .el-dialog__header {
    display: none !important;
}

.el-dialog.chatluna-picker-dialog .el-dialog__body {
    padding: 0 !important;
    background: transparent !important;
}
</style>

<style scoped>
.picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    background: var(--k-card-bg);
    border-bottom: 1px solid var(--k-color-divider);
}

.picker-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--k-text-dark);
}

.header-close-btn {
    color: var(--k-text-light);
}

.picker-body {
    padding: 14px 18px;
    background: color-mix(in srgb, var(--k-card-bg), var(--k-page-bg) 25%);
}

.adapter-list-wrapper {
    height: 400px;
    overflow: hidden;
    position: relative;
    touch-action: pan-y;
}

.adapter-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
}

.adapter-tile-btn {
    display: flex;
    align-items: center;
    gap: 16px;
    height: 58px;
    padding: 0 16px;
    box-sizing: border-box;
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    background: var(--k-card-bg);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    width: 100%;
}

.adapter-tile-btn:hover:not(.is-disabled) {
    border-color: var(--k-color-primary);
    box-shadow: 0 0 0 1px var(--k-color-primary);
}

.adapter-tile-btn.is-disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.tile-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 700;
    color: var(--k-color-primary);
    background: color-mix(in srgb, var(--k-color-primary), transparent 90%);
    flex-shrink: 0;
}

.adapter-tile-btn.is-missing .tile-avatar {
    color: var(--k-text-light);
    background: var(--k-color-fill);
}

.tile-info {
    flex: 1;
    min-width: 0;
}

.tile-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--k-text-dark);
}

.tile-badge {
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 6px;
    flex-shrink: 0;
}

.badge-count {
    color: var(--k-color-primary);
    background: color-mix(in srgb, var(--k-color-primary), transparent 90%);
}

.badge-missing {
    color: var(--k-text-light);
    background: var(--k-color-fill);
}

.badge-disabled {
    color: var(--k-text-light);
    background: var(--k-color-fill);
}

.tile-arrow {
    color: var(--k-text-light);
    opacity: 0.5;
    transition: transform 0.2s ease;
    flex-shrink: 0;
    font-size: 14px;
}

.adapter-tile-btn:hover:not(.is-disabled) .tile-arrow {
    transform: translateX(2px);
    opacity: 1;
    color: var(--k-color-primary);
}

.pagination-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-top: 10px;
}

.page-indicator {
    font-size: 12px;
    font-weight: 600;
    color: var(--k-text-light);
    background: var(--k-card-bg);
    border: 1px solid var(--k-color-divider);
    padding: 3px 10px;
    border-radius: 6px;
    user-select: none;
    font-variant-numeric: tabular-nums;
}

.slide-next-enter-active,
.slide-next-leave-active,
.slide-prev-enter-active,
.slide-prev-leave-active {
    transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}

.slide-next-enter-from {
    opacity: 0;
    transform: translateX(24px);
}
.slide-next-leave-to {
    opacity: 0;
    transform: translateX(-24px);
}

.slide-prev-enter-from {
    opacity: 0;
    transform: translateX(-24px);
}
.slide-prev-leave-to {
    opacity: 0;
    transform: translateX(24px);
}
</style>
