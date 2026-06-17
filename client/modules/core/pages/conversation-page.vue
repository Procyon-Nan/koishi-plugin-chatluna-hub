<template>
    <section class="core-page" :class="{ compact: compactMode }">
        <CorePageHeader
            kicker="ChatLuna Core"
            title="会话管理"
            subtitle="按路由归档，批量调整模型与预设"
            :pills="[
                { value: routeTotal, label: '会话' },
                { value: routeCurrentTotal, label: '活跃', variant: 'success' },
                { value: routeGroupCount, label: '路由', variant: 'character' }
            ]"
        >
            <template #icon>
                <el-icon :size="26"><ChatRound /></el-icon>
            </template>
        </CorePageHeader>

        <div class="conversation-workspace">
            <el-card shadow="never" class="route-card">
                <template #header>
                    <div class="route-card-header">
                        <div class="route-card-heading">
                            <span class="route-card-title">路由 / 会话组</span>
                        </div>
                        <span class="route-total-badge">
                            {{ routeTotal }} 个会话
                        </span>
                    </div>
                </template>

                <div class="route-list" v-loading="routesLoading">
                    <button
                        class="route-item"
                        :class="{ active: selectedRouteId === allRouteId }"
                        type="button"
                        @click="selectRoute(allRouteId)"
                    >
                        <span class="route-icon">
                            <el-icon>
                                <FolderOpened />
                            </el-icon>
                        </span>
                        <span class="route-meta">
                            <span class="route-title">全部会话</span>
                            <span class="route-detail">所有活跃 ChatLuna 会话</span>
                        </span>
                        <span class="route-badges">
                            <span
                                v-if="routeCurrentTotal > 0"
                                class="route-current"
                            >
                                活跃
                            </span>
                            <span class="route-count">{{ routeTotal }}</span>
                        </span>
                    </button>

                    <template
                        v-for="section in routeSections"
                        :key="section.key"
                    >
                        <div v-if="section.routes.length > 0" class="route-section">
                            <div class="route-section-title">
                                <span>{{ section.label }}</span>
                                <span>{{ section.count }}</span>
                            </div>
                            <button
                                v-for="route in section.routes"
                                :key="route.id"
                                class="route-item"
                                :class="{ active: selectedRouteId === route.id }"
                                type="button"
                                @click="selectRoute(route.id)"
                            >
                                <span class="route-icon">
                                    <el-icon>
                                        <component :is="section.icon" />
                                    </el-icon>
                                </span>
                                <span class="route-meta">
                                    <span class="route-title">
                                        {{ route.label }}
                                    </span>
                                    <span class="route-detail">
                                        {{ route.detail }}
                                    </span>
                                </span>
                                <span class="route-badges">
                                    <span
                                        v-if="route.currentCount > 0"
                                        class="route-current"
                                    >
                                        活跃
                                    </span>
                                    <span class="route-count">
                                        {{ route.count }}
                                    </span>
                                </span>
                            </button>
                        </div>
                    </template>
                </div>
            </el-card>

            <el-card shadow="never" class="conversation-card">
                <template #header>
                    <div class="conversation-card-header">
                        <div class="conversation-heading-wrap">
                            <span class="card-title">{{ activeRouteTitle }}</span>
                        </div>
                        <div class="header-actions">
                            <span
                                v-if="selectedConversations.length > 0"
                                class="selected-count"
                            >
                                已选择 {{ selectedConversations.length }} 项
                            </span>
                            <el-dropdown
                                trigger="click"
                                :disabled="selectedConversations.length === 0"
                                @command="handleBatchCommand"
                            >
                                <el-button
                                    :disabled="selectedConversations.length === 0"
                                    type="primary"
                                    plain
                                >
                                    批量操作
                                </el-button>
                                <template #dropdown>
                                    <el-dropdown-menu>
                                        <el-dropdown-item command="model">
                                            切换模型
                                        </el-dropdown-item>
                                        <el-dropdown-item command="preset">
                                            切换预设
                                        </el-dropdown-item>
                                        <el-dropdown-item
                                            command="delete"
                                            divided
                                        >
                                            删除会话
                                        </el-dropdown-item>
                                    </el-dropdown-menu>
                                </template>
                            </el-dropdown>
                        </div>
                    </div>
                </template>

                <div class="conversation-toolbar">
                    <el-input
                        v-model="keyword"
                        placeholder="搜索标题、模型、预设、用户或群聊 ID"
                        clearable
                        @keyup.enter="refreshCurrentRoute"
                        @clear="refreshCurrentRoute"
                    >
                        <template #prefix>
                            <el-icon>
                                <Search />
                            </el-icon>
                        </template>
                    </el-input>

                    <el-select v-model="sortPreset" @change="applySortPreset">
                        <el-option label="最近对话" value="lastChatAt:descending" />
                        <el-option label="标题名称" value="title:ascending" />
                    </el-select>

                    <el-button
                        :icon="Refresh"
                        :loading="loading || routesLoading"
                        @click="refreshConversations"
                    >
                        刷新
                    </el-button>
                </div>

                <el-table
                    ref="tableRef"
                    class="conversation-table"
                    :data="conversations"
                    :row-key="getRowKey"
                    :row-class-name="tableRowClass"
                    v-loading="loading"
                    empty-text="暂无 ChatLuna 会话"
                    max-height="620"
                    @selection-change="onSelectionChange"
                >
                    <el-table-column
                        type="selection"
                        width="48"
                        :resizable="false"
                        align="center"
                        header-align="center"
                    />

                    <el-table-column
                        label="状态"
                        width="92"
                        :resizable="false"
                        align="center"
                        header-align="center"
                    >
                        <template #default="scope">
                            <el-tooltip
                                :content="formatStatusTip(scope.row)"
                                placement="top"
                            >
                                <span
                                    class="status-chip"
                                    :class="
                                        scope.row.isCurrent
                                            ? 'is-active'
                                            : 'is-idle'
                                    "
                                >
                                    <span class="status-dot" />
                                    {{ scope.row.isCurrent ? '活跃' : '可用' }}
                                </span>
                            </el-tooltip>
                        </template>
                    </el-table-column>

                    <el-table-column
                        prop="seq"
                        label="序号"
                        width="82"
                        :resizable="false"
                        align="center"
                        header-align="center"
                    />

                    <el-table-column
                        prop="title"
                        label="标题"
                        min-width="180"
                        :resizable="false"
                        align="center"
                        header-align="center"
                        show-overflow-tooltip
                    />

                    <el-table-column
                        prop="createdBy"
                        label="创建者"
                        width="118"
                        :resizable="false"
                        align="center"
                        header-align="center"
                        show-overflow-tooltip
                    />

                    <el-table-column
                        label="模型"
                        min-width="220"
                        :resizable="false"
                        align="center"
                        header-align="center"
                    >
                        <template #default="scope">
                            <el-select
                                v-if="drafts[scope.row.id]"
                                v-model="drafts[scope.row.id].model"
                                filterable
                                placeholder="选择模型"
                                class="usage-select"
                                :loading="optionsLoading"
                                :disabled="isConversationBusy(scope.row)"
                            >
                                <el-option
                                    v-for="model in options.models"
                                    :key="model.value"
                                    :label="model.label"
                                    :value="model.value"
                                />
                            </el-select>
                        </template>
                    </el-table-column>

                    <el-table-column
                        label="预设"
                        min-width="180"
                        :resizable="false"
                        align="center"
                        header-align="center"
                    >
                        <template #default="scope">
                            <el-select
                                v-if="drafts[scope.row.id]"
                                v-model="drafts[scope.row.id].preset"
                                filterable
                                placeholder="选择预设"
                                class="usage-select"
                                :loading="optionsLoading"
                                :disabled="isConversationBusy(scope.row)"
                            >
                                <el-option
                                    v-for="preset in options.presets"
                                    :key="preset.value"
                                    :label="preset.label"
                                    :value="preset.value"
                                />
                            </el-select>
                        </template>
                    </el-table-column>

                    <el-table-column
                        prop="chatMode"
                        label="模式"
                        width="112"
                        :resizable="false"
                        align="center"
                        header-align="center"
                        show-overflow-tooltip
                    />

                    <el-table-column
                        label="最近对话"
                        width="150"
                        :resizable="false"
                        align="center"
                        header-align="center"
                    >
                        <template #default="scope">
                            {{ formatTime(scope.row.lastChatAt) }}
                        </template>
                    </el-table-column>

                    <el-table-column
                        label="操作"
                        width="210"
                        :resizable="false"
                        align="center"
                        header-align="center"
                    >
                        <template #default="scope">
                            <el-space>
                                <el-button
                                    size="small"
                                    type="primary"
                                    :disabled="
                                        !isConversationDirty(scope.row) ||
                                        isConversationBusy(scope.row)
                                    "
                                    :loading="
                                        savingConversationIds.has(scope.row.id)
                                    "
                                    @click="saveConversation(scope.row)"
                                >
                                    保存
                                </el-button>
                                <el-button
                                    size="small"
                                    :disabled="
                                        !isConversationDirty(scope.row) ||
                                        isConversationBusy(scope.row)
                                    "
                                    @click="resetDraft(scope.row)"
                                >
                                    还原
                                </el-button>
                                <el-button
                                    size="small"
                                    type="danger"
                                    :disabled="isConversationBusy(scope.row)"
                                    :loading="
                                        deletingConversationIds.has(scope.row.id)
                                    "
                                    @click="removeConversation(scope.row)"
                                >
                                    删除
                                </el-button>
                            </el-space>
                        </template>
                    </el-table-column>
                </el-table>

                <div class="pagination-row">
                    <el-pagination
                        v-model:current-page="page"
                        v-model:page-size="pageSize"
                        :page-sizes="[10, 20, 50, 100]"
                        :total="total"
                        layout="total, sizes, prev, pager, next"
                        @current-change="fetchConversations"
                        @size-change="onPageSizeChange"
                    />
                </div>
            </el-card>
        </div>

        <BatchUsageDialog
            v-model:visible="batchDialog.visible"
            v-model:value="batchDialog.value"
            :field="batchDialog.field"
            :options="options"
            :options-loading="optionsLoading"
            :saving="batchSaving"
            @apply="applyBatchUsageAndSave"
        />
    </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ChatRound, FolderOpened, Refresh, Search } from '@element-plus/icons-vue'
