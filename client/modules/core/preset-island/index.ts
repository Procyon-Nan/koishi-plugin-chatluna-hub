import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { PresetIslandApp } from './app'
import { createPresetHubApi, type HubInvoke } from './lib/hub-api'
import type { PresetIslandOptions } from './lib/types'
import './styles.css'

let root: Root | null = null
let mountedEl: HTMLElement | null = null
let isDirty = false

const discardMessage =
    '当前预设有未保存修改，继续操作会丢失这些修改。是否继续？'

const setDirty = (dirty: boolean) => {
    isDirty = dirty
}

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (!isDirty) return
    event.preventDefault()
    event.returnValue = ''
}

export function confirmPresetIslandDiscard(): boolean {
    return !isDirty || window.confirm(discardMessage)
}

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
    window.addEventListener('beforeunload', handleBeforeUnload)
    root.render(createElement(PresetIslandApp, { api, onDirtyChange: setDirty }))
}

export function unmountPresetIsland(): void {
    if (!root) return
    root.unmount()
    root = null
    mountedEl = null
    isDirty = false
    window.removeEventListener('beforeunload', handleBeforeUnload)
}

export type { PresetIslandOptions }
