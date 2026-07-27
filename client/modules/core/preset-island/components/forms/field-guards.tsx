import { numOrUndef } from '../../lib/form-utils'
import type { TemplateEditorContext } from '../../lib/prompt-template'
import { CommaListInput } from '../comma-list-input'
import { TemplateEditor } from '../template-editor'
import {
    readBoolean,
    readNumber,
    readOneOf,
    readText,
    readTextList,
    shapePreview
} from '../../lib/field-guard-logic'

export {
    readBoolean,
    readList,
    readNumber,
    readObject,
    readOneOf,
    readScalarText,
    readText,
    readTextList,
    readTextOrTextList,
    shapePreview
} from '../../lib/field-guard-logic'

/**
 * Parsing no longer trims a value to fit the type it is declared with, so a key
 * typed `string` may hold any YAML shape at runtime. Every field reads its value
 * through one of the readers below and renders this notice instead of a control
 * when the shape is not editable.
 *
 * The branch is read-only on purpose: putting the value in a control would write
 * the form's own interpretation of it back to the file on the next keystroke, and
 * no interpretation of an object survives that round trip.
 */
export const SHAPE_NOTICE_TEXT =
    '该字段的内容不是表单可编辑的结构，请切换到 YAML 页签编辑'

export interface FieldShapeNoticeProps {
    /** The label the editable control would have carried. */
    label: string
    value: unknown
    className?: string
}

export function FieldShapeNotice({
    label,
    value,
    className
}: FieldShapeNoticeProps) {
    return (
        <div className={className ? `pei-field ${className}` : 'pei-field'}>
            <span>{label}</span>
            <div className="pei-alert">
                {SHAPE_NOTICE_TEXT}
                <code>{shapePreview(value)}</code>
            </div>
        </div>
    )
}

interface GuardedFieldProps {
    label: string
    /** The raw value straight off the parsed preset, guards not yet applied. */
    value: unknown
    /** Patch path handed to the workspace, e.g. `config.postHandler.prefix`. */
    path: string
    placeholder?: string
    className?: string
    disabled: boolean
    onChange: (path: string, value: unknown) => void
}

export type NumberInputFieldProps = GuardedFieldProps

export function NumberInputField({
    label,
    value,
    path,
    disabled,
    onChange,
    className
}: NumberInputFieldProps) {
    const number = readNumber(value)
    if (number === null) {
        return (
            <FieldShapeNotice
                label={label}
                value={value}
                className={className}
            />
        )
    }

    return (
        <label className={className ? `pei-field ${className}` : 'pei-field'}>
            <span>{label}</span>
            <input
                className="pei-input"
                type="number"
                value={number}
                disabled={disabled}
                onChange={(event) =>
                    onChange(path, numOrUndef(event.target.value))
                }
            />
        </label>
    )
}

export interface SelectOption<T extends string> {
    value: T
    label: string
}

export interface SelectFieldProps<T extends string> extends Omit<
    GuardedFieldProps,
    'placeholder'
> {
    options: readonly SelectOption<T>[]
    emptyLabel?: string
    emptyOptionDisabled?: boolean
}

export function SelectField<T extends string>({
    label,
    value,
    path,
    disabled,
    onChange,
    className,
    options,
    emptyLabel = '未设置',
    emptyOptionDisabled = false
}: SelectFieldProps<T>) {
    const selected = readOneOf(
        value,
        options.map((option) => option.value)
    )
    if (selected === null) {
        return (
            <FieldShapeNotice
                label={label}
                value={value}
                className={className}
            />
        )
    }

    return (
        <label className={className ? `pei-field ${className}` : 'pei-field'}>
            <span>{label}</span>
            <select
                className="pei-select"
                value={selected}
                disabled={disabled}
                onChange={(event) =>
                    onChange(path, event.target.value || undefined)
                }
            >
                <option value="" disabled={emptyOptionDisabled}>
                    {emptyLabel}
                </option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    )
}

export type CheckboxFieldProps = Omit<GuardedFieldProps, 'placeholder'>

export function CheckboxField({
    label,
    value,
    path,
    disabled,
    onChange,
    className = 'pei-field-inline'
}: CheckboxFieldProps) {
    const checked = readBoolean(value)
    if (checked === null) {
        return (
            <FieldShapeNotice
                label={label}
                value={value}
                className={className}
            />
        )
    }

    return (
        <label className={`pei-field ${className}`}>
            <span>{label}</span>
            <input
                type="checkbox"
                checked={checked === true}
                disabled={disabled}
                onChange={(event) => onChange(path, event.target.checked)}
            />
        </label>
    )
}

export interface TextInputFieldProps extends GuardedFieldProps {
    /** Defaults to `readText`; pass `readScalarText` where YAML may hold a number. */
    read?: (value: unknown) => string | null
}

export function TextInputField({
    label,
    value,
    path,
    placeholder,
    disabled,
    onChange,
    read = readText
}: TextInputFieldProps) {
    const text = read(value)
    if (text === null) return <FieldShapeNotice label={label} value={value} />

    return (
        <label className="pei-field">
            <span>{label}</span>
            <input
                className="pei-input"
                value={text}
                placeholder={placeholder}
                disabled={disabled}
                onChange={(e) => onChange(path, e.target.value)}
            />
        </label>
    )
}

export interface ListInputFieldProps extends GuardedFieldProps {
    /** Defaults to `readTextList`; pass `readTextOrTextList` for the string-or-list keys. */
    read?: (value: unknown) => string[] | null
}

export function ListInputField({
    label,
    value,
    path,
    placeholder,
    disabled,
    onChange,
    read = readTextList
}: ListInputFieldProps) {
    const list = read(value)
    if (list === null) return <FieldShapeNotice label={label} value={value} />

    return (
        <label className="pei-field">
            <span>{label}</span>
            <CommaListInput
                className="pei-input"
                value={list}
                placeholder={placeholder}
                disabled={disabled}
                onChange={(next) => onChange(path, next)}
            />
        </label>
    )
}

export interface TemplateFieldProps extends GuardedFieldProps {
    /** DOM id of the editor, kept stable for the `<label>` association. */
    id: string
    context: TemplateEditorContext
    minRows: number
    maxRows?: number
    /** Defaults to `label`. */
    ariaLabel?: string
}

export function TemplateField({
    label,
    value,
    path,
    placeholder,
    disabled,
    onChange,
    id,
    context,
    minRows,
    maxRows,
    ariaLabel
}: TemplateFieldProps) {
    const text = readText(value)
    if (text === null) return <FieldShapeNotice label={label} value={value} />

    return (
        <label className="pei-field">
            <span>{label}</span>
            <TemplateEditor
                id={id}
                context={context}
                minRows={minRows}
                maxRows={maxRows}
                placeholder={placeholder}
                ariaLabel={ariaLabel ?? label}
                readOnly={disabled}
                value={text}
                onChange={(next) => onChange(path, next)}
            />
        </label>
    )
}
