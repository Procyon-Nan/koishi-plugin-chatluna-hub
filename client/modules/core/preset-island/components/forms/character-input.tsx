import type { CharacterPresetTemplate } from '../../lib/preset-types'
import { TemplateEditor } from '../template-editor'

export interface CharacterInputFormProps {
    preset: CharacterPresetTemplate
    onChange: (path: string, value: unknown) => void
}

export function CharacterInputForm({
    preset,
    onChange
}: CharacterInputFormProps) {
    return (
        <div className="pei-form-stack">
            <section className="pei-card">
                <h3 className="pei-card-title">输入提示词</h3>
                <label className="pei-field">
                    <span>格式化输入提示词内容</span>
                    <TemplateEditor
                        id="character-input-prompt"
                        context="character-input"
                        minRows={10}
                        maxRows={20}
                        placeholder="格式化输入提示词内容"
                        ariaLabel="伪装预设格式化输入提示词"
                        value={preset.input}
                        onChange={(value) => onChange('input', value)}
                    />
                </label>
            </section>
        </div>
    )
}
