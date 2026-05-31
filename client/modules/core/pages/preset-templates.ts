/**
 * Starter YAML templates and source options for the preset editor. Pure data /
 * string builders, kept out of the SFC so the page focuses on editor behavior.
 */
import type { ChatLunaCorePresetSource } from '../types'

const createCorePresetTemplate = (name: string) => `keywords:
  - ${name || 'new-preset'}
prompts:
  - role: system
    content: |
      在这里输入预设内容
`

const createCharacterPresetTemplate = (
    name: string
) => `name: ${name || 'new-character'}
nick_name:
  - ${name || 'new-character'}
input: |
  在这里输入角色输入模板
system: |
  在这里输入角色系统设定
`

/** A starter template for a new preset of the given source. */
export const createPresetTemplate = (
    name: string,
    source: ChatLunaCorePresetSource
): string => {
    return source === 'character'
        ? createCharacterPresetTemplate(name)
        : createCorePresetTemplate(name)
}

export const presetSourceOptions: {
    label: string
    value: ChatLunaCorePresetSource
}[] = [
    { label: '主插件预设', value: 'core' },
    { label: 'Character 预设', value: 'character' }
]
