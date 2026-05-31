<template>
    <CodeWindow
        :name="name"
        :class="{ 'is-error-window': error }"
        @copy="emit('copy')"
    ><pre
        class="body-viewer hljs"
        :class="{ 'is-error': error }"
    ><code v-html="html"></code></pre></CodeWindow>
</template>

<script setup lang="ts">
import CodeWindow from './CodeWindow.vue'

defineProps<{
    /** The window title, e.g. `request · 1.2 KB`. */
    name: string
    /** Highlighted body markup, injected via v-html. */
    html: string
    /** Render the error variant (red text + red dot glow). */
    error?: boolean
}>()

const emit = defineEmits<{
    (event: 'copy'): void
}>()
</script>

<style scoped>
/* The shared CodeWindow root only sizes itself intrinsically; inside the log
   detail tabs it must grow to fill the tab pane height. */
.code-window {
    flex: 1;
}

.is-error-window :deep(.window-dots i:nth-child(1)) {
    box-shadow: 0 0 0 3px color-mix(in srgb, #ff5f56, transparent 70%);
}

.body-viewer {
    --log-scrollbar-track: color-mix(
        in srgb,
        var(--k-card-bg),
        var(--k-page-bg) 34%
    );
    --log-scrollbar-thumb: color-mix(
        in srgb,
        var(--k-color-divider),
        var(--k-text-light) 28%
    );
    box-sizing: border-box;
    margin: 0;
    border: 1px solid var(--k-color-divider);
    border-radius: 8px;
    overflow: auto;
    color: var(--k-text-dark);
    background: var(--k-card-bg);
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
        "Liberation Mono", "Courier New", monospace;
    scrollbar-color: var(--log-scrollbar-thumb) var(--log-scrollbar-track);
    scrollbar-width: thin;
}

.body-viewer {
    flex: 1;
    min-height: 0;
    height: auto;
    padding: 14px 16px;
    border: 0;
    border-radius: 0;
    font-size: 13px;
    line-height: 1.6;
    white-space: pre;
    background: color-mix(in srgb, var(--k-card-bg), var(--k-page-bg) 22%);
}

.body-viewer code {
    display: block;
    min-width: 0;
    padding: 0;
    margin: 0;
    background: transparent;
    font: inherit;
    color: inherit;
    white-space: inherit;
}

/* highlight.js token palette mapped onto the koishi theme. Tokens are injected
   via v-html (no scope attribute), so the selectors must be wrapped in :deep()
   or the scoped data-v attribute lands on .hljs-* and never matches. */
.body-viewer :deep(.hljs-attr),
.body-viewer :deep(.hljs-attribute) {
    color: var(--hljs-key, #0a66c2);
    font-weight: 600;
}

.body-viewer :deep(.hljs-string) {
    color: var(--hljs-string, #1a7f37);
}

.body-viewer :deep(.hljs-number),
.body-viewer :deep(.hljs-literal) {
    color: var(--hljs-number, #b3261e);
}

.body-viewer :deep(.hljs-punctuation) {
    color: var(--k-text-light);
}

.body-viewer.is-error {
    color: var(--k-color-danger, #d03050);
}

.dark .body-viewer :deep(.hljs-attr),
.dark .body-viewer :deep(.hljs-attribute),
html.dark .body-viewer :deep(.hljs-attr),
html.dark .body-viewer :deep(.hljs-attribute),
.theme-root.dark .body-viewer :deep(.hljs-attr),
.theme-root.dark .body-viewer :deep(.hljs-attribute) {
    color: #79c0ff;
}

.dark .body-viewer :deep(.hljs-string),
html.dark .body-viewer :deep(.hljs-string),
.theme-root.dark .body-viewer :deep(.hljs-string) {
    color: #7ee787;
}

.dark .body-viewer :deep(.hljs-number),
.dark .body-viewer :deep(.hljs-literal),
html.dark .body-viewer :deep(.hljs-number),
html.dark .body-viewer :deep(.hljs-literal),
.theme-root.dark .body-viewer :deep(.hljs-number),
.theme-root.dark .body-viewer :deep(.hljs-literal) {
    color: #ff7b72;
}

.body-viewer::-webkit-scrollbar {
    width: 10px;
    height: 10px;
}

.body-viewer::-webkit-scrollbar-track {
    background: var(--log-scrollbar-track);
}

.body-viewer::-webkit-scrollbar-thumb {
    border: 2px solid var(--log-scrollbar-track);
    border-radius: 999px;
    background: var(--log-scrollbar-thumb);
}

.body-viewer::-webkit-scrollbar-corner {
    background: var(--log-scrollbar-track);
}

@media (max-width: 768px) {
    .body-viewer {
        height: 420px;
    }
}
</style>