import * as api from '../api'
import { useCoreCompactMode } from '../use-compact-mode'
import { reportError } from '../use-error-toast'
import { formatDateTime } from '../format'
import CorePageHeader from '../components/CorePageHeader.vue'
import BatchUsageDialog from '../components/BatchUsageDialog.vue'
import { allRouteId } from './conversation-routes'
import { useConversationRoutesData } from './use-conversation-routes-data'
import type {
    ChatLunaConversationListItem,
    ChatLunaConversationOptions,
    ChatLunaConversationSortKey,
    ChatLunaConversationSortOrder
} from '../types'

interface ConversationDraft {
    model: string
    preset: string
}

interface ConversationTableRef {
    clearSelection: () => void
}

type BatchUsageField = 'model' | 'preset'
type BatchCommand = 'model' | 'preset' | 'delete'

const emptyOptions = (): ChatLunaConversationOptions => ({
    models: [],
    presets: []
})

/**
 * Thin wrapper over the shared `formatDateTime`. The conversation table needs
 * the page's original fallbacks: `''` for empty/nullish and `String(value)`
 * for an unparseable value (shared `formatDateTime` would return its fallback
 * in both cases). The valid-date path delegates to `formatDateTime`.
 */
const formatTime = (value: string | Date | null | undefined): string => {
    if (!value) return ''

    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)

    return formatDateTime(date, '')
}

