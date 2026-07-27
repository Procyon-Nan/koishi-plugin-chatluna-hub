import { useEffect, useRef, useState } from 'react'
import type { PresetHubApi } from '../lib/hub-api'
import { isDraftId } from '../lib/id'
import { presetSourceOptions } from '../lib/templates'
import type { PresetListItem, PresetSource } from '../lib/types'
import { asCharacterPreset, asCorePreset } from '../lib/draft-store'
import { usePresetWorkspace } from '../hooks/use-preset-workspace'
import { EditorFormBody, EditorTabsBar } from './editor-tabs'
import { GeneratePanel } from './generate-panel'

export interface PresetShellProps {
    api: PresetHubApi
    onDirtyChange: (dirty: boolean) => void
}

/** Where focus goes after an action replaces the controls that had it. */
type FocusTarget = 'editor' | 'filename'

const runInBackground = (promise: Promise<unknown>) => {
    promise.catch(() => undefined)
}

export function PresetShell({ api, onDirtyChange }: PresetShellProps) {
    const {
        presets,
        listReason,
        listError,
        listLoading,
        detailLoading,
        saving,
        deleting,
        keyword,
        setKeyword,
        session,
        drafts,
        error,
        status,
        newMenuOpen,
        setNewMenuOpen,
        fileInputRef,
        dirty,
        hasUnsavedWork,
        structuredEditingBlocked,
        filtered,
        coreCount,
        characterCount,
        editorTitle,
        editorMeta,
        canSave,
        editorTab,
        setEditorTab,
        openPreset,
        startCreate,
        updateField,
        updateRawText,
        updateFilename,
        resetEditor,
        saveSession,
        deleteSession,
        discardDraft,
        refresh,
        onImportClick,
        onImportFile,
        exportSession,
        generate
    } = usePresetWorkspace(api)

    const menuRef = useRef<HTMLDivElement>(null)
    const newButtonRef = useRef<HTMLButtonElement>(null)
    const editorHeadingRef = useRef<HTMLDivElement>(null)
    const filenameInputRef = useRef<HTMLInputElement>(null)

    const sessionId = session?.id
    const currentSessionIdRef = useRef(sessionId)
    currentSessionIdRef.current = sessionId

    const focusRequestRef = useRef<{
        target: FocusTarget
        fromId: string | undefined
    } | null>(null)
    const [focusTick, setFocusTick] = useState(0)

    /**
     * The host page guards navigation with this, so it has to cover the drafts
     * that are not on screen as well — `dirty` only describes the open session.
     */
    useEffect(() => {
        onDirtyChange(hasUnsavedWork)
        return () => onDirtyChange(false)
    }, [hasUnsavedWork, onDirtyChange])

    /**
     * Creating, deleting and discarding all unmount the control that was just
     * used, or leave it pointing at a different preset. Without this the caret
     * lands on `<body>` and keyboard users lose their place in the page.
     */
    useEffect(() => {
        const request = focusRequestRef.current
        if (!request) return
        focusRequestRef.current = null

        // A declined confirm dialog leaves the editor exactly as it was, so
        // there is nothing to move towards.
        if (request.fromId === currentSessionIdRef.current) return

        const node =
            request.target === 'filename'
                ? filenameInputRef.current
                : editorHeadingRef.current
        node?.focus()
    }, [focusTick])

    // The menu has no dismissal of its own; without this it stays open over the
    // list until another preset is created.
    useEffect(() => {
        if (!newMenuOpen) return

        const closeOnOutsideClick = (event: MouseEvent) => {
            if (menuRef.current?.contains(event.target as Node)) return
            setNewMenuOpen(false)
        }

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return
            setNewMenuOpen(false)
            newButtonRef.current?.focus()
        }

        document.addEventListener('click', closeOnOutsideClick)
        document.addEventListener('keydown', closeOnEscape)
        return () => {
            document.removeEventListener('click', closeOnOutsideClick)
            document.removeEventListener('keydown', closeOnEscape)
        }
    }, [newMenuOpen, setNewMenuOpen])

    const refreshList = () => {
        runInBackground(refresh())
    }

    const requestFocus = (target: FocusTarget, fromId: string | undefined) => {
        focusRequestRef.current = { target, fromId }
        setFocusTick((tick) => tick + 1)
    }

    const createPreset = (source: PresetSource) => {
        const fromId = sessionId
        startCreate(source)
        // The filename is the one field a new draft cannot be saved without.
        requestFocus('filename', fromId)
    }

    const deletePreset = async () => {
        const fromId = sessionId
        await deleteSession()
        requestFocus('editor', fromId)
    }

    const discardCurrentDraft = () => {
        const fromId = sessionId
        // `discardDraft` confirms on its own for a dirty draft.
        discardDraft()
        requestFocus('editor', fromId)
    }

    return (
        <div className="chatluna-preset-island">
            <header className="pei-header">
                <div>
                    <p className="pei-kicker">ChatLuna Core</p>
                    <h1 className="pei-title">预设管理</h1>
                    <p className="pei-subtitle">
                        列表 / 新建 / 导入 / 一键生成 / 结构化表单 / YAML 高级 /
                        导出
                    </p>
                </div>
                <div className="pei-pills">
                    <span className="pei-pill">
                        <strong>{presets.length}</strong> 已落盘
                    </span>
                    <span className="pei-pill">
                        <strong>{coreCount}</strong> 主插件
                    </span>
                    <span className="pei-pill">
                        <strong>{characterCount}</strong> Character
                    </span>
                    {drafts.length > 0 && (
                        <span className="pei-pill">
                            <strong>{drafts.length}</strong> 草稿
                        </span>
                    )}
                </div>
            </header>

            {listReason ? <div className="pei-alert">{listReason}</div> : null}
            {error ? (
                <div className="pei-alert pei-alert-error">{error}</div>
            ) : null}

            <div className="pei-workspace">
                <aside className="pei-panel">
                    <div className="pei-panel-header">
                        <span className="pei-panel-title">预设文件</span>
                        <div className="pei-menu" ref={menuRef}>
                            <button
                                ref={newButtonRef}
                                type="button"
                                className="pei-btn pei-btn-primary"
                                aria-haspopup="menu"
                                aria-expanded={newMenuOpen}
                                aria-controls="pei-new-preset-menu"
                                onClick={() => setNewMenuOpen((open) => !open)}
                            >
                                新建
                            </button>
                            {newMenuOpen ? (
                                <div
                                    id="pei-new-preset-menu"
                                    className="pei-menu-panel"
                                    role="menu"
                                >
                                    {presetSourceOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            className="pei-menu-item"
                                            role="menuitem"
                                            onClick={() =>
                                                createPreset(option.value)
                                            }
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="pei-toolbar">
                        <input
                            className="pei-search"
                            value={keyword}
                            aria-label="搜索预设文件名或关键词"
                            placeholder="搜索文件名或关键词"
                            onChange={(e) => setKeyword(e.target.value)}
                        />
                        <button
                            type="button"
                            className="pei-btn"
                            onClick={onImportClick}
                        >
                            导入
                        </button>
                        <button
                            type="button"
                            className="pei-btn"
                            disabled={listLoading}
                            onClick={refreshList}
                        >
                            {listLoading ? '…' : '刷新'}
                        </button>
                        <input
                            ref={fileInputRef}
                            className="pei-hidden"
                            type="file"
                            accept=".yml,.yaml,.txt,text/yaml,text/plain"
                            onChange={(e) => runInBackground(onImportFile(e))}
                        />
                    </div>

                    <div className="pei-list">
                        {filtered.length === 0 ? (
                            <ListPlaceholder
                                listError={listError}
                                listLoading={listLoading}
                                onRetry={refreshList}
                            />
                        ) : (
                            filtered.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={
                                        session?.id === item.id
                                            ? 'pei-list-item active'
                                            : 'pei-list-item'
                                    }
                                    data-source={item.source}
                                    data-draft={
                                        isDraftId(item.id) ? 'true' : 'false'
                                    }
                                    aria-current={session?.id === item.id}
                                    onClick={() =>
                                        runInBackground(openPreset(item.id))
                                    }
                                >
                                    <span className="pei-list-title-row">
                                        <span className="pei-list-title">
                                            {item.filename}
                                        </span>
                                        <span className="pei-tag">
                                            {isDraftId(item.id)
                                                ? '草稿'
                                                : item.sourceLabel}
                                        </span>
                                    </span>
                                    <div className="pei-list-meta">
                                        {formatCount(item)}
                                        {item.updatedAt
                                            ? ` · ${formatTime(item.updatedAt)}`
                                            : ''}
                                    </div>
                                    {item.keywords.length > 0 ? (
                                        <div className="pei-keywords">
                                            {item.keywords
                                                .slice(0, 6)
                                                .map((kw) => (
                                                    <span
                                                        key={kw}
                                                        className="pei-keyword"
                                                    >
                                                        {kw}
                                                    </span>
                                                ))}
                                        </div>
                                    ) : null}
                                </button>
                            ))
                        )}
                    </div>
                </aside>

                <section className="pei-panel">
                    <div className="pei-editor-header">
                        <div
                            className="pei-editor-heading"
                            ref={editorHeadingRef}
                            tabIndex={-1}
                        >
                            <span className="pei-editor-title">
                                {editorTitle}
                            </span>
                            <span className="pei-editor-meta">
                                {editorMeta}
                            </span>
                        </div>
                        <div className="pei-editor-actions">
                            {dirty ? (
                                <span className="pei-dirty">未保存</span>
                            ) : null}
                            {session ? (
                                <button
                                    type="button"
                                    className="pei-btn"
                                    onClick={exportSession}
                                >
                                    导出
                                </button>
                            ) : null}
                            {session?.isDraft ? (
                                <button
                                    type="button"
                                    className="pei-btn pei-btn-danger"
                                    onClick={discardCurrentDraft}
                                >
                                    丢弃草稿
                                </button>
                            ) : null}
                            {session && !session.isDraft ? (
                                <button
                                    type="button"
                                    className="pei-btn pei-btn-danger"
                                    disabled={deleting}
                                    onClick={() =>
                                        runInBackground(deletePreset())
                                    }
                                >
                                    {deleting ? '删除中…' : '删除'}
                                </button>
                            ) : null}
                            <button
                                type="button"
                                className="pei-btn"
                                disabled={!session || !dirty}
                                onClick={resetEditor}
                            >
                                还原
                            </button>
                            <button
                                type="button"
                                className="pei-btn pei-btn-primary"
                                disabled={!canSave || saving}
                                onClick={() => runInBackground(saveSession())}
                            >
                                {saving ? '保存中…' : '保存'}
                            </button>
                        </div>
                    </div>

                    {!session ? (
                        <div className="pei-empty">
                            选择左侧预设，或新建 / 导入一个预设文件。
                        </div>
                    ) : (
                        <div className="pei-editor-body">
                            {session.isDraft ? (
                                <div className="pei-form-row">
                                    <label htmlFor="pei-filename">文件名</label>
                                    <input
                                        id="pei-filename"
                                        ref={filenameInputRef}
                                        className="pei-input"
                                        value={session.filename}
                                        placeholder={
                                            session.source === 'character'
                                                ? '例如 my-character.yml'
                                                : '例如 my-preset.yml'
                                        }
                                        onChange={(e) =>
                                            updateFilename(e.target.value)
                                        }
                                    />
                                </div>
                            ) : null}

                            <GeneratePanel
                                model={generate.model}
                                onModelChange={generate.setModel}
                                llmModels={generate.llmModels}
                                modelsLoading={generate.modelsLoading}
                                modelsError={generate.modelsError}
                                format={generate.format}
                                onFormatChange={generate.setFormat}
                                formatOptions={generate.formatOptions}
                                generating={generate.generating}
                                canStart={generate.canStart}
                                logLines={generate.logLines}
                                tokenPreview={generate.tokenPreview}
                                onRefreshModels={() =>
                                    runInBackground(generate.loadModels())
                                }
                                onStart={() =>
                                    runInBackground(generate.startGenerate())
                                }
                                onStop={() =>
                                    runInBackground(generate.cancelGenerate())
                                }
                            />

                            <EditorTabsBar
                                source={session.source}
                                active={editorTab}
                                onChange={setEditorTab}
                            />

                            {detailLoading ? (
                                <div className="pei-empty">加载中…</div>
                            ) : (
                                <div
                                    id={`pei-tabpanel-${editorTab}`}
                                    className="pei-form-scroll"
                                    role="tabpanel"
                                    aria-labelledby={`pei-tab-${editorTab}`}
                                >
                                    <EditorFormBody
                                        // Switching preset otherwise reuses the
                                        // row components — and with them the
                                        // CodeMirror instances, whose undo
                                        // history still holds the previous
                                        // preset's text. One Ctrl+Z would then
                                        // paste that text into this preset.
                                        key={session.id}
                                        source={session.source}
                                        tab={editorTab}
                                        core={asCorePreset(
                                            session.structured,
                                            session.source
                                        )}
                                        character={asCharacterPreset(
                                            session.structured,
                                            session.source
                                        )}
                                        onChange={updateField}
                                        rawText={session.rawText}
                                        parseError={session.parseError}
                                        onRawTextChange={updateRawText}
                                        structuredEditingBlocked={
                                            structuredEditingBlocked
                                        }
                                    />
                                </div>
                            )}

                            {status ? (
                                <div className="pei-status pei-status-ok">
                                    {status}
                                </div>
                            ) : null}
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}

interface ListPlaceholderProps {
    listError: string
    listLoading: boolean
    onRetry: () => void
}

/**
 * A failed request and an empty directory both render zero rows. Without the
 * distinction an outage reads as "you have no presets", which invites the user to
 * start recreating files that already exist.
 */
function ListPlaceholder({
    listError,
    listLoading,
    onRetry
}: ListPlaceholderProps) {
    if (!listError) return <div className="pei-empty">暂无预设</div>

    return (
        <div className="pei-empty">
            <span>{listError}</span>
            <button
                type="button"
                className="pei-btn"
                disabled={listLoading}
                onClick={onRetry}
            >
                {listLoading ? '重试中…' : '重试'}
            </button>
        </div>
    )
}

const formatCount = (item: PresetListItem): string =>
    item.source === 'character'
        ? `${item.promptCount} sections`
        : `${item.promptCount} prompts`

const formatTime = (value: string): string => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value

    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
