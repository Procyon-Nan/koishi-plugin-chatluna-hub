/**
 * Locating an adapter's entries in the Koishi loader config. Shared by the read
 * (list) and write (mutation) paths so both agree on how an adapter maps to its
 * config entries.
 */
import type { Context } from 'koishi'
import {
    findPluginConfigMatches,
    getLoader,
    type PluginConfigMatch
} from '../loader'
import { adapterDescriptors } from './descriptors'
import type { ChatLunaAdapterDescriptor } from './types'

/** All config entries (enabled or disabled) for one adapter descriptor. */
export const findAdapterMatches = (
    ctx: Context,
    descriptor: ChatLunaAdapterDescriptor
): PluginConfigMatch[] => {
    const loader = getLoader(ctx)
    const plugins = loader?.config?.plugins
    if (!plugins) return []

    const matches: PluginConfigMatch[] = []
    findPluginConfigMatches(
        plugins,
        descriptor.pluginName,
        loader?.entry,
        matches
    )

    return matches
}

/** Locate a single instance by its activeKey across all adapter descriptors. */
export const findInstanceMatch = (
    ctx: Context,
    instanceKey: string
): {
    descriptor: ChatLunaAdapterDescriptor
    match: PluginConfigMatch
} | null => {
    for (const descriptor of adapterDescriptors) {
        const match = findAdapterMatches(ctx, descriptor).find(
            (item) => item.activeKey === instanceKey
        )
        if (match) return { descriptor, match }
    }

    return null
}
