/**
 * ChatLuna conversation routing: parsing a binding key into a structured route,
 * formatting it for display, and comparing/grouping routes. All pure functions
 * — no Koishi context, no database — so the routing logic is easy to follow and
 * is shared by the conversation list, the route rail, and the log store.
 */

export type ChatLunaConversationRouteMode =
    | 'personal'
    | 'shared'
    | 'custom'
    | 'unknown'

export type ChatLunaConversationStatus =
    | 'active'
    | 'archived'
    | 'deleted'
    | 'broken'

export interface ChatLunaConversationRouteInfo {
    mode: ChatLunaConversationRouteMode
    baseBindingKey: string
    presetLane?: string | null
    platform?: string | null
    selfId?: string | null
    userId?: string | null
    guildId?: string | null
    routeKey?: string | null
    isDirect?: boolean | null
}

const presetMarker = ':preset:'

const routeModeOrder: Record<ChatLunaConversationRouteMode, number> = {
    shared: 0,
    personal: 1,
    custom: 2,
    unknown: 3
}

/** Split a binding key into its base key and optional preset lane. */
const splitPresetLane = (bindingKey: string) => {
    const presetIndex = bindingKey.indexOf(presetMarker)
    if (presetIndex < 0) {
        return { baseBindingKey: bindingKey, presetLane: null }
    }

    return {
        baseBindingKey: bindingKey.slice(0, presetIndex),
        presetLane: bindingKey.slice(presetIndex + presetMarker.length) || null
    }
}

/** Parse a raw binding key into a structured, mode-tagged route. */
export const parseRouteInfo = (
    bindingKey: string
): ChatLunaConversationRouteInfo => {
    const { baseBindingKey, presetLane } = splitPresetLane(bindingKey)
    const parts = baseBindingKey.split(':')

    if (parts[0] === 'custom') {
        return {
            mode: 'custom',
            baseBindingKey,
            presetLane,
            routeKey: parts.slice(1).join(':') || null,
            isDirect: null
        }
    }

    if (parts[0] === 'shared' && parts.length >= 4) {
        return {
            mode: 'shared',
            baseBindingKey,
            presetLane,
            platform: parts[1],
            selfId: parts[2],
            guildId: parts[3],
            isDirect: false
        }
    }

    if (parts[0] === 'personal' && parts.length >= 5) {
        const direct = parts[3] === 'direct'

        return {
            mode: 'personal',
            baseBindingKey,
            presetLane,
            platform: parts[1],
            selfId: parts[2],
            guildId: direct ? null : parts[3],
            userId: parts[4],
            isDirect: direct
        }
    }

    return {
        mode: 'unknown',
        baseBindingKey,
        presetLane,
        isDirect: null
    }
}

/** A short, human-readable label for a route (used as the group title). */
export const formatRouteLabel = (
    route: ChatLunaConversationRouteInfo
): string => {
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

/** A secondary detail line for a route (platform / bot identity). */
export const formatRouteDetail = (
    route: ChatLunaConversationRouteInfo
): string => {
    if (route.mode === 'custom') {
        return route.baseBindingKey
    }

    const parts = [route.platform, route.selfId].filter(Boolean)

    return parts.length > 0 ? parts.join(' / ') : route.baseBindingKey
}

/** Order routes by mode, then alphabetically by their display label. */
export const compareRoute = (
    left: ChatLunaConversationRouteInfo,
    right: ChatLunaConversationRouteInfo
): number => {
    const mode = routeModeOrder[left.mode] - routeModeOrder[right.mode]
    if (mode !== 0) return mode

    return formatRouteLabel(left).localeCompare(
        formatRouteLabel(right),
        undefined,
        {
            numeric: true,
            sensitivity: 'base'
        }
    )
}
