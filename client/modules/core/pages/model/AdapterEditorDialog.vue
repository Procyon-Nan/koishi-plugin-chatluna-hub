<template>
    <el-dialog
        v-model="visible"
        width="960px"
        class="chatluna-editor-dialog"
        top="4vh"
        append-to-body
        :show-close="false"
    >
        <div class="picker-header" v-if="descriptor">
            <h3>{{ instanceKey ? '编辑配置' : '新建配置' }} - {{ descriptor.title }}</h3>
            <el-button
                class="header-close-btn"
                text
                circle
                :icon="Close"
                @click="visible = false"
            />
        </div>

        <div
            v-if="descriptor"
            class="picker-body dialog-body"
            :class="{ 'is-single-column': visibleSections.length === 0 }"
        >
            <div class="dialog-main">
                <el-form
                    v-if="descriptor.platformConfigurable"
                    label-position="top"
                    class="editor-form editor-block config-form"
                >
                    <div class="config-item-wrapper">
                        <div class="config-item-info">
                            <div class="config-item-name">
                                platform
                            </div>
                            <div class="config-item-desc">
                                设置适配器平台名称。
                            </div>
                        </div>
                        <div class="config-item-input-wrap">
                            <el-input
                                v-model="platform"
                                :placeholder="descriptor.platformDefault"
                            />
                        </div>
                    </div>
                </el-form>

                <div
                    v-if="descriptor.credentialKind !== 'opaque'"
                    class="cred-section editor-block"
                >
                    <div class="config-panel-head">
                        <h4>请求设置</h4>
                    </div>

                    <div class="config-fields-viewport">
                        <div class="config-form">
                            <div class="config-item-wrapper is-block-item">
                                <div class="config-item-header">
                                    <div class="config-item-info">
                                        <div class="config-item-name">
                                            apiKeys
                                        </div>
                                        <div class="config-item-desc">
                                            配置 API Key 和对应的请求地址列表。
                                        </div>
                                    </div>
                                    <el-button
                                        class="inline-add"
                                        plain
                                        :icon="Plus"
                                        @click="emit('add-credential')"
                                    >
                                        添加行
                                    </el-button>
                                </div>
                                <div class="config-item-input-wrap table-editor-wrap">
                                    <div class="table-editor">
                                        <div class="table-head-ios">
                                            <span v-if="editorShowApiKey">API Key</span>
                                            <span v-if="editorShowEndpoint">API 请求地址</span>
                                            <span>是否启用此配置</span>
                                            <span />
                                        </div>
                                        <div
                                            v-for="(entry, index) in credentials"
                                            :key="index"
                                            class="table-row-ios"
                                        >
                                            <div class="cell-input-wrap" v-if="editorShowApiKey">
                                                <el-input
                                                    v-model="entry.apiKey"
                                                    type="password"
                                                    show-password
                                                    :placeholder="apiKeyPlaceholder"
                                                />
                                            </div>
                                            <div class="cell-input-wrap" v-if="editorShowEndpoint">
                                                <el-input
                                                    v-model="entry.apiEndpoint"
                                                    :placeholder="descriptor.endpointPlaceholder || 'API 请求地址'"
                                                />
                                            </div>
                                            <div class="cell-checkbox-wrap">
                                                <el-switch v-model="entry.enabled" />
                                            </div>
                                            <div class="cell-actions-wrap">
                                                <el-button
                                                    text
                                                    type="danger"
                                                    :icon="DeleteIcon"
                                                    @click="emit('remove-credential', index)"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div
                    v-for="section in visibleSections"
                    :key="section.title"
                    class="config-panel editor-block"
                >
                    <div class="config-panel-head">
                        <h4>{{ section.title }}</h4>
                    </div>

                    <div class="config-fields-viewport">
                        <div class="config-form">
                            <template
                                v-for="field in section.fields"
                                :key="field.key"
                            >
                                <div
                                    v-if="isFieldVisible(field)"
                                    class="config-item-wrapper"
                                    :class="[
                                        'field-' + field.key,
                                        { 'is-block-item': ['string-list', 'tuple-table', 'object-table', 'dict-table'].includes(field.kind) }
                                    ]"
                                >
                                    <div class="config-item-header">
                                        <div class="config-item-info">
                                            <div class="config-item-name">
                                                {{ field.key }}
                                                <span
                                                    v-if="field.required"
                                                    class="required-star"
                                                >*</span>
                                                <span
                                                    v-if="isComputedChatLimit(field)"
                                                    class="computed-chip"
                                                >
                                                    复杂表达式，保留原值
                                                </span>
                                            </div>
                                            <div v-if="field.label || field.description" class="config-item-desc">
                                                {{ field.label }}。{{ field.description }}
                                            </div>
                                        </div>
                                        <!-- block 布局的“添加行”按钮放至右端同一行 -->
                                        <template v-if="['string-list', 'tuple-table', 'object-table', 'dict-table'].includes(field.kind)">
                                            <el-button
                                                v-if="field.kind === 'string-list'"
                                                class="inline-add"
                                                plain
                                                :icon="Plus"
                                                @click="addStringListRow(field)"
                                            >
                                                添加行
                                            </el-button>
                                            <el-button
                                                v-else-if="field.kind === 'tuple-table' || field.kind === 'object-table'"
                                                class="inline-add"
                                                plain
                                                :icon="Plus"
                                                @click="addTableRow(field)"
                                            >
                                                添加行
                                            </el-button>
                                            <el-button
                                                v-else-if="field.kind === 'dict-table'"
                                                class="inline-add"
                                                plain
                                                :icon="Plus"
                                                @click="addDictGroup(field)"
                                            >
                                                添加配置组
                                            </el-button>
                                        </template>
                                    </div>

                                    <div class="config-item-input-wrap">
                                        <el-switch
                                            v-if="field.kind === 'boolean'"
                                            :model-value="Boolean(extraConfig[field.key])"
                                            @update:model-value="setConfigValue(field.key, $event)"
                                        />

                                        <el-input-number
                                            v-else-if="field.kind === 'number' && !isComputedChatLimit(field)"
                                            :model-value="numberValue(extraConfig[field.key], field.default)"
                                            :min="field.min"
                                            :max="field.max"
                                            :step="field.step ?? 1"
                                            controls-position="right"
                                            @update:model-value="setConfigValue(field.key, $event)"
                                        />

                                        <el-input
                                            v-else-if="field.kind === 'text'"
                                            :model-value="stringValue(extraConfig[field.key], field.default)"
                                            @update:model-value="setConfigValue(field.key, $event)"
                                        />

                                        <el-input
                                            v-else-if="field.kind === 'textarea'"
                                            :model-value="stringValue(extraConfig[field.key], field.default)"
                                            type="textarea"
                                            :autosize="{ minRows: 2, maxRows: 8 }"
                                            @update:model-value="setConfigValue(field.key, $event)"
                                        />

                                        <el-select
                                            v-else-if="field.kind === 'select'"
                                            :model-value="extraConfig[field.key] ?? field.default"
                                            @update:model-value="setConfigValue(field.key, $event)"
                                        >
                                            <el-option
                                                v-for="option in field.options ?? []"
                                                :key="String(option.value)"
                                                :label="option.label"
                                                :value="option.value"
                                            />
                                        </el-select>

                                        <el-select
                                            v-else-if="field.kind === 'multi-select'"
                                            :model-value="arrayValue(extraConfig[field.key], field.default)"
                                            multiple
                                            collapse-tags
                                            collapse-tags-tooltip
                                            @update:model-value="setConfigValue(field.key, $event)"
                                        >
                                            <el-option
                                                v-for="option in field.options ?? []"
                                                :key="String(option.value)"
                                                :label="option.label"
                                                :value="option.value"
                                            />
                                        </el-select>

                                        <div
                                            v-else-if="field.kind === 'string-list'"
                                            class="list-editor"
                                        >
                                            <div
                                                v-for="(_, index) in arrayValue(extraConfig[field.key], field.default)"
                                                :key="index"
                                                class="list-row"
                                            >
                                                <el-input
                                                    :model-value="String(arrayValue(extraConfig[field.key], field.default)[index] ?? '')"
                                                    @update:model-value="updateStringList(field, index, $event)"
                                                />
                                                <el-button
                                                    text
                                                    type="danger"
                                                    :icon="DeleteIcon"
                                                    @click="removeArrayRow(field, index)"
                                                />
                                            </div>
                                        </div>

                                        <div
                                            v-else-if="field.kind === 'tuple-table' || field.kind === 'object-table'"
                                            class="table-editor"
                                        >
                                            <div
                                                class="table-head"
                                                :style="tableGridStyle(field)"
                                            >
                                                <span
                                                    v-for="column in field.columns"
                                                    :key="column.key"
                                                >
                                                    {{ column.label }}
                                                </span>
                                                <span />
                                            </div>
                                            <div
                                                v-for="(_, index) in arrayValue(extraConfig[field.key], field.default)"
                                                :key="index"
                                                class="table-row"
                                                :style="tableGridStyle(field)"
                                            >
                                                <template
                                                    v-for="column in field.columns"
                                                    :key="column.key"
                                                >
                                                    <div class="cell-component-container">
                                                        <el-select
                                                            v-if="column.kind === 'select' || column.kind === 'multi-select'"
                                                            v-bind="columnComponentProps(field, column, index)"
                                                            @update:model-value="updateTableCell(field, column, index, $event)"
                                                        >
                                                            <el-option
                                                                v-for="option in column.options ?? []"
                                                                :key="String(option.value)"
                                                                :label="option.label"
                                                                :value="option.value"
                                                            />
                                                        </el-select>
                                                        <el-switch
                                                            v-else-if="column.kind === 'boolean'"
                                                            v-bind="columnComponentProps(field, column, index)"
                                                            @update:model-value="updateTableCell(field, column, index, $event)"
                                                        />
                                                        <el-input-number
                                                            v-else-if="column.kind === 'number'"
                                                            v-bind="columnComponentProps(field, column, index)"
                                                            :controls="false"
                                                            @update:model-value="updateTableCell(field, column, index, $event)"
                                                        />
                                                        <el-input
                                                            v-else
                                                            v-bind="columnComponentProps(field, column, index)"
                                                            @update:model-value="updateTableCell(field, column, index, $event)"
                                                        />
                                                    </div>
                                                </template>
                                                <el-button
                                                    text
                                                    type="danger"
                                                    :icon="DeleteIcon"
                                                    @click="removeArrayRow(field, index)"
                                                />
                                            </div>
                                        </div>

                                        <div
                                            v-else-if="field.kind === 'dict-table'"
                                            class="dict-editor"
                                        >
                                            <div
                                                v-for="(_, rowIndex) in arrayValue(extraConfig[field.key], field.default)"
                                                :key="rowIndex"
                                                class="dict-group"
                                            >
                                                <div class="dict-group-head">
                                                    <span class="dict-group-badge">
                                                        配置 {{ rowIndex + 1 }}
                                                    </span>
                                                    <el-button
                                                        text
                                                        type="danger"
                                                        :icon="DeleteIcon"
                                                        @click="removeArrayRow(field, rowIndex)"
                                                    />
                                                </div>
                                                <div class="dict-rows-container">
                                                    <div
                                                        v-for="(_, entryIndex) in dictEntries(field, rowIndex)"
                                                        :key="entryIndex"
                                                        class="dict-row"
                                                    >
                                                        <el-input
                                                            :model-value="dictEntries(field, rowIndex)[entryIndex][0]"
                                                            placeholder="模型别名"
                                                            @update:model-value="updateDictEntryKey(field, rowIndex, entryIndex, $event)"
                                                        />
                                                        <el-input
                                                            :model-value="dictEntries(field, rowIndex)[entryIndex][1]"
                                                            type="password"
                                                            show-password
                                                            placeholder="API Password"
                                                            @update:model-value="updateDictEntryValue(field, rowIndex, entryIndex, $event)"
                                                        />
                                                        <el-button
                                                            text
                                                            type="danger"
                                                            :icon="DeleteIcon"
                                                            @click="removeDictEntry(field, rowIndex, entryIndex)"
                                                        />
                                                    </div>
                                                </div>
                                                <el-button
                                                    class="inline-add"
                                                    plain
                                                    :icon="Plus"
                                                    @click="addDictEntry(field, rowIndex)"
                                                >
                                                    添加键值
                                                </el-button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="picker-footer">
            <el-button class="footer-btn btn-reset" @click="emit('reset-to-default')">重置为默认</el-button>
            <span class="footer-spacer" />
            <el-button class="footer-btn btn-cancel" @click="visible = false">取消</el-button>
            <el-button
                class="footer-btn btn-primary"
                type="primary"
                :loading="saving"
                @click="emit('save')"
            >
                保存并应用
            </el-button>
        </div>
    </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
    ElButton,
    ElDialog,
    ElForm,
    ElFormItem,
    ElIcon,
    ElInput,
    ElInputNumber,
    ElOption,
    ElSelect,
    ElSwitch
} from 'element-plus'
import {
    Close,
    Delete as DeleteIcon,
    Plus,
    Setting,
    Key,
    Connection
} from '@element-plus/icons-vue'
import type {
    ChatLunaAdapterConfigColumn,
    ChatLunaAdapterConfigField,
    ChatLunaAdapterConfigSection,
    ChatLunaAdapterCredentialEntry
} from '../../types'
import type { EditorDescriptor } from './use-adapters'

