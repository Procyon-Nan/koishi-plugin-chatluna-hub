import { useEffect } from 'react'
import type { PresetHubApi } from '../lib/hub-api'
import { isDraftId } from '../lib/id'
import { presetSourceOptions } from '../lib/templates'
import type { PresetListItem } from '../lib/types'
import {
    asCharacterPreset,
    asCorePreset
} from '../lib/draft-store'
import { usePresetWorkspace } from '../hooks/use-preset-workspace'
import { EditorFormBody, EditorTabsBar } from './editor-tabs'
import { GeneratePanel } from './generate-panel'

export interface PresetShellProps {
    api: PresetHubApi
    onDirtyChange: (dirty: boolean) => void
}

export function PresetShell({ api, onDirtyChange }: PresetShellProps) {
    const {
        presets,
        listReason,
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
        refresh,
        onImportClick,
        onImportFile,
        exportSession,
        generate
    } = usePresetWorkspace(api)

    useEffect(() => {
        onDirtyChange(dirty)
        return () => onDirtyChange(false)
    }, [dirty, onDirtyChange])

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
                        <div className="pei-menu">
                            <button
                                type="button"
                                className="pei-btn pei-btn-primary"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setNewMenuOpen((open) => !open)
                                }}
                            >
                                新建
                            </button>
                            {newMenuOpen ? (
                                <div
                                    className="pei-menu-panel"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {presetSourceOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            className="pei-menu-item"
                                            onClick={() => startCreate(option.value)}
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
                            onClick={() => void refresh()}
                        >
                            {listLoading ? '…' : '刷新'}
                        </button>
                        <input
                            ref={fileInputRef}
                            className="pei-hidden"
                            type="file"
                            accept=".yml,.yaml,.txt,text/yaml,text/plain"
                            onChange={(e) => void onImportFile(e)}
                        />
                    </div>

                    <div className="pei-list">
                        {filtered.length === 0 ? (
                            <div className="pei-empty">暂无预设</div>
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
                                    data-draft={isDraftId(item.id) ? 'true' : 'false'}
                                    onClick={() => void openPreset(item.id)}
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
                                            {item.keywords.slice(0, 6).map((kw) => (
                                                <span key={kw} className="pei-keyword">
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
                        <div className="pei-editor-heading">
                            <span className="pei-editor-title">{editorTitle}</span>
                            <span className="pei-editor-meta">{editorMeta}</span>
                        </div>
                        <div className="pei-editor-actions">
                            {dirty ? <span className="pei-dirty">未保存</span> : null}
                            {session ? (
                                <button
                                    type="button"
                                    className="pei-btn"
                                    onClick={exportSession}
                                >
                                    导出
                                </button>
                            ) : null}
                            {session && !session.isDraft ? (
                                <button
                                    type="button"
                                    className="pei-btn pei-btn-danger"
                                    disabled={deleting}
                                    onClick={() => void deleteSession()}
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
                                onClick={() => void saveSession()}
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
                                    void generate.loadModels()
                                }
                                onStart={() => void generate.startGenerate()}
                                onStop={() => void generate.cancelGenerate()}
                            />

                            <EditorTabsBar
                                source={session.source}
                                active={editorTab}
                                onChange={setEditorTab}
                            />

                            {detailLoading ? (
                                <div className="pei-empty">加载中…</div>
                            ) : (
                                <div className="pei-form-scroll">
                                    <EditorFormBody
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
                                    />
                                </div>
                            )}

                            {status ? (
                                <div
                                    className={
                                        status.includes('失败')
                                            ? 'pei-status pei-status-error'
                                            : 'pei-status pei-status-ok'
                                    }
                                >
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
