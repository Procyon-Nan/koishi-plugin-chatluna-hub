<template>
    <CodeWindow :name="fileLabel" @copy="copy">
        <div
            class="code-editor"
            :style="{
                '--line-gutter-width': lineGutterWidth
            }"
        >
            <pre
                ref="lineGutter"
                class="line-gutter"
                aria-hidden="true"
            ><span
                v-for="line in lineNumbers"
                :key="line"
            >{{ line }}</span></pre>
            <div class="editor-input-wrap">
                <div
                    class="indent-guide-viewport"
                    aria-hidden="true"
                >
                    <div
                        ref="indentGuideLayer"
                        class="indent-guide-layer"
                    >
                        <div
                            v-for="(
                                guides, row
                            ) in indentGuideRows"
                            :key="row"
                            class="indent-guide-row"
                        >
                            <span
                                v-for="level in guides"
                                :key="level"
                                class="indent-guide"
                                :style="
                                    getIndentGuideStyle(level)
                                "
                            />
                    </div>
                </div>
            </div>
            <textarea
                ref="editorTextarea"
                v-model="text"
                class="preset-editor"
                spellcheck="false"
                wrap="off"
                aria-label="ChatLuna preset YAML editor"
                placeholder="输入 ChatLuna preset YAML"
                @scroll="syncEditorScroll"
                @keydown="handleEditorKeydown"
            />
            </div>
        </div>
    </CodeWindow>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import CodeWindow from './CodeWindow.vue'

const props = defineProps<{
    modelValue: string
    fileLabel: string
}>()

const emit = defineEmits<{
    (event: 'update:modelValue', value: string): void
}>()

const text = computed({
    get: () => props.modelValue,
    set: (value: string) => emit('update:modelValue', value)
})

const fileLabel = computed(() => props.fileLabel)

const editorTextarea = ref<HTMLTextAreaElement | null>(null)
const lineGutter = ref<HTMLElement | null>(null)
const indentGuideLayer = ref<HTMLElement | null>(null)

const indentGuideSize = computed(() => {
    const lines = text.value.split('\n')
    let minIndent = 999

    for (const line of lines) {
        if (line.trim().length === 0) continue
        const indentText = line.match(/^[ \t]*/)?.[0] ?? ''
        if (indentText.length > 0 && indentText.length < minIndent) {
            minIndent = indentText.length
        }
    }

    return minIndent === 999 ? 2 : minIndent >= 4 ? 4 : 2
})

const copy = async () => {
    try {
        await navigator.clipboard.writeText(text.value)
        ElMessage.success('已复制到剪贴板')
    } catch {
        ElMessage.error('复制失败')
    }
}

const lineNumbers = computed(() => {
    return text.value.split('\n').map((_, index) => index + 1)
})

const lineGutterWidth = computed(() => {
    return `${Math.max(3, String(lineNumbers.value.length).length + 1)}ch`
})

const indentGuideRows = computed(() => {
    const lines = text.value.split('\n')
    const indents = lines.map((line) => {
        const isEmpty = line.trim().length === 0
        if (isEmpty) return null

        const indentText = line.match(/^[ \t]*/)?.[0] ?? ''
        return Array.from(indentText).reduce((width, char) => {
            return width + (char === '\t' ? indentGuideSize.value : 1)
        }, 0)
    })

    return lines.map((line, index) => {
        let indentWidth = indents[index]

        if (indentWidth === null) {
            let prevIndent = 0
            for (let i = index - 1; i >= 0; i--) {
                if (indents[i] !== null) {
                    prevIndent = indents[i]!
                    break
                }
            }

            let nextIndent = 0
            for (let i = index + 1; i < indents.length; i++) {
                if (indents[i] !== null) {
                    nextIndent = indents[i]!
                    break
                }
            }

            indentWidth = Math.min(prevIndent, nextIndent)
        }

        const guideCount = Math.floor(indentWidth / indentGuideSize.value)
        return Array.from({ length: guideCount }, (_, idx) => idx)
    })
})

const getIndentGuideStyle = (level: number) => {
    return {
        left: `${level * indentGuideSize.value}ch`
    }
}

const syncEditorScroll = () => {
    if (!editorTextarea.value || !lineGutter.value) return

    lineGutter.value.scrollTop = editorTextarea.value.scrollTop

    if (indentGuideLayer.value) {
        indentGuideLayer.value.style.transform = `translate(${-editorTextarea.value.scrollLeft}px, ${-editorTextarea.value.scrollTop}px)`
    }
}

const handleEditorKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return

    event.preventDefault()

    const textarea = event.target as HTMLTextAreaElement
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const next = `${text.value.slice(0, start)}  ${text.value.slice(end)}`

    text.value = next

    requestAnimationFrame(() => {
        textarea.selectionStart = start + 2
        textarea.selectionEnd = start + 2
    })
}

watch(text, () => {
    requestAnimationFrame(syncEditorScroll)
})
</script>

<style scoped>
.code-editor {
    --editor-line-height: 22px;
    --editor-padding-x: 14px;
    --editor-padding-y: 12px;
    --editor-scrollbar-track: color-mix(
        in srgb,
        var(--k-card-bg),
        var(--k-page-bg) 34%
    );
    --editor-scrollbar-thumb: color-mix(
        in srgb,
        var(--k-color-divider),
        var(--k-text-light) 28%
    );
    --editor-scrollbar-thumb-hover: color-mix(
        in srgb,
        var(--k-color-divider),
        var(--k-text-dark) 30%
    );
    box-sizing: border-box;
    height: 100%;
    border: 0;
    border-radius: 0;
    display: grid;
    grid-template-columns: var(--line-gutter-width) minmax(0, 1fr);
    overflow: hidden;
    background: var(--k-card-bg);
}

.line-gutter {
    box-sizing: border-box;
    height: 100%;
    min-width: 0;
    margin: 0;
    padding: var(--editor-padding-y) 8px var(--editor-padding-y) 0;
    border-right: 1px solid var(--k-color-divider);
    overflow: hidden;
    text-align: right;
    color: var(--k-text-light);
    background: color-mix(in srgb, var(--k-card-bg), var(--k-page-bg) 42%);
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
        "Liberation Mono", "Courier New", monospace;
    font-size: 13px;
    line-height: var(--editor-line-height);
    user-select: none;
}

.line-gutter span {
    display: block;
    height: var(--editor-line-height);
}

.editor-input-wrap {
    position: relative;
    min-width: 0;
    height: 100%;
    min-height: 0;
    background: var(--k-card-bg);
}

.indent-guide-viewport {
    position: absolute;
    inset: 0;
    z-index: 1;
    overflow: hidden;
    pointer-events: none;
}
.indent-guide-layer {
    box-sizing: border-box;
    min-width: 100%;
    padding: var(--editor-padding-y) var(--editor-padding-x);
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
        "Liberation Mono", "Courier New", monospace;
    font-size: 14px;
    line-height: var(--editor-line-height);
    will-change: transform;
}

.indent-guide-row {
    position: relative;
    height: var(--editor-line-height);
}

.indent-guide {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 0;
    border-left: 1px solid
        color-mix(in srgb, var(--k-text-light), transparent 40%);
}

.preset-editor {
    box-sizing: border-box;
    position: relative;
    z-index: 2;
    display: block;
    width: 100%;
    min-width: 0;
    height: 100%;
    min-height: 0;
    margin: 0;
    padding: var(--editor-padding-y) var(--editor-padding-x);
    border: 0;
    outline: none;
    overflow: auto;
    resize: none;
    color: var(--k-text-dark);
    caret-color: var(--k-text-dark);
    background: transparent;
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
        "Liberation Mono", "Courier New", monospace;
    font-size: 14px;
    line-height: var(--editor-line-height);
    scrollbar-color: var(--editor-scrollbar-thumb)
        var(--editor-scrollbar-track);
    scrollbar-width: thin;
    tab-size: 2;
    white-space: pre;
}

.preset-editor::-webkit-scrollbar {
    width: 10px;
    height: 10px;
}

.preset-editor::-webkit-scrollbar-track {
    background: var(--editor-scrollbar-track);
}

.preset-editor::-webkit-scrollbar-thumb {
    border: 2px solid var(--editor-scrollbar-track);
    border-radius: 999px;
    background: var(--editor-scrollbar-thumb);
}

.preset-editor::-webkit-scrollbar-thumb:hover {
    background: var(--editor-scrollbar-thumb-hover);
}

.preset-editor::-webkit-scrollbar-corner {
    background: var(--editor-scrollbar-track);
}

@media (max-width: 980px) {
    .code-editor,
    .editor-input-wrap,
    .preset-editor {
        height: 100%;
    }
}
</style>

