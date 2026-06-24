import { resolve } from 'path'
import { Context } from 'koishi'
import { Config } from './webui/config'
import {
    type ChatLunaCallbackProviderService,
    ChatLunaHubService
} from './webui/service'
import { ChatLunaHubConsoleService } from './console/data-service'
import { registerHubListeners } from './console/listeners'
import type { HubConsoleServices, HubEvents } from './webui/events'

export const name = 'chatluna-hub'

export function apply(ctx: Context, config: Config = {}) {
    ctx.plugin(ChatLunaHubService, config)

    // Capture Character requests through its public before/after chat events.
    ctx.inject(['chatluna_hub'], (ctx) => {
        ctx.chatluna_hub.registerCharacterLogEvents()
    })

    // Instrument ChatLuna's callback resolution to capture LLM run logs.
    ctx.inject(['chatluna_hub', 'chatluna'], (ctx) => {
        const chatluna = ctx.get(
            'chatluna'
        ) as ChatLunaCallbackProviderService | null

        if (!chatluna) return

        const dispose = ctx.chatluna_hub.registerCoreLogProvider(chatluna)
        const disposeCharacterModel =
            ctx.chatluna_hub.registerCharacterModelProvider(chatluna)
        ctx.on('dispose', dispose)
        ctx.on('dispose', disposeCharacterModel)
    })

    // Register the console bundle, the RPC listeners, and the data service.
    ctx.inject(['console', 'chatluna_hub'], (ctx) => {
        const base = ctx.loader?.baseDir ?? process.cwd()
        ctx.console.addEntry({
            dev: resolve(
                base,
                'node_modules',
                'koishi-plugin-chatluna-hub',
                'client',
                'index.ts'
            ),
            prod: resolve(
                base,
                'node_modules',
                'koishi-plugin-chatluna-hub',
                'dist'
            )
        })

        registerHubListeners(ctx)

        ctx.plugin(ChatLunaHubConsoleService)
    })
}

export const inject = {
    optional: ['console', 'chatluna']
}

declare module 'koishi' {
    interface Context {
        chatluna_hub: ChatLunaHubService
    }
}

// Koishi ships the console under two package ids; both share one contract.
declare module '@koishijs/plugin-console' {
    interface Events extends HubEvents {}

    namespace Console {
        interface Services extends HubConsoleServices {}
    }
}

declare module '@koishijs/console' {
    interface Events extends HubEvents {}

    namespace Console {
        interface Services extends HubConsoleServices {}
    }
}

export * from './webui/config'
export * from './webui/service'
export * from './webui/modules'
export * from './webui/core'
export * from './webui/loader'
export * from './webui/adapters'
export * from './webui/events'