const loading = ref(false)
const compactMode = useCoreCompactMode()
const optionsLoading = ref(false)
const keyword = ref('')
const sortKey = ref<ChatLunaConversationSortKey>('lastChatAt')
const sortOrder = ref<ChatLunaConversationSortOrder>('descending')
const sortPreset = ref('lastChatAt:descending')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const selectedRouteId = ref(allRouteId)
const tableRef = ref<ConversationTableRef>()
const options = ref<ChatLunaConversationOptions>(emptyOptions())
const conversations = ref<ChatLunaConversationListItem[]>([])
const selectedConversations = ref<ChatLunaConversationListItem[]>([])
const drafts = reactive<Record<string, ConversationDraft>>({})
const savingConversationIds = reactive(new Set<string>())
const deletingConversationIds = reactive(new Set<string>())
const batchSaving = ref(false)
const batchDeleting = ref(false)
const batchDialog = reactive<{
    visible: boolean
    field: BatchUsageField
    value: string
}>({
    visible: false,
    field: 'model',
    value: ''
})

const {
    routesLoading,
    fetchRoutes,
    routeTotal,
    routeCurrentTotal,
    routeGroupCount,
    activeRouteTitle,
    routeSections
} = useConversationRoutesData(selectedRouteId)


const getRowKey = (row: ChatLunaConversationListItem) => row.id

