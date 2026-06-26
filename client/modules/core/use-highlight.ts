import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'

let registered = false

const ensureRegistered = () => {
    if (registered) return
    hljs.registerLanguage('json', json)
    registered = true
}

const formatJson = (value: string): string | null => {
    try {
        return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
        return null
    }
}

const formatSseJson = (value: string): string | null => {
    let formattedCount = 0
    const lines = value.split(/\r?\n/)

    const formattedLines = lines.map((line) => {
        const match = line.match(/^(\s*data:\s*)(.*)$/)
        if (!match) return line

        const formatted = formatJson(match[2].trim())
        if (!formatted) return line

        formattedCount += 1
        return `${match[1]}${formatted}`
    })

    return formattedCount > 0 ? formattedLines.join('\n') : null
}

const formatLogBody = (
    value: string
): { text: string; highlightJson: boolean } => {
    const jsonText = formatJson(value)
    if (jsonText) return { text: jsonText, highlightJson: true }

    return {
        text: formatSseJson(value) ?? value,
        highlightJson: false
    }
}

/** Highlight a captured JSON or SSE JSON log body for display. */
export const highlightLogBody = (
    value: string | null | undefined
): string => {
    const text = value ?? ''
    if (!text) return ''

    ensureRegistered()

    const formatted = formatLogBody(text)
    if (formatted.highlightJson) {
        try {
            return hljs.highlight(formatted.text, { language: 'json' }).value
        } catch {
            // Fall through to escaped text if the highlighter rejects it.
        }
    }

    return escapeHtml(formatted.text)
}

const escapeHtml = (value: string): string => {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}
