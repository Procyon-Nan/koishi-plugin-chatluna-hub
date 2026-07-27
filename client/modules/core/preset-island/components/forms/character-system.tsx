import type { CharacterPresetTemplate } from '../../lib/preset-types'
import { TemplateField } from './field-guards'

export interface CharacterSystemFormProps {
    preset: CharacterPresetTemplate
    onChange: (path: string, value: unknown) => void
    disabled?: boolean
}

export function CharacterSystemForm({
    preset,
    onChange,
    disabled = false
}: CharacterSystemFormProps) {
    return (
        <div className="pei-form-stack">
            <section className="pei-card">
                <h3 className="pei-card-title">系统提示词</h3>
                <TemplateField
                    label="系统提示词内容"
                    value={preset.system}
                    path="system"
                    id="character-system-prompt"
                    context="character-system"
                    minRows={16}
                    placeholder="系统提示词内容"
                    ariaLabel="伪装预设系统提示词"
                    disabled={disabled}
                    onChange={onChange}
                />
            </section>
        </div>
    )
}
