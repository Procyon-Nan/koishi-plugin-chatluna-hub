import { ElMessage } from 'element-plus'

/** Turn an unknown thrown value into a readable message. */
const toErrorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : String(error)
}

/**
 * Show an error toast prefixed with `label`, e.g. `reportError(e, '加载模型失败')`
 * renders `加载模型失败：<reason>`. Centralizes the `error instanceof Error ?
 * error.message : String(error)` boilerplate repeated across every page.
 */
export const reportError = (error: unknown, label: string): void => {
    ElMessage.error(`${label}：${toErrorMessage(error)}`)
}