const tableRowClass = ({ row }: { row: ChatLunaConversationListItem }) => {
    const classes: string[] = []

    if (row.isCurrent) classes.push('row-active')
    if (isConversationDirty(row)) classes.push('row-dirty')

    return classes.join(' ')
}

const formatStatusTip = (conversation: ChatLunaConversationListItem) => {
    return `记录状态：${conversation.status}；当前绑定：${
        conversation.activeConversationId ?? '-'
    }`
}

const syncDrafts = (items: ChatLunaConversationListItem[]) => {
    const visibleIds = new Set(items.map((item) => item.id))

    for (const key of Object.keys(drafts)) {
        if (!visibleIds.has(key)) {
            delete drafts[key]
        }
    }

    for (const item of items) {
        drafts[item.id] = {
            model: item.model,
            preset: item.preset
        }
    }
}

const clearSelection = () => {
    selectedConversations.value = []
    tableRef.value?.clearSelection()
}

const fetchOptions = async () => {
    optionsLoading.value = true

    try {
        options.value = await api.listChatLunaConversationOptions()
    } catch (error) {
        reportError(error, '加载 ChatLuna 选项失败')
    } finally {
        optionsLoading.value = false
    }
}

const fetchConversations = async () => {
    loading.value = true

    try {
        const result = await api.listChatLunaConversations({
            keyword: keyword.value.trim() || undefined,
            routeBaseBindingKey:
                selectedRouteId.value === allRouteId
                    ? undefined
                    : selectedRouteId.value,
            sortKey: sortKey.value,
            sortOrder: sortOrder.value,
            page: page.value,
            pageSize: pageSize.value
        })

        clearSelection()
        syncDrafts(result.items)
        conversations.value = result.items
        total.value = result.total
        page.value = result.page
        pageSize.value = result.pageSize
    } catch (error) {
        reportError(error, '加载 ChatLuna 会话失败')
    } finally {
        loading.value = false
    }
}

const refreshConversations = async () => {
    page.value = 1
    await Promise.all([fetchOptions(), fetchRoutes()])
    await fetchConversations()
}

const refreshCurrentRoute = async () => {
    page.value = 1
    await fetchConversations()
}

const selectRoute = (routeId: string) => {
    if (selectedRouteId.value === routeId) return

    selectedRouteId.value = routeId
    page.value = 1
    void fetchConversations()
}

const applySortPreset = () => {
    const [key, order] = sortPreset.value.split(':') as [
        ChatLunaConversationSortKey,
        ChatLunaConversationSortOrder
    ]

    sortKey.value = key
    sortOrder.value = order
    page.value = 1
    void fetchConversations()
}

const onPageSizeChange = () => {
    page.value = 1
    void fetchConversations()
}

