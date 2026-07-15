import { Context } from 'koishi'
import type { ChatLunaHubService } from '../webui/service'
import type { HubEvents } from '../webui/events'

const dataServiceField = 'chatluna_hub_webui'

/** Authority required to mutate config/data vs. just read it. */
const READ = 3
const MUTATE = 4

/**
 * A single RPC listener: the channel name, the handler that delegates to the
 * service, the authority level, and whether to refresh the console data service
 * afterwards (used by mutations that change module/adapter state).
 */
interface ListenerSpec<E extends keyof HubEvents> {
    event: E
    authority: number
    refresh?: boolean
    handle: (
        hub: ChatLunaHubService,
        ...args: Parameters<HubEvents[E]>
    ) =>
        | Awaited<ReturnType<HubEvents[E]>>
        | Promise<Awaited<ReturnType<HubEvents[E]>>>
}

const spec = <E extends keyof HubEvents>(
    entry: ListenerSpec<E>
): ListenerSpec<E> => entry

/**
 * The full Hub RPC surface as data. Read handlers default missing query/input
 * to `{}` to mirror the previous hand-written listeners.
 */
const listeners = [
    spec({
        event: 'chatluna-hub/module/set-enabled',
        authority: MUTATE,
        refresh: true,
        handle: (hub, moduleId, enabled) =>
            hub.setModuleEnabled(moduleId, enabled)
    }),
    spec({
        event: 'chatluna-hub/module/create-config',
        authority: MUTATE,
        refresh: true,
        handle: (hub, moduleId) => hub.createModuleConfig(moduleId)
    }),
    spec({
        event: 'chatluna-hub/core/models/list',
        authority: READ,
        handle: (hub) => hub.listCoreModels()
    }),
    spec({
        event: 'chatluna-hub/core/adapters/list',
        authority: READ,
        handle: (hub) => hub.listAdapters()
    }),
    spec({
        event: 'chatluna-hub/core/adapters/save',
        authority: MUTATE,
        refresh: true,
        handle: (hub, input) => hub.saveAdapter(input)
    }),
    spec({
        event: 'chatluna-hub/core/adapters/toggle',
        authority: MUTATE,
        refresh: true,
        handle: (hub, input) => hub.toggleAdapter(input)
    }),
    spec({
        event: 'chatluna-hub/core/adapters/delete',
        authority: MUTATE,
        refresh: true,
        handle: (hub, input) => hub.deleteAdapter(input)
    }),
    spec({
        event: 'chatluna-hub/core/logs/list',
        authority: READ,
        handle: (hub, query) => hub.listCoreLogs(query ?? {})
    }),
    spec({
        event: 'chatluna-hub/core/logs/get',
        authority: READ,
        handle: (hub, input) => hub.getCoreLog(input)
    }),
    spec({
        event: 'chatluna-hub/core/logs/clear',
        authority: MUTATE,
        handle: (hub) => hub.clearCoreLogs()
    }),
    spec({
        event: 'chatluna-hub/core/conversations/list',
        authority: READ,
        handle: (hub, query) => hub.listCoreConversations(query ?? {})
    }),
    spec({
        event: 'chatluna-hub/core/conversations/routes',
        authority: READ,
        handle: (hub) => hub.listCoreConversationRoutes()
    }),
    spec({
        event: 'chatluna-hub/core/conversations/options',
        authority: READ,
        handle: (hub) => hub.listCoreConversationOptions()
    }),
    spec({
        event: 'chatluna-hub/core/conversations/update-usage',
        authority: MUTATE,
        handle: (hub, input) => hub.updateCoreConversationUsage(input)
    }),
    spec({
        event: 'chatluna-hub/core/conversations/batch-update-usage',
        authority: MUTATE,
        handle: (hub, input) => hub.batchUpdateCoreConversationUsage(input)
    }),
    spec({
        event: 'chatluna-hub/core/conversations/delete',
        authority: MUTATE,
        handle: (hub, input) => hub.deleteCoreConversation(input)
    }),
    spec({
        event: 'chatluna-hub/core/conversations/batch-delete',
        authority: MUTATE,
        handle: (hub, input) => hub.batchDeleteCoreConversation(input)
    }),
    spec({
        event: 'chatluna-hub/core/presets/list',
        authority: READ,
        handle: (hub) => hub.listCorePresets()
    }),
    spec({
        event: 'chatluna-hub/core/presets/get',
        authority: READ,
        handle: (hub, input) => hub.getCorePreset(input)
    }),
    spec({
        event: 'chatluna-hub/core/presets/validate',
        authority: READ,
        handle: (hub, input) => hub.validateCorePreset(input)
    }),
    spec({
        event: 'chatluna-hub/core/presets/create',
        authority: MUTATE,
        handle: (hub, input) => hub.createCorePreset(input)
    }),
    spec({
        event: 'chatluna-hub/core/presets/update',
        authority: MUTATE,
        handle: (hub, input) => hub.updateCorePreset(input)
    }),
    spec({
        event: 'chatluna-hub/core/presets/delete',
        authority: MUTATE,
        handle: (hub, input) => hub.deleteCorePreset(input)
    })
] as const

/**
 * Register every Hub RPC listener from the table above. `ctx` must already have
 * the `console` and `chatluna_hub` services injected.
 */
export const registerHubListeners = (ctx: Context) => {
    for (const listener of listeners) {
        ctx.console.addListener(
            listener.event,
            (async (...args: unknown[]) => {
                const result = await (
                    listener.handle as (
                        hub: ChatLunaHubService,
                        ...rest: unknown[]
                    ) => unknown
                )(ctx.chatluna_hub, ...args)

                if (listener.refresh) {
                    await ctx.console.refresh(dataServiceField)
                }

                return result
            }) as never,
            { authority: listener.authority }
        )
    }
}
