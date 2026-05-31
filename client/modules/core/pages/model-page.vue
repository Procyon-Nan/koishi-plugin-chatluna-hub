<template>
    <section class="core-page" :class="{ compact: compactMode }">
        <CorePageHeader
            kicker="ChatLuna Core"
            title="模型管理"
            subtitle="配置模型适配器凭据，并查看已加载的平台模型"
            :pills="[
                { value: adapterCount, label: '适配器' },
                { value: configuredCount, label: '已配置', variant: 'core' },
                { value: runningCount, label: '运行中', variant: 'success' },
                {
                    value: modelData.summary.total,
                    label: '模型',
                    variant: 'character'
                }
            ]"
        >
            <template #icon>
                <el-icon :size="26">
                    <DataAnalysis />
                </el-icon>
            </template>
        </CorePageHeader>

        <el-alert
            v-if="adapterReason"
            :title="adapterReason"
            type="warning"
            show-icon
            :closable="false"
        />

        <el-card shadow="never" class="adapter-card">
            <template #header>
                <div class="card-header">
                    <div class="card-title-group">
                        <span class="card-title">模型适配器</span>
                        <span class="card-tip">{{ adapterUpdatedText }}</span>
                    </div>
                    <div class="card-toolbar">
                        <el-input
                            v-model="adapterKeyword"
                            class="adapter-search"
                            placeholder="搜索适配器或平台"
                            clearable
                        />
                        <div class="scope-tabs">
                            <button
                                v-for="option in adapterScopeOptions"
                                :key="option.value"
                                type="button"
                                class="scope-tab"
                                :class="{
                                    'is-active': adapterScope === option.value
                                }"
                                @click="adapterScope = option.value"
                            >
                                <span
                                    class="scope-dot"
                                    :class="`is-${option.value}`"
                                />
                                <span class="scope-label">{{
                                    option.label
                                }}</span>
                                <span class="scope-count">{{
                                    scopeCount(option.value)
                                }}</span>
                            </button>
                        </div>
                        <el-button
                            type="primary"
                            :icon="Plus"
                            :disabled="!adapterWritable"
                            @click="openCreatePicker"
                        >
                            添加
                        </el-button>
                        <el-button
                            :icon="Refresh"
                            :loading="adapterLoading"
                            @click="fetchAdapters"
                        >
                            刷新
                        </el-button>
                    </div>
                </div>
            </template>

            <div v-if="filteredInstances.length === 0" class="empty-state">
                {{
                    instances.length === 0
                        ? '尚未配置任何适配器，点击右上角「添加」开始。'
                        : '没有匹配的配置实例'
                }}
            </div>

            <div v-else class="adapter-grid">
                <article
                    v-for="instance in filteredInstances"
                    :key="instance.instanceKey"
                    class="adapter-tile"
                    :data-status="instance.status"
                >
                    <header class="adapter-tile-head">
                        <div class="adapter-identity">
                            <span class="adapter-name">
                                {{ instance.platform }}
                            </span>
                            <span class="adapter-platform">
                                {{ instance.title }}
                            </span>
                        </div>
                        <span
                            class="status-chip"
                            :class="`is-${instance.status}`"
                        >
                            <span class="status-dot" />
                            {{ statusLabel(instance.status) }}
                        </span>
                    </header>

                    <div class="adapter-meta">
                        <span class="meta-item">
                            <el-icon><Key /></el-icon>
                            {{ instance.credentials.length }} 凭据
                        </span>
                        <span class="meta-item">
                            <el-icon><DataAnalysis /></el-icon>
                            {{ instance.modelCount }} 模型
                        </span>
                        <span class="meta-item adapter-pkg">
                            {{ instance.pluginName }}
                        </span>
                    </div>

                    <footer class="adapter-tile-foot">
                        <el-switch
                            :model-value="!instance.disabled"
                            :loading="busyKey === instance.instanceKey"
                            :disabled="!adapterWritable"
                            @change="handleToggle(instance)"
                        />
                        <span class="foot-spacer" />
                        <el-button
                            size="small"
                            :icon="Setting"
                            :disabled="!adapterWritable"
                            @click="openEditor(instance)"
                        >
                            配置
                        </el-button>
                        <el-button
                            size="small"
                            text
                            type="danger"
                            :icon="DeleteIcon"
                            :disabled="!adapterWritable"
                            @click="handleDelete(instance)"
                        />
                    </footer>
                </article>
            </div>
        </el-card>

        <el-alert
            v-if="modelData.reason"
            :title="modelData.reason"
            type="warning"
            show-icon
            :closable="false"
        />

        <el-card shadow="never" class="model-card">
            <template #header>
                <div class="card-header">
                    <div class="card-title-group">
                        <span class="card-title">已加载模型</span>
                        <span class="card-tip">{{ updatedAtText }}</span>
                    </div>
                    <div class="card-toolbar model-toolbar">
                        <el-input
                            v-model="keyword"
                            class="model-search"
                            placeholder="搜索模型名、调用名或能力"
                            clearable
                        />
                        <el-select
                            v-model="typeFilter"
                            class="filter-select"
                            placeholder="模型类型"
                        >
                            <el-option label="全部类型" value="all" />
                            <el-option label="LLM" value="llm" />
                            <el-option label="Embedding" value="embeddings" />
                            <el-option label="Reranker" value="reranker" />
                            <el-option label="Unknown" value="unknown" />
                        </el-select>
                        <el-select
                            v-model="platformFilter"
                            class="filter-select"
                            placeholder="适配器"
                            filterable
                        >
                            <el-option label="全部适配器" value="all" />
                            <el-option
                                v-for="platform in modelData.platforms"
                                :key="platform"
                                :label="platformLabel(platform)"
                                :value="platform"
                            />
                        </el-select>
                        <el-select
                            v-model="capabilityFilters"
                            class="capability-select"
                            placeholder="模型能力"
                            multiple
                            collapse-tags
                            collapse-tags-tooltip
                            clearable
                        >
                            <el-option
                                v-for="capability in availableCapabilities"
                                :key="capability"
                                :label="capabilityLabel(capability)"
                                :value="capability"
                            />
                        </el-select>
                        <el-button
                            :icon="Refresh"
                            :loading="loading"
                            @click="fetchModels"
                        >
                            刷新
                        </el-button>
                    </div>
                </div>
            </template>

            <el-table
                class="model-table"
                :data="filteredModels"
                :row-key="getRowKey"
                v-loading="loading"
                empty-text="暂无可显示模型"
                max-height="560"
            >
                <el-table-column
                    label="适配器"
                    width="170"
                    :resizable="false"
                    align="center"
                    header-align="center"
                    show-overflow-tooltip
                >
                    <template #default="scope">
                        <div class="adapter-col">
                            <strong>{{ adapterTitleOf(scope.row.platform) }}</strong>
                            <span>{{ scope.row.platform }}</span>
                        </div>
                    </template>
                </el-table-column>

                <el-table-column
                    label="模型名"
                    min-width="320"
                    :resizable="false"
                    header-align="center"
                    show-overflow-tooltip
                >
                    <template #default="scope">
                        <div class="model-name-cell">
                            <strong>{{ scope.row.name }}</strong>
                            <span>{{ scope.row.fullName }}</span>
                        </div>
                    </template>
                </el-table-column>

                <el-table-column
                    label="模型类型"
                    width="128"
                    :resizable="false"
                    align="center"
                    header-align="center"
                >
                    <template #default="scope">
                        <span
                            class="type-chip"
                            :class="`is-${scope.row.type}`"
                        >
                            {{ modelTypeLabel(scope.row.type) }}
                        </span>
                    </template>
                </el-table-column>

                <el-table-column
                    label="模型能力"
                    min-width="360"
                    :resizable="false"
                    align="center"
                    header-align="center"
                >
                    <template #default="scope">
                        <div class="capability-tags">
                            <el-tag
                                v-for="capability in scope.row.capabilities"
                                :key="capability"
                                size="small"
                                effect="plain"
                                round
                            >
                                {{ capabilityLabel(capability) }}
                            </el-tag>
                            <span
                                v-if="scope.row.capabilities.length === 0"
                                class="empty-text"
                            >
                                未声明
                            </span>
                        </div>
                    </template>
                </el-table-column>

                <el-table-column
                    v-if="hasMaxTokens"
                    label="最大 Tokens"
                    width="140"
                    :resizable="false"
                    align="center"
                    header-align="center"
                >
                    <template #default="scope">
                        {{ formatTokens(scope.row.maxTokens) }}
                    </template>
                </el-table-column>
            </el-table>
        </el-card>


        <AdapterTypePickerDialog
            v-model:visible="pickerVisible"
            v-model:keyword="pickerKeyword"
            :types="types"
            @choose="chooseType"
        />

        <AdapterEditorDialog
            v-model:visible="editorVisible"
            v-model:platform="editorPlatform"
            :descriptor="editorDescriptor"
            :instance-key="editorInstanceKey"
            :credentials="editorCredentials"
            :saving="savingAdapter"
            @save="saveEditor"
            @add-credential="addCredential"
            @remove-credential="removeCredential"
        />
    </section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import {
    DataAnalysis,
    Delete as DeleteIcon,
    Key,
    Plus,
    Refresh,
    Setting
} from '@element-plus/icons-vue'
import { useCoreCompactMode } from '../use-compact-mode'
import CorePageHeader from '../components/CorePageHeader.vue'
import AdapterTypePickerDialog from './model/AdapterTypePickerDialog.vue'
import AdapterEditorDialog from './model/AdapterEditorDialog.vue'
import { useModelCatalogue } from './model/use-model-catalogue'
import { useAdapters } from './model/use-adapters'

