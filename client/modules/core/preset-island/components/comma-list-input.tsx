import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import { splitCommaList } from '../lib/form-utils'

export interface CommaListInputProps extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange'
> {
    value: readonly string[]
    onChange: (value: string[]) => void
}

export function CommaListInput({
    value,
    onChange,
    onBlur,
    onFocus,
    ...props
}: CommaListInputProps) {
    const formattedValue = value.join(', ')
    const [text, setText] = useState(formattedValue)
    const focusedRef = useRef(false)

    // Rewriting the box while it has focus would fight the caret, so an external
    // value that lands mid-edit is deferred to blur instead of applied here.
    useEffect(() => {
        if (!focusedRef.current) setText(formattedValue)
    }, [formattedValue])

    return (
        <input
            {...props}
            value={text}
            onFocus={(event) => {
                focusedRef.current = true
                onFocus?.(event)
            }}
            onChange={(event) => {
                const nextText = event.target.value
                setText(nextText)
                onChange(splitCommaList(nextText))
            }}
            onBlur={(event) => {
                focusedRef.current = false
                // Resync from the value, not from the box: every keystroke was
                // already pushed upstream, so `formattedValue` holds the user's
                // own text — plus anything that arrived while they were typing,
                // which the effect above skipped and which would otherwise stay
                // invisible until the next unrelated change.
                setText(formattedValue)
                onBlur?.(event)
            }}
        />
    )
}
