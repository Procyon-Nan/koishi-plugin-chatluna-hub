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
                    class="editor-form editor-block"
                >
                    <el-form-item label="平台名称">
                        <el-input
                            v-model="platform"
                            :placeholder="descriptor.platformDefault"
                        />
                        <span class="form-hint">
                            多份配置请使用不同的平台名称以避免冲突。
                        </span>
                    </el-form-item>
                </el-form>

                <div
                    v-if="descriptor.credentialKind !== 'opaque'"
                    class="cred-section editor-block"
                >
                    <div class="cred-section-head">
                        <span class="cred-section-title">
                            请求凭据
                            <span class="cred-section-count">{{
                                credentials.length
                            }}</span>
                        </span>
                        <span class="cred-section-hint">
                            多条凭据组成负载均衡池，取模型时以选中凭据为准。
                        </span>
                    </div>

                    <div class="cred-list">
                        <TransitionGroup
                            name="list"
                            tag="div"
                            class="transition-stack"
                        >
                            <div
                                v-for="(entry, index) in credentials"
                                :key="index"
                                class="cred-row"
                                :class="{ 'is-off': !entry.enabled }"
                            >
                                <span class="cred-index">{{ index + 1 }}</span>
                                <div class="cred-fields">
                                    <el-input
                                        v-if="editorShowApiKey"
                                        v-model="entry.apiKey"
                                        class="cred-key"
                                        type="password"
                                        show-password
                                        :placeholder="apiKeyPlaceholder"
                                    >
                                        <template #prefix>
                                            <el-icon class="field-icon">
                                                <Key />
                                            </el-icon>
                                        </template>
                                    </el-input>
                                    <el-input
                                        v-if="editorShowEndpoint"
                                        v-model="entry.apiEndpoint"
                                        class="cred-endpoint"
                                        :placeholder="
                                            descriptor.endpointPlaceholder ||
                                            'API 端点'
                                        "
                                    >
                                        <template #prefix>
                                            <el-icon class="field-icon">
                                                <Connection />
                                            </el-icon>
                                        </template>
                                    </el-input>
                                </div>
                                <el-switch
                                    v-model="entry.enabled"
                                    class="cred-enabled"
                                    inline-prompt
                                    active-text="启用"
                                    inactive-text="停用"
                                />
                                <el-button
                                    class="cred-remove"
                                    text
                                    type="danger"
                                    :icon="DeleteIcon"
                                    @click="emit('remove-credential', index)"
                                />
                            </div>
                        </TransitionGroup>

                        <div v-if="credentials.length === 0" class="cred-empty">
                            暂无凭据，点击下方按钮添加一条。
                        </div>

                        <el-button
                            class="cred-add"
                            :icon="Plus"
                            plain
                            @click="emit('add-credential')"
                        >
                            添加凭据
                        </el-button>
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
                        <el-form
                            label-position="top"
                            class="config-form"
                        >
                            <template
                                v-for="field in section.fields"
                                :key="field.key"
                            >
                                <el-form-item
                                    v-if="isFieldVisible(field)"
                                    class="config-item"
                                    :label="field.label"
                                    :required="field.required"
                                >
                                <template #label>
                                    <span class="field-label">
                                        {{ field.label }}
                                        <span
                                            v-if="
                                                isComputedChatLimit(field)
                                            "
                                            class="computed-chip"
                                        >
                                            复杂表达式，保留原值
                                        </span>
                                    </span>
                                </template>

                                <el-switch
                                    v-if="field.kind === 'boolean'"
                                    :model-value="
                                        Boolean(extraConfig[field.key])
                                    "
                                    @update:model-value="
                                        setConfigValue(field.key, $event)
                                    "
                                />

                                <el-input-number
                                    v-else-if="
                                        field.kind === 'number' &&
                                        !isComputedChatLimit(field)
                                    "
                                    :model-value="
                                        numberValue(
                                            extraConfig[field.key],
                                            field.default
                                        )
                                    "
                                    :min="field.min"
                                    :max="field.max"
                                    :step="field.step ?? 1"
                                    controls-position="right"
                                    @update:model-value="
                                        setConfigValue(field.key, $event)
                                    "
                                />

                                <el-input
                                    v-else-if="field.kind === 'text'"
                                    :model-value="
                                        stringValue(
                                            extraConfig[field.key],
                                            field.default
                                        )
                                    "
                                    @update:model-value="
                                        setConfigValue(field.key, $event)
                                    "
                                />

                                <el-input
                                    v-else-if="field.kind === 'textarea'"
                                    :model-value="
                                        stringValue(
                                            extraConfig[field.key],
                                            field.default
                                        )
                                    "
                                    type="textarea"
                                    :autosize="{ minRows: 4, maxRows: 10 }"
                                    @update:model-value="
                                        setConfigValue(field.key, $event)
                                    "
                                />

                                <el-select
                                    v-else-if="field.kind === 'select'"
                                    :model-value="
                                        extraConfig[field.key] ??
                                        field.default
                                    "
                                    @update:model-value="
                                        setConfigValue(field.key, $event)
                                    "
                                >
                                    <el-option
                                        v-for="option in field.options ??
                                        []"
                                        :key="String(option.value)"
                                        :label="option.label"
                                        :value="option.value"
                                    />
                                </el-select>

                                <el-select
                                    v-else-if="
                                        field.kind === 'multi-select'
                                    "
                                    :model-value="
                                        arrayValue(
                                            extraConfig[field.key],
                                            field.default
                                        )
                                    "
                                    multiple
                                    collapse-tags
                                    collapse-tags-tooltip
                                    @update:model-value="
                                        setConfigValue(field.key, $event)
                                    "
                                >
                                    <el-option
                                        v-for="option in field.options ??
                                        []"
                                        :key="String(option.value)"
                                        :label="option.label"
                                        :value="option.value"
                                    />
                                </el-select>

                                <div
                                    v-else-if="
                                        field.kind === 'string-list'
                                    "
                                    class="list-editor"
                                >
                                    <TransitionGroup
                                        name="list"
                                        tag="div"
                                        class="transition-stack"
                                    >
                                        <div
                                            v-for="(_, index) in arrayValue(
                                                extraConfig[field.key],
                                                field.default
                                            )"
                                            :key="index"
                                            class="list-row"
                                        >
                                            <el-input
                                                :model-value="
                                                    String(
                                                        arrayValue(
                                                            extraConfig[
                                                                field.key
                                                            ],
                                                            field.default
                                                        )[index] ?? ''
                                                    )
                                                "
                                                @update:model-value="
                                                    updateStringList(
                                                        field,
                                                        index,
                                                        $event
                                                    )
                                                "
                                            />
                                            <el-button
                                                text
                                                type="danger"
                                                :icon="DeleteIcon"
                                                @click="
                                                    removeArrayRow(field, index)
                                                "
                                            />
                                        </div>
                                    </TransitionGroup>
                                    <el-button
                                        class="inline-add"
                                        plain
                                        :icon="Plus"
                                        @click="addStringListRow(field)"
                                    >
                                        添加
                                    </el-button>
                                </div>

                                <div
                                    v-else-if="
                                        field.kind === 'tuple-table' ||
                                        field.kind === 'object-table'
                                    "
                                    class="table-editor"
                                >
                                    <div
                                        class="table-head"
                                        :style="
                                            tableGridStyle(field)
                                        "
                                    >
                                        <span
                                            v-for="column in field.columns"
                                            :key="column.key"
                                        >
                                            {{ column.label }}
                                        </span>
                                        <span />
                                    </div>
                                    <TransitionGroup
                                        name="list"
                                        tag="div"
                                        class="transition-stack"
                                    >
                                        <div
                                            v-for="(_, index) in arrayValue(
                                                extraConfig[field.key],
                                                field.default
                                            )"
                                            :key="index"
                                            class="table-row"
                                            :style="tableGridStyle(field)"
                                        >
                                            <template
                                                v-for="column in field.columns"
                                                :key="column.key"
                                            >
                                                <component
                                                    :is="
                                                        column.kind ===
                                                        'boolean'
                                                            ? ElSwitch
                                                            : column.kind ===
                                                                'number'
                                                              ? ElInputNumber
                                                              : column.kind ===
                                                                  'select' ||
                                                                  column.kind ===
                                                                      'multi-select'
                                                                ? ElSelect
                                                                : ElInput
                                                    "
                                                    v-bind="
                                                        columnComponentProps(
                                                            field,
                                                            column,
                                                            index
                                                        )
                                                    "
                                                    @update:model-value="
                                                        updateTableCell(
                                                            field,
                                                            column,
                                                            index,
                                                            $event
                                                        )
                                                    "
                                                >
                                                    <template
                                                        v-if="
                                                            column.kind ===
                                                                'select' ||
                                                            column.kind ===
                                                                'multi-select'
                                                        "
                                                    >
                                                        <el-option
                                                            v-for="option in column.options ??
                                                            []"
                                                            :key="
                                                                String(
                                                                    option.value
                                                                )
                                                            "
                                                            :label="
                                                                option.label
                                                            "
                                                            :value="
                                                                option.value
                                                            "
                                                        />
                                                    </template>
                                                </component>
                                            </template>
                                            <el-button
                                                text
                                                type="danger"
                                                :icon="DeleteIcon"
                                                @click="
                                                    removeArrayRow(field, index)
                                                "
                                            />
                                        </div>
                                    </TransitionGroup>
                                    <el-button
                                        class="inline-add"
                                        plain
                                        :icon="Plus"
                                        @click="addTableRow(field)"
                                    >
                                        添加
                                    </el-button>
                                </div>

                                <div
                                    v-else-if="field.kind === 'dict-table'"
                                    class="dict-editor"
                                >
                                    <TransitionGroup
                                        name="list"
                                        tag="div"
                                        class="transition-stack"
                                    >
                                        <div
                                            v-for="(_, rowIndex) in arrayValue(
                                                extraConfig[field.key],
                                                field.default
                                            )"
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
                                                    @click="
                                                        removeArrayRow(
                                                            field,
                                                            rowIndex
                                                        )
                                                    "
                                                />
                                            </div>
                                            <TransitionGroup
                                                name="list"
                                                class="dict-rows-container"
                                                tag="div"
                                            >
                                                <div
                                                    v-for="(_, entryIndex) in dictEntries(
                                                        field,
                                                        rowIndex
                                                    )"
                                                    :key="entryIndex"
                                                    class="dict-row"
                                                >
                                                    <el-input
                                                        :model-value="
                                                            dictEntries(
                                                                field,
                                                                rowIndex
                                                            )[entryIndex][0]
                                                        "
                                                        placeholder="模型别名"
                                                        @update:model-value="
                                                            updateDictEntryKey(
                                                                field,
                                                                rowIndex,
                                                                entryIndex,
                                                                $event
                                                            )
                                                        "
                                                    />
                                                    <el-input
                                                        :model-value="
                                                            dictEntries(
                                                                field,
                                                                rowIndex
                                                            )[entryIndex][1]
                                                        "
                                                        type="password"
                                                        show-password
                                                        placeholder="API Password"
                                                        @update:model-value="
                                                            updateDictEntryValue(
                                                                field,
                                                                rowIndex,
                                                                entryIndex,
                                                                $event
                                                            )
                                                        "
                                                    />
                                                    <el-button
                                                        text
                                                        type="danger"
                                                        :icon="DeleteIcon"
                                                        @click="
                                                            removeDictEntry(
                                                                field,
                                                                rowIndex,
                                                                entryIndex
                                                            )
                                                        "
                                                    />
                                                </div>
                                            </TransitionGroup>
                                            <el-button
                                                class="inline-add"
                                                plain
                                                :icon="Plus"
                                                @click="
                                                    addDictEntry(
                                                        field,
                                                        rowIndex
                                                    )
                                                "
                                            >
                                                添加键值
                                            </el-button>
                                        </div>
                                    </TransitionGroup>
                                    <el-button
                                        class="inline-add"
                                        plain
                                        :icon="Plus"
                                        @click="addDictGroup(field)"
                                    >
                                        添加配置组
                                    </el-button>
                                </div>

                                <span
                                    v-if="field.description"
                                    class="form-hint"
                                >
                                    {{ field.description }}
                                </span>
                            </el-form-item>
                            </template>
                        </el-form>
                    </div>
                </div>
            </div>
        </div>

        <div class="picker-footer">
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
            collapseTagsTooltip: true
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
    border: 1px solid var(--k-color-divider) !important;
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
    padding: 14px 16px;
    background: var(--k-page-bg);
}

