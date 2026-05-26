<template>
    <section class="core-page" :class="{ compact: compactMode }">
        <header class="page-header">
            <div class="page-icon">
                <el-icon :size="28">
                    <ChatRound />
                </el-icon>
            </div>
            <div>
                <span class="page-kicker">ChatLuna Core</span>
                <h1>会话管理</h1>
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

        <el-card shadow="never" class="toolbar-card">
            <template #header>
                <div class="card-header">
                    <span>ChatLuna 会话</span>
                    <span class="card-tip">仅展示当前活跃会话</span>
                </div>
            </template>

            <div class="conversation-toolbar">
                <el-input
                    v-model="keyword"
                    placeholder="搜索标题、模型、预设、用户或群聊 ID"
                    clearable
                    @keyup.enter="refreshConversations"
                    @clear="refreshConversations"
                >
                    <template #prepend>搜索</template>
                </el-input>

                <el-button
                    :loading="loading"
                    type="primary"
                    @click="refreshConversations"
                >
                    刷新
                </el-button>
            </div>
        </el-card>

        <el-card shadow="never" class="table-card">
            <template #header>
                <div class="card-header">
                    <span>会话列表</span>
                    <span class="card-tip">修改后需保存才会写入 ChatLuna 会话字段</span>
                </div>
            </template>

            <el-table
                class="conversation-table"
                :data="conversations"
                :row-key="getRowKey"
                border
                v-loading="loading"
                empty-text="暂无 ChatLuna 会话"
                max-height="560"
            >
                <el-table-column
                    label="状态"
                    width="88"
                    :resizable="false"
                    align="center"
                    header-align="center"
                >
                    <template #default="scope">
                        <el-tooltip
                            :content="formatStatusTip(scope.row)"
                            placement="top"
                        >
                            <el-tag
                                :type="scope.row.isCurrent ? 'success' : 'info'"
                                size="small"
                                effect="plain"
                            >
                                {{ scope.row.isCurrent ? '当前' : '可用' }}
                            </el-tag>
                        </el-tooltip>
                    </template>
                </el-table-column>

                <el-table-column
                    prop="seq"
                    label="#"
                    width="72"
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
                    label="路由"
                    min-width="220"
                    :resizable="false"
                    align="center"
                    header-align="center"
                    show-overflow-tooltip
                >
                    <template #default="scope">
                        <el-tag
                            :type="routeTagType(scope.row.route.mode)"
                            size="small"
                            effect="plain"
                        >
                            {{ routeModeLabel(scope.row.route.mode) }}
                        </el-tag>
                        <span class="route-text">{{
                            formatRoute(scope.row.route)
                        }}</span>
                    </template>
                </el-table-column>

                <el-table-column
                    prop="createdBy"
                    label="创建者"
                    min-width="120"
                    :resizable="false"
                    align="center"
                    header-align="center"
                    show-overflow-tooltip
                />

                <el-table-column
                    label="模型"
                    min-width="240"
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
                    min-width="200"
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
                    width="120"
                    :resizable="false"
                    align="center"
                    header-align="center"
                    show-overflow-tooltip
                />

                <el-table-column
                    label="最近对话"
                    min-width="160"
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
                    width="220"
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
                                :loading="savingConversationId === scope.row.id"
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
                                :loading="deletingConversationId === scope.row.id"
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
    </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ChatRound } from '@element-plus/icons-vue'
import * as api from '../api'
import { useCoreCompactMode } from '../use-compact-mode'
import type {
    ChatLunaConversationListItem,
    ChatLunaConversationOptions,
    ChatLunaConversationRouteInfo,
    ChatLunaConversationRouteMode
} from '../types'

interface ConversationDraft {
    model: string
    preset: string
}

const emptyOptions = (): ChatLunaConversationOptions => ({
    models: [],
    presets: []
})

const formatTime = (value: string | Date | null | undefined): string => {
    if (!value) return ''

    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')

    return `${year}-${month}-${day} ${hour}:${minute}`
}

const loading = ref(false)
const compactMode = useCoreCompactMode()
const optionsLoading = ref(false)
const savingConversationId = ref<string | null>(null)
const deletingConversationId = ref<string | null>(null)
const keyword = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const options = ref<ChatLunaConversationOptions>(emptyOptions())
const conversations = ref<ChatLunaConversationListItem[]>([])
const drafts = reactive<Record<string, ConversationDraft>>({})

const getRowKey = (row: ChatLunaConversationListItem) => row.id

const formatStatusTip = (conversation: ChatLunaConversationListItem) => {
    return `记录状态：${conversation.status}；当前绑定：${
        conversation.activeConversationId ?? '-'
    }`
}

const routeModeLabel = (mode: ChatLunaConversationRouteMode): string => {
    if (mode === 'personal') return '个人'
    if (mode === 'shared') return '共享'
    if (mode === 'custom') return '自定义'
    return '未知'
}