const onSelectionChange = (selection: ChatLunaConversationListItem[]) => {
    selectedConversations.value = selection
}

const isConversationBusy = (conversation: ChatLunaConversationListItem) => {
    return (
        savingConversationIds.has(conversation.id) ||
        deletingConversationIds.has(conversation.id) ||
        batchSaving.value ||
        batchDeleting.value
    )
}

const isConversationDirty = (conversation: ChatLunaConversationListItem) => {
    const draft = drafts[conversation.id]

    if (draft == null) return false

    return draft.model !== conversation.model || draft.preset !== conversation.preset
}

const resetDraft = (conversation: ChatLunaConversationListItem) => {
    drafts[conversation.id] = {
        model: conversation.model,
        preset: conversation.preset
    }
}

const updateConversationInList = (
    updated: ChatLunaConversationListItem
) => {
    const index = conversations.value.findIndex((item) => item.id === updated.id)

    if (index >= 0) {
        conversations.value[index] = updated
    }

    resetDraft(updated)
}

const saveConversation = async (conversation: ChatLunaConversationListItem) => {
    const draft = drafts[conversation.id]

    if (draft == null || !isConversationDirty(conversation)) {
        return
    }

    savingConversationIds.add(conversation.id)

    try {
        const updated = await api.updateChatLunaConversationUsage({
            conversationId: conversation.id,
            model: draft.model !== conversation.model ? draft.model : undefined,
            preset:
                draft.preset !== conversation.preset ? draft.preset : undefined
        })

        updateConversationInList(updated)
        ElMessage.success('ChatLuna 会话已更新')
    } catch (error) {
        reportError(error, '保存 ChatLuna 会话失败')
    } finally {
        savingConversationIds.delete(conversation.id)
    }
}

const removeConversation = async (
    conversation: ChatLunaConversationListItem
) => {
    try {
        await ElMessageBox.confirm(
            [
                `删除会话「${conversation.title || conversation.id}」后，`,
                '会移除该 ChatLuna 会话的消息记录与权限记录，',
                '并解除当前绑定；该操作不能从此界面恢复。是否继续？'
            ].join(''),
            '删除 ChatLuna 会话',
            {
                type: 'warning',
                confirmButtonText: '确认删除',
                cancelButtonText: '取消'
            }
        )
    } catch {
        return
    }

    deletingConversationIds.add(conversation.id)

    try {
        await api.deleteChatLunaConversation({
            conversationId: conversation.id
        })

        if (conversations.value.length <= 1 && page.value > 1) {
            page.value -= 1
        }

        ElMessage.success('ChatLuna 会话已删除')
        await fetchRoutes()
        await fetchConversations()
    } catch (error) {
        reportError(error, '删除 ChatLuna 会话失败')
    } finally {
        deletingConversationIds.delete(conversation.id)
    }
}

const openBatchUsageDialog = (field: BatchUsageField) => {
    if (selectedConversations.value.length === 0) return

    batchDialog.field = field
    batchDialog.value = ''
    batchDialog.visible = true
}

const applyBatchUsageAndSave = async () => {
    if (!batchDialog.value) return

    const conversationIds = selectedConversations.value.map((item) => item.id)
    if (conversationIds.length === 0) {
        return
    }

    batchSaving.value = true

    try {
        const result = await api.batchUpdateChatLunaConversationUsage({
            conversationIds,
            model:
                batchDialog.field === 'model' ? batchDialog.value : undefined,
            preset:
                batchDialog.field === 'preset' ? batchDialog.value : undefined
        })

        for (const updated of result.updated) {
            updateConversationInList(updated)
        }

        if (result.failed.length > 0) {
            ElMessage.warning(
                `已更新 ${result.updated.length} 个会话，${result.failed.length} 个失败`
            )
        } else {
            ElMessage.success(`已更新 ${result.updated.length} 个会话`)
        }

        batchDialog.visible = false
    } catch (error) {
        reportError(error, '批量更新 ChatLuna 会话失败')
    } finally {
        batchSaving.value = false
    }
}

