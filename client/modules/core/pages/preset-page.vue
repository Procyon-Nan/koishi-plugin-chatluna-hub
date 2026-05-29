<template>
    <section class="core-page" :class="{ compact: compactMode }">
        <header class="page-header">
            <div class="page-icon">
                <el-icon :size="26">
                    <Memo />
                </el-icon>
            </div>
            <div class="page-heading">
                <span class="page-kicker">ChatLuna Core</span>
                <h1>预设管理</h1>
                <p class="page-subtitle">
                    编辑主插件与 Character 预设的 YAML 原文
                </p>
            </div>
            <div class="page-actions">
                <div class="stat-pills">
                    <span class="stat-pill">
                        <span class="stat-pill-value">{{ presets.length }}</span>
                        <span class="stat-pill-label">预设</span>
                    </span>
                    <span class="stat-pill is-core">
                        <span class="stat-pill-value">{{ coreCount }}</span>
                        <span class="stat-pill-label">主插件</span>
                    </span>
                    <span class="stat-pill is-character">
                        <span class="stat-pill-value">{{
                            characterCount
                        }}</span>
                        <span class="stat-pill-label">伪装</span>
                    </span>
                </div>
                <el-button
                    size="small"
                    :type="compactMode ? 'primary' : 'default'"
                    plain
                    @click="compactMode = !compactMode"
                >
                    {{ compactMode ? '紧凑模式' : '宽屏模式' }}
                </el-button>
            </div>
        </header>

        <el-alert
            v-if="listReason"
            :title="listReason"
            type="warning"
            show-icon
            :closable="false"
        />

        <div class="preset-workspace">
            <el-card shadow="never" class="preset-list-card">
                <template #header>
                    <div class="card-header">
                        <span>预设文件</span>
                        <el-button
                            size="small"
                            type="primary"
                            :icon="Plus"
                            @click="startCreate"
                        >
                            新建
                        </el-button>
                    </div>
                </template>

                <div class="list-toolbar">
                    <el-input
                        v-model="keyword"
                        placeholder="搜索文件名或关键词"
                        clearable
                    />
                    <el-button
                        :icon="Refresh"
                        :loading="listLoading"
                        @click="refreshPresets"
                    >
                        刷新
                    </el-button>
                </div>

                <el-scrollbar class="preset-list-scroll">
                    <div
                        v-if="filteredPresets.length === 0"
                        class="empty-state"
                    >
                        暂无预设
                    </div>

                    <button
                        v-for="preset in filteredPresets"
                        :key="preset.id"
                        type="button"
                        class="preset-list-item"
                        :class="{
                            active: !createMode && selectedId === preset.id
                        }"
                        :data-source="preset.source"
                        @click="selectPreset(preset.id)"
                    >
                        <span class="preset-list-title-row">
                            <span class="preset-list-title">
                                {{ preset.filename }}
                            </span>
                            <el-tag size="small" effect="plain" round>
                                {{ preset.sourceLabel }}
                            </el-tag>
                        </span>
                        <span class="preset-list-meta">
                            <el-icon><Document /></el-icon>
                            {{ formatPresetCount(preset) }} ·
                            {{ formatTime(preset.updatedAt) }}
                        </span>
                        <span v-if="preset.keywords.length" class="keyword-row">
                            <el-tag
                                v-for="item in preset.keywords"
                                :key="item"
                                size="small"
                                effect="plain"
                            >
                                {{ item }}
                            </el-tag>
                        </span>
                    </button>
                </el-scrollbar>
            </el-card>

            <el-card shadow="never" class="preset-editor-card">
                <template #header>
                    <div class="editor-header">
                        <div>
                            <span class="editor-title">{{ editorTitle }}</span>
                            <span class="editor-meta">{{ editorMeta }}</span>
                        </div>
                        <div class="editor-actions">
                            <el-tag
                                v-if="isDirty"
                                size="small"
                                type="warning"
                                effect="plain"
                            >
                                未保存
                            </el-tag>
                            <el-button
                                v-if="canDelete"
                                type="danger"
                                plain
                                :icon="DeleteIcon"
                                :loading="deleting"
                                @click="deletePreset"
                            >
                                删除
                            </el-button>
                            <el-button
                                :disabled="!hasEditor"
                                :loading="validationLoading"
                                @click="validatePreset"
                            >
                                校验
                            </el-button>
                            <el-button
                                :disabled="!hasEditor || !isDirty"
                                @click="resetEditor"
                            >
                                还原
                            </el-button>
                            <el-button
                                type="primary"
                                :icon="Check"
                                :disabled="!canSave"
                                :loading="saving"
                                @click="savePreset"
                            >
                                保存
                            </el-button>
                        </div>
                    </div>
                </template>

                <div v-if="!hasEditor" class="editor-empty">
                    选择左侧预设，或新建一个预设文件。
                </div>

                <div v-else class="editor-body" v-loading="detailLoading">
                    <el-form
                        v-if="createMode"
                        label-position="top"
                        class="create-form"
                    >
                        <el-form-item label="预设来源">
                            <el-select
                                v-model="createSource"
                                @change="handleCreateSourceChange"
                            >
                                <el-option
                                    v-for="source in presetSourceOptions"
                                    :key="source.value"
                                    :label="source.label"
                                    :value="source.value"
                                />
                            </el-select>
                        </el-form-item>
                        <el-form-item label="文件名">
                            <el-input
                                v-model="createFilename"
                                placeholder="例如 my-preset.yml"
                            />
                        </el-form-item>
                    </el-form>

                    <div class="summary-row">
                        <span class="summary-label">关键词</span>
                        <span class="keyword-row">
                            <el-tag
                                v-for="item in summaryKeywords"
                                :key="item"
                                size="small"
                                effect="plain"
                            >
                                {{ item }}
                            </el-tag>
                            <span
                                v-if="summaryKeywords.length === 0"
                                class="muted"
                            >
                                未解析
                            </span>
                        </span>
                    </div>

                    <el-alert
                        v-if="validationResult && !validationResult.valid"
                        :title="validationResult.error || '预设校验失败'"
                        type="error"
                        show-icon
                        :closable="false"
                    />
                    <el-alert
                        v-else-if="validationResult?.valid"
                        title="预设校验通过"
                        type="success"
                        show-icon
                        :closable="false"
                    />

                    <div class="code-window">
                        <div class="code-window-bar">
                            <span class="window-dots">
                                <i></i><i></i><i></i>
                            </span>
                            <span class="window-name">
                                {{ editorFileLabel }}
                            </span>
                            <el-button
                                size="small"
                                text
                                :icon="CopyDocument"
                                class="copy-btn"
                                @click="copyEditor"
                            >
                                复制
                            </el-button>
                        </div>
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
                                v-model="rawText"
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
                    </div>
                </div>
            </el-card>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
    Check,
    CopyDocument,
    Delete as DeleteIcon,
    Document,
    Memo,
    Plus,
    Refresh
} from '@element-plus/icons-vue'
import * as api from '../api'
import { useCoreCompactMode } from '../use-compact-mode'
import type {
    ChatLunaCorePresetDetail,
    ChatLunaCorePresetListItem,
    ChatLunaCorePresetSource,
    ChatLunaCorePresetValidationResult
} from '../types'

