<template>
    <el-dialog
        v-model="visible"
        width="960px"
        class="adapter-dialog editor-dialog"
        top="4vh"
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

        <div
            v-if="descriptor"
            class="dialog-body"
            :class="{ 'is-single-column': visibleSections.length === 0 }"
        >
            <aside
                v-if="visibleSections.length > 0"
                class="section-rail"
                aria-label="适配器配置分组"
            >
                <button
                    v-for="section in visibleSections"
                    :key="section.title"
                    type="button"
                    class="section-rail-item"
                    :class="{ 'is-active': activeSectionTitle === section.title }"
                    @click="activeSectionTitle = section.title"
                >
                    <span class="section-rail-dot" />
                    <span class="section-rail-text">
                        <span>{{ section.title }}</span>
                        <small>{{ visibleFieldCount(section) }} 项配置</small>
                    </span>
                </button>
            </aside>

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

                <section class="config-panel editor-block">
                    <div class="config-panel-head" v-if="currentSection">
                        <div>
                            <span class="config-panel-kicker">配置分组</span>
                            <h4>{{ currentSection.title }}</h4>
                        </div>
                        <span class="config-panel-count">
                            {{ currentVisibleFieldCount }} 项配置
                        </span>
                    </div>

                    <div class="config-fields-viewport">
                        <el-form
                            v-if="currentSection"
                            label-position="top"
                            class="config-form"
                        >
                            <template
                                v-for="field in currentSection.fields"
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
                </section>
            </div>
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

const activeSectionTitle = ref('')

watch(
    visibleSections,
    (newSections) => {
        if (newSections && newSections.length > 0) {
            if (
                !activeSectionTitle.value ||
                !newSections.some(
                    (section) => section.title === activeSectionTitle.value
                )
            ) {
                activeSectionTitle.value = newSections[0].title
            }
        }
    },
    { immediate: true }
)

const currentSection = computed(() => {
    return (
        visibleSections.value.find(
            (section) => section.title === activeSectionTitle.value
        ) || visibleSections.value[0]
    )
})

const currentVisibleFieldCount = computed(() => {
    return currentSection.value ? visibleFieldCount(currentSection.value) : 0
})

function visibleFieldCount(section: ChatLunaAdapterConfigSection) {
    return section.fields.filter(isFieldVisible).length
}

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

<style scoped>
:deep(.el-dialog.editor-dialog) {
    --adapter-dialog-bg: color-mix(
        in srgb,
        var(--k-card-bg),
        var(--k-page-bg) 46%
    );
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 8vh);
    margin: 4vh auto !important;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 16px;
    background: var(--adapter-dialog-bg);
}

.adapter-dialog :deep(.el-dialog__header) {
    flex-shrink: 0;
    margin-right: 0;
    padding: 14px 14px 0;
    border-radius: 16px 16px 0 0;
    background: var(--adapter-dialog-bg);
    overflow: hidden;
}

.adapter-dialog :deep(.el-dialog__body) {
    flex: 1;
    min-height: 0;
    padding: 18px 20px;
    overflow: hidden;
    background: var(--adapter-dialog-bg);
}

.adapter-dialog :deep(.el-dialog__footer) {
    flex-shrink: 0;
    padding: 14px 22px 18px;
    border-top: 1px solid var(--k-color-divider);
    border-radius: 0 0 16px 16px;
    background: var(--adapter-dialog-bg);
}

.dialog-hero {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 20px 22px;
    border-radius: 14px;
    overflow: hidden;
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
    border-radius: 14px 14px 0 0;
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
    display: grid;
    grid-template-columns: 190px minmax(0, 1fr);
    gap: 16px;
    height: min(68vh, 680px);
    max-height: 100%;
    min-height: min(460px, calc(100vh - 220px));
    padding: 0;
    overflow: hidden;
}

.dialog-body.is-single-column {
    grid-template-columns: minmax(0, 1fr);
}

.section-rail {
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    background: var(--k-card-bg);
    overflow: auto;
}

.section-rail-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: transparent;
    color: var(--k-text-light);
    text-align: left;
    cursor: pointer;
    transition:
        border-color 0.18s ease,
        background 0.18s ease,
        color 0.18s ease,
        box-shadow 0.18s ease;
}