.picker-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: var(--k-card-bg);
    border-top: 1px solid var(--k-color-divider);
}

.footer-btn {
    border-radius: 4px;
    font-weight: 500;
    font-size: 13px;
}

.dialog-body {
    height: min(68vh, 680px);
    max-height: 100%;
    min-height: min(460px, calc(100vh - 220px));
    overflow: hidden;
}

.dialog-body.is-single-column {
    height: min(68vh, 680px);
}

.dialog-main {
    min-width: 0;
    min-height: 0;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow: auto;
    padding: 14px;
    border: 1px solid var(--k-color-divider);
    border-radius: 6px;
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
}

.editor-form {
    padding-bottom: 16px;
    border-bottom: 1px dashed var(--k-color-divider);
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
    border-bottom: 1px solid var(--k-color-divider);
}

.config-panel-head h4 {
    margin: 0;
    color: var(--k-text-dark);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.02em;
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
    padding-bottom: 16px;
    border-bottom: 1px dashed var(--k-color-divider);
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
    gap: 10px;
    padding: 8px 12px;
    border: 1px solid var(--k-color-divider);
    border-radius: 6px;
    background: transparent;
    transition:
        border-color 150ms ease,
        opacity 150ms ease;
}

.cred-row:hover:not(.is-off) {
    border-color: var(--k-color-primary);
}

