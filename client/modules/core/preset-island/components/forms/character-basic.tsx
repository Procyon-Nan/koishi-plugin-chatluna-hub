import type { CharacterPresetTemplate } from '../../lib/preset-types'
import {
    FieldShapeNotice,
    ListInputField,
    readText,
    TextInputField
} from './field-guards'

export interface CharacterBasicFormProps {
    preset: CharacterPresetTemplate
    onChange: (path: string, value: unknown) => void
    disabled?: boolean
}

export function CharacterBasicForm({
    preset,
    onChange,
    disabled = false
}: CharacterBasicFormProps) {
    const status = readText(preset.status)

    return (
        <div className="pei-form-stack">
            <section className="pei-card">
                <h3 className="pei-card-title">基本信息</h3>
                <div className="pei-field-grid">
                    <TextInputField
                        label="名称"
                        value={preset.name}
                        path="name"
                        placeholder="预设名称"
                        disabled={disabled}
                        onChange={onChange}
                    />
                    <ListInputField
                        label="触发昵称（逗号分隔）"
                        value={preset.nick_name}
                        path="nick_name"
                        placeholder="触发昵称"
                        disabled={disabled}
                        onChange={onChange}
                    />
                    <ListInputField
                        label="禁言词（逗号分隔）"
                        value={preset.mute_keyword}
                        path="mute_keyword"
                        placeholder="禁言词"
                        disabled={disabled}
                        onChange={onChange}
                    />
                </div>
                {status === null ? (
                    <FieldShapeNotice label="状态信息" value={preset.status} />
                ) : (
                    <label className="pei-field">
                        <span>状态信息</span>
                        <textarea
                            className="pei-textarea pei-textarea-plain"
                            rows={12}
                            value={status}
                            placeholder="人物的状态模版信息"
                            disabled={disabled}
                            onChange={(e) => onChange('status', e.target.value)}
                        />
                    </label>
                )}
            </section>
        </div>
    )
}
