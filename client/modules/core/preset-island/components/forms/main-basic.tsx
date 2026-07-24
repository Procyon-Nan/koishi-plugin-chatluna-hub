import { splitCommaList } from '../../lib/form-utils'
import type { RawPreset } from '../../lib/preset-types'
import { TemplateEditor } from '../template-editor'

export interface MainBasicFormProps {
    preset: RawPreset
    onChange: (path: string, value: unknown) => void
}

export function MainBasicForm({ preset, onChange }: MainBasicFormProps) {
    return (
        <div className="pei-form-stack">
            <section className="pei-card">
                <h3 className="pei-card-title">基本信息</h3>
                <div className="pei-field-grid">
                    <label className="pei-field">
                        <span>关键词（逗号分隔）</span>
                        <input
                            className="pei-input"
                            value={preset.keywords.join(', ')}
                            placeholder="预设关键词"
                            onChange={(e) =>
                                onChange(
                                    'keywords',
                                    splitCommaList(e.target.value)
                                )
                            }
                        />
                    </label>
                    <label className="pei-field">
                        <span>版本号（可选）</span>
                        <input
                            className="pei-input"
                            value={preset.version ?? ''}
                            placeholder="版本号"
                            onChange={(e) => onChange('version', e.target.value)}
                        />
                    </label>
                </div>
                <label className="pei-field">
                    <span>用户格式化输入</span>
                    <TemplateEditor
                        id="format-user-prompt"
                        context="format-user"
                        minRows={5}
                        placeholder="用户的格式化输入"
                        ariaLabel="用户格式化输入"
                        value={preset.format_user_prompt ?? ''}
                        onChange={(value) =>
                            onChange('format_user_prompt', value)
                        }
                    />
                </label>
            </section>

            <section className="pei-card">
                <h3 className="pei-card-title">后处理器（Post Handler）</h3>
                <div className="pei-field-grid">
                    <label className="pei-field">
                        <span>前缀 prefix</span>
                        <input
                            className="pei-input"
                            value={preset.config?.postHandler?.prefix ?? ''}
                            onChange={(e) =>
                                onChange(
                                    'config.postHandler.prefix',
                                    e.target.value
                                )
                            }
                        />
                    </label>
                    <label className="pei-field">
                        <span>后缀 postfix</span>
                        <input
                            className="pei-input"
                            value={preset.config?.postHandler?.postfix ?? ''}
                            onChange={(e) =>
                                onChange(
                                    'config.postHandler.postfix',
                                    e.target.value
                                )
                            }
                        />
                    </label>
                    <label className="pei-field pei-field-inline">
                        <span>启用 Censor 审核</span>
                        <input
                            type="checkbox"
                            checked={!!preset.config?.postHandler?.censor}
                            onChange={(e) =>
                                onChange(
                                    'config.postHandler.censor',
                                    e.target.checked
                                )
                            }
                        />
                    </label>
                </div>
            </section>

            <section className="pei-card">
                <h3 className="pei-card-title">知识库</h3>
                <label className="pei-field">
                    <span>知识库列表（逗号分隔）</span>
                    <input
                        className="pei-input"
                        value={knowledgeText(preset.knowledge?.knowledge)}
                        onChange={(e) =>
                            onChange(
                                'knowledge.knowledge',
                                splitCommaList(e.target.value)
                            )
                        }
                    />
                </label>
                <label className="pei-field">
                    <span>知识库检索预设</span>
                    <TemplateEditor
                        id="knowledge-prompt"
                        context="knowledge"
                        minRows={5}
                        placeholder="知识库的预设"
                        ariaLabel="知识库检索预设"
                        value={preset.knowledge?.prompt ?? ''}
                        onChange={(value) =>
                            onChange('knowledge.prompt', value)
                        }
                    />
                </label>
            </section>

            <section className="pei-card">
                <h3 className="pei-card-title">其他配置</h3>
                <div className="pei-field-grid">
                    <label className="pei-field">
                        <span>长期记忆检索 Prompt</span>
                        <TemplateEditor
                            id="long_memory_prompt"
                            context="memory"
                            minRows={4}
                            ariaLabel="长期记忆检索 Prompt"
                            value={preset.config?.longMemoryPrompt ?? ''}
                            onChange={(value) =>
                                onChange('config.longMemoryPrompt', value)
                            }
                        />
                    </label>
                    <label className="pei-field">
                        <span>长期记忆新问题 Prompt</span>
                        <TemplateEditor
                            id="long_memory_new_question_prompt"
                            context="memory"
                            minRows={4}
                            ariaLabel="长期记忆新问题 Prompt"
                            value={
                                preset.config?.longMemoryNewQuestionPrompt ?? ''
                            }
                            onChange={(value) =>
                                onChange(
                                    'config.longMemoryNewQuestionPrompt',
                                    value
                                )
                            }
                        />
                    </label>
                    <label className="pei-field">
                        <span>长期记忆提取 Prompt</span>
                        <TemplateEditor
                            id="long_term_memory_extraction_prompt"
                            context="memory"
                            minRows={4}
                            ariaLabel="长期记忆提取 Prompt"
                            value={
                                preset.config?.longMemoryExtractPrompt ?? ''
                            }
                            onChange={(value) =>
                                onChange(
                                    'config.longMemoryExtractPrompt',
                                    value
                                )
                            }
                        />
                    </label>
                </div>
                <label className="pei-field">
                    <span>世界书检索 Prompt</span>
                    <TemplateEditor
                        id="lore_books_prompt"
                        context="memory"
                        minRows={4}
                        placeholder="世界书检索 Prompt"
                        ariaLabel="世界书检索 Prompt"
                        value={preset.config?.loreBooksPrompt ?? ''}
                        onChange={(value) =>
                            onChange('config.loreBooksPrompt', value)
                        }
                    />
                </label>
            </section>
        </div>
    )
}

const knowledgeText = (value: string | string[] | undefined): string => {
    if (value == null) return ''
    return Array.isArray(value) ? value.join(', ') : value
}
