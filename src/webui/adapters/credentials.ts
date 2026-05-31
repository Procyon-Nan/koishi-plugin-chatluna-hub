/**
 * Conversion between ChatLuna's array-shaped credential config and the Hub's
 * uniform {apiKey, apiEndpoint, enabled} rows. Each adapter's
 * {@link ChatLunaAdapterCredentialKind} decides the array layout.
 */
import type {
    ChatLunaAdapterCredentialEntry,
    ChatLunaAdapterCredentialKind,
    ChatLunaAdapterDescriptor
} from './types'

const emptyCredential = (): ChatLunaAdapterCredentialEntry => ({
    apiKey: '',
    apiEndpoint: '',
    enabled: true
})

/** Parse one raw config row into a credential entry, by credential kind. */
const parseCredentialRow = (
    kind: ChatLunaAdapterCredentialKind,
    row: unknown
): ChatLunaAdapterCredentialEntry | null => {
    if (!Array.isArray(row)) return null

    const entry = emptyCredential()

    if (kind === 'api-endpoint-enabled') {
        entry.apiKey = typeof row[0] === 'string' ? row[0] : ''
        entry.apiEndpoint = typeof row[1] === 'string' ? row[1] : ''
        entry.enabled = row[2] !== false
    } else if (kind === 'api-enabled') {
        entry.apiKey = typeof row[0] === 'string' ? row[0] : ''
        entry.enabled = row[1] !== false
    } else if (kind === 'endpoint-enabled') {
        entry.apiEndpoint = typeof row[0] === 'string' ? row[0] : ''
        entry.enabled = row[1] !== false
    } else {
        return null
    }

    return entry
}

/** Serialize a credential entry back into its kind-specific config row. */
export const serializeCredentialRow = (
    kind: ChatLunaAdapterCredentialKind,
    entry: ChatLunaAdapterCredentialEntry
): unknown[] => {
    if (kind === 'api-endpoint-enabled') {
        return [entry.apiKey, entry.apiEndpoint, entry.enabled]
    }
    if (kind === 'api-enabled') {
        return [entry.apiKey, entry.enabled]
    }

    return [entry.apiEndpoint, entry.enabled]
}

/** Read an adapter instance's credentials out of its raw config. */
export const readCredentials = (
    descriptor: ChatLunaAdapterDescriptor,
    config: Record<string, unknown>
): ChatLunaAdapterCredentialEntry[] => {
    if (descriptor.credentialKind === 'opaque') return []

    const rows = config[descriptor.credentialField]
    if (!Array.isArray(rows)) return []

    return rows
        .map((row) => parseCredentialRow(descriptor.credentialKind, row))
        .filter((row): row is ChatLunaAdapterCredentialEntry => Boolean(row))
}

/** Trim and drop empty credentials before persisting them. */
export const sanitizeCredentials = (
    descriptor: ChatLunaAdapterDescriptor,
    credentials: ChatLunaAdapterCredentialEntry[]
): ChatLunaAdapterCredentialEntry[] => {
    return credentials
        .map((entry) => ({
            apiKey: typeof entry.apiKey === 'string' ? entry.apiKey.trim() : '',
            apiEndpoint:
                typeof entry.apiEndpoint === 'string'
                    ? entry.apiEndpoint.trim()
                    : '',
            enabled: entry.enabled !== false
        }))
        .filter((entry) => {
            if (descriptor.credentialKind === 'endpoint-enabled') {
                return entry.apiEndpoint.length > 0
            }

            return entry.apiKey.length > 0
        })
}

/** The effective platform name for an instance (default or configured). */
export const resolvePlatform = (
    descriptor: ChatLunaAdapterDescriptor,
    config: Record<string, unknown>
): string => {
    if (descriptor.platformConfigurable) {
        const platform = config.platform
        if (typeof platform === 'string' && platform.length > 0) {
            return platform
        }
    }

    return descriptor.platformDefault
}
