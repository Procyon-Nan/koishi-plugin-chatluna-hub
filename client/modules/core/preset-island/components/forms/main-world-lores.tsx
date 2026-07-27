import {
    isWorldLoreEntry,
    type RawPreset,
    type RawWorldLore,
    type RawWorldLoreEntry,
    type WorldLoreInsertPosition
} from '../../lib/preset-types'
import { TemplateEditor } from '../template-editor'
import {
    CheckboxField,
    FieldShapeNotice,
    NumberInputField,
    readList,
    readText,
    readTextOrTextList,
    SelectField,
    shapePreview
} from './field-guards'
import { useRowKeys } from './use-row-keys'

export interface MainWorldLoresFormProps {
    preset: RawPreset
    onChange: (path: string, value: unknown) => void
    disabled?: boolean
}

const INSERT_OPTIONS: { value: WorldLoreInsertPosition; label: string }[] = [
    { value: 'before_char_defs', label: '角色定义前' },
    { value: 'after_char_defs', label: '角色定义后' },
    { value: 'before_example_messages', label: '示例消息前' },
    { value: 'after_example_messages', label: '示例消息后' },
    { value: 'before_scenario', label: '场景前' },
    { value: 'after_scenario', label: '场景后' }
]

export function MainWorldLoresForm({
    preset,
    onChange,
    disabled = false
}: MainWorldLoresFormProps) {
    const lores = readList(preset.world_lores)
    const cardKeys = useRowKeys(lores?.length ?? 0)

    const updateLore = (index: number, patch: Record<string, unknown>) => {
        if (!lores) return
        const next = lores.map((item, i) =>
            i === index ? { ...item, ...patch } : item
        )
        onChange('world_lores', next)
    }

    const addLore = () => {
        if (!lores) return
        onChange('world_lores', [
            ...lores,
            { keywords: [''], content: '' } satisfies RawWorldLore
        ])
    }

    const removeLore = (index: number) => {
        if (!lores) return
        const next = [...lores]
        next.splice(index, 1)
        cardKeys.removeAt(index)
        onChange('world_lores', next)
    }

    return (
        <div className="pei-form-stack">
            <section className="pei-card">
                <div className="pei-card-header">
                    <h3 className="pei-card-title">世界书列表</h3>
                    <button
                        type="button"
                        className="pei-btn"
                        disabled={disabled || !lores}
                        onClick={addLore}
                    >
                        添加条目
                    </button>
                </div>

                {!lores ? (
                    <FieldShapeNotice
                        label="世界书 world_lores"
                        value={preset.world_lores}
                    />
                ) : lores.length === 0 ? (
                    <div className="pei-empty pei-empty-sm">暂无世界书条目</div>
                ) : (
                    lores.map((lore, index) =>
                        isWorldLoreEntry(lore) ? (
                            <WorldLoreCard
                                key={cardKeys.keys[index]}
                                lore={lore}
                                index={index}
                                disabled={disabled}
                                onPatch={(patch) => updateLore(index, patch)}
                                onRemove={() => removeLore(index)}
                            />
                        ) : (
                            <WorldLoreConfigCard
                                key={cardKeys.keys[index]}
                                index={index}
                                value={lore}
                            />
                        )
                    )
                )}
            </section>
        </div>
    )
}

interface WorldLoreCardProps {
    lore: RawWorldLoreEntry
    index: number
    disabled: boolean
    onPatch: (patch: Record<string, unknown>) => void
    onRemove: () => void
}

/**
 * One lore entry. Split out so that each card holds its own keyword row keys:
 * React then discards exactly the removed card's keys along with the card, which
 * a single flat key list in the parent could not express.
 */