const deleteSelectedConversations = async () => {
    if (selectedConversations.value.length === 0) return

    try {
        await ElMessageBox.confirm(
            [
                `将删除选中的 ${selectedConversations.value.length} 个 ChatLuna 会话，`,
                '并移除相关消息记录与权限记录。是否继续？'
            ].join(''),
            '批量删除 ChatLuna 会话',
            {
                type: 'warning',
                confirmButtonText: '确认删除',
                cancelButtonText: '取消'
            }
        )
    } catch {
        return
    }

    batchDeleting.value = true

    try {
        const result = await api.batchDeleteChatLunaConversation({
            conversationIds: selectedConversations.value.map((item) => item.id)
        })

        if (result.deleted.length > 0 && result.failed.length === 0) {
            ElMessage.success(`已删除 ${result.deleted.length} 个会话`)
        } else {
            ElMessage.warning(
                `已删除 ${result.deleted.length} 个会话，${result.failed.length} 个失败`
            )
        }

        if (
            result.deleted.length >= conversations.value.length &&
            page.value > 1
        ) {
            page.value -= 1
        }

        await fetchRoutes()
        await fetchConversations()
    } catch (error) {
        reportError(error, '批量删除 ChatLuna 会话失败')
    } finally {
        batchDeleting.value = false
    }
}

const handleBatchCommand = (command: BatchCommand) => {
    if (command === 'model' || command === 'preset') {
        openBatchUsageDialog(command)
        return
    }

    void deleteSelectedConversations()
}

onMounted(() => {
    void refreshConversations()
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

.conversation-workspace {
    display: grid;
    grid-template-columns: 320px minmax(0, 1fr);
    gap: 16px;
    align-items: stretch;
}

.core-page.compact .conversation-workspace {
    grid-template-columns: 280px minmax(0, 1fr);
}

.route-card,
.conversation-card {
    min-width: 0;
    border-radius: 12px;
}

.route-card :deep(.el-card__header),
.conversation-card :deep(.el-card__header) {
    padding: 16px 16px 12px;
}

.route-card :deep(.el-card__body),
.conversation-card :deep(.el-card__body) {
    min-width: 0;
}

.route-card :deep(.el-card__body) {
    padding: 14px;
}

.conversation-card :deep(.el-card__body) {
    min-height: 720px;
    display: flex;
    flex-direction: column;
}

.card-header,
.conversation-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    height: 36px;
    box-sizing: border-box;
}

.route-card-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    height: 36px;
    box-sizing: border-box;
}

.card-title {
    color: var(--k-text-dark);
    font-size: 17px;
    font-weight: 650;
    line-height: 1.4;
}

.card-tip {
    color: var(--k-text-light);
    font-size: 13px;
}

.header-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
}

.selected-count {
    padding: 3px 10px;
    border-radius: 999px;
    color: var(--k-color-primary);
    font-size: 12px;
    font-weight: 600;
    background: color-mix(in srgb, var(--k-color-primary), transparent 90%);
    white-space: nowrap;
}

.conversation-heading-wrap {
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
}

.route-card-heading {
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 10px;
}

.route-card-title {
    color: var(--k-text-dark);
    font-size: 17px;
    font-weight: 650;
    line-height: 1.4;
}

.route-card-subtitle {
    color: var(--k-text-light);
    font-size: 13px;
    margin: 0;
}

.route-total-badge {
    height: 26px;
    border-radius: 999px;
    display: inline-grid;
    place-items: center;
    padding: 0 12px;
    color: var(--k-color-primary);
    font-size: 12px;
    font-weight: 700;
    background: color-mix(in srgb, var(--k-color-primary), transparent 88%);
    white-space: nowrap;
}

.route-list {
    max-height: 680px;
    overflow: auto;
    padding-right: 4px;
    display: grid;
    gap: 12px;
    scrollbar-width: thin;
}

.route-section {
    display: grid;
    gap: 7px;
}

