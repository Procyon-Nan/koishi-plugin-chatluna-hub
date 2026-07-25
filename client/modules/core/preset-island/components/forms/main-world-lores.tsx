import { numOrUndef } from '../../lib/form-utils'
import {
    keywordList,
    type RawPreset,
    type RawWorldLore,
    type WorldLoreInsertPosition
} from '../../lib/preset-types'
import { TemplateEditor } from '../template-editor'

export interface MainWorldLoresFormProps {
    preset: RawPreset
    onChange: (path: string, value: unknown) => void
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
    onChange
}: MainWorldLoresFormProps) {
    const lores = preset.world_lores ?? []

    const updateLore = (index: number, patch: Partial<RawWorldLore>) => {
        const next = lores.map((item, i) =>
            i === index ? { ...item, ...patch } : item
        )
        onChange('world_lores', next)
    }

    const updateKeywords = (index: number, keywords: string[]) => {
        updateLore(index, { keywords })
    }

    const addLore = () => {
        onChange('world_lores', [
            ...lores,
            { keywords: [''], content: '' } satisfies RawWorldLore
        ])
    }

    const removeLore = (index: number) => {
        const next = [...lores]
        next.splice(index, 1)
        onChange('world_lores', next)
    }

    return (
        <div className="pei-form-stack">
            <section className="pei-card">
                <div className="pei-card-header">
                    <h3 className="pei-card-title">世界书列表</h3>
                    <button type="button" className="pei-btn" onClick={addLore}>
                        添加条目
                    </button>
                </div>

                {lores.length === 0 ? (
                    <div className="pei-empty pei-empty-sm">暂无世界书条目</div>
                ) : (
                    lores.map((lore, index) => {
                        const keywords = keywordList(lore.keywords)
                        const title = keywords[0] || '未命名条目'

                        return (
                            <div key={index} className="pei-lore-card">
                                <div className="pei-card-header">
                                    <h4 className="pei-card-subtitle">{title}</h4>
                                    <button
                                        type="button"
                                        className="pei-btn pei-btn-danger"
                                        onClick={() => removeLore(index)}
                                    >
                                        删除
                                    </button>
                                </div>

                                <div className="pei-field">
                                    <span>触发关键词</span>
                                    {keywords.map((kw, kidx) => (
                                        <div
                                            key={kidx}
                                            className="pei-keyword-row"
                                        >
                                            <input
                                                className="pei-input"
                                                aria-label={`世界书条目 ${index + 1} 触发关键词 ${kidx + 1}`}
                                                value={kw}
                                                onChange={(e) => {
                                                    const next = [...keywords]
                                                    next[kidx] = e.target.value
                                                    updateKeywords(index, next)
                                                }}
                                            />
                                            <button
                                                type="button"
                                                className="pei-btn pei-btn-icon"
                                                aria-label={`删除世界书条目 ${index + 1} 的关键词 ${kidx + 1}`}
                                                onClick={() => {
                                                    const next = [...keywords]
                                                    next.splice(kidx, 1)
                                                    updateKeywords(index, next)
                                                }}
                                            >
                                                删
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        className="pei-btn"
                                        aria-label={`为世界书条目 ${index + 1} 添加关键词`}
                                        onClick={() =>
                                            updateKeywords(index, [
                                                ...keywords,
                                                ''
                                            ])
                                        }
                                    >
                                        添加关键词
                                    </button>
                                </div>

                                <label className="pei-field">
                                    <span>条目内容</span>
                                    <TemplateEditor
                                        id={`world-lore-content-${index}`}
                                        context="world-lore"
                                        minRows={6}
                                        placeholder="输入内容"
                                        ariaLabel={`世界书条目 ${index + 1} 内容`}
                                        value={lore.content}
                                        onChange={(value) =>
                                            updateLore(index, {
                                                content: value
                                            })
                                        }
                                    />
                                </label>

                                <div className="pei-field-grid">
                                    <label className="pei-field">
                                        <span>Token 限制</span>
                                        <input
                                            className="pei-input"
                                            type="number"
                                            value={lore.tokenLimit ?? ''}
                                            onChange={(e) =>
                                                updateLore(index, {
                                                    tokenLimit: numOrUndef(
                                                        e.target.value
                                                    )
                                                })
                                            }
                                        />
                                    </label>
                                    <label className="pei-field">
                                        <span>扫描深度</span>
                                        <input
                                            className="pei-input"
                                            type="number"
                                            value={lore.scanDepth ?? ''}
                                            onChange={(e) =>
                                                updateLore(index, {
                                                    scanDepth: numOrUndef(
                                                        e.target.value
                                                    )
                                                })
                                            }
                                        />
                                    </label>
                                    <label className="pei-field">
                                        <span>最大递归深度</span>
                                        <input
                                            className="pei-input"
                                            type="number"
                                            value={lore.maxRecursionDepth ?? ''}
                                            onChange={(e) =>
                                                updateLore(index, {
                                                    maxRecursionDepth:
                                                        numOrUndef(
                                                            e.target.value
                                                        )
                                                })
                                            }
                                        />
                                    </label>
                                    <label className="pei-field">
                                        <span>插入位置</span>
                                        <select
                                            className="pei-select"
                                            value={lore.insertPosition ?? ''}
                                            onChange={(e) =>
                                                updateLore(index, {
                                                    insertPosition:
                                                        (e.target.value ||
                                                            undefined) as
                                                            | WorldLoreInsertPosition
                                                            | undefined
                                                })
                                            }
                                        >
                                            <option value="">默认</option>
                                            {INSERT_OPTIONS.map((opt) => (
                                                <option
                                                    key={opt.value}
                                                    value={opt.value}
                                                >
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="pei-field pei-field-inline">
                                        <span>递归扫描</span>
                                        <input
                                            type="checkbox"
                                            checked={!!lore.recursiveScan}
                                            onChange={(e) =>
                                                updateLore(index, {
                                                    recursiveScan:
                                                        e.target.checked
                                                })
                                            }
                                        />
                                    </label>
                                </div>
                            </div>
                        )
                    })
                )}
            </section>
        </div>
    )
}
