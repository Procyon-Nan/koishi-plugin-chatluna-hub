/**
 * Generic helpers shared across the server webui modules.
 *
 * Everything here is pure and imports nothing, so any server module can pull it
 * in freely. The Console authority levels below are the one concession: they
 * are a Koishi Console concept rather than a generic helper, but they are bare
 * numbers with no imports attached and both layers gate on them, so they belong
 * to the shared surface too. Domain helpers (ChatLuna service access, model
 * normalization, etc.) live next to the feature that owns them, not here.
 */

/**
 * Koishi Console authority levels used to gate the Hub surface. The RPC
 * listener table, the console DataService and the preset generation broadcast
 * all gate on these, so they live here rather than in
 * `src/console/listeners.ts`: `src/console/**` is the transport layer and
 * depends on the `src/webui/**` domain layer, so importing back the other way
 * would invert that direction.
 *
 * Note that it would not have formed a cycle — listeners.ts reaches
 * `../webui/service` and `../webui/events` through `import type` only, which is
 * erased at compile time and leaves no runtime edge. Layering, not cycle
 * avoidance, is the reason these constants sit here.
 *
 * Anything that reads config/data requires READ; anything that mutates state or
 * carries generated preset content requires MUTATE.
 */
export const CONSOLE_AUTHORITY_READ = 3
export const CONSOLE_AUTHORITY_MUTATE = 4

/** Turn an unknown thrown value into a human-readable reason string. */
export const coerceReason = (error: unknown): string => {
    if (error instanceof Error) return error.message
    return String(error)
}

/** Narrow an unknown value to a plain object (excludes arrays and null). */
export const isRecord = (value: unknown): value is Record<string, unknown> => {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** Return the value when it is a string, otherwise an empty string. */
export const coerceString = (value: unknown): string => {
    return typeof value === 'string' ? value : ''
}

/** Read a string field from an unknown value that may not be a record. */
export const getRecordString = (value: unknown, key: string): string => {
    if (!isRecord(value)) return ''
    return coerceString(value[key])
}

/**
 * Natural, case-insensitive string comparison. This is the single comparator
 * used for every alphabetical sort on the server so ordering stays consistent.
 */
export const naturalCompare = (left: string, right: string): number => {
    return left.localeCompare(right, undefined, {
        numeric: true,
        sensitivity: 'base'
    })
}

/** Convert a Date/ISO string into a millisecond timestamp, 0 when invalid. */
export const toTimestamp = (
    value: Date | string | null | undefined
): number => {
    if (value == null) return 0
    const date = value instanceof Date ? value : new Date(value)
    const time = date.getTime()

    return Number.isFinite(time) ? time : 0
}

/** De-duplicate a list by a derived string key, preserving first-seen order. */
export const unique = <T>(items: T[], resolveKey: (item: T) => string): T[] => {
    const result: T[] = []
    const keys = new Set<string>()

    for (const item of items) {
        const key = resolveKey(item)
        if (keys.has(key)) continue
        keys.add(key)
        result.push(item)
    }

    return result
}

const defaultPage = 1
const defaultPageSize = 20
const maxPageSize = 100

/** Clamp a requested page number to a positive integer. */
export const normalizePage = (value: number | undefined): number => {
    if (value == null || !Number.isFinite(value)) return defaultPage
    return Math.max(1, Math.floor(value))
}

/** Clamp a requested page size to the supported [1, maxPageSize] range. */
export const normalizePageSize = (value: number | undefined): number => {
    if (value == null || !Number.isFinite(value)) return defaultPageSize
    return Math.min(maxPageSize, Math.max(1, Math.floor(value)))
}

export interface Page<T> {
    items: T[]
    page: number
    pageSize: number
    total: number
}

/**
 * Slice an already filtered+sorted list into a page. `total` reflects the full
 * list length, not the sliced window.
 */
export const paginate = <T>(
    items: T[],
    page: number,
    pageSize: number
): Page<T> => {
    const start = (page - 1) * pageSize

    return {
        items: items.slice(start, start + pageSize),
        page,
        pageSize,
        total: items.length
    }
}
