<template>
    <div class="code-window">
        <div class="code-window-bar">
            <span class="window-dots"><i></i><i></i><i></i></span>
            <span class="window-name">{{ name }}</span>
            <el-button
                class="copy-btn"
                size="small"
                text
                :icon="CopyDocument"
                @click="emit('copy')"
            >
                复制
            </el-button>
        </div>
        <slot />
    </div>
</template>

<script setup lang="ts">
import { ElButton } from 'element-plus'
import { CopyDocument } from '@element-plus/icons-vue'

defineProps<{
    /** The filename / size label shown in the window title bar. */
    name: string
}>()

const emit = defineEmits<{
    (event: 'copy'): void
}>()
</script>

<style scoped>
.code-window {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    overflow: hidden;
    background: var(--k-card-bg);
    box-shadow:
        0 1px 2px color-mix(in srgb, var(--k-text-dark), transparent 92%),
        0 8px 24px color-mix(in srgb, var(--k-text-dark), transparent 94%);
}

.code-window-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--k-color-divider);
    background: color-mix(in srgb, var(--k-card-bg), var(--k-page-bg) 55%);
}

.window-dots {
    display: inline-flex;
    gap: 6px;
}

.window-dots i {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--k-color-divider);
}

.window-dots i:nth-child(1) {
    background: #ff5f56;
}

.window-dots i:nth-child(2) {
    background: #ffbd2e;
}

.window-dots i:nth-child(3) {
    background: #27c93f;
}

.window-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--k-text-light);
    font-size: 12px;
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    letter-spacing: 0.02em;
}

.copy-btn {
    flex-shrink: 0;
}
</style>
