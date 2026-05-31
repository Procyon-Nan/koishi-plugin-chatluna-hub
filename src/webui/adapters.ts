/**
 * ChatLuna adapter management for the Hub model page.
 *
 * Barrel over the focused modules under `adapters/`:
 * - `types`        — shared DTOs and the RPC contract
 * - `descriptors`  — the catalogue of supported adapters
 * - `credentials`  — credential (de)serialization per credential kind
 * - `matches`      — locating adapter entries in the loader config
 * - `list`         — the read path (instances, types, platform map)
 * - `mutations`    — the write path (save/toggle/delete)
 */
export * from './adapters/types'
export {
    adapterDescriptors,
    getAdapterDescriptor
} from './adapters/descriptors'
export { listChatLunaAdapters } from './adapters/list'
export {
    deleteChatLunaAdapter,
    saveChatLunaAdapter,
    toggleChatLunaAdapter
} from './adapters/mutations'
