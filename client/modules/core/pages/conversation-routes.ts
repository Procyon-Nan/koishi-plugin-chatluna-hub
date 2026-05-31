/**
 * Pure partitioning logic for the conversation route rail. Extracted from
 * conversation-page.vue so the SFC keeps only a thin `computed` wrapper. The
 * section icons are injected as arguments to keep this module free of any
 * element-plus/icon import coupling and trivially testable.
 */
import type { Component } from 'vue'
import type { ChatLunaConversationRouteGroup } from '../types'

/** Sentinel route id representing the "all conversations" pseudo-route. */
export const allRouteId = '__all__'

export interface RouteSection {
    key: string
    label: string
    icon: Component
    routes: ChatLunaConversationRouteGroup[]
    count: number
}

/** Icon components for each section, in the original section order. */
export interface RouteSectionIcons {
    direct: Component
    guild: Component
    custom: Component
    unknown: Component
}

/**
 * Partition route groups into the four fixed sections (私聊 / 群聊 / 自定义 /
 * 未知) with their per-section counts. Pure: same inputs yield the same
 * structure; preserves the exact filter predicates, labels and order.
 */
export const buildRouteSections = (
    routeGroups: ChatLunaConversationRouteGroup[],
    icons: RouteSectionIcons
): RouteSection[] => {
    const direct = routeGroups.filter(
        (route) => route.mode === 'personal' && route.isDirect
    )
    const guild = routeGroups.filter(
        (route) =>
            route.mode === 'shared' ||
            (route.mode === 'personal' && !route.isDirect)
    )
    const custom = routeGroups.filter((route) => route.mode === 'custom')
    const unknown = routeGroups.filter((route) => route.mode === 'unknown')

    return [
        {
            key: 'direct',
            label: '私聊',
            icon: icons.direct,
            routes: direct,
            count: direct.reduce((sum, route) => sum + route.count, 0)
        },
        {
            key: 'guild',
            label: '群聊',
            icon: icons.guild,
            routes: guild,
            count: guild.reduce((sum, route) => sum + route.count, 0)
        },
        {
            key: 'custom',
            label: '自定义',
            icon: icons.custom,
            routes: custom,
            count: custom.reduce((sum, route) => sum + route.count, 0)
        },
        {
            key: 'unknown',
            label: '未知',
            icon: icons.unknown,
            routes: unknown,
            count: unknown.reduce((sum, route) => sum + route.count, 0)
        }
    ]
}
