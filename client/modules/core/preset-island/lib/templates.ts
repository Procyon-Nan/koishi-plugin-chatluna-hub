import type { PresetSource } from './types'
import {
    emptyCharacterPreset,
    emptyCorePreset,
    type StructuredPreset
} from './preset-types'

export const createStructuredTemplate = (
    source: PresetSource
): StructuredPreset =>
    source === 'character' ? emptyCharacterPreset() : emptyCorePreset()

export const presetSourceOptions: { label: string; value: PresetSource }[] = [
    { label: '主插件预设', value: 'core' },
    { label: 'Character 预设', value: 'character' }
]
