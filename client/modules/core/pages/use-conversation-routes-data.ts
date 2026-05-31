/**
 * Route-rail data for the conversation page: the route groups loaded from the
 * API plus all derived aggregates (totals, active route, partitioned sections).
 *
 * `selectedRouteId` is owned by the SFC (the conversation-list logic also reads
 * and writes it), so it is injected here as a ref. `fetchRoutes` may reset it
 * back to `allRouteId` when the selected route disappears — exactly as the
 * original inline logic did.
 */
import { computed, ref, type Ref } from 'vue'
import { Connection, FolderOpened, User } from '@element-plus/icons-vue'
import * as api from '../api'
import { reportError } from '../use-error-toast'
import type { ChatLunaConversationRouteGroup } from '../types'
import { allRouteId, buildRouteSections } from './conversation-routes'

export const useConversationRoutesData = (selectedRouteId: Ref<string>) => {
    const routeGroups = ref<ChatLunaConversationRouteGroup[]>([])
    const routesLoading = ref(false)

    const fetchRoutes = async () => {
        routesLoading.value = true

        try {
            const result = await api.listChatLunaConversationRoutes()
            routeGroups.value = result.routes

            if (
                selectedRouteId.value !== allRouteId &&
                !result.routes.some(
                    (route) => route.id === selectedRouteId.value
                )
            ) {
                selectedRouteId.value = allRouteId
            }
        } catch (error) {
            reportError(error, '加载 ChatLuna 路由分组失败')
        } finally {
            routesLoading.value = false
        }
    }

    const routeTotal = computed(() =>
        routeGroups.value.reduce((sum, route) => sum + route.count, 0)
    )

    const routeCurrentTotal = computed(() =>
        routeGroups.value.reduce((sum, route) => sum + route.currentCount, 0)
    )

    const routeGroupCount = computed(() => routeGroups.value.length)

    const activeRoute = computed(() =>
        routeGroups.value.find((route) => route.id === selectedRouteId.value)
    )

    const activeRouteTitle = computed(() => {
        if (selectedRouteId.value === allRouteId) {
            return '全部会话'
        }

        return activeRoute.value?.label ?? '会话列表'
    })

    const routeSections = computed(() =>
        buildRouteSections(routeGroups.value, {
            direct: User,
            guild: Connection,
            custom: FolderOpened,
            unknown: FolderOpened
        })
    )

    return {
        routeGroups,
        routesLoading,
        fetchRoutes,
        routeTotal,
        routeCurrentTotal,
        routeGroupCount,
        activeRoute,
        activeRouteTitle,
        routeSections
    }
}
