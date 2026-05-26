import { computed, ref } from 'vue'

const compactModeStorageKey = 'chatluna-hub-core-compact-mode'
const defaultCompactMode = true

const readCompactMode = () => {
    if (typeof window === 'undefined') return defaultCompactMode

    const raw = window.localStorage.getItem(compactModeStorageKey)
    if (!raw) return defaultCompactMode

    try {
        return JSON.parse(raw) === true
    } catch {
        return defaultCompactMode
    }
}

const writeCompactMode = (value: boolean) => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(compactModeStorageKey, JSON.stringify(value))
}

const compactMode = ref(readCompactMode())

export const useCoreCompactMode = () =>
    computed({
        get() {
            return compactMode.value
        },
        set(value: boolean) {
            compactMode.value = value
            writeCompactMode(value)
        }
    })