const props = defineProps<{
    descriptor: EditorDescriptor | null
    instanceKey: string | undefined
    credentials: ChatLunaAdapterCredentialEntry[]
    extraConfig: Record<string, unknown>
    saving: boolean
}>()

const emit = defineEmits<{
    (event: 'save'): void
    (event: 'add-credential'): void
    (event: 'remove-credential', index: number): void
    (event: 'reset-to-default'): void
}>()

const visible = defineModel<boolean>('visible', { required: true })
const platform = defineModel<string>('platform', { required: true })

const visibleSections = computed(
    () =>
        props.descriptor?.configSections.filter((section) =>
            section.fields.some(isFieldVisible)
        ) ?? []
)

const editorShowApiKey = computed(() => {
    return props.descriptor?.credentialKind !== 'endpoint-enabled'
})

const editorShowEndpoint = computed(() => {
    return props.descriptor?.credentialKind !== 'api-enabled'
})

const apiKeyPlaceholder = computed(() => {
    if (!props.descriptor) return 'API Key'
    if (props.descriptor.adapterId === 'ollama') return 'API 端点'
    return `${props.descriptor.title} API Key`
})

const cloneConfigValue = <T>(value: T): T => {
    if (Array.isArray(value)) {
        return value.map((item) => cloneConfigValue(item)) as T
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
                key,
                cloneConfigValue(item)
            ])
        ) as T
    }
    return value
}

