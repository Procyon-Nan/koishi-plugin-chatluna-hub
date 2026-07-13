import { onBeforeUnmount, reactive } from 'vue'
import { send } from '@koishijs/client'
import { canToggleHubModule } from '../../module-access'
import type {
    HubModuleId,
    HubModuleItem,
    HubModuleToggleResult
} from '../../types'
import type { ToggleDirection } from './graph-types'

export const useModuleToggle = () => {
    const togglePending = reactive<Partial<Record<HubModuleId, ToggleDirection>>>(
        {}
    )
    const toggleErrors = reactive<Partial<Record<HubModuleId, string>>>({})
    const errorTimers: Partial<Record<HubModuleId, number>> = {}

    const clearToggleError = (id: HubModuleId) => {
        if (errorTimers[id]) {
            window.clearTimeout(errorTimers[id])
            delete errorTimers[id]
        }

        delete toggleErrors[id]
    }

    const setToggleError = (id: HubModuleId, reason: string) => {
        clearToggleError(id)
        toggleErrors[id] = reason
        errorTimers[id] = window.setTimeout(() => {
            delete toggleErrors[id]
            delete errorTimers[id]
        }, 4200)
    }

    const setModuleEnabled = async (item: HubModuleItem, enabled: boolean) => {
        if (!canToggleHubModule(item)) return

        clearToggleError(item.id)
        togglePending[item.id] = enabled ? 'enable' : 'disable'

        try {
            const result = (await send(
                'chatluna-hub/module/set-enabled',
                item.id,
                enabled
            )) as HubModuleToggleResult | undefined

            if (!result?.ok) {
                setToggleError(
                    item.id,
                    result?.reason ?? 'Unable to update plugin state.'
                )
            }
        } catch (error) {
            setToggleError(
                item.id,
                error instanceof Error ? error.message : String(error)
            )
        } finally {
            delete togglePending[item.id]
        }
    }

    const disposeToggleErrors = () => {
        for (const timer of Object.values(errorTimers)) {
            if (timer) window.clearTimeout(timer)
        }
    }

    onBeforeUnmount(() => {
        disposeToggleErrors()
    })

    return {
        togglePending,
        toggleErrors,
        setModuleEnabled,
        clearToggleError,
        setToggleError,
        disposeToggleErrors
    }
}