.route-section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 8px 3px;
    color: var(--k-text-light);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.route-item {
    position: relative;
    width: 100%;
    min-height: 60px;
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    padding: 10px 10px 10px 14px;
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    color: var(--k-text-dark);
    background: var(--k-card-bg);
    text-align: left;
    cursor: pointer;
    overflow: hidden;
    transition:
        background 0.16s ease,
        border-color 0.16s ease,
        color 0.16s ease,
        transform 0.16s ease;
}

.route-item::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    width: 3px;
    height: 0;
    border-radius: 0 999px 999px 0;
    background: linear-gradient(
        180deg,
        var(--k-color-primary),
        color-mix(in srgb, var(--k-color-primary), #7c5cff 60%)
    );
    transform: translateY(-50%);
    transition: height 0.18s ease;
}

.route-item:hover {
    border-color: color-mix(
        in srgb,
        var(--k-color-primary) 36%,
        var(--k-color-divider)
    );
    transform: translateX(2px);
}

.route-item.active {
    border-color: color-mix(
        in srgb,
        var(--k-color-primary) 50%,
        var(--k-color-divider)
    );
    color: var(--k-color-primary);
    background: color-mix(in srgb, var(--k-color-primary) 8%, var(--k-card-bg));
}

.route-item.active::before {
    height: 60%;
}

.route-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    color: inherit;
    background: color-mix(in srgb, var(--k-color-fill), transparent 20%);
    transition: background 0.16s ease;
}