const setConfigValue = (key: string, value: unknown) => {
    props.extraConfig[key] = value
}

function isFieldVisible(field: ChatLunaAdapterConfigField) {
    if (field.key === 'proxyAddress') {
        return props.extraConfig.proxyMode === 'on'
    }
    return true
}

const isComputedChatLimit = (field: ChatLunaAdapterConfigField) => {
    return (
        field.key === 'chatTimeLimit' &&
        props.extraConfig[field.key] != null &&
        typeof props.extraConfig[field.key] === 'object'
    )
}

const numberValue = (value: unknown, fallback: unknown) => {
    if (typeof value === 'number') return value
    if (typeof value === 'string' && value.trim()) return Number(value)
    return typeof fallback === 'number' ? fallback : undefined
}

const stringValue = (value: unknown, fallback: unknown) => {
    if (typeof value === 'string') return value
    return typeof fallback === 'string' ? fallback : ''
}

const arrayValue = (value: unknown, fallback: unknown): unknown[] => {
    if (Array.isArray(value)) return value
    if (Array.isArray(fallback)) return cloneConfigValue(fallback)
    return []
}

const replaceArrayValue = (
    field: ChatLunaAdapterConfigField,
    rows: unknown[]
) => {
    setConfigValue(field.key, rows)
}

