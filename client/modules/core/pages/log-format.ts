/**
 * Presentation helpers for the log page: status/route/run labels and id
 * shortening. Pure functions, separated from the SFC for readability and reuse.
 */
import type {
    ChatLunaConversationRouteMode,
    ChatLunaCoreLogListItem,
    ChatLunaCoreLogRunSummary,
    ChatLunaCoreLogSource,
    ChatLunaCoreLogStatus
} from '../types'

export const routeModeLabel = (
    mode: ChatLunaConversationRouteMode | undefined
): string => {
    if (mode === 'personal') return '私有路由'
    if (mode === 'shared') return '共享路由'
    if (mode === 'custom') return '自定义路由'
    return '未知路由'
}

/** Compact source label for a list row: platform + who + where. */
export const listSourceLabel = (item: ChatLunaCoreLogListItem): string => {
    const who = item.userId ? `用户 ${item.userId}` : '未知用户'
    const where = item.guildId
        ? `群 ${item.guildId}`
        : item.channelId
          ? '私聊'
          : ''
    const platform = item.platform ? `${item.platform} · ` : ''

    return `${platform}${who}${where ? ` · ${where}` : ''}`
}

export const shortId = (value: string): string => {
    return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value
}

export const statusLabel = (status: ChatLunaCoreLogStatus): string => {
    if (status === 'success') return '成功'
    if (status === 'error') return '错误'
    return '进行中'
}

export const statusTag = (status: ChatLunaCoreLogStatus): string => {
    if (status === 'success') return 'success'
    if (status === 'error') return 'danger'
    return 'warning'
}

export const logSourceLabel = (
    source: ChatLunaCoreLogSource | undefined
): string => {
    return source === 'character' ? 'Character' : 'ChatLuna 主插件'
}

export const logSourceTag = (
    source: ChatLunaCoreLogSource | undefined
): string => {
    return source === 'character' ? 'warning' : 'info'
}

/**
 * A friendly call-type label. `run.runName` is the LangChain class path (e.g.
 * .../ChatLunaChatModel), not a model name, so we show the call type instead.
 */
export const runTypeLabel = (run: ChatLunaCoreLogRunSummary): string => {
    if (run.type === 'character') return 'Character 请求'
    return run.type === 'chat-model' ? '对话模型' : '语言模型'
}

export const runLabel = (run: ChatLunaCoreLogRunSummary): string => {
    return `${statusLabel(run.status)} · ${runTypeLabel(run)} · ${shortId(
        run.runId
    )}`
}
