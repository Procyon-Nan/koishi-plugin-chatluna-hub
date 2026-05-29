<template>
    <section class="core-page" :class="{ compact: compactMode }">
        <header class="page-header">
            <div class="page-icon">
                <el-icon :size="26">
                    <Document />
                </el-icon>
            </div>
            <div class="page-heading">
                <span class="page-kicker">ChatLuna Core</span>
                <h1>请求日志</h1>
                <p class="page-subtitle">
                    实时捕获模型调用的请求体与响应体
                </p>
            </div>
            <div class="page-actions">
                <div class="stat-pills">
                    <span class="stat-pill">
                        <span class="stat-pill-value">{{ total }}</span>
                        <span class="stat-pill-label">条记录</span>
                    </span>
                    <span class="stat-pill is-success">
                        <span class="stat-pill-value">{{ successCount }}</span>
                        <span class="stat-pill-label">成功</span>
                    </span>
                    <span class="stat-pill is-error">
                        <span class="stat-pill-value">{{ errorCount }}</span>
                        <span class="stat-pill-label">错误</span>
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

        <div class="log-workspace">
            <el-card shadow="never" class="log-list-card">
                <template #header>
                    <div class="card-header">
                        <span>回复请求</span>
                        <div class="card-actions">
                            <el-button
                                :icon="Refresh"
                                :loading="listLoading"
                                @click="fetchLogs"
                            >
                                刷新
                            </el-button>
                            <el-button
                                type="danger"
                                plain
                                :icon="DeleteIcon"
                                :disabled="logList.length === 0"
                                @click="clearLogs"
                            >
                                清空
                            </el-button>
                        </div>
                    </div>
                </template>

                <div class="list-toolbar">
                    <el-input
                        v-model="keyword"
                        placeholder="搜索 requestId、会话、模型、预设或消息"
                        clearable
                    />
                    <el-select v-model="statusFilter" class="status-filter">
                        <el-option label="全部状态" value="all" />
                        <el-option label="进行中" value="pending" />
                        <el-option label="成功" value="success" />
                        <el-option label="错误" value="error" />
                    </el-select>
                </div>

                <el-scrollbar class="log-list-scroll">
                    <div v-if="logList.length === 0" class="empty-state">
                        暂无已捕获回复
                    </div>

                    <button
                        v-for="item in logList"
                        :key="item.id"
                        type="button"
                        class="log-list-item"
                        :class="{ active: selectedId === item.id }"
                        :data-status="item.status"
                        @click="selectLog(item.id)"
                    >
                        <span class="log-list-title-row">
                            <span class="log-list-title">
                                {{
                                    item.conversationTitle ||
                                    item.conversationId
                                }}
                            </span>
                            <el-tag
                                size="small"
                                effect="plain"
                                :type="statusTag(item.status)"
                            >
                                {{ statusLabel(item.status) }}
                            </el-tag>
                        </span>
                        <span class="log-list-message">
                            {{ item.messageSummary || '空消息' }}
                        </span>
                        <span class="log-list-source">
                            <el-icon><User /></el-icon>
                            {{ listSourceLabel(item) }}
                        </span>
                        <span class="log-list-meta">
                            {{ formatTime(item.startedAt) }} ·
                            {{ item.model || '-' }} · {{ item.preset || '-' }}
                        </span>
                        <span class="log-list-footer">
                            <span>{{ shortId(item.requestId) }}</span>
                            <span>
                                {{ item.runCount }} 次调用
                                <template v-if="item.errorCount > 0">
                                    / {{ item.errorCount }} 错误
                                </template>
                            </span>
                        </span>
                    </button>
                </el-scrollbar>

                <div class="pagination-row">
                    <el-pagination
                        v-model:current-page="page"
                        v-model:page-size="pageSize"
                        :total="total"
                        :page-sizes="[10, 20, 50]"
                        small
                        layout="sizes, prev, pager, next"
                    />
                </div>
            </el-card>

            <el-card
                shadow="never"
                class="log-detail-card"
                v-loading="detailLoading"
            >
                <template #header>
                    <div class="detail-header">
                        <div>
                            <span class="detail-title">{{ detailTitle }}</span>
                            <span class="detail-meta">{{ detailMeta }}</span>
                        </div>
                        <div class="detail-actions">
                            <el-select
                                v-if="detail && detail.runs.length > 1"
                                v-model="selectedRunId"
                                class="run-select"
                                placeholder="选择模型调用"
                            >
                                <el-option
                                    v-for="run in detail.runs"
                                    :key="run.id"
                                    :label="runLabel(run)"
                                    :value="run.id"
                                />
                            </el-select>
                            <el-tag
                                v-if="detail"
                                effect="plain"
                                :type="statusTag(detail.status)"
                            >
                                {{ statusLabel(detail.status) }}
                            </el-tag>
                        </div>
                    </div>
                </template>

                <div v-if="!detail" class="detail-empty">
                    选择左侧回复后查看完整请求体与响应体
                </div>

                <div v-else class="detail-body">
                    <div class="detail-summary">
                        <div>
                            <span>Request ID</span>
                            <strong :title="detail.requestId">
                                {{ detail.requestId }}
                            </strong>
                        </div>
                        <div>
                            <span>模型</span>
                            <strong :title="detail.model">
                                {{ detail.model || '-' }}
                            </strong>
                        </div>
                        <div>
                            <span>预设</span>
                            <strong :title="detail.preset">
                                {{ detail.preset || '-' }}
                            </strong>
                        </div>
                        <div>
                            <span>耗时</span>
                            <strong>
                                {{ formatDuration(detail.durationMs) }}
                            </strong>
                        </div>
                    </div>

                    <div v-if="sourceInfo" class="source-bar">
                        <span class="source-chip">
                            <el-icon><Platform /></el-icon>
                            {{ sourceInfo.platform }}
                        </span>
                        <span class="source-chip">
                            <el-icon><User /></el-icon>
                            用户 {{ sourceInfo.userId }}
                        </span>
                        <span class="source-chip">
                            <el-icon><ChatDotRound /></el-icon>
                            {{ sourceInfo.scope }}
                        </span>
                        <span class="source-chip is-route">
                            <el-icon><Share /></el-icon>
                            {{ sourceInfo.routeLabel }}
                        </span>
                    </div>

                    <div class="message-panel">
                        <span>触发消息</span>
                        <pre
                            v-text="
                                detail.messageBody || detail.messageSummary || '-'
                            "
                        ></pre>
                    </div>

                    <div v-if="selectedRun" class="run-summary">
                        <span class="run-summary-model">
                            {{ detail.model || '模型调用' }}
                        </span>
                        <span class="run-summary-type">
                            {{ runTypeLabel(selectedRun) }}
                        </span>
                        <span>{{ formatTime(selectedRun.startedAt) }}</span>
                        <span>{{ formatDuration(selectedRun.durationMs) }}</span>
                        <span>
                            请求 {{ formatSize(selectedRun.requestSize) }} / 响应
                            {{ formatSize(selectedRun.responseSize) }}
                        </span>
                    </div>

                    <el-tabs v-if="selectedRun" v-model="activeBodyTab">
                        <el-tab-pane label="请求体" name="request">
                            <div class="code-window">
                                <div class="code-window-bar">
                                    <span class="window-dots">
                                        <i></i><i></i><i></i>
                                    </span>
                                    <span class="window-name">
                                        request · {{ formatSize(selectedRun.requestSize) }}
                                    </span>
                                    <el-button
                                        class="copy-btn"
                                        size="small"
                                        text
                                        :icon="CopyDocument"
                                        @click="copyBody('request')"
                                    >
                                        复制
                                    </el-button>
                                </div>
                                <pre
                                    class="body-viewer hljs"
                                ><code v-html="requestBodyHtml"></code></pre>
                            </div>
                        </el-tab-pane>
                        <el-tab-pane label="响应体" name="response">
                            <div class="code-window">
                                <div class="code-window-bar">
                                    <span class="window-dots">
                                        <i></i><i></i><i></i>
                                    </span>
                                    <span class="window-name">
                                        response · {{ formatSize(selectedRun.responseSize) }}
                                    </span>
                                    <el-button
                                        class="copy-btn"
                                        size="small"
                                        text
                                        :icon="CopyDocument"
                                        @click="copyBody('response')"
                                    >
                                        复制
                                    </el-button>
                                </div>
                                <pre
                                    class="body-viewer hljs"
                                ><code v-html="responseBodyHtml"></code></pre>
                            </div>
                        </el-tab-pane>
                        <el-tab-pane
                            v-if="selectedRun.error"
                            label="错误"
                            name="error"
                        >
                            <div class="code-window is-error-window">
                                <div class="code-window-bar">
                                    <span class="window-dots">
                                        <i></i><i></i><i></i>
                                    </span>
                                    <span class="window-name">error</span>
                                    <el-button
                                        class="copy-btn"
                                        size="small"
                                        text
                                        :icon="CopyDocument"
                                        @click="copyBody('error')"
                                    >
                                        复制
                                    </el-button>
                                </div>
                                <pre
                                    class="body-viewer hljs is-error"
                                ><code v-html="errorBodyHtml"></code></pre>
                            </div>
                        </el-tab-pane>
                    </el-tabs>
                </div>
            </el-card>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
    ChatDotRound,
    CopyDocument,
    Delete as DeleteIcon,
    Document,
    Platform,
    Refresh,
    Share,
    User
} from '@element-plus/icons-vue'
import * as api from '../api'
import type {
    ChatLunaConversationRouteMode,
    ChatLunaCoreLogDetail,
    ChatLunaCoreLogListItem,
    ChatLunaCoreLogRunSummary,
    ChatLunaCoreLogStatus
} from '../types'
import { useCoreCompactMode } from '../use-compact-mode'
import { highlightLogBody } from '../use-highlight'