const createCorePresetTemplate = (name: string) => `keywords:
  - ${name || 'new-preset'}
prompts:
  - role: system
    content: |
      在这里输入预设内容
`

const createCharacterPresetTemplate = (name: string) => `name: ${name || 'new-character'}
nick_name:
  - ${name || 'new-character'}
input: |
  在这里输入角色输入模板
system: |
  在这里输入角色系统设定
`

const createPresetTemplate = (
    name: string,
    source: ChatLunaCorePresetSource
) => {
    return source === 'character'
        ? createCharacterPresetTemplate(name)
        : createCorePresetTemplate(name)
}

const presetSourceOptions: {
    label: string
    value: ChatLunaCorePresetSource
}[] = [
    { label: '主插件预设', value: 'core' },
    { label: 'Character 预设', value: 'character' }
]

const compactMode = useCoreCompactMode()
const listLoading = ref(false)
const detailLoading = ref(false)
const validationLoading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const keyword = ref('')
const listReason = ref('')
const presets = ref<ChatLunaCorePresetListItem[]>([])
const selectedId = ref<string | null>(null)
const selectedPreset = ref<ChatLunaCorePresetListItem | null>(null)
const createMode = ref(false)
const createSource = ref<ChatLunaCorePresetSource>('core')
const createFilename = ref('')
const rawText = ref('')
const originalRawText = ref('')
const validationResult = ref<ChatLunaCorePresetValidationResult | null>(null)
const editorTextarea = ref<HTMLTextAreaElement | null>(null)
const lineGutter = ref<HTMLElement | null>(null)
const indentGuideLayer = ref<HTMLElement | null>(null)
const indentGuideSize = computed(() => {
    const lines = rawText.value.split('\n')
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

const normalizedKeyword = computed(() => keyword.value.trim().toLowerCase())

const coreCount = computed(
    () => presets.value.filter((preset) => preset.source === 'core').length
)

const characterCount = computed(
    () => presets.value.filter((preset) => preset.source === 'character').length
)

const filteredPresets = computed(() => {
    const text = normalizedKeyword.value

    if (!text) return presets.value

    return presets.value.filter((preset) => {
        return [preset.filename, preset.sourceLabel, ...preset.keywords]
            .join(' ')
            .toLowerCase()
            .includes(text)
    })
})

const isDirty = computed(() => {
    return rawText.value !== originalRawText.value || createMode.value
})

const hasEditor = computed(() => {
    return createMode.value || selectedPreset.value != null
})

const canSave = computed(() => {
    if (!hasEditor.value || !isDirty.value) return false
    if (!createMode.value) return true

    return createFilename.value.trim().length > 0
})

const canDelete = computed(() => {
    return !createMode.value && selectedPreset.value != null
})

const editorTitle = computed(() => {
    if (createMode.value) return '新增预设文件'
    return selectedPreset.value?.filename ?? '未选择预设'
})

const editorMeta = computed(() => {
    if (createMode.value) {
        const source = presetSourceOptions.find(
            (item) => item.value === createSource.value
        )

        return `${source?.label ?? '主插件预设'} · YAML 原文编辑`
    }

    const preset = selectedPreset.value
    if (!preset) return ''

    return `${preset.sourceLabel} · ${formatPresetCount(preset)} · ${formatSize(
        preset.size
    )}`
})

const summaryKeywords = computed(() => {
    return (
        validationResult.value?.keywords ??
        selectedPreset.value?.keywords ??
        []
    )
})

const editorFileLabel = computed(() => {
    if (createMode.value) {
        return createFilename.value.trim() || '未命名.yml'
    }

    return selectedPreset.value?.filename ?? 'preset.yml'
})

const copyEditor = async () => {
    try {
        await navigator.clipboard.writeText(rawText.value)
        ElMessage.success('已复制到剪贴板')
    } catch {
        ElMessage.error('复制失败')
    }
}

const lineNumbers = computed(() => {
    return rawText.value.split('\n').map((_, index) => index + 1)
})

const lineGutterWidth = computed(() => {
    return `${Math.max(3, String(lineNumbers.value.length).length + 1)}ch`
})

const indentGuideRows = computed(() => {
    const lines = rawText.value.split('\n')
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

const applyPresetDetail = (detail: ChatLunaCorePresetDetail) => {
    selectedId.value = detail.preset.id
    selectedPreset.value = detail.preset
    createMode.value = false
    createSource.value = detail.preset.source
    createFilename.value = ''
    rawText.value = detail.rawText
    originalRawText.value = detail.rawText
    validationResult.value = null
}

const formatTime = (value: string | null) => {
    if (!value) return '-'

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value

    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')

    return `${month}-${day} ${hour}:${minute}`
}

const formatSize = (value: number | null) => {
    if (value == null) return '-'
    if (value < 1024) return `${value} B`

    return `${(value / 1024).toFixed(1)} KB`
}

const formatPresetCount = (preset: ChatLunaCorePresetListItem) => {
    return preset.source === 'character'
        ? `${preset.promptCount} sections`
        : `${preset.promptCount} prompts`
}

const confirmDiscardIfDirty = async () => {
    if (!isDirty.value) return true

    try {
        await ElMessageBox.confirm(
            '当前预设有未保存修改，继续操作会丢失这些修改。是否继续？',
            '未保存修改',
            {
                type: 'warning',
                confirmButtonText: '继续',
                cancelButtonText: '取消'
            }
        )
        return true
    } catch {
        return false
    }
}

const fetchPresets = async () => {
    listLoading.value = true

    try {
        const result = await api.listChatLunaCorePresets()
        presets.value = result.presets
        listReason.value = result.reason ?? ''
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        ElMessage.error(`加载 ChatLuna 预设失败：${message}`)
    } finally {
        listLoading.value = false
    }
}

const loadPresetDetail = async (id: string) => {
    detailLoading.value = true

    try {
        applyPresetDetail(await api.getChatLunaCorePreset({ id }))
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        ElMessage.error(`加载 ChatLuna 预设内容失败：${message}`)
    } finally {
        detailLoading.value = false
    }
}

const refreshPresets = async () => {
    if (!(await confirmDiscardIfDirty())) return

    await fetchPresets()

    const next =
        selectedId.value != null
            ? presets.value.find((preset) => preset.id === selectedId.value)
            : presets.value[0]

    if (next) {
        await loadPresetDetail(next.id)
    } else {
        selectedId.value = null
        selectedPreset.value = null
        rawText.value = ''
        originalRawText.value = ''
        createMode.value = false
        createSource.value = 'core'
    }
}

const selectPreset = async (id: string) => {
    if (!createMode.value && selectedId.value === id) return
    if (!(await confirmDiscardIfDirty())) return

    await loadPresetDetail(id)
}

const startCreate = async () => {
    if (!(await confirmDiscardIfDirty())) return

    const nextSource = selectedPreset.value?.source ?? createSource.value

    selectedId.value = null
    selectedPreset.value = null
    createMode.value = true
    createSource.value = nextSource
    createFilename.value = ''
    rawText.value = createPresetTemplate('new-preset', createSource.value)
    originalRawText.value = ''
    validationResult.value = null
}

const handleCreateSourceChange = () => {
    if (!createMode.value) return

    rawText.value = createPresetTemplate('new-preset', createSource.value)
    originalRawText.value = ''
    validationResult.value = null
}

const resetEditor = async () => {
    if (createMode.value) {
        rawText.value = createPresetTemplate('new-preset', createSource.value)
        validationResult.value = null
        return
    }

    rawText.value = originalRawText.value
    validationResult.value = null
}

const validatePreset = async () => {
    validationLoading.value = true

    try {
        validationResult.value = await api.validateChatLunaCorePreset({
            source: createMode.value
                ? createSource.value
                : selectedPreset.value?.source,
            rawText: rawText.value
        })

        if (validationResult.value.valid) {
            ElMessage.success('预设校验通过')
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        ElMessage.error(`校验 ChatLuna 预设失败：${message}`)
    } finally {
        validationLoading.value = false
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
    const next = `${rawText.value.slice(0, start)}  ${rawText.value.slice(end)}`

    rawText.value = next

    requestAnimationFrame(() => {
        textarea.selectionStart = start + 2
        textarea.selectionEnd = start + 2
    })
}

const savePreset = async () => {
    saving.value = true

    try {
        const detail = createMode.value
            ? await api.createChatLunaCorePreset({
                  source: createSource.value,
                  filename: createFilename.value,
                  rawText: rawText.value
              })
            : await api.updateChatLunaCorePreset({
                  id: selectedPreset.value!.id,
                  rawText: rawText.value
              })

        applyPresetDetail(detail)
        await fetchPresets()
        ElMessage.success('ChatLuna 预设已保存')
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        ElMessage.error(`保存 ChatLuna 预设失败：${message}`)
    } finally {
        saving.value = false
    }
}

const deletePreset = async () => {
    const preset = selectedPreset.value
    if (!preset) return

    try {
        await ElMessageBox.confirm(
            `确认删除预设文件 "${preset.filename}"？此操作会从 Koishi data 目录中删除该文件，且不可撤销。`,
            '删除预设文件',
            {
                type: 'warning',
                confirmButtonText: '删除',
                cancelButtonText: '取消',
                confirmButtonClass: 'el-button--danger'
            }
        )
    } catch {
        return
    }

    deleting.value = true

    try {
        await api.deleteChatLunaCorePreset({ id: preset.id })
        ElMessage.success('ChatLuna 预设已删除')

        selectedId.value = null
        selectedPreset.value = null
        rawText.value = ''
        originalRawText.value = ''
        validationResult.value = null
        await fetchPresets()

        if (presets.value[0]) {
            await loadPresetDetail(presets.value[0].id)
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        ElMessage.error(`删除 ChatLuna 预设失败：${message}`)
    } finally {
        deleting.value = false
    }
}

watch(rawText, () => {
    validationResult.value = null
    requestAnimationFrame(syncEditorScroll)
})

onMounted(async () => {
    await fetchPresets()

    if (presets.value[0]) {
        await loadPresetDetail(presets.value[0].id)
    }
})
</script>

<style scoped>
.core-page {
    box-sizing: border-box;
    width: min(1800px, 100%);
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 22px;
}

.core-page.compact {
    width: min(1440px, 100%);
}

.page-header {
    position: relative;
    flex-shrink: 0;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 18px;
    padding: 22px 26px;
    border: 1px solid var(--k-color-divider);
    border-radius: 16px;
    overflow: hidden;
    background:
        radial-gradient(
            120% 160% at 0% 0%,
            color-mix(in srgb, var(--k-color-primary), transparent 86%),
            transparent 60%
        ),
        var(--k-card-bg);
    box-shadow: var(--k-card-shadow);
}

.page-header::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 3px;
    background: linear-gradient(
        90deg,
        var(--k-color-primary),
        color-mix(in srgb, var(--k-color-primary), transparent 55%) 60%,
        transparent
    );
}

.page-icon {
    width: 54px;
    height: 54px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    color: #fff;
    background: linear-gradient(
        135deg,
        var(--k-color-primary),
        color-mix(in srgb, var(--k-color-primary), #7c5cff 50%)
    );
    box-shadow: 0 8px 20px
        color-mix(in srgb, var(--k-color-primary), transparent 65%);
}

.page-heading {
    min-width: 0;
}

.page-kicker {
    display: inline-block;
    margin-bottom: 4px;
    padding: 2px 10px;
    border-radius: 999px;
    color: var(--k-color-primary);
    background: color-mix(in srgb, var(--k-color-primary), transparent 88%);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.page-header h1 {
    margin: 2px 0 0;
    color: var(--k-text-dark);
    font-size: 26px;
    font-weight: 700;
    line-height: 1.15;
}

.page-subtitle {
    margin: 4px 0 0;
    color: var(--k-text-light);
    font-size: 13px;
}

.page-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
}

.stat-pills {
    display: flex;
    gap: 8px;
}

.stat-pill {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 62px;
    padding: 8px 12px;
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    background: var(--k-card-bg);
    line-height: 1.1;
}

.stat-pill-value {
    color: var(--k-text-dark);
    font-size: 18px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}

.stat-pill-label {
    margin-top: 3px;
    color: var(--k-text-light);
    font-size: 11px;
}

.stat-pill.is-core {
    border-color: color-mix(
        in srgb,
        var(--k-color-primary),
        transparent 55%
    );
}

.stat-pill.is-core .stat-pill-value {
    color: var(--k-color-primary);
}

.stat-pill.is-character {
    border-color: color-mix(in srgb, #7c5cff, transparent 55%);
}

.stat-pill.is-character .stat-pill-value {
    color: #7c5cff;
}

.preset-workspace {
    display: grid;
    grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
    gap: 16px;
    align-items: start;
}

.preset-list-card,
.preset-editor-card {
    min-width: 0;
    border-radius: 12px;
}

.card-header,
.editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.card-header > span {
    font-size: 15px;
    font-weight: 650;
}

.list-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    margin-bottom: 12px;
}

.preset-list-scroll {
    height: 590px;
}

.preset-list-scroll :deep(.el-scrollbar__view) {
    padding-right: 2px;
}

.preset-list-item {
    position: relative;
    width: 100%;
    min-width: 0;
    margin: 0 0 10px;
    padding: 12px 12px 12px 18px;
    border: 1px solid var(--k-color-divider);
    border-radius: 10px;
    display: grid;
    gap: 8px;
    text-align: left;
    color: var(--k-text-dark);
    background: var(--k-card-bg);
    cursor: pointer;
    transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease,
        transform 0.15s ease;
}

.preset-list-item::before {
    content: '';
    position: absolute;
    top: 12px;
    bottom: 12px;
    left: 8px;
    width: 3px;
    border-radius: 999px;
    background: var(--k-color-primary);
    opacity: 0.55;
}

.preset-list-item[data-source='character']::before {
    background: #7c5cff;
}

.preset-list-item:hover {
    border-color: color-mix(
        in srgb,
        var(--k-color-primary),
        transparent 40%
    );
    transform: translateX(2px);
}

.preset-list-item.active {
    border-color: var(--k-color-primary);
    box-shadow: 0 0 0 1px var(--k-color-primary) inset;
    background: color-mix(in srgb, var(--k-color-primary), transparent 94%);
}

.preset-list-title-row {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
}

.preset-list-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    font-weight: 650;
}

.preset-list-meta {
    display: inline-flex;
    align-items: center;
    gap: 5px;
}

.preset-list-meta .el-icon {
    flex-shrink: 0;
    color: var(--k-color-primary);
    font-size: 13px;
}

.preset-list-meta,
.editor-meta,
.muted {
    color: var(--k-text-light);
    font-size: 13px;
}

.keyword-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
}

.editor-header {
    align-items: flex-start;
}

.editor-title {
    display: block;
    margin-bottom: 4px;
    color: var(--k-text-dark);
    font-size: 17px;
    font-weight: 650;
}

.editor-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;
}

.editor-empty,
.empty-state {
    min-height: 180px;
    display: grid;
    place-items: center;
    color: var(--k-text-light);
    font-size: 14px;
}

.editor-body {
    display: grid;
    gap: 14px;
}

.create-form {
    max-width: 420px;
}

.create-form :deep(.el-select) {
    width: 100%;
}

.summary-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 10px;
}

.summary-label {
    color: var(--k-text-light);
    font-size: 13px;
    font-weight: 600;
}

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
    height: clamp(560px, calc(100vh - 360px), 920px);
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
    .preset-workspace {
        grid-template-columns: 1fr;
    }

    .preset-list-scroll {
        height: 320px;
    }

    .code-editor,
    .editor-input-wrap,
    .preset-editor {
        height: 420px;
    }
}

@media (max-width: 768px) {
    .page-header {
        grid-template-columns: 1fr;
    }

    .page-header h1 {
        font-size: 24px;
    }

    .page-actions {
        align-items: flex-start;
        justify-content: flex-start;
    }

    .stat-pills {
        flex-wrap: wrap;
    }

    .card-header,
    .editor-header {
        align-items: flex-start;
        flex-direction: column;
    }

    .editor-actions,
    .list-toolbar,
    .summary-row {
        width: 100%;
        grid-template-columns: 1fr;
    }
}
</style>
