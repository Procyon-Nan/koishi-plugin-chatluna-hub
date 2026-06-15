<template>
    <section class="core-page" :class="{ compact: compactMode }">
        <CorePageHeader
            kicker="ChatLuna Core"
            title="请求日志"
            subtitle="实时捕获模型调用的请求体与响应体"
            mobile-variant="row"
            :pills="[
                { value: total, label: '记录' },
                {
                    value: logStatusCounts.success,
                    label: '成功',
                    variant: 'success'
                },
                {
                    value: logStatusCounts.error,
                    label: '错误',
                    variant: 'error'
                }
            ]"
        >
            <template #icon>
                <el-icon :size="26">
                    <Document />
                </el-icon>
            </template>
        </CorePageHeader>

        <div class="log-workspace">
            <el-card shadow="never" class="log-list-card">
                <template #header>
                    <div class="card-header">
                        <span class="card-title">请求记录</span>
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
                        暂无已捕获请求
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
                            {{ formatDateTime(item.startedAt, '-') }} ·
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
                    选择左侧请求后查看完整请求体与响应体
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
                        <span>{{ formatDateTime(selectedRun.startedAt, '-') }}</span>
                        <span>{{ formatDuration(selectedRun.durationMs) }}</span>
                        <span>
                            请求 {{ formatBytes(selectedRun.requestSize, '-', 'MB') }} / 响应
                            {{ formatBytes(selectedRun.responseSize, '-', 'MB') }}
                        </span>
                    </div>

                    <el-tabs v-if="selectedRun" v-model="activeBodyTab">
                        <el-tab-pane label="请求体" name="request">
                            <LogBodyViewer
                                :name="`request · ${formatBytes(selectedRun.requestSize, '-', 'MB')}`"
                                :html="requestBodyHtml"
                                @copy="copyBody('request')"
                            />
                        </el-tab-pane>
                        <el-tab-pane label="响应体" name="response">
                            <LogBodyViewer
                                :name="`response · ${formatBytes(selectedRun.responseSize, '-', 'MB')}`"
                                :html="responseBodyHtml"
                                @copy="copyBody('response')"
                            />
                        </el-tab-pane>
                        <el-tab-pane
                            v-if="selectedRun.error"
                            label="错误"
                            name="error"
                        >
                            <LogBodyViewer
                                name="error"
                                :html="errorBodyHtml"
                                error
                                @copy="copyBody('error')"
                            />
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
    Document,
    Platform,
    Refresh,
    Share,
    User,
    Delete as DeleteIcon
} from '@element-plus/icons-vue'
import * as api from '../api'
import type {
    ChatLunaCoreLogDetail,
    ChatLunaCoreLogListItem,
    ChatLunaCoreLogStatus,
    ChatLunaCoreLogStatusCounts
} from '../types'
import { useCoreCompactMode } from '../use-compact-mode'
import { highlightLogBody } from '../use-highlight'
import { formatDateTime, formatBytes, formatDuration } from '../format'
import { reportError } from '../use-error-toast'
import {
    routeModeLabel,
    listSourceLabel,
    shortId,
    statusLabel,
    statusTag,
    runTypeLabel,
    runLabel
} from './log-format'
import CorePageHeader from '../components/CorePageHeader.vue'
import LogBodyViewer from '../components/LogBodyViewer.vue'

const compactMode = useCoreCompactMode()

const keyword = ref('')
const statusFilter = ref<ChatLunaCoreLogStatus | 'all'>('all')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const logStatusCounts = ref<ChatLunaCoreLogStatusCounts>({
    pending: 0,
    success: 0,
    error: 0
})
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
        reportError(error, '加载 ChatLuna 日志失败')
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
        logStatusCounts.value = result.statusCounts

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
        reportError(error, '加载 ChatLuna 日志列表失败')
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
                '确认清空 ChatLuna Hub 当前捕获的请求日志？',
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
        reportError(error, '清空 ChatLuna 日志失败')
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

.card-title {
    font-size: 15px;
    font-weight: 650;
    color: var(--k-text-dark);
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

.message-panel pre {
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

.message-panel pre::-webkit-scrollbar {
    width: 10px;
    height: 10px;
}

.message-panel pre::-webkit-scrollbar-track {
    background: var(--log-scrollbar-track);
}

.message-panel pre::-webkit-scrollbar-thumb {
    border: 2px solid var(--log-scrollbar-track);
    border-radius: 999px;
    background: var(--log-scrollbar-thumb);
}

.message-panel pre::-webkit-scrollbar-corner {
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
}
</style>