const updateStringList = (
    field: ChatLunaAdapterConfigField,
    index: number,
    value: string
) => {
    const rows = arrayValue(props.extraConfig[field.key], field.default).slice()
    rows[index] = value
    replaceArrayValue(field, rows)
}

const addStringListRow = (field: ChatLunaAdapterConfigField) => {
    replaceArrayValue(field, [
        ...arrayValue(props.extraConfig[field.key], field.default),
        ''
    ])
}

const removeArrayRow = (field: ChatLunaAdapterConfigField, index: number) => {
    const rows = arrayValue(props.extraConfig[field.key], field.default).slice()
    rows.splice(index, 1)
    replaceArrayValue(field, rows)
}

const createTableRow = (field: ChatLunaAdapterConfigField) => {
    const columns = field.columns ?? []
    if (field.kind === 'tuple-table') {
        return columns.map((column) => cloneConfigValue(column.default ?? ''))
    }

    return Object.fromEntries(
        columns.map((column) => [
            column.key,
            cloneConfigValue(column.default ?? '')
        ])
    )
}

const addTableRow = (field: ChatLunaAdapterConfigField) => {
    replaceArrayValue(field, [
        ...arrayValue(props.extraConfig[field.key], field.default),
        createTableRow(field)
    ])
}

const tableGridStyle = (field: ChatLunaAdapterConfigField) => ({
    '--table-columns': String(field.columns?.length ?? 1)
})

const getTableCellValue = (
    field: ChatLunaAdapterConfigField,
    column: ChatLunaAdapterConfigColumn,
    index: number
) => {
    const row = arrayValue(props.extraConfig[field.key], field.default)[index]
    if (field.kind === 'tuple-table' && Array.isArray(row)) {
        const columnIndex = Number(column.key)
        return row[columnIndex] ?? column.default
    }
    if (row && typeof row === 'object' && !Array.isArray(row)) {
        return (row as Record<string, unknown>)[column.key] ?? column.default
    }
    return column.default
}

const updateTableCell = (
    field: ChatLunaAdapterConfigField,
    column: ChatLunaAdapterConfigColumn,
    index: number,
    value: unknown
) => {
    const rows = arrayValue(props.extraConfig[field.key], field.default).slice()
    const row = rows[index]

    if (field.kind === 'tuple-table') {
        const nextRow = Array.isArray(row) ? row.slice() : []
        nextRow[Number(column.key)] = value
        rows[index] = nextRow
    } else {
        rows[index] = {
            ...(row && typeof row === 'object' && !Array.isArray(row)
                ? row
                : {}),
            [column.key]: value
        }
    }

    replaceArrayValue(field, rows)
}

