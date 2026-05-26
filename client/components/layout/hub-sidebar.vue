<template>
    <nav class="side-nav">
        <div
            class="nav-segment"
            :class="{ 'no-active': active < 0 }"
            :style="{ '--nav-index': active }"
        >
            <div class="nav-pill" />
            <button
                v-for="item in items"
                :key="item.id"
                class="nav-item"
                :class="{
                    active: current === item.id,
                    muted: !item.available
                }"
                :title="item.title"
                :disabled="!item.available"
                type="button"
                @click="handleSelect(item)"
            >
                <el-icon :size="24">
                    <component :is="icons[item.icon] ?? Cpu" />
                </el-icon>
                <span class="nav-label">{{ item.title }}</span>
            </button>
        </div>
    </nav>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { computed } from 'vue'
import {
    ChatRound,
    Collection,
    Connection,
    Cpu,
    Brush
} from '@element-plus/icons-vue'
import MemesLunaIcon from '../../icons/memesluna.vue'
import type { HubModuleId, HubModuleItem } from '../../types'

const props = defineProps<{
    current: HubModuleId | null
    modules: HubModuleItem[]
}>()

const emit = defineEmits<{
    select: [id: HubModuleId]
}>()

const icons: Record<string, Component> = {
    ChatRound,
    Collection,
    Connection,
    Cpu,
    Palette: Brush,
    MemesLunaEmoji: MemesLunaIcon
}

const items = computed(() =>
    props.modules.slice().sort((left, right) => left.order - right.order)
)
const active = computed(() =>
    items.value.findIndex((item) => item.id === props.current)
)

const handleSelect = (item: HubModuleItem) => {
    if (!item.available) return
    emit('select', item.id)
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
    overflow: hidden;
    padding: 12px;
    border: 1px solid var(--k-color-divider);
    border-radius: 8px;
    background: var(--k-card-bg);
    box-shadow: var(--k-card-shadow);
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
    border-radius: 8px;
    background: var(--k-hover-bg);
    transform: translateY(calc(var(--nav-index) * var(--nav-step)));
    transition: transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
    pointer-events: none;
    will-change: transform;
}

.nav-segment.no-active .nav-pill {
    opacity: 0;
}

.nav-item {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    height: 40px;
    padding: 0 8px;
    border: 0;
    border-radius: 8px;
    overflow: hidden;
    color: var(--k-text-light);
    background: transparent;
    cursor: pointer;
    white-space: nowrap;
    transition:
        color 0.2s ease,
        opacity 0.2s ease;
}

.nav-item:hover:not(:disabled) {
    color: var(--k-text-dark);
}

.nav-item.active {
    color: var(--k-color-primary);
    font-weight: 600;
}

.nav-item.muted:not(.active) {
    opacity: 0.58;
}

.nav-item:disabled {
    cursor: not-allowed;
}

.nav-item .el-icon {
    flex: 0 0 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    min-width: 24px;
}

.nav-label {
    display: block;
    max-width: 0;
    overflow: hidden;
    opacity: 0;
    font-size: 14px;
    transform: translateX(-6px);
    transition:
        max-width 0.32s cubic-bezier(0.22, 1, 0.36, 1),
        opacity 0.16s ease 0.12s,
        transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
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
        width: auto;
        padding: 8px 16px;
        border-radius: 24px;
        transform: translateX(50%);
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
        width: 24px;
        height: 32px;
        padding: 0;
        gap: 0;
        border-radius: 0;
    }

    .nav-label {
        display: none;
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