const routeTagType = (
    mode: ChatLunaConversationRouteMode
): 'success' | 'warning' | 'primary' | 'info' => {
    if (mode === 'personal') return 'success'
    if (mode === 'shared') return 'warning'
    if (mode === 'custom') return 'primary'
    return 'info'
}

const formatRoute = (route: ChatLunaConversationRouteInfo): string => {
    if (route.mode === 'custom') {
        return route.routeKey ?? route.baseBindingKey
    }

    if (route.mode === 'shared') {
        return `群聊 ${route.guildId ?? '-'}`
    }

    if (route.mode === 'personal' && route.isDirect) {
        return `私聊 ${route.userId ?? '-'}`
    }

    if (route.mode === 'personal') {
        return `群聊 ${route.guildId ?? '-'} / 用户 ${route.userId ?? '-'}`
    }

    return route.baseBindingKey
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

const fetchOptions = async () => {
    optionsLoading.value = true

    try {
        options.value = await api.listChatLunaConversationOptions()
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        ElMessage.error(`加载 ChatLuna 选项失败：${message}`)
    } finally {
        optionsLoading.value = false
    }
}

const fetchConversations = async (_nextPage?: number) => {
    loading.value = true

    try {
        const result = await api.listChatLunaConversations({
            keyword: keyword.value.trim() || undefined,
            page: page.value,
            pageSize: pageSize.value
        })

        syncDrafts(result.items)
        conversations.value = result.items
        total.value = result.total
        page.value = result.page
        pageSize.value = result.pageSize
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        ElMessage.error(`加载 ChatLuna 会话失败：${message}`)
    } finally {
        loading.value = false
    }
}

const refreshConversations = async () => {
    page.value = 1
    await Promise.all([fetchOptions(), fetchConversations()])
}

const onPageSizeChange = (_nextSize?: number) => {
    page.value = 1
    void fetchConversations()
}

const isConversationBusy = (conversation: ChatLunaConversationListItem) => {
    return (
        savingConversationId.value === conversation.id ||
        deletingConversationId.value === conversation.id
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

const saveConversation = async (conversation: ChatLunaConversationListItem) => {
    const draft = drafts[conversation.id]

    if (draft == null || !isConversationDirty(conversation)) {
        return
    }

    savingConversationId.value = conversation.id

    try {
        const updated = await api.updateChatLunaConversationUsage({
            conversationId: conversation.id,
            model: draft.model !== conversation.model ? draft.model : undefined,
            preset:
                draft.preset !== conversation.preset ? draft.preset : undefined
        })
        const index = conversations.value.findIndex(
            (item) => item.id === updated.id
        )

        if (index >= 0) {
            conversations.value[index] = updated
        }

        resetDraft(updated)
        ElMessage.success('ChatLuna 会话已更新')
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        ElMessage.error(`保存 ChatLuna 会话失败：${message}`)
    } finally {
        savingConversationId.value = null
    }
}

const removeConversation = async (
    conversation: ChatLunaConversationListItem
) => {
    try {
        await ElMessageBox.confirm(
            `删除会话「${conversation.title || conversation.id}」后，会移除该 ChatLuna 会话的消息记录与权限记录，并解除当前绑定；该操作不能从此界面恢复。是否继续？`,
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

    deletingConversationId.value = conversation.id

    try {
        await api.deleteChatLunaConversation({
            conversationId: conversation.id
        })

        if (conversations.value.length <= 1 && page.value > 1) {
            page.value -= 1
        }

        ElMessage.success('ChatLuna 会话已删除')
        await fetchConversations()
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        ElMessage.error(`删除 ChatLuna 会话失败：${message}`)
    } finally {
        deletingConversationId.value = null
    }
}

onMounted(() => {
    void refreshConversations()
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

.toolbar-card,
.table-card {
    border-radius: 8px;
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

.conversation-toolbar {
    display: grid;
    grid-template-columns: minmax(260px, 1fr) auto;
    gap: 12px;
    align-items: center;
}

.usage-select {
    width: 100%;
}

.conversation-table {
    font-size: 14px;
}

.conversation-table :deep(.cell) {
    padding: 0 8px;
    font-size: 14px;
    line-height: 20px;
}

.conversation-table :deep(th .cell) {
    font-size: 14px;
    font-weight: 600;
}

.conversation-table :deep(.el-tag) {
    font-size: 13px;
}

.core-page.compact .conversation-table :deep(.cell) {
    padding: 0 6px;
}

.route-text {
    margin-left: 8px;
}

.pagination-row {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
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

    .conversation-toolbar {
        grid-template-columns: 1fr;
    }

    .card-header {
        align-items: flex-start;
        flex-direction: column;
    }
}
</style>