.section-rail-item:hover {
    color: var(--k-text-dark);
    background: var(--adapter-dialog-bg);
}

.section-rail-item.is-active {
    color: var(--k-text-dark);
    border-color: color-mix(in srgb, var(--k-color-primary), transparent 58%);
    background: var(--adapter-dialog-bg);
    box-shadow: 0 8px 18px
        color-mix(in srgb, var(--k-color-primary), transparent 90%);
}

.section-rail-dot {
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--k-text-light);
    opacity: 0.55;
}

.section-rail-item.is-active .section-rail-dot {
    background: var(--k-color-primary);
    opacity: 1;
    box-shadow: 0 0 8px var(--k-color-primary);
}

.section-rail-text {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;
    font-weight: 700;
}

.section-rail-text small {
    color: var(--k-text-light);
    font-size: 11px;
    font-weight: 500;
}

.dialog-main {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow: auto;
    padding-right: 4px;
}

.dialog-main::-webkit-scrollbar,
.section-rail::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

.dialog-main::-webkit-scrollbar-track,
.section-rail::-webkit-scrollbar-track {
    background: color-mix(in srgb, var(--k-color-fill), transparent 35%);
    border-radius: 999px;
}

.dialog-main::-webkit-scrollbar-thumb,
.section-rail::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: color-mix(in srgb, var(--k-text-light), transparent 62%);
}

.editor-block {
    padding: 14px 16px;
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    background: var(--k-card-bg);
    box-shadow: 0 4px 14px
        color-mix(in srgb, var(--k-color-divider), transparent 88%);
}

.editor-form {
    background: var(--k-card-bg);
}

.config-panel {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-bottom: 16px;
}

.config-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1px dashed var(--k-color-divider);
}

.config-panel-kicker {
    display: block;
    margin-bottom: 3px;
    color: var(--k-text-light);
    font-size: 11px;
    font-weight: 700;
}

.config-panel-head h4 {
    margin: 0;
    color: var(--k-text-dark);
    font-size: 16px;
    line-height: 1.35;
}

.config-panel-count {
    flex-shrink: 0;
    padding: 3px 9px;
    border-radius: 999px;
    color: var(--k-color-primary);
    background: color-mix(in srgb, var(--k-color-primary), transparent 88%);
    font-size: 12px;
    font-weight: 700;
}

.config-fields-viewport {
    min-width: 0;
}

.cred-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.cred-section-head {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.cred-section-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 700;
    color: var(--k-text-dark);
}

.cred-section-count {
    min-width: 22px;
    height: 18px;
    line-height: 18px;
    padding: 0 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--k-color-primary), transparent 88%);
    color: var(--k-color-primary);
    font-size: 11px;
    font-weight: 700;
    text-align: center;
}

.cred-section-hint {
    color: var(--k-text-light);
    font-size: 12px;
    line-height: 1.6;
}