.route-item.active .route-icon {
    color: #fff;
    background: linear-gradient(
        135deg,
        var(--k-color-primary),
        color-mix(in srgb, var(--k-color-primary), #7c5cff 50%)
    );
}

.route-meta {
    min-width: 0;
    display: grid;
    gap: 2px;
}

.route-title,
.route-detail {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.route-title {
    font-size: 14px;
    font-weight: 700;
}

.route-detail {
    color: var(--k-text-light);
    font-size: 12px;
}

.route-badges {
    display: grid;
    justify-items: end;
    gap: 4px;
}

.route-current {
    height: 20px;
    border-radius: 999px;
    display: inline-grid;
    place-items: center;
    padding: 0 8px;
    color: var(--k-color-success, #67c23a);
    font-size: 11px;
    font-weight: 700;
    background: color-mix(
        in srgb,
        var(--k-color-success, #67c23a) 14%,
        transparent
    );
    white-space: nowrap;
}

.route-count {
    min-width: 30px;
    height: 24px;
    border-radius: 999px;
    display: inline-grid;
    place-items: center;
    padding: 0 9px;
    color: var(--k-text-light);
    font-size: 12px;
    font-weight: 700;
    background: color-mix(in srgb, var(--k-color-fill), transparent 15%);
}

.route-item.active .route-count {
    color: var(--k-color-primary);
    background: color-mix(in srgb, var(--k-color-primary), transparent 86%);
}

.conversation-toolbar {
    display: grid;
    grid-template-columns: minmax(260px, 1fr) 150px auto;
    gap: 12px;
    align-items: center;
    margin-bottom: 14px;
    padding: 10px;
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    background: color-mix(in srgb, var(--k-card-bg), var(--k-page-bg) 45%);
}

.usage-select {
    width: 100%;
}

/* ---- Premium borderless table ---- */
.conversation-table {
    width: 100%;
    font-size: 14px;
    --el-table-border-color: transparent;
    --el-table-border: none;
}

.conversation-table :deep(.el-table__inner-wrapper)::before {
    display: none;
}

.conversation-table :deep(.cell) {
    padding: 0 10px;
    font-size: 14px;
    line-height: 20px;
}

/* Frosted, uppercase header */
.conversation-table :deep(thead th.el-table__cell) {
    border-bottom: 1px solid var(--k-color-divider);
    background: color-mix(in srgb, var(--k-card-bg), var(--k-page-bg) 55%);
}

.conversation-table :deep(th .cell) {
    color: var(--k-text-light);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.03em;
}

/* Rows: quiet separators, lift on hover */
.conversation-table :deep(td.el-table__cell) {
    border-bottom: 1px solid
        color-mix(in srgb, var(--k-color-divider) 60%, transparent);
}

.conversation-table :deep(.el-table__row) {
    transition: background 0.14s ease;
}

.conversation-table :deep(.el-table__body tr:hover > td.el-table__cell) {
    background: color-mix(in srgb, var(--k-color-primary) 5%, transparent);
}

/* Live left accent: active rows (primary) and unsaved rows (warning) */
.conversation-table :deep(.el-table__row > td.el-table__cell:first-child) {
    position: relative;
}

.conversation-table
    :deep(.el-table__row.row-active > td.el-table__cell:first-child)::before,
.conversation-table
    :deep(.el-table__row.row-dirty > td.el-table__cell:first-child)::before {
    content: '';
    position: absolute;
    top: 6px;
    bottom: 6px;
    left: 0;
    width: 3px;
    border-radius: 0 999px 999px 0;
}

.conversation-table
    :deep(.el-table__row.row-active > td.el-table__cell:first-child)::before {
    background: var(--k-color-primary);
}

.conversation-table
    :deep(.el-table__row.row-dirty > td.el-table__cell:first-child)::before {
    background: var(--k-color-warning, #e6a23c);
}

.conversation-table
    :deep(.el-table__row.row-dirty > td.el-table__cell) {
    background: color-mix(
        in srgb,
        var(--k-color-warning, #e6a23c) 6%,
        transparent
    );
}

/* Inline selects styled as quiet chips that come alive on focus/hover */
.conversation-table :deep(.usage-select .el-select__wrapper) {
    border-radius: 9px;
    box-shadow: 0 0 0 1px transparent inset;
    background: color-mix(in srgb, var(--k-color-fill), transparent 25%);
    transition:
        box-shadow 0.16s ease,
        background 0.16s ease;
}

.conversation-table :deep(.usage-select:hover .el-select__wrapper) {
    background: color-mix(in srgb, var(--k-color-primary) 8%, transparent);
}

.conversation-table
    :deep(.usage-select .el-select__wrapper.is-focused) {
    background: var(--k-card-bg);
    box-shadow: 0 0 0 1px var(--k-color-primary) inset;
}

/* Status chip with dot */
.status-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px 3px 8px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.4;
}

.status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
}

.status-chip.is-active {
    color: var(--k-color-success, #67c23a);
    background: color-mix(
        in srgb,
        var(--k-color-success, #67c23a) 14%,
        transparent
    );
}

.status-chip.is-active .status-dot {
    background: var(--k-color-success, #67c23a);
    box-shadow: 0 0 0 3px
        color-mix(in srgb, var(--k-color-success, #67c23a), transparent 75%);
}

.status-chip.is-idle {
    color: var(--k-text-light);
    background: color-mix(in srgb, var(--k-color-fill), transparent 10%);
}

.status-chip.is-idle .status-dot {
    background: var(--k-text-light);
}

.core-page.compact .conversation-table :deep(.cell) {
    padding: 0 6px;
}

.pagination-row {
    display: flex;
    justify-content: flex-end;
    margin-top: auto;
    padding-top: 14px;
}

/* ---- Dark mode polish ---- */
.dark .conversation-table :deep(thead th.el-table__cell),
html.dark .conversation-table :deep(thead th.el-table__cell),
.theme-root.dark .conversation-table :deep(thead th.el-table__cell) {
    background: color-mix(in srgb, var(--k-card-bg), #000 12%);
}

@media (max-width: 1100px) {
    .conversation-workspace {
        grid-template-columns: 1fr;
    }

    .route-list {
        max-height: 360px;
        overflow: auto;
    }
}

@media (max-width: 768px) {
    .header-actions {
        justify-content: flex-start;
    }

    .conversation-card-header,
    .card-header {
        align-items: flex-start;
        flex-direction: column;
    }

    .conversation-toolbar {
        grid-template-columns: 1fr;
    }

    .conversation-card :deep(.el-card__body) {
        min-height: 0;
    }
}
</style>
