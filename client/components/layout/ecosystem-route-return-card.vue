<template>
    <button
        v-if="visible"
        class="ecosystem-route-return-card"
        type="button"
        aria-label="返回ChatLuna Hub 首页"
        @click="returnHome"
    >
        <el-icon :size="20">
            <House />
        </el-icon>
        <span class="ecosystem-route-return-card__label">
            返回ChatLuna Hub 首页
        </span>
    </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { router } from '@koishijs/client'
import { House } from '@element-plus/icons-vue'

const visible = computed(
    () =>
        router.currentRoute.value.path === '/chatluna-agent' ||
        router.currentRoute.value.path === '/chatluna-livingmemory' ||
        router.currentRoute.value.path === '/media-luna' ||
        router.currentRoute.value.path === '/memesluna/' ||
        router.currentRoute.value.path === '/memesluna' ||
        router.currentRoute.value.path === '/chatluna-affinity/dashboard'
)

const returnHome = () => {
    void router.push({
        path: '/chatluna',
        query: {
            home: '1'
        }
    })
}
</script>

<style scoped>
.ecosystem-route-return-card {
    position: fixed;
    top: 7px;
    right: 14px;
    box-sizing: border-box;
    width: 48px;
    height: 39px;
    padding: 8px;
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    overflow: hidden;
    color: var(--k-text-normal);
    font-size: 13px;
    white-space: nowrap;
    background: var(--k-card-bg);
    box-shadow: var(--k-card-shadow);
    cursor: pointer;
    z-index: 100;
    transition:
        width 0.32s cubic-bezier(0.22, 1, 0.36, 1),
        color 0.2s ease,
        border-color 0.2s ease,
        background 0.2s ease;
}

.ecosystem-route-return-card:hover,
.ecosystem-route-return-card:focus-visible {
    color: var(--k-color-primary);
    border-color: var(--k-color-primary);
    background: var(--k-hover-bg);
}

.ecosystem-route-return-card:is(:hover, :focus-visible) {
    width: 200px;
    justify-content: flex-start;
    gap: 8px;
}

.ecosystem-route-return-card:focus-visible {
    outline: 2px solid var(--k-color-primary);
    outline-offset: 2px;
}

.ecosystem-route-return-card__label {
    display: block;
    min-width: 0;
    max-width: 0;
    overflow: hidden;
    opacity: 0;
    transform: translateX(-6px);
    transition:
        max-width 0.32s cubic-bezier(0.22, 1, 0.36, 1),
        opacity 0.16s ease 0.12s,
        transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.ecosystem-route-return-card:is(:hover, :focus-visible)
    .ecosystem-route-return-card__label {
    max-width: 152px;
    opacity: 1;
    transform: translateX(0);
    transition-delay: 0.04s, 0.08s, 0.04s;
}

@media (prefers-reduced-motion: reduce) {
    .ecosystem-route-return-card,
    .ecosystem-route-return-card__label {
        transition-duration: 0.01ms !important;
        transition-delay: 0s !important;
    }

    .ecosystem-route-return-card__label {
        transform: none;
    }
}
</style>