const compactMode = useCoreCompactMode()

const keyword = ref('')
const statusFilter = ref<ChatLunaCoreLogStatus | 'all'>('all')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const logList = ref<ChatLunaCoreLogListItem[]>([])
const detail = ref<ChatLunaCoreLogDetail | null>(null)
const selectedId = ref('')
const selectedRunId = ref('')
const activeBodyTab = ref('request')
const listLoading = ref(false)
const detailLoading = ref(false)

let searchTimer: number | undefined

const selectedRun = computed(() => {
    if (!detail.value) return null

    return (
        detail.value.runs.find((run) => run.id === selectedRunId.value) ??
        detail.value.runs[0] ??
        null
    )
})

const requestBodyHtml = computed(() =>
    highlightLogBody(selectedRun.value?.requestBody)
)

const responseBodyHtml = computed(() =>
    highlightLogBody(selectedRun.value?.responseBody || '尚未捕获响应体')
)

const errorBodyHtml = computed(() =>
    highlightLogBody(selectedRun.value?.error, 'plaintext')
)

const successCount = computed(
    () => logList.value.filter((item) => item.status === 'success').length
)

const errorCount = computed(
    () => logList.value.filter((item) => item.status === 'error').length
)

const detailTitle = computed(() => {
    if (!detail.value) return '请求详情'

    return detail.value.conversationTitle || detail.value.conversationId
})