const columnComponentProps = (
    field: ChatLunaAdapterConfigField,
    column: ChatLunaAdapterConfigColumn,
    index: number
) => {
    const value = getTableCellValue(field, column, index)

    if (column.kind === 'boolean') {
        return { modelValue: Boolean(value) }
    }

    if (column.kind === 'number') {
        return {
            modelValue: numberValue(value, column.default),
            min: column.min,
            max: column.max,
            step: column.step ?? 1,
            controlsPosition: 'right'
        }
    }

    if (column.kind === 'select') {
        return { modelValue: value ?? column.default }
    }

    if (column.kind === 'multi-select') {
        return {
            modelValue: arrayValue(value, column.default),
            multiple: true,
            collapseTags: true,
            collapseTagsTooltip: false
        }
    }

    return {
        modelValue: stringValue(value, column.default),
        type: column.kind === 'password' ? 'password' : undefined,
        showPassword: column.kind === 'password'
    }
}

const dictEntries = (field: ChatLunaAdapterConfigField, rowIndex: number) => {
    const row = arrayValue(props.extraConfig[field.key], field.default)[rowIndex]
    if (!row || typeof row !== 'object' || Array.isArray(row)) return []
    return Object.entries(row as Record<string, string>)
}

const replaceDictEntries = (
    field: ChatLunaAdapterConfigField,
    rowIndex: number,
    entries: [string, string][]
) => {
    const rows = arrayValue(props.extraConfig[field.key], field.default).slice()
    rows[rowIndex] = Object.fromEntries(entries)
    replaceArrayValue(field, rows)
}

const addDictGroup = (field: ChatLunaAdapterConfigField) => {
    replaceArrayValue(field, [
        ...arrayValue(props.extraConfig[field.key], field.default),
        {}
    ])
}

const addDictEntry = (field: ChatLunaAdapterConfigField, rowIndex: number) => {
    replaceDictEntries(field, rowIndex, [
        ...dictEntries(field, rowIndex),
        ['', '']
    ])
}

const updateDictEntryKey = (
    field: ChatLunaAdapterConfigField,
    rowIndex: number,
    entryIndex: number,
    value: string
) => {
    const entries = dictEntries(field, rowIndex)
    entries[entryIndex] = [value, entries[entryIndex]?.[1] ?? '']
    replaceDictEntries(field, rowIndex, entries)
}

const updateDictEntryValue = (
    field: ChatLunaAdapterConfigField,
    rowIndex: number,
    entryIndex: number,
    value: string
) => {
    const entries = dictEntries(field, rowIndex)
    entries[entryIndex] = [entries[entryIndex]?.[0] ?? '', value]
    replaceDictEntries(field, rowIndex, entries)
}

const removeDictEntry = (
    field: ChatLunaAdapterConfigField,
    rowIndex: number,
    entryIndex: number
) => {
    const entries = dictEntries(field, rowIndex)
    entries.splice(entryIndex, 1)
    replaceDictEntries(field, rowIndex, entries)
}
</script>

<style>
/* 全局样式：控制 Dialog 容器本身 */
.el-dialog.chatluna-editor-dialog {
    border-radius: 8px !important;
    overflow: hidden !important;
    background: var(--k-card-bg) !important;
    border: none !important;
    box-shadow: none !important;
}

.el-dialog.chatluna-editor-dialog .el-dialog__header {
    display: none !important; /* 隐藏原生 Header */
}

.el-dialog.chatluna-editor-dialog .el-dialog__body {
    padding: 0 !important;
    background: transparent !important;
}
</style>

<style scoped>
/* 局部样式：控制弹窗内部布局 */
.picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--k-card-bg);
    border-bottom: 1px solid var(--k-color-divider);
}

.picker-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--k-text-dark);
}

.header-close-btn {
    color: var(--k-text-light);
}

.picker-body {
    padding: 0;
    background: var(--k-card-bg);
}

.picker-footer {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: var(--k-card-bg);
    border-top: 1px solid var(--k-color-divider);
}

.footer-spacer {
    flex: 1;
}

.btn-reset {
    border: 1px solid var(--k-color-divider);
    background: transparent;
    color: var(--k-text-light);
}

.btn-reset:hover {
    border-color: var(--k-color-warning);
    color: var(--k-color-warning);
}

.footer-btn {
    border-radius: 4px;
    font-weight: 500;
    font-size: 13px;
}

.dialog-body {
    height: min(72vh, 720px);
    max-height: 100%;
    min-height: min(480px, calc(100vh - 200px));
    overflow: hidden;
}

.dialog-body.is-single-column {
    height: min(72vh, 720px);
}

