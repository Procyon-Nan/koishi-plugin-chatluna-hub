import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'

let registered = false

const ensureRegistered = () => {
    if (registered) return
    hljs.registerLanguage('json', json)
    registered = true
}

const looksLikeJson = (value: string) => {
    const trimmed = value.trimStart()
    return trimmed.startsWith('{') || trimmed.startsWith('[')
}

/**
 * Highlight a log body. Request/response bodies are 2-space JSON; the error tab
 * is plain text. We only run the JSON grammar when the content actually looks
 * like JSON, otherwise return escaped plain text so non-JSON never renders as
 * broken markup.
 */
export const highlightLogBody = (
    value: string | null | undefined,
    language: 'json' | 'plaintext' = 'json'
): string => {
    const text = value ?? ''
    if (!text) return ''

    ensureRegistered()

    if (language === 'json' && looksLikeJson(text)) {
        try {
            return hljs.highlight(text, { language: 'json' }).value
        } catch {
            // Fall through to escaped plain text on any grammar failure.
        }
    }

    return escapeHtml(text)
}

const escapeHtml = (value: string): string => {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}
