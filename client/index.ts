import { Context, icons } from '@koishijs/client'
import type {} from './types'
import Dashboard from './dashboard.vue'
import EcosystemRouteReturnCard from './components/layout/ecosystem-route-return-card.vue'
import HubIcon from './icons/chatluna-hub.vue'

const hiddenEcosystemActivities = new Set([
    'chatluna-agent',
    'chatluna-livingmemory',
    'media-luna',
    'memesluna'
])

const hiddenEcosystemActivityPaths = new Set([
    '/chatluna-agent',
    '/chatluna-livingmemory',
    '/media-luna',
    '/memesluna',
    '/memesluna/'
])

export default (ctx: Context) => {
    icons.register('activity:chatluna-hub', HubIcon)

    ctx.on('activity', (activity) => {
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