function WorldLoreCard({
    lore,
    index,
    disabled,
    onPatch,
    onRemove
}: WorldLoreCardProps) {
    const keywords = readTextOrTextList(lore.keywords)
    const keywordKeys = useRowKeys(keywords?.length ?? 0)
    const title = keywords?.[0] || '未命名条目'
    // `isWorldLoreEntry` only asserts that the key is present, so the content may
    // still be any shape — and a non-string would reach CodeMirror's document.
    const content = readText(lore.content)
    const updateGuardedField = (path: string, value: unknown) => {
        onPatch({ [path]: value })
    }

    const updateKeywords = (next: string[]) => {
        if (!keywords) return
        onPatch({ keywords: next })
    }

    const removeKeyword = (position: number) => {
        if (!keywords) return
        const next = [...keywords]
        next.splice(position, 1)
        keywordKeys.removeAt(position)
        updateKeywords(next)
    }

    return (
        <div className="pei-lore-card">
            <div className="pei-card-header">
                <h4 className="pei-card-subtitle">{title}</h4>
                <button
                    type="button"
                    className="pei-btn pei-btn-danger"
                    disabled={disabled}
                    onClick={onRemove}
                >
                    删除
                </button>
            </div>

            {keywords === null ? (
                <FieldShapeNotice label="触发关键词" value={lore.keywords} />
            ) : (
                <div className="pei-field">
                    <span>触发关键词</span>
                    {keywords.map((keyword, position) => (
                        <div
                            key={keywordKeys.keys[position]}
                            className="pei-keyword-row"
                        >
                            <input
                                className="pei-input"
                                aria-label={`世界书条目 ${index + 1} 触发关键词 ${position + 1}`}
                                value={keyword}
                                disabled={disabled}
                                onChange={(event) => {
                                    const next = [...keywords]
                                    next[position] = event.target.value
                                    updateKeywords(next)
                                }}
                            />
                            <button
                                type="button"
                                className="pei-btn pei-btn-icon"
                                aria-label={`删除世界书条目 ${index + 1} 的关键词 ${position + 1}`}
                                disabled={disabled}
                                onClick={() => removeKeyword(position)}
                            >
                                删
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        className="pei-btn"
                        aria-label={`为世界书条目 ${index + 1} 添加关键词`}
                        disabled={disabled}
                        onClick={() => updateKeywords([...keywords, ''])}
                    >
                        添加关键词
                    </button>
                </div>
            )}

            {content === null ? (
                <FieldShapeNotice label="条目内容" value={lore.content} />
            ) : (
                <label className="pei-field">
                    <span>条目内容</span>
                    <TemplateEditor
                        id={`world-lore-content-${index}`}
                        context="world-lore"
                        minRows={6}
                        placeholder="输入内容"
                        ariaLabel={`世界书条目 ${index + 1} 内容`}
                        readOnly={disabled}
                        value={content}
                        onChange={(value) => onPatch({ content: value })}
                    />
                </label>
            )}

            <div className="pei-field-grid">
                <NumberInputField
                    label="Token 限制"
                    value={lore.tokenLimit}
                    path="tokenLimit"
                    disabled={disabled}
                    onChange={updateGuardedField}
                />
                <NumberInputField
                    label="扫描深度"
                    value={lore.scanDepth}
                    path="scanDepth"
                    disabled={disabled}
                    onChange={updateGuardedField}
                />
                <NumberInputField
                    label="最大递归深度"
                    value={lore.maxRecursionDepth}
                    path="maxRecursionDepth"
                    disabled={disabled}
                    onChange={updateGuardedField}
                />
                <SelectField
                    label="插入位置"
                    value={lore.insertPosition}
                    path="insertPosition"
                    options={INSERT_OPTIONS}
                    emptyLabel="默认"
                    disabled={disabled}
                    onChange={updateGuardedField}
                />
                <CheckboxField
                    label="递归扫描"
                    value={lore.recursiveScan}
                    path="recursiveScan"
                    disabled={disabled}
                    onChange={updateGuardedField}
                />
            </div>
        </div>
    )
}

interface WorldLoreConfigCardProps {
    index: number
    value: unknown
}

/**
 * A `world_lores` element without `keywords` / `content` is ChatLuna's global lore
 * config, not an entry. It is read-only here: rendering the entry form for it
 * would write those two keys on the first edit and silently reclassify the
 * element as an entry.
 */
function WorldLoreConfigCard({ index, value }: WorldLoreConfigCardProps) {
    return (
        <div className="pei-lore-card">
            <div className="pei-card-header">
                <h4 className="pei-card-subtitle">
                    第 {index + 1} 项：世界书全局配置
                </h4>
            </div>
            <div className="pei-alert">
                该元素没有 keywords /
                content，是世界书的全局配置项，表单不提供编辑，请切换到 YAML
                页签修改。
                <code>{shapePreview(value)}</code>
            </div>
        </div>
    )
}