.cred-list,
.list-editor,
.table-editor,
.dict-editor {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.transition-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.dict-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.cred-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    background: var(--k-card-bg);
    box-shadow: 0 2px 8px
        color-mix(in srgb, var(--k-color-divider), transparent 85%);
    transition:
        border-color 0.2s cubic-bezier(0.22, 1, 0.36, 1),
        box-shadow 0.2s cubic-bezier(0.22, 1, 0.36, 1),
        opacity 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.cred-row:hover:not(.is-off) {
    border-color: color-mix(in srgb, var(--k-color-primary), transparent 50%);
    box-shadow: 0 4px 12px
        color-mix(in srgb, var(--k-color-primary), transparent 90%);
}

.cred-row.is-off {
    opacity: 0.5;
    background: var(--k-color-fill);
}

.cred-index {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    background: var(--k-color-fill);
    color: var(--k-text-light);
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}

.cred-fields {
    display: flex;
    align-items: center;
    gap: 12px;
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
    opacity: 0.7;
    transition: color 0.2s ease, opacity 0.2s ease;
}

.el-input:focus-within .field-icon {
    color: var(--k-color-primary);
    opacity: 1;
}

.cred-enabled,
.cred-remove {
    flex-shrink: 0;
}

.cred-empty {
    padding: 24px;
    border: 1px dashed var(--k-color-divider);
    border-radius: 12px;
    text-align: center;
    color: var(--k-text-light);
    font-size: 13px;
    background: color-mix(in srgb, var(--k-card-bg), var(--k-color-fill) 30%);
}

.cred-add,
.inline-add {
    align-self: flex-start;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s ease;
}

.cred-add:hover,
.inline-add:hover {
    transform: translateY(-1px);
    box-shadow: 0 3px 8px
        color-mix(in srgb, var(--k-color-primary), transparent 85%);
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

.config-item:has(.list-editor),
.config-item:has(.table-editor),
.config-item:has(.dict-editor) {
    grid-column: 1 / -1;
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
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 6px 12px;
    border-bottom: 1px solid var(--k-color-divider);
}

.table-row {
    position: relative;
    padding: 14px 16px;
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    background: var(--k-card-bg);
    box-shadow: 0 2px 6px
        color-mix(in srgb, var(--k-color-divider), transparent 90%);
    transition: all 0.22s ease;
    overflow: hidden;
}

.table-row::before {
    content: '';
    position: absolute;
    top: 6px;
    bottom: 6px;
    left: 0;
    width: 3px;
    border-radius: 0 4px 4px 0;
    background: var(--k-color-primary);
    opacity: 0;
    transition: opacity 0.2s ease;
}

.table-row:hover::before {
    opacity: 1;
}

.table-row:hover {
    border-color: color-mix(in srgb, var(--k-color-primary), transparent 60%);
    box-shadow: 0 4px 12px
        color-mix(in srgb, var(--k-color-primary), transparent 92%);
}

.dict-group {
    position: relative;
    padding: 18px;
    border: 1px solid var(--k-color-divider);
    border-radius: 14px;
    background: var(--k-card-bg);
    box-shadow: 0 3px 8px
        color-mix(in srgb, var(--k-color-divider), transparent 88%);
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow: hidden;
}

.dict-group::before {
    content: '';
    position: absolute;
    top: 8px;
    bottom: 8px;
    left: 0;
    width: 4px;
    border-radius: 0 4px 4px 0;
    background: var(--k-color-primary);
    opacity: 0.5;
}

.dict-group:hover::before {
    opacity: 1;
}

.dict-group-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 12px;
    border-bottom: 1px dashed var(--k-color-divider);
}

.dict-group-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 8px;
    background: var(--k-color-fill);
    color: var(--k-text-dark);
    font-size: 12px;
    font-weight: 750;
}

.dict-group-badge::before {
    content: '';
    display: inline-block;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--k-color-primary);
    box-shadow: 0 0 5px var(--k-color-primary);
}

.dict-rows-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.dict-row {
    position: relative;
    display: grid;
    grid-template-columns: minmax(150px, 0.8fr) minmax(0, 1.2fr) auto;
    gap: 12px;
    align-items: center;
    padding: 6px 0 6px 14px;
}

.dict-row::before {
    content: '';
    position: absolute;
    left: 0;
    top: -4px;
    bottom: 50%;
    width: 2px;
    border-left: 2px dashed
        color-mix(in srgb, var(--k-color-divider), transparent 50%);
    border-bottom: 2px dashed
        color-mix(in srgb, var(--k-color-divider), transparent 50%);
    border-bottom-left-radius: 6px;
}

/* Vue list transition animations */
.list-enter-active,
.list-leave-active {
    transition: all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.list-enter-from,
.list-leave-to {
    opacity: 0;
    transform: scale(0.97) translateY(8px);
}
.list-move {
    transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.list-leave-active {
    position: absolute;
    width: 100%;
    pointer-events: none;
    z-index: 0;
}

@media (max-width: 760px) {
    :deep(.el-dialog.editor-dialog) {
        width: calc(100vw - 24px) !important;
        max-width: calc(100vw - 24px);
        max-height: calc(100vh - 24px);
        margin: 12px auto !important;
    }

    .adapter-dialog :deep(.el-dialog__body) {
        padding: 14px;
    }

    .dialog-body {
        grid-template-columns: 1fr;
        height: calc(100vh - 220px);
        min-height: 360px;
    }

    .section-rail {
        min-height: auto;
        flex-direction: row;
        overflow-x: auto;
    }

    .section-rail-item {
        min-width: 150px;
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
