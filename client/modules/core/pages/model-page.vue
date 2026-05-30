<template>
    <section class="core-page" :class="{ compact: compactMode }">
        <header class="page-header">
            <div class="page-icon">
                <el-icon :size="26">
                    <DataAnalysis />
                </el-icon>
            </div>
            <div class="page-heading">
                <span class="page-kicker">ChatLuna Core</span>
                <h1>模型管理</h1>
                <p class="page-subtitle">
                    配置模型适配器凭据，并查看已加载的平台模型
                </p>
            </div>
            <div class="page-actions">
                <div class="stat-pills">
                    <span class="stat-pill">
                        <span class="stat-pill-value">{{ adapterCount }}</span>
                        <span class="stat-pill-label">适配器</span>
                    </span>
                    <span class="stat-pill is-configured">
                        <span class="stat-pill-value">{{
                            configuredCount
                        }}</span>
                        <span class="stat-pill-label">已配置</span>
                    </span>
                    <span class="stat-pill is-running">
                        <span class="stat-pill-value">{{ runningCount }}</span>
                        <span class="stat-pill-label">运行中</span>
                    </span>
                    <span class="stat-pill is-model">
                        <span class="stat-pill-value">{{
                            modelData.summary.total
                        }}</span>
                        <span class="stat-pill-label">模型</span>
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


        <el-dialog
            v-model="pickerVisible"
            width="720px"
            class="adapter-dialog picker-dialog"
            align-center
            append-to-body
            :show-close="false"
        >
            <template #header>
                <div class="dialog-hero">
                    <div class="dialog-hero-icon">
                        <el-icon :size="22"><Plus /></el-icon>
                    </div>
                    <div class="dialog-hero-text">
                        <span class="dialog-hero-kicker">Adapter</span>
                        <h3>添加适配器</h3>
                        <p>
                            选择适配器类型。平台名可自定义的适配器可重复添加多份配置实例，平台固定的适配器每种仅可配置一份。
                        </p>
                    </div>
                    <el-button
                        class="dialog-hero-close"
                        text
                        :icon="Close"
                        @click="pickerVisible = false"
                    />
                </div>
            </template>

            <el-input
                v-model="pickerKeyword"
                class="picker-search"
                placeholder="搜索适配器名称或平台"
                clearable
            >
                <template #prefix>
                    <el-icon><Search /></el-icon>
                </template>
            </el-input>

            <div
                v-if="filteredPickerTypes.length === 0"
                class="picker-empty"
            >
                没有匹配的适配器类型
            </div>

            <div v-else class="type-grid">
                <button
                    v-for="type in filteredPickerTypes"
                    :key="type.id"
                    type="button"
                    class="type-tile"
                    :class="{ 'is-disabled': !type.canCreate }"
                    :disabled="!type.canCreate"
                    :title="type.createReason"
                    @click="chooseType(type)"
                >
                    <span class="type-avatar">{{ typeInitial(type) }}</span>
                    <span class="type-info">
                        <span class="type-title">{{ type.title }}</span>
                        <span class="type-platform">{{
                            type.platformDefault
                        }}</span>
                    </span>
                    <span
                        v-if="type.instanceCount > 0"
                        class="type-badge is-count"
                    >
                        已配置 {{ type.instanceCount }}
                    </span>
                    <span
                        v-else-if="!type.canCreate"
                        class="type-badge is-blocked"
                    >
                        不可添加
                    </span>
                    <el-icon v-else class="type-arrow"><ArrowRight /></el-icon>
                </button>
            </div>
        </el-dialog>

        <el-dialog
            v-model="editorVisible"
            width="680px"
            class="adapter-dialog editor-dialog"
            align-center
            append-to-body
            :show-close="false"
        >
            <template #header>
                <div class="dialog-hero" v-if="editorDescriptor">
                    <div class="dialog-hero-icon">
                        <el-icon :size="22"><Setting /></el-icon>
                    </div>
                    <div class="dialog-hero-text">
                        <span class="dialog-hero-kicker">
                            {{ editorInstanceKey ? '编辑配置' : '新建配置' }}
                        </span>
                        <h3>{{ editorDescriptor.title }}</h3>
                        <p>
                            配置写入
                            <code>{{ editorDescriptor.pluginName }}</code>
                            并自动重载。
                        </p>
                    </div>
                    <el-button
                        class="dialog-hero-close"
                        text
                        :icon="Close"
                        @click="editorVisible = false"
                    />
                </div>
            </template>

            <div v-if="editorDescriptor" class="dialog-body">
                <el-form
                    v-if="editorDescriptor.platformConfigurable"
                    label-position="top"
                    class="editor-form"
                >
                    <el-form-item label="平台名称">
                        <el-input
                            v-model="editorPlatform"
                            :placeholder="editorDescriptor.platformDefault"
                        />
                        <span class="form-hint">
                            多份配置请使用不同的平台名称以避免冲突。
                        </span>
                    </el-form-item>
                </el-form>

                <div class="cred-section">
                    <div class="cred-section-head">
                        <span class="cred-section-title">
                            凭据
                            <span class="cred-section-count">{{
                                editorCredentials.length
                            }}</span>
                        </span>
                        <span class="cred-section-hint">
                            多条凭据组成负载均衡池，取模型时以选中凭据为准。
                        </span>
                    </div>

                    <div class="cred-list">
                        <div
                            v-for="(entry, index) in editorCredentials"
                            :key="index"
                            class="cred-row"
                            :class="{ 'is-off': !entry.enabled }"
                        >
                            <span class="cred-index">{{ index + 1 }}</span>
                            <div class="cred-fields">
                                <el-input
                                    v-if="editorShowApiKey"
                                    v-model="entry.apiKey"
                                    class="cred-key"
                                    type="password"
                                    show-password
                                    placeholder="API Key"
                                />
                                <el-input
                                    v-if="editorShowEndpoint"
                                    v-model="entry.apiEndpoint"
                                    class="cred-endpoint"
                                    :placeholder="
                                        editorDescriptor.endpointPlaceholder ||
                                        'API 端点'
                                    "
                                />
                            </div>
                            <el-switch
                                v-model="entry.enabled"
                                class="cred-enabled"
                                inline-prompt
                                active-text="启用"
                                inactive-text="停用"
                            />
                            <el-button
                                class="cred-remove"
                                text
                                type="danger"
                                :icon="DeleteIcon"
                                @click="removeCredential(index)"
                            />
                        </div>

                        <div
                            v-if="editorCredentials.length === 0"
                            class="cred-empty"
                        >
                            暂无凭据，点击下方按钮添加一条。
                        </div>

                        <el-button
                            class="cred-add"
                            :icon="Plus"
                            plain
                            @click="addCredential"
                        >
                            添加凭据
                        </el-button>
                    </div>
                </div>
            </div>

            <template #footer>
                <el-button @click="editorVisible = false">取消</el-button>
                <el-button
                    type="primary"
                    :loading="savingAdapter"
                    @click="saveEditor"
                >
                    保存并应用
                </el-button>
            </template>
        </el-dialog>
    </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
    ArrowRight,
    Close,
    DataAnalysis,
    Delete as DeleteIcon,
    Key,
    Plus,
    Refresh,
    Search,
    Setting
} from '@element-plus/icons-vue'
import * as api from '../api'
import { useCoreCompactMode } from '../use-compact-mode'
import type {
    ChatLunaAdapterCredentialEntry,
    ChatLunaAdapterCredentialKind,
    ChatLunaAdapterInstance,
    ChatLunaAdapterListResult,
    ChatLunaAdapterStatus,
    ChatLunaAdapterType,
    ChatLunaCoreModelItem,
    ChatLunaCoreModelListResult,
    ChatLunaCoreModelType
} from '../types'