const detailMeta = computed(() => {
    if (!detail.value) return '捕获 ChatLuna 回复过程中的模型请求与响应'

    return [
        detail.value.model || '-',
        detail.value.preset || '-',
        `${detail.value.runCount} 次模型调用`
    ].join(' · ')
})

const routeModeLabel = (mode: ChatLunaConversationRouteMode | undefined) => {
    if (mode === 'personal') return '私有路由'
    if (mode === 'shared') return '共享路由'
    if (mode === 'custom') return '自定义路由'
    return '未知路由'
}

// Compact source label for the list row: platform + who + where.
const listSourceLabel = (item: ChatLunaCoreLogListItem) => {
    const who = item.userId ? `用户 ${item.userId}` : '未知用户'
    const where = item.guildId
        ? `群 ${item.guildId}`
        : item.channelId
          ? '私聊'
          : ''
    const platform = item.platform ? `${item.platform} · ` : ''

    return `${platform}${who}${where ? ` · ${where}` : ''}`
}

// Where the request came from: who sent it and in which chat. Prefer the
// session fields captured on the entry, falling back to the parsed route.
const sourceInfo = computed(() => {
    const d = detail.value
    if (!d) return null

    const route = d.route ?? ({} as ChatLunaCoreLogDetail['route'])
    const userId = d.userId || route.userId || null
    const guildId = d.guildId || route.guildId || null
    const isDirect = route.isDirect === true || (!guildId && !route.guildId)

    return {
        platform: d.platform || route.platform || '-',
        userId: userId || '-',
        scope: guildId
            ? `群聊 ${guildId}`
            : isDirect
              ? '私聊'
              : d.channelId
                ? `频道 ${d.channelId}`
                : '-',
        channelId: d.channelId || null,
        routeLabel: routeModeLabel(route.mode)
    }
})

