/**
 * Shared display formatters for the Hub core pages. Previously each page
 * defined its own near-identical `formatTime`/`formatSize`, which drifted in
 * their fallback strings; these unify the logic while letting each call site
 * keep its own fallback via an argument.
 */

const pad = (value: number) => String(value).padStart(2, '0')

/**
 * Format a date/ISO string as `YYYY-MM-DD HH:mm`. Returns `fallback` for
 * empty/nullish input or an unparseable date.
 */
export const formatDateTime = (
    value: string | Date | null | undefined,
    fallback = '-'
): string => {
    if (value == null || value === '') return fallback

    const date = value instanceof Date ? value : new Date(value)
    if (!Number.isFinite(date.getTime())) return fallback

    const year = date.getFullYear()
    const month = pad(date.getMonth() + 1)
    const day = pad(date.getDate())
    const hour = pad(date.getHours())
    const minute = pad(date.getMinutes())

    return `${year}-${month}-${day} ${hour}:${minute}`
}

/**
 * Format a byte count. `maxUnit` caps the largest unit used: `'KB'` yields
 * `B`/`KB` (preset page), `'MB'` yields `B`/`KB`/`MB` (log page).
 */
export const formatBytes = (
    value: number | null | undefined,
    fallback = '-',
    maxUnit: 'KB' | 'MB' = 'MB'
): string => {
    if (value == null || !Number.isFinite(value)) return fallback
    if (value < 1024) return `${value} B`

    if (maxUnit === 'KB' || value < 1024 * 1024) {
        return `${(value / 1024).toFixed(1)} KB`
    }

    return `${(value / 1024 / 1024).toFixed(2)} MB`
}

/** Format a millisecond duration as `ms` under 1s, otherwise `s`. */
export const formatDuration = (
    value: number | null | undefined,
    fallback = '-'
): string => {
    if (value == null || !Number.isFinite(value)) return fallback
    if (value < 1000) return `${Math.round(value)} ms`

    return `${(value / 1000).toFixed(2)} s`
}
