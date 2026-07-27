import type { CharacterPresetTemplate, RawPreset } from '../lib/preset-types'
import type { PresetSource } from '../lib/types'
import { CharacterBasicForm } from './forms/character-basic'
import { CharacterInputForm } from './forms/character-input'
import { CharacterSystemForm } from './forms/character-system'
import { MainAuthorNoteForm } from './forms/main-author-note'
import { MainBasicForm } from './forms/main-basic'
import { MainMessagesForm } from './forms/main-messages'
import { MainWorldLoresForm } from './forms/main-world-lores'

export type EditorTabId =
    | 'basic'
    | 'messages'
    | 'world_lores'
    | 'author_note'
    | 'input'
    | 'system'
    | 'yaml'

const CORE_TABS: { id: EditorTabId; label: string }[] = [
    { id: 'basic', label: '基本配置' },
    { id: 'messages', label: '提示词' },
    { id: 'world_lores', label: '世界书' },
    { id: 'author_note', label: '作者注释' },
    { id: 'yaml', label: 'YAML' }
]

const CHARACTER_TABS: { id: EditorTabId; label: string }[] = [
    { id: 'basic', label: '基本配置' },
    { id: 'system', label: '系统提示词' },
    { id: 'input', label: '格式化输入' },
    { id: 'yaml', label: 'YAML' }
]

export const tabsForSource = (source: PresetSource) =>
    source === 'character' ? CHARACTER_TABS : CORE_TABS

export const defaultTabForSource = (source: PresetSource): EditorTabId =>
    tabsForSource(source)[0]?.id ?? 'basic'

export interface EditorTabsBarProps {
    source: PresetSource
    active: EditorTabId
    onChange: (tab: EditorTabId) => void
}

export function EditorTabsBar({
    source,
    active,
    onChange
}: EditorTabsBarProps) {
    const tabs = tabsForSource(source)

    return (
        <div className="pei-tabs" role="tablist">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    id={`pei-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={active === tab.id}
                    aria-controls={`pei-tabpanel-${tab.id}`}
                    className={active === tab.id ? 'pei-tab active' : 'pei-tab'}
                    onClick={() => onChange(tab.id)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    )
}

export interface EditorFormBodyProps {
    source: PresetSource
    tab: EditorTabId
    core: RawPreset | null
    character: CharacterPresetTemplate | null
    onChange: (path: string, value: unknown) => void
    rawText: string
    parseError: string
    onRawTextChange: (value: string) => void
    /**
     * Set while YAML parsing or a structured write-back failed. The workspace
     * refuses further patches until the YAML tab restores a safe state.
     */
    structuredEditingBlocked?: boolean
}

export function EditorFormBody({
    source,
    tab,
    core,
    character,
    onChange,
    rawText,
    parseError,
    onRawTextChange,
    structuredEditingBlocked = false
}: EditorFormBodyProps) {
    if (tab === 'yaml') {
        return (
            <div className="pei-yaml-pane">
                {parseError ? (
                    <div className="pei-alert pei-alert-error">
                        {parseError}
                    </div>
                ) : (
                    <div className="pei-status pei-status-ok">
                        高级
                        YAML：修改成功解析后会回写表单；解析失败保留上一份合法草稿
                    </div>
                )}
                <textarea
                    className="pei-textarea"
                    aria-label="YAML 预设内容"
                    value={rawText}
                    spellCheck={false}
                    onChange={(e) => onRawTextChange(e.target.value)}
                />
            </div>
        )
    }

    const form = renderForm({
        source,
        tab,
        core,
        character,
        onChange,
        disabled: structuredEditingBlocked
    })

    if (!form) {
        return (
            <div className="pei-empty">
                {parseError
                    ? `结构化草稿不可用：${parseError}`
                    : '当前 Tab 无可用表单'}
            </div>
        )
    }

    if (!structuredEditingBlocked) return form

    return (
        <>
            <div className="pei-alert pei-alert-error" role="status">
                结构化表单已锁定为只读，当前内容无法安全写回 YAML。 请切换到
                YAML 页签处理后继续编辑：{parseError}
            </div>
            {form}
        </>
    )
}

interface RenderFormOptions {
    source: PresetSource
    tab: EditorTabId
    core: RawPreset | null
    character: CharacterPresetTemplate | null
    onChange: (path: string, value: unknown) => void
    disabled: boolean
}

function renderForm({
    source,
    tab,
    core,
    character,
    onChange,
    disabled
}: RenderFormOptions) {
    if (source === 'core' && core) {
        if (tab === 'basic') {
            return (
                <MainBasicForm
                    preset={core}
                    onChange={onChange}
                    disabled={disabled}
                />
            )
        }
        if (tab === 'messages') {
            return (
                <MainMessagesForm
                    preset={core}
                    onChange={onChange}
                    disabled={disabled}
                />
            )
        }
        if (tab === 'world_lores') {
            return (
                <MainWorldLoresForm
                    preset={core}
                    onChange={onChange}
                    disabled={disabled}
                />
            )
        }
        if (tab === 'author_note') {
            return (
                <MainAuthorNoteForm
                    preset={core}
                    onChange={onChange}
                    disabled={disabled}
                />
            )
        }
    }

    if (source === 'character' && character) {
        if (tab === 'basic') {
            return (
                <CharacterBasicForm
                    preset={character}
                    onChange={onChange}
                    disabled={disabled}
                />
            )
        }
        if (tab === 'system') {
            return (
                <CharacterSystemForm
                    preset={character}
                    onChange={onChange}
                    disabled={disabled}
                />
            )
        }
        if (tab === 'input') {
            return (
                <CharacterInputForm
                    preset={character}
                    onChange={onChange}
                    disabled={disabled}
                />
            )
        }
    }

    return null
}