.cred-row.is-off {
    opacity: 0.4;
}

.cred-index {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    display: grid;
    place-items: center;
    border: 1px solid var(--k-color-divider);
    color: var(--k-text-light);
    font-size: 10px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
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

.cred-add,
.inline-add {
    align-self: flex-start;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    border: 1px solid var(--k-color-divider);
    background: transparent;
    transition: border-color 150ms ease, color 150ms ease;
}

.cred-add:hover,
.inline-add:hover {
    border-color: var(--k-color-primary);
    color: var(--k-color-primary);
}

.config-form {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 16px;
}

.config-item :deep(.el-form-item__content) {
    align-items: flex-start;
}

.config-item :deep(.el-input-number),
.config-item :deep(.el-select),
.config-item :deep(.el-input) {
    width: 100%;
}

.config-item:has(.list-editor),
.config-item:has(.table-editor),
.config-item:has(.dict-editor) {
    grid-column: 1 / -1;
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
    padding: 4px 8px;
    border-bottom: 1px solid var(--k-color-divider);
}

.table-row {
    position: relative;
    padding: 8px 12px;
    border: 1px solid var(--k-color-divider);
    border-radius: 6px;
    background: transparent;
    transition: border-color 150ms ease;
    overflow: hidden;
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
    border-bottom: 1px dashed var(--k-color-divider);
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
