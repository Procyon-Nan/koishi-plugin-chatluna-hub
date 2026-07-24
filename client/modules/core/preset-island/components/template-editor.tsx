import { useEffect, useRef } from 'react'
import { basicSetup } from 'codemirror'
import {
    autocompletion,
    snippetCompletion,
    type Completion,
    type CompletionContext
} from '@codemirror/autocomplete'
import { linter, type Diagnostic } from '@codemirror/lint'
import { Compartment, EditorState } from '@codemirror/state'
import {
    Decoration,
    type DecorationSet,
    EditorView,
    placeholder as codeMirrorPlaceholder,
    ViewPlugin,
    type ViewUpdate
} from '@codemirror/view'
import {
    analyzeTemplate,
    escapeTemplateBraces,
    getTemplateDefinitions,
    type TemplateEditorContext
} from '../lib/prompt-template'

export interface TemplateEditorProps {
    id?: string
    value?: string
    onChange?: (value: string) => void
    context?: TemplateEditorContext
    placeholder?: string
    minRows?: number
    maxRows?: number
    className?: string
    ariaLabel?: string
    readOnly?: boolean
}

const templateExtension = new Compartment()
const templateTheme = new Compartment()
const editorAttributes = new Compartment()
const placeholderExtension = new Compartment()
const readOnlyExtension = new Compartment()

export function TemplateEditor({
    id,
    value = '',
    onChange,
    context = 'generic',
    placeholder,
    minRows = 5,
    maxRows,
    className,
    ariaLabel = 'ChatLuna 模板内容',
    readOnly = false
}: TemplateEditorProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const editorRef = useRef<EditorView | null>(null)
    const valueRef = useRef(value)
    const onChangeRef = useRef(onChange)
    const readOnlyRef = useRef(readOnly)

    useEffect(() => {
        onChangeRef.current = onChange
    }, [onChange])

    useEffect(() => {
        if (!containerRef.current) return

        const state = EditorState.create({
            doc: valueRef.current,
            extensions: [
                basicSetup,
                EditorView.lineWrapping,
                editorAttributes.of([]),
                placeholderExtension.of([]),
                templateExtension.of([]),
                templateTheme.of([]),
                readOnlyExtension.of([
                    EditorState.readOnly.of(readOnlyRef.current),
                    EditorView.editable.of(!readOnlyRef.current)
                ]),
                EditorView.updateListener.of((update) => {
                    if (!update.docChanged) return
                    const nextValue = update.state.doc.toString()
                    if (nextValue === valueRef.current) return
                    valueRef.current = nextValue
                    onChangeRef.current?.(nextValue)
                })
            ]
        })

        const view = new EditorView({ state, parent: containerRef.current })
        editorRef.current = view

        return () => {
            view.destroy()
            editorRef.current = null
        }
    }, [])

    useEffect(() => {
        const view = editorRef.current
        if (!view) return
        view.dispatch({
            effects: editorAttributes.reconfigure(
                EditorView.contentAttributes.of({
                    'aria-label': ariaLabel,
                    ...(id ? { id } : {})
                })
            )
        })
    }, [ariaLabel, id])

    useEffect(() => {
        const view = editorRef.current
        if (!view) return
        view.dispatch({
            effects: placeholderExtension.reconfigure(
                placeholder ? codeMirrorPlaceholder(placeholder) : []
            )
        })
    }, [placeholder])

    useEffect(() => {
        const view = editorRef.current
        if (!view) return
        readOnlyRef.current = readOnly
        view.dispatch({
            effects: readOnlyExtension.reconfigure([
                EditorState.readOnly.of(readOnly),
                EditorView.editable.of(!readOnly)
            ])
        })
    }, [readOnly])

    useEffect(() => {
        const view = editorRef.current
        if (!view) return
        view.dispatch({
            effects: templateExtension.reconfigure(
                createTemplateExtensions(context, readOnly)
            )
        })
    }, [context, readOnly])

    useEffect(() => {
        const view = editorRef.current
        if (!view) return
        view.dispatch({
            effects: templateTheme.reconfigure(
                createEditorTheme(minRows, maxRows)
            )
        })
    }, [maxRows, minRows])

    useEffect(() => {
        const view = editorRef.current
        if (!view || value === valueRef.current) return

        valueRef.current = value
        view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: value }
        })
    }, [value])

    const escapeSelection = () => {
        const view = editorRef.current
        if (!view) return

        const selection = view.state.selection.main
        if (selection.empty) {
            view.dispatch({
                changes: { from: selection.from, insert: '{{}}' },
                selection: { anchor: selection.from + 2 }
            })
        } else {
            const selectedText = view.state.sliceDoc(selection.from, selection.to)
            const escaped = escapeTemplateBraces(selectedText)
            view.dispatch({
                changes: {
                    from: selection.from,
                    to: selection.to,
                    insert: escaped
                },
                selection: { anchor: selection.from + escaped.length }
            })
        }
        view.focus()
    }

    return (
        <div className={className ? `pei-template-editor ${className}` : 'pei-template-editor'}>
            <div className="pei-template-editor-frame">
                <div ref={containerRef} className="pei-cm-host" />
                {!readOnly ? (
                    <button
                        type="button"
                        className="pei-template-escape"
                        onClick={escapeSelection}
                        title="转义选区中的花括号；未选择文本时插入普通花括号"
                        aria-label="转义花括号"
                    >
                        {'{}'}
                    </button>
                ) : null}
            </div>
        </div>
    )
}