// Shared compact/wide toggle; the root section reads it for the `compact`
// class. CorePageHeader owns its own copy for the toggle button.
const compactMode = useCoreCompactMode()

// Model catalogue feature (已加载模型 card).
const {
    loading,
    keyword,
    typeFilter,
    platformFilter,
    capabilityFilters,
    modelData,
    capabilityLabel,
    availableCapabilities,
    updatedAtText,
    filteredModels,
    hasMaxTokens,
    getRowKey,
    modelTypeLabel,
    formatTokens,
    fetchModels
} = useModelCatalogue()

// Adapter feature (模型适配器 card + picker/editor dialogs). Toggling, saving
// or deleting an adapter reloads the model catalogue, so fetchModels is wired
// in as the refresh callback.
const {
    adapterScopeOptions,
    adapterLoading,
    adapterKeyword,
    adapterScope,
    busyKey,
    pickerVisible,
    pickerKeyword,
    editorVisible,
    editorDescriptor,
    editorInstanceKey,
    editorPlatform,
    editorCredentials,
    savingAdapter,
    instances,
    types,
    adapterWritable,
    adapterCount,
    configuredCount,
    runningCount,
    adapterReason,
    adapterUpdatedText,
    filteredInstances,
    scopeCount,
    platformLabel,
    adapterTitleOf,
    statusLabel,
    openCreatePicker,
    chooseType,
    openEditor,
    addCredential,
    removeCredential,
    fetchAdapters,
    saveEditor,
    handleToggle,
    handleDelete
} = useAdapters(fetchModels)

