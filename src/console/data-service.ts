import { Context } from 'koishi'
import { DataService } from '@koishijs/plugin-console'
import type { HubConsoleData } from '../webui/modules'
import { CONSOLE_AUTHORITY_READ } from '../webui/shared'

/**
 * The console DataService that streams Hub module/config state to the client.
 * It refreshes whenever the Koishi runtime, forks, or plugin status change, so
 * the relationship graph reflects enable/disable operations immediately.
 */
export class ChatLunaHubConsoleService extends DataService<HubConsoleData> {
    static inject = ['console', 'chatluna_hub']

    constructor(ctx: Context) {
        // `authority` is what `console/intercept` gates the push on, for both
        // `refresh()` and the initial `Client.refresh()`. Omitting it is not a
        // neutral default: plugin-auth's interceptor returns false immediately
        // when a listener carries no authority, so an unset field hands the full
        // payload — installed plugins, config paths, availability, failure
        // reasons — to every socket, authenticated or not. READ matches both the
        // listener table in `src/console/listeners.ts` and the `authority: 3`
        // already declared on the page in `client/index.ts`, so no client that
        // can render the Hub is excluded.
        super(ctx, 'chatluna_hub_webui', {
            immediate: true,
            authority: CONSOLE_AUTHORITY_READ
        })

        const refreshRuntimeData = ctx.debounce(() => this.refresh(false), 0)
        ctx.on('internal/runtime', refreshRuntimeData)
        ctx.on('internal/fork', refreshRuntimeData)
        ctx.on('internal/status', refreshRuntimeData)
    }

    async get() {
        return await this.ctx.chatluna_hub.getConsoleData()
    }
}
