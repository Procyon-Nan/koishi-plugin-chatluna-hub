import type { BaseMessage, RawPreset } from '../../lib/preset-types'
import { TemplateEditor } from '../template-editor'

export interface MainMessagesFormProps {
    preset: RawPreset
    onChange: (path: string, value: unknown) => void
}

const nextRole = (
    last: BaseMessage | undefined
): BaseMessage['role'] => {
    if (!last) return 'system'
    if (last.role === 'system') return 'assistant'
    if (last.role === 'assistant') return 'user'
    return 'assistant'
}

export function MainMessagesForm({ preset, onChange }: MainMessagesFormProps) {
    const prompts = preset.prompts ?? []

    const addPrompt = () => {
        onChange('prompts', [
            ...prompts,
            { role: nextRole(prompts[prompts.length - 1]), content: '' }
        ])
    }

    const removePrompt = (index: number) => {
        const next = [...prompts]
        next.splice(index, 1)
        onChange('prompts', next)
    }

    return (
        <div className="pei-form-stack">
            <section className="pei-card">
                <div className="pei-card-header">
                    <h3 className="pei-card-title">提示词列表</h3>
                    <button
                        type="button"
                        className="pei-btn"
                        onClick={addPrompt}
                    >
                        添加
                    </button>
                </div>

                {prompts.length === 0 ? (
                    <div className="pei-empty pei-empty-sm">暂无提示词</div>
                ) : (
                    prompts.map((message, index) => (
                        <div key={index} className="pei-prompt-row">
                            <label className="pei-field pei-field-role">
                                <span>角色</span>
                                <select
                                    className="pei-select"
                                    value={message.role}
                                    onChange={(e) =>
                                        onChange(
                                            `prompts.${index}.role`,
                                            e.target.value
                                        )
                                    }
                                >
                                    <option value="system">系统</option>
                                    <option value="assistant">助手</option>
                                    <option value="user">用户</option>
                                </select>
                            </label>
                            <label className="pei-field pei-field-grow">
                                <span>内容</span>
                                <TemplateEditor
                                    id={`prompt-content-${index}`}
                                    context="prompt"
                                    minRows={5}
                                    ariaLabel={`第 ${index + 1} 条提示词内容`}
                                    value={message.content}
                                    onChange={(value) =>
                                        onChange(
                                            `prompts.${index}.content`,
                                            value
                                        )
                                    }
                                />
                            </label>
                            <button
                                type="button"
                                className="pei-btn pei-btn-danger pei-btn-icon"
                                title="删除"
                                onClick={() => removePrompt(index)}
                            >
                                删
                            </button>
                        </div>
                    ))
                )}
            </section>
        </div>
    )
}
