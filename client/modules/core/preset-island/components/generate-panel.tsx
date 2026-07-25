import { useEffect, useRef } from 'react'
import type { ChatLunaCoreModelItem, PresetGenerateFormat } from '../../types'
import type { GenerateLogLine } from '../hooks/use-preset-generate'

export interface GeneratePanelProps {
    model: string
    onModelChange: (fullName: string) => void
    llmModels: ChatLunaCoreModelItem[]
    modelsLoading: boolean
    modelsError: string
    format: PresetGenerateFormat
    onFormatChange: (format: PresetGenerateFormat) => void
    formatOptions: { value: PresetGenerateFormat; label: string }[]
    generating: boolean
    canStart: boolean
    logLines: GenerateLogLine[]
    tokenPreview: string
    onRefreshModels: () => void
    onStart: () => void
    onStop: () => void
}

export function GeneratePanel({
    model,
    onModelChange,
    llmModels,
    modelsLoading,
    modelsError,
    format,
    onFormatChange,
    formatOptions,
    generating,
    canStart,
    logLines,
    tokenPreview,
    onRefreshModels,
    onStart,
    onStop
}: GeneratePanelProps) {
    const logRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const element = logRef.current
        if (element) element.scrollTop = element.scrollHeight
    }, [generating, logLines, tokenPreview])

    return (
        <div className="pei-ai-panel">
            <div className="pei-ai-row">
                <label className="pei-ai-label" htmlFor="pei-ai-model">
                    模型
                </label>
                <select
                    id="pei-ai-model"
                    className="pei-select pei-ai-select"
                    value={model}
                    disabled={generating || modelsLoading || llmModels.length === 0}
                    onChange={(e) => onModelChange(e.target.value)}
                >
                    {llmModels.length === 0 ? (
                        <option value="">
                            {modelsLoading ? '加载中…' : '无可用 LLM'}
                        </option>
                    ) : (
                        llmModels.map((item) => (
                            <option key={item.id} value={item.fullName}>
                                {item.fullName}
                            </option>
                        ))
                    )}
                </select>

                <label className="pei-ai-label" htmlFor="pei-ai-format">
                    格式
                </label>
                <select
                    id="pei-ai-format"
                    className="pei-select pei-ai-select pei-ai-format"
                    value={format}
                    disabled={generating}
                    onChange={(e) =>
                        onFormatChange(e.target.value as PresetGenerateFormat)
                    }
                >
                    {formatOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>

                <button
                    type="button"
                    className="pei-btn"
                    disabled={modelsLoading || generating}
                    onClick={onRefreshModels}
                    title="刷新模型列表"
                >
                    {modelsLoading ? '…' : '刷新'}
                </button>

                {generating ? (
                    <button
                        type="button"
                        className="pei-btn pei-btn-danger"
                        onClick={onStop}
                    >
                        停止
                    </button>
                ) : (
                    <button
                        type="button"
                        className="pei-btn pei-btn-primary"
                        disabled={!canStart}
                        onClick={onStart}
                    >
                        一键生成
                    </button>
                )}
            </div>

            {modelsError ? (
                <div className="pei-ai-hint pei-ai-hint-error">{modelsError}</div>
            ) : (
                <div className="pei-ai-hint">
                    使用 ChatLuna Agent 生成核心字段，结果写入当前草稿，不会自动保存。
                </div>
            )}

            {generating || logLines.length > 0 || tokenPreview ? (
                <div
                    ref={logRef}
                    className="pei-ai-log"
                    role="log"
                    aria-live="polite"
                    aria-relevant="additions text"
                >
                    {logLines.map((line) => (
                        <div
                            key={line.id}
                            className={`pei-ai-log-line pei-ai-log-${line.kind}`}
                        >
                            {line.text}
                        </div>
                    ))}
                    {tokenPreview ? (
                        <div className="pei-ai-log-line pei-ai-log-token">
                            …{tokenPreview}
                        </div>
                    ) : null}
                    {generating && logLines.length === 0 && !tokenPreview ? (
                        <div className="pei-ai-log-line pei-ai-log-info">
                            等待模型响应…
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    )
}
