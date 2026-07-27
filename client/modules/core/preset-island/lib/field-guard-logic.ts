import {
    isRenderableList,
    isRenderableObject,
    isRenderableText
} from './preset-types'

export const FIELD_PREVIEW_LIMIT = 120

/**
 * Readers return `null` for a value the form cannot edit. A missing value is not
 * an anomaly: YAML omits optional keys, and those render as empty controls.
 */
export const readText = (value: unknown): string | null => {
    if (value == null) return ''
    return isRenderableText(value) ? value : null
}

/** YAML keeps `version: 1.0` and `bot_id: 3345618715` as numbers. */
export const readScalarText = (value: unknown): string | null => {
    if (value == null) return ''
    if (isRenderableText(value)) return value
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value)
    }
    return null
}

export const readTextList = (value: unknown): string[] | null => {
    if (value == null) return []
    if (!isRenderableList(value)) return null

    // A `keywords: [{ a: 1 }]` element cannot go into an `<input>`. Filtering it
    // for display would delete it when a neighbouring entry is edited.
    const texts = value.filter(isRenderableText)
    return texts.length === value.length ? texts : null
}

/** For the keys ChatLuna accepts as either one string or a list of them. */
export const readTextOrTextList = (value: unknown): string[] | null => {
    if (isRenderableText(value)) return value ? [value] : []
    return readTextList(value)
}

export const readObject = (value: unknown): Record<string, unknown> | null => {
    if (value == null) return {}
    return isRenderableObject(value) ? value : null
}

/**
 * The declared element type is what the caller has to work with; the runtime
 * check is what decides whether the key actually holds a list.
 */
export const readList = <T>(value: T[] | undefined): T[] | null => {
    if (value == null) return []
    return isRenderableList(value) ? value : null
}

export type GuardedNumber = number | '' | null

export const readNumber = (value: unknown): GuardedNumber => {
    if (value == null) return ''
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export type GuardedBoolean = boolean | '' | null

export const readBoolean = (value: unknown): GuardedBoolean => {
    if (value == null) return ''
    return typeof value === 'boolean' ? value : null
}

export const readOneOf = <T extends string>(
    value: unknown,
    allowed: readonly T[]
): T | '' | null => {
    if (value == null) return ''
    if (typeof value !== 'string') return null
    return allowed.includes(value as T) ? (value as T) : null
}

interface PreviewWriter {
    append: (text: string) => boolean
    isFull: () => boolean
}

const createPreviewWriter = (
    limit: number
): PreviewWriter & {
    finish: () => string
} => {
    const chunks: string[] = []
    let remaining = Math.max(0, Math.floor(limit))
    let truncated = false

    return {
        append(text) {
            if (remaining === 0) {
                truncated = true
                return false
            }
            if (text.length <= remaining) {
                chunks.push(text)
                remaining -= text.length
                return true
            }
            chunks.push(text.slice(0, remaining))
            remaining = 0
            truncated = true
            return false
        },
        isFull: () => remaining === 0,
        finish: () => `${chunks.join('')}${truncated ? '…' : ''}`
    }
}

const appendQuoted = (writer: PreviewWriter, value: string): void => {
    if (!writer.append('"')) return

    for (let index = 0; index < value.length && !writer.isFull(); index += 1) {
        const character = value[index]
        const code = value.charCodeAt(index)
        let escaped = character

        if (character === '"' || character === '\\') {
            escaped = `\\${character}`
        } else if (character === '\b') {
            escaped = '\\b'
        } else if (character === '\f') {
            escaped = '\\f'
        } else if (character === '\n') {
            escaped = '\\n'
        } else if (character === '\r') {
            escaped = '\\r'
        } else if (character === '\t') {
            escaped = '\\t'
        } else if (code < 0x20) {
            escaped = `\\u${code.toString(16).padStart(4, '0')}`
        }

        if (!writer.append(escaped)) return
    }

    writer.append('"')
}

/**
 * Builds a JSON-like one-line preview without first materializing the complete
 * value. Once the character budget is consumed the walker stops before reading
 * later properties, so a large field cannot make its own warning expensive.
 */
export const shapePreview = (
    value: unknown,
    limit = FIELD_PREVIEW_LIMIT
): string => {
    const writer = createPreviewWriter(limit)
    const ancestors = new Set<object>()

    const visit = (node: unknown): void => {
        if (writer.isFull()) return

        if (typeof node === 'string') {
            appendQuoted(writer, node)
            return
        }
        if (typeof node === 'number') {
            writer.append(Number.isFinite(node) ? String(node) : 'null')
            return
        }
        if (typeof node === 'boolean' || node === null) {
            writer.append(String(node))
            return
        }
        if (node === undefined) {
            writer.append('undefined')
            return
        }
        if (typeof node === 'bigint' || typeof node === 'symbol') {
            writer.append(String(node))
            return
        }
        if (typeof node === 'function') {
            writer.append('[Function]')
            return
        }

        if (ancestors.has(node)) {
            appendQuoted(writer, '[Circular]')
            return
        }

        ancestors.add(node)
        try {
            if (node instanceof Date) {
                if (Number.isNaN(Date.prototype.getTime.call(node))) {
                    writer.append('null')
                } else {
                    appendQuoted(writer, Date.prototype.toISOString.call(node))
                }
                return
            }

            if (Array.isArray(node)) {
                if (!writer.append('[')) return
                for (let index = 0; index < node.length; index += 1) {
                    if (writer.isFull()) break
                    if (index > 0 && !writer.append(',')) break
                    if (writer.isFull()) break
                    visit(node[index])
                }
                writer.append(']')
                return
            }

            if (!writer.append('{')) return
            let isFirst = true
            for (const key in node) {
                if (writer.isFull()) break
                if (!Object.prototype.hasOwnProperty.call(node, key)) continue
                if (!isFirst && !writer.append(',')) break
                isFirst = false
                appendQuoted(writer, key)
                if (writer.isFull() || !writer.append(':')) break

                try {
                    visit((node as Record<string, unknown>)[key])
                } catch {
                    appendQuoted(writer, '[Unreadable]')
                }
            }
            writer.append('}')
        } finally {
            ancestors.delete(node)
        }
    }

    try {
        visit(value)
    } catch {
        appendQuoted(writer, '[Unreadable]')
    }
    return writer.finish()
}
