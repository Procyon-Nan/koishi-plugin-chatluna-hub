<template>
    <button class="hub-return-button" type="button" @click="emit('click')">
        <el-icon :size="18">
            <Back />
        </el-icon>
        <span>返回ChatLuna Hub 首页</span>
    </button>
</template>

<script setup lang="ts">
import { Back } from '@element-plus/icons-vue'

/**
 * The fixed top-right "back to Hub home" button. Pure chrome: it owns the
 * markup, label and styling, and emits `click` so each caller can wire its
 * own action (internal state reset in the shell, router navigation from an
 * ecosystem route). Visibility is the caller's responsibility too.
 */
const emit = defineEmits<{
    (event: 'click'): void
}>()
</script>

<style scoped>
.hub-return-button {
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

.hub-return-button:hover,
.hub-return-button:focus-visible {
    color: var(--k-color-primary);
    border-color: var(--k-color-primary);
    background: var(--k-hover-bg);
}

.hub-return-button:focus-visible {
    outline: 2px solid var(--k-color-primary);
    outline-offset: 2px;
}
</style>
