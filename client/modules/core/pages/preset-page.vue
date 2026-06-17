<template>
    <section class="core-page" :class="{ compact: compactMode }">
        <CorePageHeader
            kicker="ChatLuna Core"
            title="预设管理"
            subtitle="编辑主插件与 Character 预设的 YAML 原文"
            :pills="[
                { value: presets.length, label: '预设' },
                { value: coreCount, label: '主插件', variant: 'core' },
                {
                    value: characterCount,
                    label: 'Character',
                    variant: 'character'
                }
            ]"
        >
            <template #icon>
                <el-icon :size="26"><Memo /></el-icon>
            </template>
        </CorePageHeader>

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
                        <div class="editor-heading-wrap">
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

                    <PresetCodeEditor
                        v-model="rawText"
                        :file-label="editorFileLabel"
                    />
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
    Delete as DeleteIcon,
    Document,
    Memo,
    Plus,
    Refresh
} from '@element-plus/icons-vue'
import * as api from '../api'
import { useCoreCompactMode } from '../use-compact-mode'
import { formatDateTime, formatBytes } from '../format'
import { reportError } from '../use-error-toast'
import CorePageHeader from '../components/CorePageHeader.vue'
import PresetCodeEditor from '../components/PresetCodeEditor.vue'
import { createPresetTemplate, presetSourceOptions } from './preset-templates'
import type {
    ChatLunaCorePresetDetail,
    ChatLunaCorePresetListItem,
    ChatLunaCorePresetSource,
    ChatLunaCorePresetValidateInput,
    ChatLunaCorePresetValidationResult
} from '../types'

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

// Thin wrapper over the shared formatDateTime: the original formatTime returned
// the raw `value` for an unparseable-but-present string (not '-'), so we
// preserve that branch exactly while delegating the valid/empty cases.
const formatTime = (value: string | null) => {
    if (!value) return '-'

    return formatDateTime(value, value)
}

const formatSize = (value: number | null) => formatBytes(value, '-', 'KB')

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
        reportError(error, '加载 ChatLuna 预设失败')
    } finally {
        listLoading.value = false
    }
}

const loadPresetDetail = async (id: string) => {
    detailLoading.value = true

    try {
        applyPresetDetail(await api.getChatLunaCorePreset({ id }))
    } catch (error) {
        reportError(error, '加载 ChatLuna 预设内容失败')
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
        const input: ChatLunaCorePresetValidateInput = {
            rawText: rawText.value
        }
        const source = createMode.value
            ? createSource.value
            : selectedPreset.value?.source

        if (source) {
            input.source = source
        }

        if (!createMode.value && selectedPreset.value?.id) {
            input.id = selectedPreset.value.id
        }

        validationResult.value = await api.validateChatLunaCorePreset(input)

        if (validationResult.value.valid) {
            ElMessage.success('预设校验通过')
        }
    } catch (error) {
        reportError(error, '校验 ChatLuna 预设失败')
    } finally {
        validationLoading.value = false
    }
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
        reportError(error, '保存 ChatLuna 预设失败')
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
        reportError(error, '删除 ChatLuna 预设失败')
    } finally {
        deleting.value = false
    }
}

watch(rawText, () => {
    validationResult.value = null
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

.preset-list-card :deep(.el-card__header),
.preset-editor-card :deep(.el-card__header) {
    padding: 16px 16px 12px;
}

.card-header,
.editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    height: 36px;
    box-sizing: border-box;
}

.card-header > span {
    font-size: 17px;
    font-weight: 650;
    color: var(--k-text-dark);
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
    align-items: center;
}

.editor-heading-wrap {
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
}

.editor-title {
    display: inline-block;
    color: var(--k-text-dark);
    font-size: 17px;
    font-weight: 650;
    line-height: 1.4;
}

.editor-meta {
    margin: 0;
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

@media (max-width: 980px) {
    .preset-workspace {
        grid-template-columns: 1fr;
    }

    .preset-list-scroll {
        height: 320px;
    }
}

@media (max-width: 768px) {
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
