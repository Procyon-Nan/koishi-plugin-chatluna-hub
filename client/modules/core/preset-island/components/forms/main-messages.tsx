import {
    type BaseMessage,
    isPlainTextContent,
    isRenderableList,
    type PromptContent,
    promptContentPreview,
    type PromptRole,
    type RawPreset
} from '../../lib/preset-types'
import { TemplateEditor } from '../template-editor'
import { FieldShapeNotice, readList, SelectField } from './field-guards'
import { useRowKeys } from './use-row-keys'

export interface MainMessagesFormProps {
    preset: RawPreset
    onChange: (path: string, value: unknown) => void
    disabled?: boolean
}

/**
 * All six roles ChatLuna's preset parser accepts. The aliases are listed
 * separately rather than folded into their canonical role: a `role: ai` message
 * would otherwise select nothing, and touching the field would silently rewrite
 * the role.
 */
const ROLE_OPTIONS: { value: PromptRole; label: string }[] = [
    { value: 'system', label: '系统 (system)' },
    { value: 'user', label: '用户 (user)' },
    { value: 'human', label: '用户 (human)' },
    { value: 'assistant', label: '助手 (assistant)' },
    { value: 'ai', label: '助手 (ai)' },
    { value: 'model', label: '助手 (model)' }
]

const nextRole = (last: BaseMessage | undefined): PromptRole => {
    if (!last) return 'system'
    if (last.role === 'system') return 'assistant'
    if (last.role === 'assistant') return 'user'
    return 'assistant'
}

export function MainMessagesForm({
    preset,
    onChange,
    disabled = false
}: MainMessagesFormProps) {
    const prompts = readList(preset.prompts)
    const rowKeys = useRowKeys(prompts?.length ?? 0)

    const addPrompt = () => {
        if (!prompts) return
        onChange('prompts', [
            ...prompts,
            { role: nextRole(prompts[prompts.length - 1]), content: '' }
        ])
    }

    const removePrompt = (index: number) => {
        if (!prompts) return
        const next = [...prompts]
        next.splice(index, 1)
        rowKeys.removeAt(index)
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
                        disabled={disabled || !prompts}
                        onClick={addPrompt}
                    >
                        添加
                    </button>
                </div>

                {!prompts ? (
                    <FieldShapeNotice
                        label="提示词 prompts"
                        value={preset.prompts}
                    />
                ) : prompts.length === 0 ? (
                    <div className="pei-empty pei-empty-sm">
                        暂无提示词，点击右上角「添加」新增一条。
                    </div>
                ) : (
                    prompts.map((message, index) => (
                        <div
                            key={rowKeys.keys[index]}
                            className="pei-prompt-row"
                        >
                            <SelectField
                                label="角色"
                                value={message.role}
                                path={`prompts.${index}.role`}
                                options={ROLE_OPTIONS}
                                className="pei-field-role"
                                emptyOptionDisabled
                                disabled={disabled}
                                onChange={onChange}
                            />
                            <PromptContentField
                                content={message.content}
                                index={index}
                                disabled={disabled}
                                onChange={(value) =>
                                    onChange(`prompts.${index}.content`, value)
                                }
                            />
                            <button
                                type="button"
                                className="pei-btn pei-btn-danger pei-btn-icon"
                                title="删除"
                                aria-label={`删除第 ${index + 1} 条提示词`}
                                disabled={disabled}
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

interface PromptContentFieldProps {
    content: PromptContent
    index: number
    disabled: boolean
    onChange: (value: string) => void
}

/**
 * A message's content is either plain text or LangChain's complex content — a
 * list of typed parts carrying images, audio or provider-specific payloads.
 * Complex content has no faithful text form, so it is shown through the lossy
 * `promptContentPreview` and never handed to the editor: writing the preview back
 * would replace the parts with a flattened string.
 */
function PromptContentField({
    content,
    index,
    disabled,
    onChange
}: PromptContentFieldProps) {
    if (isPlainTextContent(content)) {
        return (
            <label className="pei-field pei-field-grow">
                <span>内容</span>
                <TemplateEditor
                    id={`prompt-content-${index}`}
                    context="prompt"
                    minRows={5}
                    ariaLabel={`第 ${index + 1} 条提示词内容`}
                    readOnly={disabled}
                    value={content}
                    onChange={onChange}
                />
            </label>
        )
    }

    if (isRenderableList(content)) {
        return (
            <div className="pei-field pei-field-grow">
                <span>内容</span>
                <div className="pei-alert">
                    该消息包含复杂内容，请在 YAML 页编辑
                </div>
                <textarea
                    className="pei-textarea pei-textarea-plain"
                    aria-label={`第 ${index + 1} 条提示词内容（复杂内容，只读预览）`}
                    rows={5}
                    readOnly
                    value={promptContentPreview(content)}
                />
            </div>
        )
    }

    // Unreachable through the declared type, reachable through the file: the
    // parser keeps a `content: { a: 1 }` exactly as it found it.
    return <FieldShapeNotice label="内容" value={content} />
}
