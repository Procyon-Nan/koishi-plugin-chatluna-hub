import type { CharacterPresetTemplate } from '../../lib/preset-types'
import { TemplateEditor } from '../template-editor'

export interface CharacterSystemFormProps {
    preset: CharacterPresetTemplate
    onChange: (path: string, value: unknown) => void
}

export function CharacterSystemForm({
    preset,
    onChange
}: CharacterSystemFormProps) {
    return (
        <div className="pei-form-stack">
            <section className="pei-card">
                <h3 className="pei-card-title">系统提示词</h3>
                <label className="pei-field">
                    <span>系统提示词内容</span>
                    <TemplateEditor
                        id="character-system-prompt"
                        context="character-system"
                        minRows={16}
                        placeholder="系统提示词内容"
                        ariaLabel="伪装预设系统提示词"
                        value={preset.system}
                        onChange={(value) => onChange('system', value)}
                    />
                </label>
            </section>
        </div>
    )
}
