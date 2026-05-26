<template>
    <div class="side-nav">
        <div class="nav-segment" :style="{ '--nav-index': active }">
            <div class="nav-pill" />
            <button
                v-for="item in items"
                :key="item.key"
                class="nav-item"
                :class="{ active: current === item.key }"
                type="button"
                @click="handleSelect(item.key, $event)"
            >
                <el-icon :size="24">
                    <component :is="item.icon" />
                </el-icon>
                <span class="nav-label">{{ item.label }}</span>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import { ChatRound, DataAnalysis, Memo } from '@element-plus/icons-vue'
import type { CoreTab } from './types'

interface NavItem {
    key: CoreTab
    label: string
    icon: Component
}

const props = defineProps<{
    current: CoreTab
}>()

const emit = defineEmits<{
    select: [key: CoreTab]
}>()

const items: NavItem[] = [
    { key: 'conversation', label: '会话管理', icon: ChatRound },
    { key: 'model', label: '模型管理', icon: DataAnalysis },
    { key: 'preset', label: '预设管理', icon: Memo }
]

const active = computed(() => {
    const index = items.findIndex((item) => item.key === props.current)
    return index < 0 ? 0 : index
})

const handleSelect = (key: CoreTab, event: MouseEvent) => {
    emit('select', key)

    if (event.currentTarget instanceof HTMLButtonElement) {
        event.currentTarget.blur()
    }
}
</script>

<style scoped>
.side-nav {
    position: fixed;
    right: 24px;
    top: 50%;
    transform: translateY(-50%);
    box-sizing: border-box;
    width: 64px;
    padding: 12px;
    border: 1px solid var(--k-color-divider);
    border-radius: 16px;
    background: var(--k-card-bg);
    box-shadow: var(--k-card-shadow);
    overflow: hidden;
    z-index: 100;
    transition: width 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.side-nav:is(:hover, :focus-within) {
    width: 188px;
}

.nav-segment {
    --nav-index: 0;
    --nav-step: 52px;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    isolation: isolate;
}

.nav-pill {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40px;
    border-radius: 10px;
    background: var(--k-hover-bg);
    transform: translateY(calc(var(--nav-index) * var(--nav-step)));
    transition: transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
    pointer-events: none;
    will-change: transform;
}

.nav-item {
    position: relative;
    z-index: 1;
    height: 40px;
    width: 100%;
    padding: 0 8px;
    border: 0;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--k-text-light);
    background: transparent;
    cursor: pointer;
    overflow: hidden;
    white-space: nowrap;
    transition:
        color 0.2s ease,
        background-color 0.2s ease;
}

.nav-item:hover {
    color: var(--k-text-dark);
}

.nav-item:focus-visible {
    outline: 2px solid var(--k-color-primary);
    outline-offset: 2px;
}

.nav-item.active {
    color: var(--k-color-primary);
    font-weight: 500;
}

.nav-item .el-icon {
    flex: 0 0 24px;
    width: 24px;
    min-width: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.nav-label {
    display: block;
    max-width: 0;
    overflow: hidden;
    opacity: 0;
    transform: translateX(-6px);
    transition:
        max-width 0.32s cubic-bezier(0.22, 1, 0.36, 1),
        opacity 0.16s ease 0.12s,
        transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
    font-size: 14px;
}

.side-nav:is(:hover, :focus-within) .nav-label {
    max-width: 96px;
    opacity: 1;
    transform: translateX(0);
    transition-delay: 0.04s, 0.08s, 0.04s;
}

@media (max-width: 768px) {
    .side-nav {
        top: auto;
        right: 50%;
        bottom: 20px;
        transform: translateX(50%);
        width: auto;
        padding: 8px 16px;
        border-radius: 30px;
    }

    .side-nav:is(:hover, :focus-within) {
        width: auto;
    }

    .nav-segment {
        flex-direction: row;
        gap: 20px;
    }

    .nav-pill {
        display: none;
    }

    .nav-item {
        height: auto;
        width: auto;
        padding: 0;
        gap: 0;
        color: var(--k-text-light);
        background: transparent !important;
        box-shadow: none !important;
    }

    .nav-item.active {
        color: var(--k-color-primary);
    }

    .nav-label {
        display: none;
    }

    .nav-item .el-icon,
    .side-nav:is(:hover, :focus-within) .nav-item .el-icon {
        flex-basis: 24px;
    }
}

@media (prefers-reduced-motion: reduce) {
    .side-nav,
    .nav-item,
    .nav-label,
    .nav-pill {
        transition-duration: 0.01ms !important;
        transition-delay: 0s !important;
    }

    .nav-label {
        transform: none;
    }
}
</style>