function createTemplateExtensions(
    context: TemplateEditorContext,
    readOnly: boolean
) {
    const decorations = createDecorationPlugin(context)
    if (readOnly) return [decorations]

    return [
        decorations,
        autocompletion({
            override: [
                (completionContext) =>
                    getCompletions(completionContext, context)
            ],
            activateOnTyping: true
        }),
        linter((view) => createDiagnostics(view.state.doc.toString(), context), {
            delay: 200
        })
    ]
}

function createDecorationPlugin(context: TemplateEditorContext) {
    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet

            constructor(view: EditorView) {
                this.decorations = buildDecorations(
                    view.state.doc.toString(),
                    context
                )
            }

            update(update: ViewUpdate) {
                if (update.docChanged) {
                    this.decorations = buildDecorations(
                        update.state.doc.toString(),
                        context
                    )
                }
            }
        },
        { decorations: (plugin) => plugin.decorations }
    )
}

function buildDecorations(source: string, context: TemplateEditorContext) {
    const decorations = analyzeTemplate(source, context).map((range) =>
        Decoration.mark({ class: `cm-template-${range.kind}` }).range(
            range.from,
            range.to
        )
    )
    return Decoration.set(decorations, true)
}

function createDiagnostics(source: string, context: TemplateEditorContext) {
    return analyzeTemplate(source, context)
        .filter((range) => range.message)
        .map((range): Diagnostic => {
            const diagnostic: Diagnostic = {
                from: range.from,
                to: range.to,
                severity: range.kind === 'error' ? 'error' : 'warning',
                message: range.message!
            }

            if (range.kind === 'unknown') {
                diagnostic.actions = [
                    {
                        name: '作为普通文本',
                        apply(view, from, to) {
                            const raw = view.state.sliceDoc(from, to)
                            view.dispatch({
                                changes: {
                                    from,
                                    to,
                                    insert: escapeTemplateBraces(raw)
                                }
                            })
                        }
                    }
                ]
            }

            return diagnostic
        })
}

