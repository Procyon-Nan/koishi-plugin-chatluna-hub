import type { CharacterPresetTemplate } from '../../lib/preset-types'
import { CommaListInput } from '../comma-list-input'

export interface CharacterBasicFormProps {
    preset: CharacterPresetTemplate
    onChange: (path: string, value: unknown) => void
}

export function CharacterBasicForm({
    preset,
    onChange
}: CharacterBasicFormProps) {
    return (
        <div className="pei-form-stack">
            <section className="pei-card">
                <h3 className="pei-card-title">基本信息</h3>
                <div className="pei-field-grid">
                    <label className="pei-field">
                        <span>名称</span>
                        <input
                            className="pei-input"
                            value={preset.name}
                            placeholder="预设名称"
                            onChange={(e) => onChange('name', e.target.value)}
                        />
                    </label>
                    <label className="pei-field">
                        <span>触发昵称（逗号分隔）</span>
                        <CommaListInput
                            className="pei-input"
                            value={preset.nick_name ?? []}
                            placeholder="触发昵称"
                            onChange={(value) => onChange('nick_name', value)}
                        />
                    </label>
                    <label className="pei-field">
                        <span>禁言词（逗号分隔）</span>
                        <CommaListInput
                            className="pei-input"
                            value={preset.mute_keyword ?? []}
                            placeholder="禁言词"
                            onChange={(value) =>
                                onChange('mute_keyword', value)
                            }
                        />
                    </label>
                </div>
                <label className="pei-field">
                    <span>状态信息</span>
                    <textarea
                        className="pei-textarea pei-textarea-plain"
                        rows={12}
                        value={preset.status ?? ''}
                        placeholder="人物的状态模版信息"
                        onChange={(e) => onChange('status', e.target.value)}
                    />
                </label>
            </section>
        </div>
    )
}
