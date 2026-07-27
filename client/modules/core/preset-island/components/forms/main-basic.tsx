import type { RawPreset } from '../../lib/preset-types'
import {
    CheckboxField,
    FieldShapeNotice,
    ListInputField,
    readObject,
    readScalarText,
    readTextOrTextList,
    TemplateField,
    TextInputField
} from './field-guards'

export interface MainBasicFormProps {
    preset: RawPreset
    onChange: (path: string, value: unknown) => void
    disabled?: boolean
}

interface SectionProps {
    /** The raw `config` / `knowledge` node, guards not yet applied. */
    node: unknown
    disabled: boolean
    onChange: (path: string, value: unknown) => void
}

const CONFIG_LABEL = '配置节点 config'

const MEMORY_PROMPTS: { key: string; id: string; label: string }[] = [
    {
        key: 'longMemoryPrompt',
        id: 'long_memory_prompt',
        label: '长期记忆检索 Prompt'
    },
    {
        key: 'longMemoryNewQuestionPrompt',
        id: 'long_memory_new_question_prompt',
        label: '长期记忆新问题 Prompt'
    },
    {
        key: 'longMemoryExtractPrompt',
        id: 'long_term_memory_extraction_prompt',
        label: '长期记忆提取 Prompt'
    }
]

export function MainBasicForm({
    preset,
    onChange,
    disabled = false
}: MainBasicFormProps) {
    return (
        <div className="pei-form-stack">
            <section className="pei-card">
                <h3 className="pei-card-title">基本信息</h3>
                <div className="pei-field-grid">
                    <ListInputField
                        label="关键词（逗号分隔）"
                        value={preset.keywords}
                        path="keywords"
                        placeholder="预设关键词"
                        disabled={disabled}
                        onChange={onChange}
                    />
                    <TextInputField
                        label="版本号（可选）"
                        value={preset.version}
                        path="version"
                        placeholder="版本号"
                        read={readScalarText}
                        disabled={disabled}
                        onChange={onChange}
                    />
                </div>
                <TemplateField
                    label="用户格式化输入"
                    value={preset.format_user_prompt}
                    path="format_user_prompt"
                    id="format-user-prompt"
                    context="format-user"
                    minRows={5}
                    placeholder="用户的格式化输入"
                    disabled={disabled}
                    onChange={onChange}
                />
            </section>

            <PostHandlerSection
                node={preset.config}
                disabled={disabled}
                onChange={onChange}
            />
            <KnowledgeSection
                node={preset.knowledge}
                disabled={disabled}
                onChange={onChange}
            />
            <MemoryPromptsSection
                node={preset.config}
                disabled={disabled}
                onChange={onChange}
            />
        </div>
    )
}

function PostHandlerSection({ node, disabled, onChange }: SectionProps) {
    const config = readObject(node)
    const postHandler = config === null ? null : readObject(config.postHandler)

    return (
        <section className="pei-card">
            <h3 className="pei-card-title">后处理器（Post Handler）</h3>
            {config === null ? (
                <FieldShapeNotice label={CONFIG_LABEL} value={node} />
            ) : postHandler === null ? (
                <FieldShapeNotice
                    label="后处理器 postHandler"
                    value={config.postHandler}
                />
            ) : (
                <div className="pei-field-grid">
                    <TextInputField
                        label="前缀 prefix"
                        value={postHandler.prefix}
                        path="config.postHandler.prefix"
                        disabled={disabled}
                        onChange={onChange}
                    />
                    <TextInputField
                        label="后缀 postfix"
                        value={postHandler.postfix}
                        path="config.postHandler.postfix"
                        disabled={disabled}
                        onChange={onChange}
                    />
                    <CheckboxField
                        label="启用 Censor 审核"
                        value={postHandler.censor}
                        path="config.postHandler.censor"
                        disabled={disabled}
                        onChange={onChange}
                    />
                </div>
            )}
        </section>
    )
}

function KnowledgeSection({ node, disabled, onChange }: SectionProps) {
    const knowledge = readObject(node)

    return (
        <section className="pei-card">
            <h3 className="pei-card-title">知识库</h3>
            {knowledge === null ? (
                <FieldShapeNotice label="知识库 knowledge" value={node} />
            ) : (
                <>
                    <ListInputField
                        label="知识库列表（逗号分隔）"
                        value={knowledge.knowledge}
                        path="knowledge.knowledge"
                        read={readTextOrTextList}
                        disabled={disabled}
                        onChange={onChange}
                    />
                    <TemplateField
                        label="知识库检索预设"
                        value={knowledge.prompt}
                        path="knowledge.prompt"
                        id="knowledge-prompt"
                        context="knowledge"
                        minRows={5}
                        placeholder="知识库的预设"
                        disabled={disabled}
                        onChange={onChange}
                    />
                </>
            )}
        </section>
    )
}

function MemoryPromptsSection({ node, disabled, onChange }: SectionProps) {
    const config = readObject(node)

    if (config === null) {
        return (
            <section className="pei-card">
                <h3 className="pei-card-title">其他配置</h3>
                <FieldShapeNotice label={CONFIG_LABEL} value={node} />
            </section>
        )
    }

    return (
        <section className="pei-card">
            <h3 className="pei-card-title">其他配置</h3>
            <div className="pei-field-grid">
                {MEMORY_PROMPTS.map((prompt) => (
                    <TemplateField
                        key={prompt.key}
                        label={prompt.label}
                        value={config[prompt.key]}
                        path={`config.${prompt.key}`}
                        id={prompt.id}
                        context="memory"
                        minRows={4}
                        disabled={disabled}
                        onChange={onChange}
                    />
                ))}
            </div>
            <TemplateField
                label="世界书检索 Prompt"
                value={config.loreBooksPrompt}
                path="config.loreBooksPrompt"
                id="lore_books_prompt"
                context="memory"
                minRows={4}
                placeholder="世界书检索 Prompt"
                disabled={disabled}
                onChange={onChange}
            />
        </section>
    )
}
