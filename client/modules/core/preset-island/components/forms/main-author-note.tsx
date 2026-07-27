import type { RawPreset } from '../../lib/preset-types'
import {
    FieldShapeNotice,
    NumberInputField,
    readObject,
    SelectField,
    TemplateField
} from './field-guards'

export interface MainAuthorNoteFormProps {
    preset: RawPreset
    onChange: (path: string, value: unknown) => void
    disabled?: boolean
}

const INSERT_POSITION_OPTIONS = [
    { value: 'after_char_defs', label: '角色定义后' },
    { value: 'in_chat', label: '聊天末尾' }
] as const

export function MainAuthorNoteForm({
    preset,
    onChange,
    disabled = false
}: MainAuthorNoteFormProps) {
    const note = readObject(preset.authors_note)

    if (note === null) {
        return (
            <div className="pei-form-stack">
                <section className="pei-card">
                    <h3 className="pei-card-title">作者注释</h3>
                    <FieldShapeNotice
                        label="作者注释 authors_note"
                        value={preset.authors_note}
                    />
                </section>
            </div>
        )
    }

    // Patching the whole node keeps the keys this form does not render.
    const patch = (partial: Record<string, unknown>) => {
        onChange('authors_note', { ...note, ...partial })
    }
    const updateGuardedField = (path: string, value: unknown) => {
        patch({ [path]: value })
    }

    return (
        <div className="pei-form-stack">
            <section className="pei-card">
                <h3 className="pei-card-title">作者注释</h3>
                <TemplateField
                    label="注释内容"
                    value={note.content}
                    path="content"
                    id="authors-note-content"
                    context="author-note"
                    minRows={5}
                    placeholder="注释的内容"
                    ariaLabel="作者注释内容"
                    disabled={disabled}
                    onChange={updateGuardedField}
                />
                <div className="pei-field-grid">
                    <NumberInputField
                        label="插入频率"
                        value={note.insertFrequency}
                        path="insertFrequency"
                        disabled={disabled}
                        onChange={updateGuardedField}
                    />
                    <NumberInputField
                        label="插入深度"
                        value={note.insertDepth}
                        path="insertDepth"
                        disabled={disabled}
                        onChange={updateGuardedField}
                    />
                    <SelectField
                        label="插入位置"
                        value={note.insertPosition}
                        path="insertPosition"
                        options={INSERT_POSITION_OPTIONS}
                        emptyLabel="默认"
                        disabled={disabled}
                        onChange={updateGuardedField}
                    />
                </div>
            </section>
        </div>
    )
}
