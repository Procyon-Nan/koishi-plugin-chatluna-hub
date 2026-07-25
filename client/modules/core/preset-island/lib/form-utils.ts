/** Parse a number input; empty / non-finite → undefined. */
export const numOrUndef = (raw: string): number | undefined => {
    if (raw === '') return undefined
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
}

/** Split a comma-separated text field into a trimmed string array. */
export const splitCommaList = (raw: string): string[] =>
    raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
