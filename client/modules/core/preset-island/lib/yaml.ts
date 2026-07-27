import type { PresetSource } from './types'

/** Guess source from common field shapes when importing a local YAML file. */
export const detectPresetSource = (rawText: string): PresetSource => {
    const hasCharacterHints =
        /^\s*name\s*:/m.test(rawText) &&
        (/^\s*input\s*:/m.test(rawText) || /^\s*system\s*:/m.test(rawText))

    if (hasCharacterHints && !/^\s*keywords\s*:/m.test(rawText)) {
        return 'character'
    }

    return 'core'
}

/**
 * Degraded list hints scraped from raw text: only for a document that failed to
 * parse. Whenever a parsed structure exists, read the hints from it instead —
 * these regexes cannot see scalar shapes such as `keywords: 猫娘`.
 */
export const extractListHints = (
    rawText: string,
    source: PresetSource
): { keywords: string[]; promptCount: number } => {
    if (source === 'character') {
        const nameMatch = /^\s*name\s*:\s*(.+)\s*$/m.exec(rawText)
        const name = nameMatch?.[1]?.replace(/^['"]|['"]$/g, '').trim()
        return {
            keywords: name ? [name] : [],
            promptCount: countSections(rawText)
        }
    }

    const keywords: string[] = []
    const block = /^\s*keywords\s*:\s*\n((?:\s*-\s*.+\n?)*)/m.exec(rawText)
    if (block) {
        for (const line of block[1].split('\n')) {
            const item = /^\s*-\s*(.+)\s*$/.exec(line)
            if (item) {
                keywords.push(item[1].replace(/^['"]|['"]$/g, '').trim())
            }
        }
    }

    return {
        keywords,
        promptCount: countPromptEntries(rawText)
    }
}

const countPromptEntries = (rawText: string): number => {
    const matches = rawText.match(/^\s*-\s*role\s*:/gm)
    return matches?.length ?? 0
}

const countSections = (rawText: string): number => {
    let count = 0
    for (const key of ['input', 'system', 'output', 'mute_keyword']) {
        if (new RegExp(`^\\s*${key}\\s*:`, 'm').test(rawText)) count += 1
    }
    return count
}

export const readLocalYamlFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            resolve(String(reader.result ?? ''))
        }
        reader.onerror = () => {
            reject(reader.error ?? new Error('Failed to read file.'))
        }
        reader.readAsText(file)
    })
}

export const isYamlFilename = (name: string): boolean => {
    const lower = name.toLowerCase()
    return lower.endsWith('.yml') || lower.endsWith('.yaml')
}