onMounted(() => {
    void fetchAdapters()
    void fetchModels()
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

.adapter-card,
.model-card {
    border-radius: 12px;
}

.card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
}

.card-title-group {
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
}

.card-title {
    font-size: 15px;
    font-weight: 650;
    color: var(--k-text-dark);
}

.card-tip {
    color: var(--k-text-light);
    font-size: 12px;
}

.card-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.adapter-search {
    width: 200px;
}
.scope-tabs {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 3px;
    border: 1px solid var(--k-color-divider);
    border-radius: 10px;
    background: var(--k-color-fill);
}

.scope-tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--k-text-light);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition:
        background 0.15s ease,
        color 0.15s ease,
        box-shadow 0.15s ease;
}

.scope-tab:hover {
    color: var(--k-text-dark);
}

.scope-tab.is-active {
    color: var(--k-text-dark);
    font-weight: 600;
    background: var(--k-card-bg);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.scope-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--k-text-light);
}

.scope-tab.is-active .scope-dot.is-running {
    background: var(--k-color-success);
}

.scope-tab.is-active .scope-dot.is-disabled {
    background: var(--k-color-danger);
}

.scope-tab.is-active .scope-dot.is-all {
    background: var(--k-color-primary);
}

.scope-count {
    min-width: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--k-text-light), transparent 82%);
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    text-align: center;
}

.scope-tab.is-active .scope-count {
    background: color-mix(in srgb, var(--k-color-primary), transparent 84%);
    color: var(--k-color-primary);
}

.empty-state {
    min-height: 120px;
    display: grid;
    place-items: center;
    color: var(--k-text-light);
    font-size: 14px;
}
.adapter-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 14px;
}

