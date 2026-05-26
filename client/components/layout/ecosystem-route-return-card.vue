<template>
    <button
        v-if="visible"
        class="ecosystem-return-card"
        type="button"
        @click="returnHome"
    >
        <el-icon :size="18">
            <Back />
        </el-icon>
        <span>返回ChatLuna Hub 首页</span>
    </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { router } from '@koishijs/client'
import { Back } from '@element-plus/icons-vue'

const visible = computed(
    () =>
        router.currentRoute.value.path === '/chatluna-agent' ||
        router.currentRoute.value.path === '/chatluna-livingmemory' ||
        router.currentRoute.value.path === '/media-luna' ||
        router.currentRoute.value.path === '/memesluna/' ||
        router.currentRoute.value.path === '/memesluna'
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
.ecosystem-return-card {
    position: fixed;
    top: 7px;
    right: 14px;
    width: fit-content;
    min-height: calc(var(--header-height) - 14px);
    padding: 0 14px;
    border: 1px solid var(--k-color-divider);
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--k-text-normal);
    background: var(--k-card-bg);
    box-shadow: var(--k-card-shadow);
    cursor: pointer;
    z-index: 260;
    transition:
        color 0.2s ease,
        border-color 0.2s ease,
        background 0.2s ease;
}

.ecosystem-return-card:hover,
.ecosystem-return-card:focus-visible {
    color: var(--k-color-primary);
    border-color: var(--k-color-primary);
    background: var(--k-hover-bg);
}

.ecosystem-return-card:focus-visible {
    outline: 2px solid var(--k-color-primary);
    outline-offset: 2px;
}

@media (max-width: 768px) {
    .ecosystem-return-card {
        right: 14px;
    }
}
</style>
