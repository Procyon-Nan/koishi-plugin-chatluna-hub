import type { Context } from 'koishi'
import { isRecord } from './shared'

const loaderRecord = Symbol.for('koishi.loader.record')

export interface LoaderLike {
    config?: {
        plugins?: Record<string, unknown>
    }
    entry?: Context
    writable?: boolean
    resolve?: (name: string) => unknown | Promise<unknown>
    reload?: (parent: Context, key: string, source: unknown) => Promise<unknown>
    unload?: (parent: Context, key: string) => void
    writeConfig?: () => Promise<void>
}

export interface PluginConfigMatch {
    key: string
    activeKey: string
    path: string
    disabled: boolean
    config: unknown
    parentConfig: Record<string, unknown>
    parentContext?: Context
}

export const getLoader = (ctx: Context): LoaderLike | undefined => {
    return (ctx as Context & { loader?: LoaderLike }).loader
}

export const normalizePluginName = (name: string | undefined) => {
    return name
        ?.replace(/^@koishijs\/plugin-/, '')
        .replace(/^@[^/]+\/koishi-plugin-/, '')
        .replace(/^koishi-plugin-/, '')
        .replace(/^@[^/]+\//, '')
        .toLowerCase()
}

export const getActiveConfigKey = (key: string) => {
    return key.startsWith('~') ? key.slice(1) : key
}

export const getPluginNameFromConfigKey = (key: string) => {
    const activeKey = getActiveConfigKey(key)
    const [name] = activeKey.split(':', 1)

    return normalizePluginName(name)
}

export const getConfigPathFromKey = (key: string) => {
    const activeKey = getActiveConfigKey(key)
    const separator = activeKey.indexOf(':')

    return separator < 0 ? activeKey : activeKey.slice(separator + 1)
}

export const getForkContext = (parent: Context | undefined, key: string) => {
    if (!parent) return

    const records = (
        parent.scope as unknown as Record<
            symbol,
            Record<string, { ctx?: Context }> | undefined
        >
    )[loaderRecord]

    return records?.[key]?.ctx
}

const insertConfigKey = (
    config: Record<string, unknown>,
    key: string,
    value: unknown,
    rest: string[]
) => {
    const temp: Record<string, unknown> = {
        [key]: value
    }

    for (const item of rest) {
        if (item === key) continue
        temp[item] = config[item]
        delete config[item]
    }

    Object.assign(config, temp)
}

export const renameConfigKey = (
    config: Record<string, unknown>,
    oldKey: string,
    newKey: string,
    value: unknown
) => {
    const keys = Object.keys(config)
    const index = keys.findIndex((key) => key === oldKey || key === newKey)
    const rest = index < 0 ? [] : keys.slice(index + 1)

    delete config[oldKey]
    delete config[newKey]
    insertConfigKey(config, newKey, value, rest)
}

export const findPluginConfigMatches = (
    config: Record<string, unknown>,
    pluginName: string,
    parentContext: Context | undefined,
    matches: PluginConfigMatch[]
) => {
    const target = normalizePluginName(pluginName)
    if (!target) return

    for (const [key, value] of Object.entries(config)) {
        if (key.startsWith('$')) continue

        const activeKey = getActiveConfigKey(key)
        const plugin = getPluginNameFromConfigKey(key)
        const disabled = key.startsWith('~')

        if (plugin === target) {
            matches.push({
                key,
                activeKey,
                path: getConfigPathFromKey(activeKey),
                disabled,
                config: value,
                parentConfig: config,
                parentContext
            })
        }

        if (plugin !== 'group' || !isRecord(value)) continue
        findPluginConfigMatches(
            value,
            pluginName,
            getForkContext(parentContext, activeKey),
            matches
        )
    }
}

const allowedKeyChars = 'abcdefghijklmnopqrstuvwxyz0123456789'

export const createConfigIdent = () => {
    let ident = ''
    for (let index = 0; index < 6; index += 1) {
        ident += allowedKeyChars.charAt(
            Math.floor(Math.random() * allowedKeyChars.length)
        )
    }

    return ident
}