type ModelTypeFilter = ChatLunaCoreModelType | 'all'
type AdapterScope = 'all' | 'running' | 'configured' | 'disabled'

interface EditorDescriptor {
    adapterId: string
    title: string
    pluginName: string
    credentialKind: ChatLunaAdapterCredentialKind
    platformConfigurable: boolean
    endpointPlaceholder?: string
    platformDefault: string
}

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

const emptyAdapterData = (): ChatLunaAdapterListResult => ({
    instances: [],
    types: [],
    platformMap: {},
    writable: true,
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

const statusLabels: Record<ChatLunaAdapterStatus, string> = {
    running: '运行中',
    configured: '已配置',
    available: '未配置',
    unsupported: '需原生配置'
}

const adapterScopeOptions: { label: string; value: AdapterScope }[] = [
    { label: '全部', value: 'all' },
    { label: '运行中', value: 'running' },
    { label: '已停用', value: 'disabled' }
]

const compactMode = useCoreCompactMode()

const loading = ref(false)
const keyword = ref('')
const typeFilter = ref<ModelTypeFilter>('all')
const platformFilter = ref('all')
const capabilityFilters = ref<string[]>([])
const modelData = ref<ChatLunaCoreModelListResult>(emptyModelData())

const adapterLoading = ref(false)
const adapterData = ref<ChatLunaAdapterListResult>(emptyAdapterData())
const adapterKeyword = ref('')
const adapterScope = ref<AdapterScope>('all')
const busyKey = ref<string | null>(null)

const pickerVisible = ref(false)
const pickerKeyword = ref('')
const editorVisible = ref(false)
const editorDescriptor = ref<EditorDescriptor | null>(null)
const editorInstanceKey = ref<string | undefined>(undefined)
const editorPlatform = ref('')
const editorCredentials = reactive<ChatLunaAdapterCredentialEntry[]>([])
const savingAdapter = ref(false)

const instances = computed(() => adapterData.value.instances)
const types = computed(() => adapterData.value.types)
const adapterWritable = computed(() => adapterData.value.writable)
const adapterCount = computed(() => instances.value.length)
const configuredCount = computed(() => instances.value.length)
const runningCount = computed(
    () => instances.value.filter((item) => item.status === 'running').length
)

const adapterReason = computed(() => adapterData.value.reason ?? '')

const adapterUpdatedText = computed(() => {
    if (!adapterData.value.updatedAt) return '尚未刷新'
    return `刷新于 ${formatTime(adapterData.value.updatedAt)}`
})

const normalizedAdapterKeyword = computed(() =>
    adapterKeyword.value.trim().toLowerCase()
)

const filteredInstances = computed(() => {
    const text = normalizedAdapterKeyword.value

    return instances.value.filter((instance) => {
        if (adapterScope.value === 'running' && instance.status !== 'running') {
            return false
        }
        if (adapterScope.value === 'disabled' && !instance.disabled) {
            return false
        }

        if (!text) return true

        return [instance.title, instance.platform, instance.pluginName]
            .join(' ')
            .toLowerCase()
            .includes(text)
    })
})

const scopeCount = (scope: AdapterScope) => {
    if (scope === 'running') {
        return instances.value.filter((item) => item.status === 'running')
            .length
    }
    if (scope === 'disabled') {
        return instances.value.filter((item) => item.disabled).length
    }
    return instances.value.length
}

const filteredPickerTypes = computed(() => {
    const text = pickerKeyword.value.trim().toLowerCase()
    if (!text) return types.value

    return types.value.filter((type) =>
        [type.title, type.platformDefault, type.pluginName]
            .join(' ')
            .toLowerCase()
            .includes(text)
    )
})

const typeInitial = (type: ChatLunaAdapterType) => {
    const source = type.title || type.platformDefault || '?'
    return source.trim().charAt(0).toUpperCase()
}

const platformLabel = (platform: string) => {
    const title = adapterData.value.platformMap[platform]
    return title ? `${title} · ${platform}` : platform
}

const adapterTitleOf = (platform: string) => {
    return adapterData.value.platformMap[platform] ?? platform
}

const editorShowApiKey = computed(() => {
    return editorDescriptor.value?.credentialKind !== 'endpoint-enabled'
})

const editorShowEndpoint = computed(() => {
    return editorDescriptor.value?.credentialKind !== 'api-enabled'
})

const statusLabel = (status: ChatLunaAdapterStatus) => statusLabels[status]

const createCredentialEntry = (): ChatLunaAdapterCredentialEntry => ({
    apiKey: '',
    apiEndpoint: '',
    enabled: true
})

const openCreatePicker = () => {
    pickerKeyword.value = ''
    pickerVisible.value = true
}

const chooseType = (type: ChatLunaAdapterType) => {
    if (!type.canCreate) return

    editorDescriptor.value = {
        adapterId: type.id,
        title: type.title,
        pluginName: type.pluginName,
        credentialKind: type.credentialKind,
        platformConfigurable: type.platformConfigurable,
        endpointPlaceholder: type.endpointPlaceholder,
        platformDefault: type.platformDefault
    }
    editorInstanceKey.value = undefined
    editorPlatform.value = ''
    editorCredentials.splice(0, editorCredentials.length, createCredentialEntry())

    pickerVisible.value = false
    editorVisible.value = true
}

const openEditor = (instance: ChatLunaAdapterInstance) => {
    editorDescriptor.value = {
        adapterId: instance.adapterId,
        title: instance.title,
        pluginName: instance.pluginName,
        credentialKind: instance.credentialKind,
        platformConfigurable: instance.platformConfigurable,
        endpointPlaceholder: instance.endpointPlaceholder,
        platformDefault: instance.platform
    }
    editorInstanceKey.value = instance.instanceKey
    editorPlatform.value = instance.platformConfigurable
        ? instance.platform
        : ''
    editorCredentials.splice(
        0,
        editorCredentials.length,
        ...instance.credentials.map((entry) => ({ ...entry }))
    )

    if (editorCredentials.length === 0) {
        editorCredentials.push(createCredentialEntry())
    }

    editorVisible.value = true
}

const addCredential = () => {
    editorCredentials.push(createCredentialEntry())
}

const removeCredential = (index: number) => {
    editorCredentials.splice(index, 1)
}

const fetchAdapters = async () => {
    adapterLoading.value = true

    try {
        adapterData.value = await api.listChatLunaAdapters()
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        ElMessage.error(`加载适配器失败：${message}`)
    } finally {
        adapterLoading.value = false
    }
}

const saveEditor = async () => {
    const descriptor = editorDescriptor.value
    if (!descriptor) return

    savingAdapter.value = true

    try {
        const result = await api.saveChatLunaAdapter({
            adapterId: descriptor.adapterId,
            instanceKey: editorInstanceKey.value,
            platform: descriptor.platformConfigurable
                ? editorPlatform.value
                : undefined,
            credentials: editorCredentials.map((entry) => ({ ...entry }))
        })

        if (!result.ok) {
            ElMessage.error(result.reason ?? '保存失败')
            return
        }

        ElMessage.success('适配器配置已保存')
        editorVisible.value = false
        await Promise.all([fetchAdapters(), fetchModels()])
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        ElMessage.error(`保存适配器失败：${message}`)
    } finally {
        savingAdapter.value = false
    }
}

const handleToggle = async (instance: ChatLunaAdapterInstance) => {
    busyKey.value = instance.instanceKey

    try {
        const result = await api.toggleChatLunaAdapter({
            instanceKey: instance.instanceKey,
            enabled: instance.disabled
        })

        if (!result.ok) {
            ElMessage.error(result.reason ?? '操作失败')
            return
        }

        ElMessage.success(instance.disabled ? '适配器已启用' : '适配器已停用')
        await Promise.all([fetchAdapters(), fetchModels()])
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        ElMessage.error(`切换适配器失败：${message}`)
    } finally {
        busyKey.value = null
    }
}

const handleDelete = async (instance: ChatLunaAdapterInstance) => {
    try {
        await ElMessageBox.confirm(
            `确认删除「${instance.title} · ${instance.platform}」的配置？此操作会从 Koishi 配置中移除该插件条目，且不可撤销。`,
            '删除适配器配置',
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

    busyKey.value = instance.instanceKey

    try {
        const result = await api.deleteChatLunaAdapter({
            instanceKey: instance.instanceKey
        })

        if (!result.ok) {
            ElMessage.error(result.reason ?? '删除失败')
            return
        }

        ElMessage.success('适配器配置已删除')
        await Promise.all([fetchAdapters(), fetchModels()])
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        ElMessage.error(`删除适配器失败：${message}`)
    } finally {
        busyKey.value = null
    }
}


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

const formatTokens = (tokens: number | null) => {
    if (tokens == null) return '-'
    return new Intl.NumberFormat().format(tokens)
}

const formatTime = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')

    return `${year}-${month}-${day} ${hour}:${minute}`
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

.stat-pill.is-configured {
    border-color: color-mix(in srgb, var(--k-color-primary), transparent 55%);
}

.stat-pill.is-configured .stat-pill-value {
    color: var(--k-color-primary);
}

.stat-pill.is-running {
    border-color: color-mix(in srgb, var(--k-color-success), transparent 50%);
}

.stat-pill.is-running .stat-pill-value {
    color: var(--k-color-success);
}

.stat-pill.is-model {
    border-color: color-mix(in srgb, #7c5cff, transparent 55%);
}

.stat-pill.is-model .stat-pill-value {
    color: #7c5cff;
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

.dialog-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.adapter-dialog :deep(.el-dialog__header) {
    margin-right: 0;
    padding: 0;
}

.adapter-dialog :deep(.el-dialog__body) {
    padding-top: 18px;
}

.dialog-hero {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 20px 22px;
    border-radius: 12px 12px 0 0;
    background:
        radial-gradient(
            120% 160% at 0% 0%,
            color-mix(in srgb, var(--k-color-primary), transparent 86%),
            transparent 62%
        ),
        var(--k-card-bg);
    border-bottom: 1px solid var(--k-color-divider);
}

.dialog-hero::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 3px;
    border-radius: 12px 12px 0 0;
    background: linear-gradient(
        90deg,
        var(--k-color-primary),
        color-mix(in srgb, var(--k-color-primary), transparent 55%) 60%,
        transparent
    );
}

.dialog-hero-icon {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    color: #fff;
    background: linear-gradient(
        135deg,
        var(--k-color-primary),
        color-mix(in srgb, var(--k-color-primary), #7c5cff 50%)
    );
    box-shadow: 0 8px 18px
        color-mix(in srgb, var(--k-color-primary), transparent 68%);
}

.dialog-hero-text {
    min-width: 0;
    flex: 1;
}

.dialog-hero-kicker {
    display: inline-block;
    margin-bottom: 4px;
    padding: 2px 9px;
    border-radius: 999px;
    color: var(--k-color-primary);
    background: color-mix(in srgb, var(--k-color-primary), transparent 88%);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.dialog-hero-text h3 {
    margin: 2px 0 0;
    color: var(--k-text-dark);
    font-size: 19px;
    font-weight: 700;
    line-height: 1.2;
}

.dialog-hero-text p {
    margin: 5px 0 0;
    color: var(--k-text-light);
    font-size: 12px;
    line-height: 1.6;
}

.dialog-hero-text code {
    padding: 1px 6px;
    border-radius: 6px;
    background: var(--k-color-fill);
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    color: var(--k-text-dark);
}

.dialog-hero-close {
    flex-shrink: 0;
    margin: -4px -8px 0 0;
}

.picker-search {
    margin-bottom: 14px;
}

.picker-empty {
    min-height: 100px;
    display: grid;
    place-items: center;
    color: var(--k-text-light);
    font-size: 14px;
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

.editor-form {
    padding: 14px 16px 4px;
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    background: var(--k-color-fill);
}

.cred-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.cred-section-head {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.cred-section-title {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 14px;
    font-weight: 650;
    color: var(--k-text-dark);
}

.cred-section-count {
    min-width: 20px;
    padding: 0 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--k-color-primary), transparent 86%);
    color: var(--k-color-primary);
    font-size: 12px;
    font-weight: 600;
    text-align: center;
}

.cred-section-hint {
    color: var(--k-text-light);
    font-size: 12px;
    line-height: 1.5;
}

.cred-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.cred-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--k-color-divider);
    border-radius: 10px;
    background: var(--k-card-bg);
    transition:
        border-color 0.15s ease,
        opacity 0.15s ease;
}

.cred-row.is-off {
    opacity: 0.6;
}

.cred-index {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    border-radius: 7px;
    display: grid;
    place-items: center;
    background: var(--k-color-fill);
    color: var(--k-text-light);
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
}

.cred-fields {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
}

.cred-key {
    flex: 1.4;
    min-width: 0;
}

.cred-endpoint {
    flex: 1;
    min-width: 0;
}

.cred-enabled {
    flex-shrink: 0;
}

.cred-remove {
    flex-shrink: 0;
}

.cred-empty {
    padding: 12px;
    border: 1px dashed var(--k-color-divider);
    border-radius: 10px;
    text-align: center;
    color: var(--k-text-light);
    font-size: 13px;
}

.cred-add {
    align-self: flex-start;
}

.form-hint {
    display: block;
    margin-top: 4px;
    color: var(--k-text-light);
    font-size: 12px;
}

.type-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px;
    max-height: 52vh;
    overflow-y: auto;
    padding: 2px;
}

.type-tile {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    background: var(--k-card-bg);
    text-align: left;
    cursor: pointer;
    transition:
        border-color 0.15s ease,
        transform 0.15s ease,
        box-shadow 0.15s ease;
}

.type-tile:hover:not(.is-disabled) {
    border-color: color-mix(in srgb, var(--k-color-primary), transparent 40%);
    transform: translateY(-2px);
    box-shadow: var(--k-card-shadow);
}

.type-tile:hover:not(.is-disabled) .type-arrow {
    color: var(--k-color-primary);
    transform: translateX(2px);
}

.type-tile.is-disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.type-avatar {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    font-size: 16px;
    font-weight: 700;
    color: var(--k-color-primary);
    background: color-mix(in srgb, var(--k-color-primary), transparent 86%);
}

.type-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
}

.type-title {
    font-size: 14px;
    font-weight: 650;
    color: var(--k-text-dark);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.type-platform {
    font-size: 12px;
    color: var(--k-text-light);
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.type-badge {
    flex-shrink: 0;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
}

.type-badge.is-count {
    color: var(--k-color-primary);
    background: color-mix(in srgb, var(--k-color-primary), transparent 88%);
}

.type-badge.is-blocked {
    color: var(--k-text-light);
    background: var(--k-color-fill);
}

.type-arrow {
    flex-shrink: 0;
    color: var(--k-color-divider);
    transition:
        color 0.15s ease,
        transform 0.15s ease;
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
    .page-header {
        grid-template-columns: 1fr;
    }

    .page-header h1 {
        font-size: 24px;
    }

    .page-actions {
        align-items: flex-start;
    }

    .stat-pills {
        flex-wrap: wrap;
    }

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