.adapter-tile {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 16px 14px 20px;
    border: 1px solid var(--k-color-divider);
    border-radius: 14px;
    background: var(--k-card-bg);
    overflow: hidden;
    transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease,
        transform 0.15s ease;
}

.adapter-tile::before {
    content: '';
    position: absolute;
    top: 14px;
    bottom: 14px;
    left: 8px;
    width: 3px;
    border-radius: 999px;
    background: var(--k-color-divider);
    transition: background 0.15s ease;
}

.adapter-tile[data-status='running']::before {
    background: var(--k-color-success);
}

.adapter-tile[data-status='configured']::before {
    background: var(--k-color-primary);
}

.adapter-tile[data-status='unsupported']::before {
    background: #7c5cff;
}

.adapter-tile:hover {
    border-color: color-mix(in srgb, var(--k-color-primary), transparent 45%);
    box-shadow: var(--k-card-shadow);
    transform: translateY(-2px);
}

.adapter-tile-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
}

.adapter-identity {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.adapter-name {
    font-size: 16px;
    font-weight: 650;
    color: var(--k-text-dark);
}
.adapter-platform {
    font-size: 12px;
    color: var(--k-text-light);
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.status-chip {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    color: var(--k-text-light);
    background: var(--k-color-fill);
}

.status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
}

.status-chip.is-running {
    color: var(--k-color-success);
    background: color-mix(in srgb, var(--k-color-success), transparent 86%);
}

.status-chip.is-running .status-dot {
    box-shadow: 0 0 0 3px
        color-mix(in srgb, var(--k-color-success), transparent 70%);
}

.status-chip.is-configured {
    color: var(--k-color-primary);
    background: color-mix(in srgb, var(--k-color-primary), transparent 88%);
}

.status-chip.is-unsupported {
    color: #7c5cff;
    background: color-mix(in srgb, #7c5cff, transparent 88%);
}

.adapter-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    color: var(--k-text-light);
    font-size: 12px;
}

.meta-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.meta-item .el-icon {
    font-size: 13px;
}

.adapter-pkg {
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
}

.adapter-note {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--k-color-warning);
}

.adapter-tile-foot {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: auto;
    padding-top: 4px;
}

.foot-spacer {
    flex: 1;
}
.dialog-tip {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--k-text-light);
}

.dialog-tip code {
    padding: 1px 6px;
    border-radius: 6px;
    background: var(--k-color-fill);
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    color: var(--k-text-dark);
}

.adapter-col {
    display: grid;
    gap: 2px;
    min-width: 0;
}

.adapter-col strong {
    color: var(--k-text-dark);
    font-weight: 650;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.adapter-col span {
    color: var(--k-text-light);
    font-size: 12px;
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.model-toolbar {
    gap: 10px;
}

.model-search {
    width: 220px;
}

.filter-select {
    width: 150px;
}

.capability-select {
    width: 220px;
}

.model-table {
    font-size: 14px;
}

.model-table :deep(.cell) {
    padding: 0 8px;
    font-size: 14px;
    line-height: 20px;
}

.model-table :deep(th .cell) {
    font-size: 14px;
    font-weight: 600;
}

.model-name-cell {
    display: grid;
    gap: 3px;
    min-width: 0;
}

.model-name-cell strong,
.model-name-cell span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.model-name-cell strong {
    color: var(--k-text-dark);
    font-weight: 650;
}

.model-name-cell span {
    color: var(--k-text-light);
    font-size: 13px;
}
.type-chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    color: var(--k-text-light);
    background: var(--k-color-fill);
}

.type-chip.is-llm {
    color: var(--k-color-success);
    background: color-mix(in srgb, var(--k-color-success), transparent 86%);
}

.type-chip.is-embeddings {
    color: var(--k-color-primary);
    background: color-mix(in srgb, var(--k-color-primary), transparent 86%);
}

.type-chip.is-reranker {
    color: var(--k-color-warning);
    background: color-mix(in srgb, var(--k-color-warning), transparent 84%);
}

.capability-tags {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
}

.empty-text {
    color: var(--k-text-light);
    font-size: 13px;
}

@media (max-width: 768px) {
    .card-toolbar {
        width: 100%;
    }

    .adapter-search,
    .model-search,
    .filter-select,
    .capability-select {
        width: 100%;
    }

    .adapter-grid {
        grid-template-columns: 1fr;
    }
}
</style>
