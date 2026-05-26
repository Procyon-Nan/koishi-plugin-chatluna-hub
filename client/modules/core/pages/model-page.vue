<template>
    <section class="core-page" :class="{ compact: compactMode }">
        <header class="page-header">
            <div class="page-icon">
                <el-icon :size="28">
                    <DataAnalysis />
                </el-icon>
            </div>
            <div>
                <span class="page-kicker">ChatLuna Core</span>
                <h1>模型管理</h1>
            </div>
            <div class="page-actions">
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
            v-if="modelData.reason"
            :title="modelData.reason"
            type="warning"
            show-icon
            :closable="false"
        />

        <div class="summary-grid">
            <el-card
                v-for="item in summaryCards"
                :key="item.key"
                shadow="never"
                class="summary-card"
            >
                <span class="summary-label">{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
            </el-card>
        </div>

        <el-card shadow="never" class="toolbar-card">
            <template #header>
                <div class="card-header">
                    <span>Adapter 模型</span>
                    <span class="card-tip">{{ updatedAtText }}</span>
                </div>
            </template>

            <div class="model-toolbar">
                <el-input
                    v-model="keyword"
                    placeholder="搜索模型名、调用名、适配器或能力"
                    clearable
                >
                    <template #prepend>搜索</template>
                </el-input>

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
                        :label="platform"
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
                    type="primary"
                    :icon="Refresh"
                    :loading="loading"
                    @click="fetchModels"
                >
                    刷新
                </el-button>
            </div>
        </el-card>

        <el-card shadow="never" class="table-card">
            <template #header>
                <div class="card-header">
                    <span>模型列表</span>
                    <span class="card-tip">数据来自已加载的 ChatLuna adapter</span>
                </div>
            </template>

            <el-table
                class="model-table"
                :data="filteredModels"
                :row-key="getRowKey"
                border
                v-loading="loading"
                empty-text="暂无可显示模型"
                max-height="560"
            >
                <el-table-column
                    prop="platform"
                    label="适配器"
                    width="150"
                    :resizable="false"
                    align="center"
                    header-align="center"
                    show-overflow-tooltip
                />

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
                        <el-tag
                            :type="modelTypeTag(scope.row.type)"
                            size="small"
                            effect="plain"
                        >
                            {{ modelTypeLabel(scope.row.type) }}
                        </el-tag>
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
    </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { DataAnalysis, Refresh } from '@element-plus/icons-vue'
import * as api from '../api'
import { useCoreCompactMode } from '../use-compact-mode'
import type {
    ChatLunaCoreModelItem,
    ChatLunaCoreModelListResult,
    ChatLunaCoreModelType
} from '../types'

type ModelTypeFilter = ChatLunaCoreModelType | 'all'

const emptyModelData = (): ChatLunaCoreModelListResult => ({
    models: [],
    platforms: [],
    summary: {
        total: 0,
        llm: 0,
        embeddings: 0,
        reranker: 0,
        unknown: 0
    },
    updatedAt: ''
})

const capabilityLabels: Record<string, string> = {
    text_input: '文本输入',
    tool_call: '工具调用',
    image_input: '图像输入',
    thinking: '思考',
    image_generation: '图像生成',
    audio_input: '音频输入',
    video_input: '视频输入',
    file_input: '文件输入'
}

const compactMode = useCoreCompactMode()
const loading = ref(false)
const keyword = ref('')
const typeFilter = ref<ModelTypeFilter>('all')
const platformFilter = ref('all')
const capabilityFilters = ref<string[]>([])
const modelData = ref<ChatLunaCoreModelListResult>(emptyModelData())

const summaryCards = computed(() => [
    {
        key: 'total',
        label: '总模型',
        value: modelData.value.summary.total
    },
    {
        key: 'llm',
        label: 'LLM',
        value: modelData.value.summary.llm
    },
    {
        key: 'embeddings',
        label: 'Embedding',
        value: modelData.value.summary.embeddings
    },
    {
        key: 'reranker',
        label: 'Reranker',
        value: modelData.value.summary.reranker
    }
])

const availableCapabilities = computed(() => {
    return Array.from(
        new Set(modelData.value.models.flatMap((item) => item.capabilities))
    ).sort((left, right) =>
        capabilityLabel(left).localeCompare(capabilityLabel(right), undefined, {
            numeric: true,
            sensitivity: 'base'
        })
    )
})

const updatedAtText = computed(() => {
    if (!modelData.value.updatedAt) return '尚未刷新'

    return `刷新于 ${formatTime(modelData.value.updatedAt)}`
})

const normalizedKeyword = computed(() => keyword.value.trim().toLowerCase())

const filteredModels = computed(() => {
    const text = normalizedKeyword.value

    return modelData.value.models.filter((model) => {
        if (typeFilter.value !== 'all' && model.type !== typeFilter.value) {
            return false
        }

        if (
            platformFilter.value !== 'all' &&
            model.platform !== platformFilter.value
        ) {
            return false
        }

        if (
            capabilityFilters.value.length > 0 &&
            !capabilityFilters.value.every((capability) =>
                model.capabilities.includes(capability)
            )
        ) {
            return false
        }

        if (!text) return true

        const haystack = [
            model.name,
            model.fullName,
            model.platform,
            model.type,
            ...model.capabilities,
            ...model.capabilities.map(capabilityLabel)
        ]
            .join(' ')
            .toLowerCase()

        return haystack.includes(text)
    })
})

const hasMaxTokens = computed(() => {
    return modelData.value.models.some((model) => model.maxTokens != null)
})

const getRowKey = (row: ChatLunaCoreModelItem) => row.id

const capabilityLabel = (capability: string) => {
    return capabilityLabels[capability] ?? capability
}

const modelTypeLabel = (type: ChatLunaCoreModelType) => {
    if (type === 'llm') return 'LLM'
    if (type === 'embeddings') return 'Embedding'
    if (type === 'reranker') return 'Reranker'
    return 'Unknown'
}

const modelTypeTag = (
    type: ChatLunaCoreModelType
): 'success' | 'warning' | 'primary' | 'info' => {
    if (type === 'llm') return 'success'
    if (type === 'embeddings') return 'primary'
    if (type === 'reranker') return 'warning'
    return 'info'
}

const formatTokens = (tokens: number | null) => {
    if (tokens == null) return '-'

    return new Intl.NumberFormat().format(tokens)
}

const formatTime = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value

    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')

    return `${month}-${day} ${hour}:${minute}`
}

