import type { CharacterPresetTemplate } from '../../lib/preset-types'
import { TemplateField } from './field-guards'

export interface CharacterInputFormProps {
    preset: CharacterPresetTemplate
    onChange: (path: string, value: unknown) => void
    disabled?: boolean
}

export function CharacterInputForm({
    preset,
    onChange,
    disabled = false
}: CharacterInputFormProps) {
    return (
        <div className="pei-form-stack">
            <section className="pei-card">
                <h3 className="pei-card-title">输入提示词</h3>
                <TemplateField
                    label="格式化输入提示词内容"
                    value={preset.input}
                    path="input"
                    id="character-input-prompt"
                    context="character-input"
                    minRows={10}
                    maxRows={20}
                    placeholder="格式化输入提示词内容"
                    ariaLabel="伪装预设格式化输入提示词"
                    disabled={disabled}
                    onChange={onChange}
                />
            </section>
        </div>
    )
}
