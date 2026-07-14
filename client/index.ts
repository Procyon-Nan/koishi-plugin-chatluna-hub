import { Context, icons, store } from '@koishijs/client'
import type {} from './types'
import Dashboard from './dashboard.vue'
import EcosystemRouteReturnCard from './components/layout/ecosystem-route-return-card.vue'
import HubIcon from './icons/chatluna-hub.vue'

const hiddenEcosystemActivities = new Set([
    'chatluna-agent',
    'chatluna-livingmemory',
    'media-luna',
    'memesluna',
    'chatluna-affinity-dashboard'
])

const hiddenEcosystemActivityPaths = new Set([
    '/chatluna-agent',
    '/chatluna-livingmemory',
    '/media-luna',
    '/memesluna',
    '/memesluna/',
    '/chatluna-affinity/dashboard'
])

const dependencyGraphActivityId = 'graph'
const dependencyGraphActivityPath = '/graph'

const shouldHideDependencyGraphEntry = () => {
    return (
        store.chatluna_hub_webui?.config?.hideDependencyGraphEntry === true
    )
}

export default (ctx: Context) => {
    icons.register('activity:chatluna-hub', HubIcon)

    ctx.on('activity', (activity) => {
        if (
            shouldHideDependencyGraphEntry() &&
            (activity.id === dependencyGraphActivityId ||
                activity.path === dependencyGraphActivityPath)
        ) {
            return true
        }

        if (hiddenEcosystemActivities.has(activity.id)) return true
        if (hiddenEcosystemActivityPaths.has(activity.path)) return true
    })

    ctx.slot({
        type: 'global',
        component: EcosystemRouteReturnCard,
        order: 100
    })

    ctx.page({
        name: 'ChatLuna Hub',
        path: '/chatluna',
        icon: 'activity:chatluna-hub',
        fields: ['chatluna_hub_webui'],
        authority: 3,
        order: 500,
        component: Dashboard
    })
}
