import { numOrUndef } from '../../lib/form-utils'
import type { AuthorsNote, RawPreset } from '../../lib/preset-types'
import { TemplateEditor } from '../template-editor'

export interface MainAuthorNoteFormProps {
    preset: RawPreset
    onChange: (path: string, value: unknown) => void
}

export function MainAuthorNoteForm({
    preset,
    onChange
}: MainAuthorNoteFormProps) {
    const note: AuthorsNote = preset.authors_note ?? { content: '' }

    const patch = (partial: Partial<AuthorsNote>) => {
        onChange('authors_note', { ...note, ...partial })
    }

    return (
        <div className="pei-form-stack">
            <section className="pei-card">
                <h3 className="pei-card-title">作者注释</h3>
                <label className="pei-field">
                    <span>注释内容</span>
                    <TemplateEditor
                        id="authors-note-content"
                        context="author-note"
                        minRows={5}
                        placeholder="注释的内容"
                        ariaLabel="作者注释内容"
                        value={note.content}
                        onChange={(value) => patch({ content: value })}
                    />
                </label>
                <div className="pei-field-grid">
                    <label className="pei-field">
                        <span>插入频率</span>
                        <input
                            className="pei-input"
                            type="number"
                            value={note.insertFrequency ?? ''}
                            onChange={(e) =>
                                patch({
                                    insertFrequency: numOrUndef(e.target.value)
                                })
                            }
                        />
                    </label>
                    <label className="pei-field">
                        <span>插入深度</span>
                        <input
                            className="pei-input"
                            type="number"
                            value={note.insertDepth ?? ''}
                            onChange={(e) =>
                                patch({
                                    insertDepth: numOrUndef(e.target.value)
                                })
                            }
                        />
                    </label>
                    <label className="pei-field">
                        <span>插入位置</span>
                        <select
                            className="pei-select"
                            value={note.insertPosition ?? 'in_chat'}
                            onChange={(e) =>
                                patch({
                                    insertPosition: e.target.value as
                                        | 'after_char_defs'
                                        | 'in_chat'
                                })
                            }
                        >
                            <option value="after_char_defs">角色定义后</option>
                            <option value="in_chat">聊天末尾</option>
                        </select>
                    </label>
                </div>
            </section>
        </div>
    )
}