.dialog-main {
    min-width: 0;
    min-height: 0;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 20px;
    overflow: auto;
    padding: 16px 20px;
    background: transparent;
}

.dialog-main::-webkit-scrollbar {
    width: 4px;
    height: 4px;
}

.dialog-main::-webkit-scrollbar-track {
    background: transparent;
}

.dialog-main::-webkit-scrollbar-thumb {
    border-radius: 2px;
    background: var(--k-color-divider);
}

.editor-block {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    border-bottom: none !important;
}

.editor-form {
    padding-bottom: 0;
    border-bottom: none;
    background: transparent;
}

.config-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 20px;
}

.config-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 6px;
    margin-top: 12px;
}

.config-panel-head h4 {
    margin: 0;
    color: var(--k-text-dark);
    font-size: 15px;
    font-weight: bold;
    line-height: 1.4;
}

.config-fields-viewport {
    min-width: 0;
    padding-top: 6px;
}

.cred-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 20px;
    border-bottom: none;
}

.cred-section-head {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.cred-section-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: var(--k-text-dark);
}

.cred-section-count {
    min-width: 18px;
    height: 16px;
    line-height: 16px;
    padding: 0 4px;
    border-radius: 4px;
    border: 1px solid var(--k-color-divider);
    color: var(--k-text-light);
    font-size: 10px;
    font-weight: 500;
    text-align: center;
}

.cred-section-hint {
    color: var(--k-text-light);
    font-size: 12px;
    line-height: 1.5;
}

.cred-list,
.list-editor,
.table-editor,
.dict-editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.transition-stack {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.dict-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.cred-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--k-color-divider);
    border-top: none;
    border-left: none;
    border-right: none;
    border-radius: 0;
    background: transparent;
}

.cred-row.is-off {
    opacity: 0.4;
}

.cred-index {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    display: grid;
    place-items: center;
    color: var(--k-text-light);
    font-size: 11px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    border: none;
}

.cred-fields {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
}

.cred-key {
    flex: 1.3;
    min-width: 0;
}

.cred-endpoint {
    flex: 1;
    min-width: 0;
}

.field-icon {
    color: var(--k-text-light);
    opacity: 0.6;
    transition: color 150ms ease, opacity 150ms ease;
}

.el-input:focus-within .field-icon {
    color: var(--k-color-primary);
    opacity: 0.9;
}

.cred-enabled,
.cred-remove {
    flex-shrink: 0;
}

.cred-empty {
    padding: 18px;
    border: 1px dashed var(--k-color-divider);
    border-radius: 6px;
    text-align: center;
    color: var(--k-text-light);
    font-size: 12px;
    background: transparent;
}

.cred-add {
    align-self: flex-start;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
    border: 1px solid var(--k-color-divider);
    background: transparent;
    transition: border-color 150ms ease, color 150ms ease;
}

.cred-add:hover {
    border-color: var(--k-color-primary);
    color: var(--k-color-primary);
}

.inline-add {
    align-self: flex-start;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
    border: 1px solid var(--k-color-divider);
    background: transparent;
    transition: border-color 150ms ease, color 150ms ease;
}

.inline-add:hover {
    border-color: var(--k-color-primary);
    color: var(--k-color-primary);
}

.config-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.config-item-wrapper {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 16px 0;
    border-bottom: 1px solid var(--k-color-divider);
    gap: 24px;
}

/* 最后一个配置项的底部分隔线去掉 */
.dialog-main > *:last-child .config-form > .config-item-wrapper:last-child {
    border-bottom: none !important;
}

.config-item-wrapper.is-block-item {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
}

/* block 配置项头部，用于将标题/说明与添加按钮放在同一行 */
.config-item-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    width: 100%;
}

.config-item-wrapper.is-block-item .config-item-input-wrap {
    width: 100% !important;
    justify-content: flex-start;
}

.config-item-wrapper.is-block-item .table-editor-wrap {
    width: 100% !important;
}

.config-item-wrapper.is-block-item .list-editor,
.config-item-wrapper.is-block-item .table-editor,
.config-item-wrapper.is-block-item .dict-editor {
    width: 100%;
}

.config-item-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.config-item-name {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 14px;
    font-weight: 600;
    color: var(--k-text-dark);
}

.required-star {
    color: var(--k-color-danger);
    margin-left: 4px;
}

.config-item-desc {
    font-size: 12px;
    color: var(--k-text-light);
    line-height: 1.5;
}

.config-item-input-wrap {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-shrink: 0;
    width: 320px;
}

.config-item-input-wrap :deep(.el-input-number),
.config-item-input-wrap :deep(.el-select),
.config-item-input-wrap :deep(.el-input) {
    width: 100% !important;
}

