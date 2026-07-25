import {
    useEffect,
    useRef,
    useState,
    type InputHTMLAttributes
} from 'react'
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
                setText(splitCommaList(event.currentTarget.value).join(', '))
                onBlur?.(event)
            }}
        />
    )
}
