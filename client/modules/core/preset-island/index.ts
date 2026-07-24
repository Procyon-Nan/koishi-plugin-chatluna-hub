import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { PresetIslandApp } from './app'
import { createPresetHubApi, type HubInvoke } from './lib/hub-api'
import type { PresetIslandOptions } from './lib/types'
import './styles.css'

let root: Root | null = null
let mountedEl: HTMLElement | null = null

export function mountPresetIsland(
    el: HTMLElement,
    options: PresetIslandOptions = {}
): void {
    if (root && mountedEl === el) {
        return
    }

    if (root) {
        root.unmount()
        root = null
        mountedEl = null
    }

    const invoke: HubInvoke | undefined = options.invoke
    const api = createPresetHubApi(invoke)
    root = createRoot(el)
    mountedEl = el
    root.render(createElement(PresetIslandApp, { api }))
}

export function unmountPresetIsland(): void {
    if (!root) return
    root.unmount()
    root = null
    mountedEl = null
}

export type { PresetIslandOptions }