function getCompletions(
    context: CompletionContext,
    editorContext: TemplateEditorContext
) {
    const match = context.matchBefore(/\{[A-Za-z_$]*$/)
    if (!match) return null

    const from = match.from + 1
    const options: Completion[] = getTemplateDefinitions(editorContext).map(
        (definition) => {
            const completion = {
                label: definition.label,
                detail: definition.detail,
                type: definition.type
            }

            if (definition.snippet) {
                const snippet = snippetCompletion(definition.snippet, completion)
                const applySnippet = snippet.apply
                return {
                    ...snippet,
                    apply(view, selectedCompletion, applyFrom, applyTo) {
                        const replaceTo = consumeClosingBrace(view, applyTo)
                        if (typeof applySnippet === 'function') {
                            applySnippet(
                                view,
                                selectedCompletion,
                                applyFrom,
                                replaceTo
                            )
                        }
                    }
                }
            }

            return {
                ...completion,
                apply(view, _completion, applyFrom, applyTo) {
                    view.dispatch({
                        changes: {
                            from: applyFrom,
                            to: consumeClosingBrace(view, applyTo),
                            insert: `${definition.label}}`
                        }
                    })
                }
            }
        }
    )

    options.unshift({
        label: '普通花括号',
        detail: '插入不会触发模板渲染的 {{ ... }}',
        type: 'text',
        boost: 100,
        apply(view, _completion, applyFrom, applyTo) {
            view.dispatch({
                changes: {
                    from: applyFrom - 1,
                    to: consumeClosingBrace(view, applyTo),
                    insert: '{{}}'
                },
                selection: { anchor: applyFrom + 1 }
            })
        }
    })

    return { from, options, validFor: /^[A-Za-z_$]*$/ }
}

function consumeClosingBrace(view: EditorView, position: number) {
    return view.state.sliceDoc(position, position + 1) === '}'
        ? position + 1
        : position
}

function createEditorTheme(minRows: number, maxRows?: number) {
    return EditorView.theme({
        '&': {
            border: '1px solid var(--pei-border, #e5e7eb)',
            borderRadius: '8px',
            backgroundColor: 'transparent',
            fontSize: '13px',
            overflow: 'hidden'
        },
        '&.cm-focused': {
            outline: '1px solid var(--pei-primary, #409eff)',
            borderColor: 'var(--pei-primary, #409eff)'
        },
        '.cm-scroller': {
            minHeight: `${Math.max(minRows, 3) * 1.5}rem`,
            maxHeight: maxRows
                ? `${Math.max(maxRows, minRows, 3) * 1.5}rem`
                : '32rem',
            fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            lineHeight: '1.5rem'
        },
        '.cm-content': {
            padding: '0.65rem 2.75rem 0.65rem 0.75rem',
            caretColor: 'var(--pei-text, #1f2329)'
        },
        '.cm-line': { padding: '0' },
        '.cm-gutters': { display: 'none' },
        '.cm-cursor, .cm-dropCursor': {
            borderLeftColor: 'var(--pei-text, #1f2329)'
        },
        '.cm-selectionBackground, ::selection': {
            backgroundColor:
                'color-mix(in srgb, var(--pei-primary, #409eff) 16%, transparent) !important'
        },
        '.cm-placeholder': {
            color: 'var(--pei-muted, #8a919f)'
        },
        '.cm-tooltip': {
            border: '1px solid var(--pei-border, #e5e7eb)',
            borderRadius: '8px',
            backgroundColor: 'var(--pei-card, #fff)',
            color: 'var(--pei-text, #1f2329)',
            overflow: 'hidden'
        },
        '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
            backgroundColor:
                'color-mix(in srgb, var(--pei-primary, #409eff) 12%, transparent)'
        },
        '.cm-template-expression': {
            color: '#0369a1',
            backgroundColor: 'rgb(14 165 233 / 0.1)',
            borderRadius: '0.25rem'
        },
        '.cm-template-control': {
            color: '#6d28d9',
            backgroundColor: 'rgb(139 92 246 / 0.1)',
            borderRadius: '0.25rem'
        },
        '.cm-template-escaped': {
            color: '#15803d',
            fontWeight: '600'
        },
        '.cm-template-unknown': {
            color: '#a16207',
            textDecoration: 'underline wavy',
            textDecorationColor: '#ca8a04',
            textUnderlineOffset: '3px'
        },
        '.cm-template-error': {
            textDecoration: 'underline dotted',
            textDecorationColor: 'var(--pei-muted, #8a919f)',
            textUnderlineOffset: '3px'
        }
    })
}