/* 下拉选择框无边框无下划线风格且文本右对齐 */
.config-item-input-wrap :deep(.el-select) .el-select__wrapper {
    background: transparent !important;
    box-shadow: none !important;
    border-bottom: none !important;
    border-radius: 0 !important;
    padding: 0 24px 0 0 !important;
}

.config-item-input-wrap :deep(.el-select) .el-select__wrapper:hover,
.config-item-input-wrap :deep(.el-select).is-focused .el-select__wrapper {
    border-bottom: none !important;
}

.config-item-input-wrap :deep(.el-select) .el-select__selected-item {
    text-align: right !important;
    justify-content: flex-end !important;
}

.config-item-input-wrap :deep(.el-input-number) {
    max-width: 160px;
}

.config-item-action {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    padding-top: 2px;
}

.action-more {
    color: var(--k-text-light);
    opacity: 0.5;
}

.action-more:hover {
    opacity: 1;
    color: var(--k-color-primary);
}

/* iOS 风格的行列表 */
.table-editor-wrap {
    display: flex;
    flex-direction: column;
    align-items: stretch !important;
    width: 540px !important;
    gap: 16px;
}

.table-head-ios {
    display: grid;
    grid-template-columns: 1fr 1fr 120px 40px;
    gap: 12px;
    padding: 8px 12px 12px 12px;
    background: transparent;
    border-bottom: 1px solid var(--k-color-divider);
    font-size: 11px;
    font-weight: 600;
    color: var(--k-text-light);
}

.table-row-ios {
    display: grid;
    grid-template-columns: 1fr 1fr 120px 40px;
    gap: 12px;
    padding: 10px 12px;
    border-bottom: none;
    align-items: center;
}

/* 单元格无边框下划线风格 */
.cell-input-wrap :deep(.el-input__wrapper),
.table-row :deep(.el-input__wrapper),
.list-row :deep(.el-input__wrapper) {
    background: transparent !important;
    box-shadow: none !important;
    border-bottom: 1px solid var(--k-color-divider) !important;
    border-radius: 0 !important;
    padding: 0 !important;
}

.table-row :deep(.el-select) .el-select__wrapper {
    background: transparent !important;
    box-shadow: none !important;
    border-bottom: 1px solid var(--k-color-divider) !important;
    border-radius: 0 !important;
    padding: 0 !important;
}

.table-row :deep(.el-select).is-focused .el-select__wrapper {
    box-shadow: none !important;
    border-bottom: 1px solid var(--k-color-primary) !important;
}

.cell-input-wrap :deep(.el-input__wrapper):hover,
.cell-input-wrap :deep(.el-input).is-focus .el-input__wrapper,
.table-row :deep(.el-input__wrapper):hover,
.table-row :deep(.el-input).is-focus .el-input__wrapper,
.table-row :deep(.el-select) .el-select__wrapper:hover,
.list-row :deep(.el-input__wrapper):hover,
.list-row :deep(.el-input).is-focus .el-input__wrapper {
    box-shadow: none !important;
    border-bottom: 1px solid var(--k-color-primary) !important;
}

.cell-checkbox-wrap {
    display: flex;
    justify-content: center;
}

.cell-actions-wrap {
    display: flex;
    justify-content: center;
}

.field-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
}

.computed-chip {
    padding: 1px 5px;
    border-radius: 4px;
    border: 1px solid var(--k-color-warning);
    color: var(--k-color-warning);
    background: transparent;
    font-size: 10px;
    font-weight: 500;
}

.form-hint {
    display: block;
    margin-top: 3px;
    color: var(--k-text-light);
    font-size: 11px;
    line-height: 1.4;
}

.list-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
}

.table-head,
.table-row {
    display: grid;
    grid-template-columns: repeat(var(--table-columns, 4), minmax(0, 1fr)) auto;
    gap: 8px;
    align-items: center;
}

.table-head {
    color: var(--k-text-light);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 4px 12px;
    border-bottom: 1px solid var(--k-color-divider);
    text-align: center;
}

.table-row {
    position: relative;
    padding: 8px 12px;
    border-bottom: none;
    border-top: none;
    border-left: none;
    border-right: none;
    border-radius: 0;
    background: transparent;
    transition: border-color 150ms ease;
    overflow: hidden;
    text-align: center;
}

/* additionalModels 列表对齐：重置 Element Plus table 单元格的 wrapper 宽度与定位 */
.field-additionalModels .table-editor .table-row > * {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    min-width: 0;
}

.cell-component-container {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
}

.table-row :deep(.el-input-number),
.table-row :deep(.el-select),
.table-row :deep(.el-input) {
    width: 100% !important;
}

.table-row :deep(.el-input__wrapper) {
    width: 100% !important;
}