const fetchModels = async () => {
    loading.value = true

    try {
        modelData.value = await api.listChatLunaCoreModels()
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        ElMessage.error(`加载 ChatLuna 模型失败：${message}`)
    } finally {
        loading.value = false
    }
}

onMounted(() => {
    void fetchModels()
})
</script>

<style scoped>
.core-page {
    width: min(1800px, 100%);
    margin: 0 auto;
    display: grid;
    gap: 22px;
}

.core-page.compact {
    width: min(1440px, 100%);
}

.page-header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 16px;
}

.page-icon {
    width: 58px;
    height: 58px;
    border: 1px solid var(--k-color-divider);
    border-radius: 8px;
    display: grid;
    place-items: center;
    color: var(--k-color-primary);
    background: var(--k-card-bg);
    box-shadow: var(--k-card-shadow);
}

.page-kicker {
    display: block;
    margin-bottom: 6px;
    color: var(--k-text-light);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0;
    text-transform: uppercase;
}

.page-header h1 {
    margin: 0;
    color: var(--k-text-dark);
    font-size: 28px;
    line-height: 1.15;
}

.page-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
}

.summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
}

.summary-card,
.toolbar-card,
.table-card {
    border-radius: 8px;
}

.summary-card :deep(.el-card__body) {
    display: grid;
    gap: 8px;
    padding: 16px;
}

.summary-label {
    color: var(--k-text-light);
    font-size: 13px;
    font-weight: 600;
}

.summary-card strong {
    color: var(--k-text-dark);
    font-size: 28px;
    line-height: 1;
}

.card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.card-tip {
    color: var(--k-text-light);
    font-size: 13px;
}

.model-toolbar {
    display: grid;
    grid-template-columns:
        minmax(280px, 1fr)
        minmax(140px, 180px)
        minmax(140px, 180px)
        minmax(180px, 260px)
        auto;
    gap: 12px;
    align-items: center;
}

.filter-select,
.capability-select {
    width: 100%;
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

.model-table :deep(.el-tag) {
    font-size: 13px;
}

.core-page.compact .model-table :deep(.cell) {
    padding: 0 6px;
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
    .page-header {
        grid-template-columns: 1fr;
    }

    .page-header h1 {
        font-size: 24px;
    }

    .page-actions {
        justify-content: flex-start;
    }

    .summary-grid,
    .model-toolbar {
        grid-template-columns: 1fr;
    }

    .card-header {
        align-items: flex-start;
        flex-direction: column;
    }
}
</style>
