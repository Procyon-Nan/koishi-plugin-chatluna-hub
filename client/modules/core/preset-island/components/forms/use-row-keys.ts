import { useRef } from 'react'

let sequence = 0

const createRowKey = () => `pei-row-${(sequence += 1)}`

export interface RowKeys {
    /** One key per element, positionally aligned with the source array. */
    keys: readonly string[]
    /** Call next to the `onChange` that removes the same index. */
    removeAt: (index: number) => void
}

/**
 * Stable React keys for the YAML lists behind these forms, which carry no id of
 * their own.
 *
 * The index cannot serve as the key: React would then reuse row N's DOM for
 * whatever value moves into slot N. Removing a middle row leaves every row below
 * it mounted under its former neighbour's key, so the text in an input — or in a
 * CodeMirror instance, which keeps its own document — belongs to a different
 * entry than the one that row now writes to.
 *
 * Object identity cannot serve either: a structured patch replaces the edited
 * object on every keystroke, so an identity-derived key would change while the
 * user types and remount the row mid-edit.
 *
 * So the keys are tracked alongside the data: local removals are announced
 * through `removeAt`, and any other length change — a YAML-tab edit or an AI
 * generation replacing the whole array — is reconciled on the next render.
 */
export function useRowKeys(length: number): RowKeys {
    const keysRef = useRef<string[]>([])
    const keys = keysRef.current

    if (keys.length > length) keys.length = length
    while (keys.length < length) keys.push(createRowKey())

    return {
        keys,
        removeAt: (index: number) => {
            keys.splice(index, 1)
        }
    }
}
