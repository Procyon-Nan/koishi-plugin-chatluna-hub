import { Context } from 'koishi'
import { DataService } from '@koishijs/plugin-console'
import type { HubConsoleData } from '../webui/modules'

/**
 * The console DataService that streams Hub module/config state to the client.
 * It refreshes whenever the Koishi runtime, forks, or plugin status change, so
 * the relationship graph reflects enable/disable operations immediately.
 */
export class ChatLunaHubConsoleService extends DataService<HubConsoleData> {
    static inject = ['console', 'chatluna_hub']

    constructor(ctx: Context) {
        super(ctx, 'chatluna_hub_webui', {
            immediate: true
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
