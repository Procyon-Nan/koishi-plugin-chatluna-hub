<template>
    <el-dialog
        v-model="visible"
        width="960px"
        class="adapter-dialog editor-dialog"
        align-center
        append-to-body
        :show-close="false"
    >
        <template #header>
            <div class="dialog-hero" v-if="descriptor">
                <div class="dialog-hero-icon">
                    <el-icon :size="22"><Setting /></el-icon>
                </div>
                <div class="dialog-hero-text">
                    <span class="dialog-hero-kicker">
                        {{ instanceKey ? '编辑配置' : '新建配置' }}
                    </span>
                    <h3>{{ descriptor.title }}</h3>
                    <p>
                        配置写入
                        <code>{{ descriptor.pluginName }}</code>
                        并自动重载。
                    </p>
                </div>
                <el-button
                    class="dialog-hero-close"
                    text
                    :icon="Close"
                    @click="visible = false"
                />
            </div>
        </template>

        <div v-if="descriptor" class="dialog-body">
            <el-form
                v-if="descriptor.platformConfigurable"
                label-position="top"
                class="editor-form"
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
                class="cred-section"
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
                            />
                            <el-input
                                v-if="editorShowEndpoint"
                                v-model="entry.apiEndpoint"
                                class="cred-endpoint"
                                :placeholder="
                                    descriptor.endpointPlaceholder ||
                                    'API 端点'
                                "
                            />
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

            <section class="config-panel">
                <el-tabs class="config-tabs">
                    <el-tab-pane
                        v-for="section in visibleSections"
                        :key="section.title"
                        :label="section.title"
                    >
                        <el-form label-position="top" class="config-form">
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
                                        <div
                                            v-for="(_, rowIndex) in arrayValue(
                                                extraConfig[field.key],
                                                field.default
                                            )"
                                            :key="rowIndex"
                                            class="dict-group"
                                        >
                                            <div class="dict-group-head">
                                                <span>配置 {{ rowIndex + 1 }}</span>
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
                    </el-tab-pane>
                </el-tabs>
            </section>
        </div>

        <template #footer>
            <el-button @click="visible = false">取消</el-button>
            <el-button
                type="primary"
                :loading="saving"
                @click="emit('save')"
            >
                保存并应用
            </el-button>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
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
    ElSwitch,
    ElTabPane,
    ElTabs
} from 'element-plus'
import {
    Close,
    Delete as DeleteIcon,
    Plus,
    Setting
} from '@element-plus/icons-vue'
import type {
    ChatLunaAdapterConfigColumn,
    ChatLunaAdapterConfigField,
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

const isFieldVisible = (field: ChatLunaAdapterConfigField) => {
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

<style scoped>
.adapter-dialog :deep(.el-dialog__header) {
    margin-right: 0;
    padding: 0;
}

.adapter-dialog :deep(.el-dialog__body) {
    padding-top: 18px;
    max-height: min(72vh, 760px);
    overflow: auto;
}

.dialog-hero {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 20px 22px;
    border-radius: 12px 12px 0 0;
    background:
        radial-gradient(
            120% 160% at 0% 0%,
            color-mix(in srgb, var(--k-color-primary), transparent 86%),
            transparent 62%
        ),
        var(--k-card-bg);
    border-bottom: 1px solid var(--k-color-divider);
}

.dialog-hero::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 3px;
    border-radius: 12px 12px 0 0;
    background: linear-gradient(
        90deg,
        var(--k-color-primary),
        color-mix(in srgb, var(--k-color-primary), transparent 55%) 60%,
        transparent
    );
}

.dialog-hero-icon {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    color: #fff;
    background: linear-gradient(
        135deg,
        var(--k-color-primary),
        color-mix(in srgb, var(--k-color-primary), #7c5cff 50%)
    );
    box-shadow: 0 8px 18px
        color-mix(in srgb, var(--k-color-primary), transparent 68%);
}

.dialog-hero-text {
    min-width: 0;
    flex: 1;
}

.dialog-hero-kicker {
    display: inline-block;
    margin-bottom: 4px;
    padding: 2px 9px;
    border-radius: 999px;
    color: var(--k-color-primary);
    background: color-mix(in srgb, var(--k-color-primary), transparent 88%);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.dialog-hero-text h3 {
    margin: 2px 0 0;
    color: var(--k-text-dark);
    font-size: 19px;
    font-weight: 700;
    line-height: 1.2;
}

.dialog-hero-text p {
    margin: 5px 0 0;
    color: var(--k-text-light);
    font-size: 12px;
    line-height: 1.6;
}

.dialog-hero-text code {
    padding: 1px 6px;
    border-radius: 6px;
    background: var(--k-color-fill);
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    color: var(--k-text-dark);
}

.dialog-hero-close {
    flex-shrink: 0;
    margin: -4px -8px 0 0;
}

.dialog-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.editor-form,
.config-panel {
    padding: 14px 16px 4px;
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    background: var(--k-color-fill);
}

.cred-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.cred-section-head {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.cred-section-title {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 14px;
    font-weight: 650;
    color: var(--k-text-dark);
}

.cred-section-count {
    min-width: 20px;
    padding: 0 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--k-color-primary), transparent 86%);
    color: var(--k-color-primary);
    font-size: 12px;
    font-weight: 600;
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
.dict-editor,
.dict-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.cred-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--k-color-divider);
    border-radius: 10px;
    background: var(--k-card-bg);
    transition:
        border-color 0.15s ease,
        opacity 0.15s ease;
}

.cred-row.is-off {
    opacity: 0.6;
}

.cred-index {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    border-radius: 7px;
    display: grid;
    place-items: center;
    background: var(--k-color-fill);
    color: var(--k-text-light);
    font-size: 12px;
    font-weight: 600;
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
    flex: 1.4;
    min-width: 0;
}

.cred-endpoint {
    flex: 1;
    min-width: 0;
}

.cred-enabled,
.cred-remove {
    flex-shrink: 0;
}

.cred-empty {
    padding: 12px;
    border: 1px dashed var(--k-color-divider);
    border-radius: 10px;
    text-align: center;
    color: var(--k-text-light);
    font-size: 13px;
}

.cred-add,
.inline-add {
    align-self: flex-start;
}

.config-panel {
    padding-bottom: 14px;
}

.config-tabs :deep(.el-tabs__header) {
    margin-bottom: 14px;
}

.config-form {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 2px 16px;
}

.config-item :deep(.el-form-item__content) {
    align-items: flex-start;
}

.config-item :deep(.el-input-number),
.config-item :deep(.el-select),
.config-item :deep(.el-input) {
    width: 100%;
}

.field-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.computed-chip {
    padding: 1px 7px;
    border-radius: 999px;
    color: var(--k-color-warning);
    background: color-mix(in srgb, var(--k-color-warning), transparent 86%);
    font-size: 11px;
    font-weight: 600;
}

.form-hint {
    display: block;
    margin-top: 4px;
    color: var(--k-text-light);
    font-size: 12px;
    line-height: 1.5;
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
    font-size: 12px;
    font-weight: 600;
}

.table-row,
.dict-group {
    padding: 10px;
    border: 1px solid var(--k-color-divider);
    border-radius: 10px;
    background: var(--k-card-bg);
}

.dict-group-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--k-text-dark);
    font-size: 13px;
    font-weight: 650;
}

.dict-row {
    display: grid;
    grid-template-columns: minmax(150px, 0.8fr) minmax(0, 1.2fr) auto;
    gap: 8px;
    align-items: center;
}

@media (max-width: 760px) {
    .adapter-dialog :deep(.el-dialog) {
        width: calc(100vw - 24px) !important;
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