.table-row :deep(.el-select) .el-select__wrapper {
    width: 100% !important;
    justify-content: center !important;
    padding: 0 !important;
}

.table-row :deep(.el-select) .el-select__selection {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 100% !important;
    padding: 0 !important;
    box-sizing: border-box;
    flex-wrap: nowrap !important;
}

.table-row :deep(.el-select) .el-select__selected-item,
.table-row :deep(.el-select) .el-select__placeholder {
    color: var(--k-text-dark) !important;
    text-align: center !important;
    justify-content: center !important;
    width: 100% !important;
    margin: 0 !important;
}

.table-row :deep(.el-select) .el-select__suffix {
    display: none !important; /* 隐藏表格内 select 的下拉小箭头，节省空间并防止遮挡居中文字 */
}

.field-additionalModels .table-editor .table-row :deep(.el-select) .el-select__wrapper {
    justify-content: center !important;
    text-align: center !important;
}

.table-row :deep(.el-switch) {
    justify-content: center;
}

/* 隐藏 additionalModels 列表中的 tag 白框背景 */
.field-additionalModels .table-editor :deep(.el-select__tags-el) {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
}

/* 隐藏 Element Plus 默认在折叠态下渲染多选多余的 input 输入框、清空图标 */
.field-additionalModels .table-editor :deep(.el-select__input-wrapper),
.field-additionalModels .table-editor :deep(.el-select__input) {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
}

.field-additionalModels .table-editor :deep(.el-tag) {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    color: var(--k-text-dark) !important;
    padding: 0 !important;
    margin: 0 4px !important;
}

/* 折叠显示的 "+ N" 胶囊背景去除，改为与首个多选项颜色一致的普通高亮色文本 */
.field-additionalModels .table-editor :deep(.el-tag.el-tag--info) {
    margin-left: 4px !important;
    margin-right: 0 !important;
}

.field-additionalModels .table-editor :deep(.el-tag__close) {
    display: none !important;
}

/* 隐藏 responseBuiltinTools 的多选框框线背景，直接采用无背景文本，并右对齐 */
.field-responseBuiltinTools .config-item-input-wrap :deep(.el-select) .el-select__wrapper {
    background: transparent !important;
    box-shadow: none !important;
    border: none !important;
    padding: 0 !important;
}

.field-responseBuiltinTools .config-item-input-wrap :deep(.el-select) .el-select__selection {
    justify-content: flex-end !important;
    flex-wrap: nowrap !important;
}

.field-responseBuiltinTools .config-item-input-wrap :deep(.el-select) .el-tag {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    color: var(--k-text-dark) !important;
    padding: 0 !important;
    margin: 0 0 0 8px !important;
}

.field-responseBuiltinTools .config-item-input-wrap :deep(.el-select) .el-tag__close {
    display: none !important;
}

.field-responseBuiltinTools .config-item-input-wrap :deep(.el-select) .el-select__selected-item {
    text-align: right !important;
    justify-content: flex-end !important;
}

.table-row:hover {
    border-color: var(--k-color-primary);
}

.dict-group {
    position: relative;
    padding: 12px;
    border: 1px solid var(--k-color-divider);
    border-radius: 6px;
    background: transparent;
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow: hidden;
}

.dict-group-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 6px;
}

.dict-group-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid var(--k-color-divider);
    color: var(--k-text-dark);
    font-size: 11px;
    font-weight: 600;
}

.dict-group-badge::before {
    content: none;
}

.dict-rows-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.dict-row {
    position: relative;
    display: grid;
    grid-template-columns: minmax(120px, 0.8fr) minmax(0, 1.2fr) auto;
    gap: 10px;
    align-items: center;
    padding: 4px 0 4px 10px;
}

.dict-row::before {
    content: '';
    position: absolute;
    left: 0;
    top: -2px;
    bottom: 50%;
    width: 2px;
    border-left: 1px dashed var(--k-color-divider);
    border-bottom: 1px dashed var(--k-color-divider);
    border-bottom-left-radius: 4px;
}

/* Vue list transition animations */
.list-enter-active,
.list-leave-active {
    transition: opacity 150ms ease, transform 150ms ease;
}
.list-enter-from,
.list-leave-to {
    opacity: 0;
    transform: translateY(4px);
}
.list-move {
    transition: transform 150ms ease;
}
.list-leave-active {
    position: absolute;
    width: 100%;
    pointer-events: none;
    z-index: 0;
}

@media (max-width: 760px) {
    .dialog-body {
        height: calc(100vh - 220px);
        min-height: 360px;
    }

    .config-form {
        grid-template-columns: 1fr;
    }

    .cred-row,
    .cred-fields,
    .table-row,
    .dict-row {
        display: flex;
        flex-direction: column;
        align-items: stretch;
    }
}
</style>