const shortId = (value: string) => {
    return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value
}

const statusLabel = (status: ChatLunaCoreLogStatus) => {
    if (status === 'success') return '成功'
    if (status === 'error') return '错误'
    return '进行中'
}

const statusTag = (status: ChatLunaCoreLogStatus) => {
    if (status === 'success') return 'success'
    if (status === 'error') return 'danger'
    return 'warning'
}

const formatTime = (value: string | null | undefined) => {
    if (!value) return '-'

    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return '-'

    return date.toLocaleString()
}

const formatDuration = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value)) return '-'
    if (value < 1000) return `${Math.round(value)} ms`

    return `${(value / 1000).toFixed(2)} s`
}

const formatSize = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value)) return '-'
    if (value < 1024) return `${value} B`
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`

    return `${(value / 1024 / 1024).toFixed(2)} MB`
}

const runLabel = (run: ChatLunaCoreLogRunSummary) => {
    return `${statusLabel(run.status)} · ${runTypeLabel(run)} · ${shortId(
        run.runId
    )}`
}

// runName is the LangChain class path (e.g. .../ChatLunaChatModel), which is
// not a model name. Show a friendly call-type label instead.
const runTypeLabel = (run: ChatLunaCoreLogRunSummary) => {
    return run.type === 'chat-model' ? '对话模型' : '语言模型'
}

const loadLog = async (id: string) => {
    if (!id) return

    detailLoading.value = true
    try {
        const result = await api.getChatLunaCoreLog({ id })
        detail.value = result
        selectedId.value = result.id

        const selectedExists = result.runs.some(
            (run) => run.id === selectedRunId.value
        )
        selectedRunId.value = selectedExists
            ? selectedRunId.value
            : result.runs[0]?.id ?? ''

        if (activeBodyTab.value === 'error' && !selectedRun.value?.error) {
            activeBodyTab.value = 'request'
        }
    } catch (error) {
        ElMessage.error(`加载 ChatLuna 日志失败：${String(error)}`)
    } finally {
        detailLoading.value = false
    }
}

const fetchLogs = async () => {
    listLoading.value = true

    try {
        const result = await api.listChatLunaCoreLogs({
            keyword: keyword.value.trim(),
            status: statusFilter.value,
            page: page.value,
            pageSize: pageSize.value
        })

        logList.value = result.items
        total.value = result.total

        if (
            selectedId.value &&
            result.items.some((item) => item.id === selectedId.value)
        ) {
            await loadLog(selectedId.value)
        } else if (result.items[0]) {
            await loadLog(result.items[0].id)
        } else {
            selectedId.value = ''
            selectedRunId.value = ''
            detail.value = null
        }
    } catch (error) {
        ElMessage.error(`加载 ChatLuna 日志列表失败：${String(error)}`)
    } finally {
        listLoading.value = false
    }
}

const scheduleFetchLogs = () => {
    if (searchTimer != null) {
        window.clearTimeout(searchTimer)
    }

    searchTimer = window.setTimeout(() => {
        page.value = 1
        void fetchLogs()
    }, 260)
}

const selectLog = async (id: string) => {
    selectedId.value = id
    activeBodyTab.value = 'request'
    await loadLog(id)
}

const clearLogs = async () => {
    try {
        await ElMessageBox.confirm(
            [
                '确认清空 ChatLuna Hub 当前捕获的回复日志？',
                '此操作只会清空 Hub 内存日志，不影响 ChatLuna 会话记录。'
            ].join(''),
            '清空日志',
            {
                type: 'warning',
                confirmButtonText: '清空',
                cancelButtonText: '取消'
            }
        )
    } catch {
        return
    }

    try {
        await api.clearChatLunaCoreLogs()
        ElMessage.success('日志已清空')
        selectedId.value = ''
        selectedRunId.value = ''
        detail.value = null
        await fetchLogs()
    } catch (error) {
        ElMessage.error(`清空 ChatLuna 日志失败：${String(error)}`)
    }
}

watch([keyword, statusFilter], scheduleFetchLogs)

const copyBody = async (kind: 'request' | 'response' | 'error') => {
    const run = selectedRun.value
    if (!run) return

    const text =
        kind === 'request'
            ? run.requestBody
            : kind === 'response'
              ? run.responseBody || ''
              : run.error || ''

    if (!text) {
        ElMessage.info('当前内容为空')
        return
    }

    try {
        await navigator.clipboard.writeText(text)
        ElMessage.success('已复制到剪贴板')
    } catch {
        ElMessage.error('复制失败，请手动选择文本')
    }
}

watch([page, pageSize], () => {
    void fetchLogs()
})

onMounted(() => {
    void fetchLogs()
})

onBeforeUnmount(() => {
    if (searchTimer != null) {
        window.clearTimeout(searchTimer)
    }
})
</script>

<style scoped>
.core-page {
    box-sizing: border-box;
    width: min(1800px, 100%);
    height: 100%;
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

.stat-pill.is-success {
    border-color: color-mix(
        in srgb,
        var(--k-color-success, #67c23a),
        transparent 55%
    );
}

.stat-pill.is-success .stat-pill-value {
    color: var(--k-color-success, #67c23a);
}

.stat-pill.is-error {
    border-color: color-mix(
        in srgb,
        var(--k-color-danger, #f56c6c),
        transparent 55%
    );
}

.stat-pill.is-error .stat-pill-value {
    color: var(--k-color-danger, #f56c6c);
}

.log-workspace {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
    gap: 16px;
    align-items: stretch;
}

.log-list-card,
.log-detail-card {
    min-width: 0;
    border-radius: 12px;
}

/* Cards fill the workspace height (which fills the page) and let their inner
   content scroll, so a wide request body never stretches the detail card. */
.log-list-card,
.log-detail-card {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 1500px;
}

.log-list-card :deep(.el-card__body),
.log-detail-card :deep(.el-card__body) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
}

.card-header,
.detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.card-actions,
.detail-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;
}

.list-toolbar {
    flex-shrink: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 120px;
    gap: 10px;
    margin-bottom: 12px;
}

.status-filter,
.run-select {
    width: 100%;
}

.run-select {
    min-width: 260px;
}

.log-list-scroll {
    flex: 1;
    min-height: 0;
}

.log-list-scroll :deep(.el-scrollbar__view) {
    padding-right: 2px;
}

.log-list-item {
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

.log-list-item::before {
    content: '';
    position: absolute;
    top: 12px;
    bottom: 12px;
    left: 8px;
    width: 3px;
    border-radius: 999px;
    background: var(--k-text-light);
    opacity: 0.55;
}

.log-list-item[data-status='success']::before {
    background: var(--k-color-success, #67c23a);
    opacity: 1;
}

.log-list-item[data-status='error']::before {
    background: var(--k-color-danger, #f56c6c);
    opacity: 1;
}

.log-list-item[data-status='pending']::before {
    background: var(--k-color-warning, #e6a23c);
    opacity: 1;
}

.log-list-item:hover {
    border-color: color-mix(
        in srgb,
        var(--k-color-primary),
        transparent 40%
    );
    transform: translateX(2px);
}

.log-list-item.active {
    border-color: var(--k-color-primary);
    box-shadow: 0 0 0 1px var(--k-color-primary) inset;
    background: color-mix(in srgb, var(--k-color-primary), transparent 94%);
}

.log-list-title-row,
.log-list-footer {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
}

.log-list-title,
.log-list-message {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.log-list-title {
    font-size: 15px;
    font-weight: 650;
}

.log-list-message {
    color: var(--k-text-dark);
    font-size: 13px;
}

.log-list-meta,
.log-list-footer,
.detail-meta {
    color: var(--k-text-light);
    font-size: 13px;
}

.log-list-source {
    min-width: 0;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--k-text-normal, var(--k-text-light));
    font-size: 12px;
}

.log-list-source .el-icon {
    flex-shrink: 0;
    color: var(--k-color-primary);
    font-size: 13px;
}

.pagination-row {
    flex-shrink: 0;
    min-height: 32px;
    margin-top: 12px;
    display: flex;
    justify-content: flex-end;
}

.detail-header {
    align-items: flex-start;
}

.detail-title {
    display: block;
    margin-bottom: 4px;
    color: var(--k-text-dark);
    font-size: 17px;
    font-weight: 650;
}

.detail-empty,
.empty-state {
    min-height: 180px;
    display: grid;
    place-items: center;
    color: var(--k-text-light);
    font-size: 14px;
}

.detail-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.detail-summary {
    flex-shrink: 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
}

.detail-summary > div {
    min-width: 0;
    padding: 10px 12px;
    border: 1px solid var(--k-color-divider);
    border-radius: 8px;
    display: grid;
    gap: 4px;
    background: var(--k-hover-bg);
}

.detail-summary span,
.message-panel span {
    color: var(--k-text-light);
    font-size: 12px;
    font-weight: 650;
}

.detail-summary strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--k-text-dark);
    font-size: 13px;
    font-weight: 650;
}

.message-panel {
    flex-shrink: 0;
    display: grid;
    gap: 6px;
}

.message-panel pre,
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

.message-panel pre {
    max-height: 120px;
    padding: 10px 12px;
    white-space: pre-wrap;
}

.run-summary {
    flex-shrink: 0;
    min-width: 0;
    padding: 10px 12px;
    border: 1px solid var(--k-color-divider);
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    color: var(--k-text-light);
    background: var(--k-hover-bg);
    font-size: 13px;
}

.run-summary-model {
    padding: 2px 10px;
    border-radius: 6px;
    color: var(--k-color-primary);
    background: color-mix(in srgb, var(--k-color-primary), transparent 88%);
    font-weight: 700;
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.run-summary-type {
    color: var(--k-text-dark);
    font-weight: 650;
}

.source-bar {
    flex-shrink: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.source-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border: 1px solid var(--k-color-divider);
    border-radius: 999px;
    color: var(--k-text-dark);
    background: var(--k-card-bg);
    font-size: 12px;
    font-weight: 600;
}

.source-chip .el-icon {
    color: var(--k-text-light);
    font-size: 14px;
}

.source-chip.is-route {
    color: var(--k-color-primary);
    border-color: color-mix(in srgb, var(--k-color-primary), transparent 55%);
    background: color-mix(in srgb, var(--k-color-primary), transparent 92%);
}

.source-chip.is-route .el-icon {
    color: var(--k-color-primary);
}

.code-window {
    flex: 1;
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
    color: var(--k-text-light);
    font-size: 12px;
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    letter-spacing: 0.02em;
}

.copy-btn {
    flex-shrink: 0;
}

/* Let the tab system grow to fill the remaining card height and keep the code
   window scrolling internally instead of stretching the card. */
.detail-body :deep(.el-tabs) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
}

.detail-body :deep(.el-tabs__content) {
    flex: 1;
    min-height: 0;
}

.detail-body :deep(.el-tab-pane) {
    height: 100%;
}

.detail-body :deep(.el-tabs__content > .el-tab-pane) {
    display: flex;
    flex-direction: column;
}

.is-error-window .window-dots i:nth-child(1) {
    box-shadow: 0 0 0 3px color-mix(in srgb, #ff5f56, transparent 70%);
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

.message-panel pre::-webkit-scrollbar,
.body-viewer::-webkit-scrollbar {
    width: 10px;
    height: 10px;
}

.message-panel pre::-webkit-scrollbar-track,
.body-viewer::-webkit-scrollbar-track {
    background: var(--log-scrollbar-track);
}

.message-panel pre::-webkit-scrollbar-thumb,
.body-viewer::-webkit-scrollbar-thumb {
    border: 2px solid var(--log-scrollbar-track);
    border-radius: 999px;
    background: var(--log-scrollbar-thumb);
}

.message-panel pre::-webkit-scrollbar-corner,
.body-viewer::-webkit-scrollbar-corner {
    background: var(--log-scrollbar-track);
}

@media (max-width: 980px) {
    .core-page {
        height: auto;
    }

    .log-workspace {
        flex: none;
        grid-template-columns: 1fr;
    }

    .log-list-card,
    .log-detail-card {
        height: 620px;
    }

    .detail-summary {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 768px) {
    .page-header {
        grid-template-columns: auto 1fr;
        gap: 14px;
        padding: 18px;
    }

    .page-actions {
        grid-column: 1 / -1;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
    }

    .page-header h1 {
        font-size: 22px;
    }

    .card-header,
    .detail-header {
        align-items: flex-start;
        flex-direction: column;
    }

    .list-toolbar,
    .detail-summary {
        grid-template-columns: 1fr;
    }

    .run-select {
        min-width: 0;
    }

    .body-viewer {
        height: 420px;
    }
}
</style>
