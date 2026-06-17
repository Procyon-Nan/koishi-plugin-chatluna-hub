import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as api from '../../api'
import { formatDateTime } from '../../format'
import { reportError } from '../../use-error-toast'
import type {
    ChatLunaAdapterConfigColumn,
    ChatLunaAdapterConfigField,
    ChatLunaAdapterCredentialEntry,
    ChatLunaAdapterCredentialKind,
    ChatLunaAdapterConfigSection,
    ChatLunaAdapterInstance,
    ChatLunaAdapterListResult,
    ChatLunaAdapterStatus,
    ChatLunaAdapterType
} from '../../types'

export type AdapterScope = 'all' | 'running' | 'configured' | 'disabled'

export interface EditorDescriptor {
    adapterId: string
    title: string
    pluginName: string
    credentialKind: ChatLunaAdapterCredentialKind
    platformConfigurable: boolean
    endpointPlaceholder?: string
    platformDefault: string
    configSections: ChatLunaAdapterConfigSection[]
    defaultExtraConfig: Record<string, unknown>
}

const emptyAdapterData = (): ChatLunaAdapterListResult => ({
    instances: [],
    types: [],
    platformMap: {},
    writable: true,
    updatedAt: ''
})

const statusLabels: Record<ChatLunaAdapterStatus, string> = {
    running: '运行中',
    configured: '已配置',
    available: '未配置',
    unavailable: '不可用',
    unsupported: '需原生配置'
}

const adapterScopeOptions: { label: string; value: AdapterScope }[] = [
    { label: '全部', value: 'all' },
    { label: '运行中', value: 'running' },
    { label: '已停用', value: 'disabled' }
]

const createCredentialEntry = (): ChatLunaAdapterCredentialEntry => ({
    apiKey: '',
    apiEndpoint: '',
    enabled: true
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

const resetRecord = (
    target: Record<string, unknown>,
    source: Record<string, unknown>
) => {
    for (const key of Object.keys(target)) {
        delete target[key]
    }

    Object.assign(target, cloneConfigValue(source))
}

const isEmptyValue = (value: unknown) => {
    return (
        value == null ||
        (typeof value === 'string' && value.trim().length === 0)
    )
}

const validateNumber = (
    label: string,
    value: unknown,
    min?: number,
    max?: number
) => {
    const numberValue =
        typeof value === 'number'
            ? value
            : typeof value === 'string' && value.trim()
              ? Number(value)
              : NaN

    if (!Number.isFinite(numberValue)) return `${label} 必须是数字。`
    if (typeof min === 'number' && numberValue < min) {
        return `${label} 不能小于 ${min}。`
    }
    if (typeof max === 'number' && numberValue > max) {
        return `${label} 不能大于 ${max}。`
    }
}

const validateOption = (
    label: string,
    value: unknown,
    options: ChatLunaAdapterConfigField['options']
) => {
    if (!options?.length) return
    if (!options.some((option) => option.value === value)) {
        return `${label} 包含不支持的选项。`
    }
}

const validateColumn = (
    column: ChatLunaAdapterConfigColumn,
    value: unknown
) => {
    if (column.required && isEmptyValue(value)) {
        return `${column.label} 不能为空。`
    }

    if (column.kind === 'number') {
        return validateNumber(column.label, value, column.min, column.max)
    }

    if (column.kind === 'select') {
        return validateOption(column.label, value, column.options)
    }

    if (column.kind === 'multi-select') {
        const values = Array.isArray(value) ? value : []
        const invalid = values.some((item) =>
            column.options?.length
                ? !column.options.some((option) => option.value === item)
                : false
        )
        if (invalid) return `${column.label} 包含不支持的选项。`
    }
}

const validateField = (
    field: ChatLunaAdapterConfigField,
    config: Record<string, unknown>
) => {
    if (field.key === 'proxyAddress' && config.proxyMode !== 'on') return

    const value = config[field.key]
    if (field.key === 'chatTimeLimit' && typeof value === 'object') return

    if (field.required && isEmptyValue(value)) {
        return `${field.label} 不能为空。`
    }

    if (field.kind === 'number') {
        return validateNumber(field.label, value, field.min, field.max)
    }

    if (field.kind === 'select') {
        return validateOption(field.label, value, field.options)
    }

    if (field.kind === 'multi-select') {
        const values = Array.isArray(value) ? value : []
        const invalid = values.some((item) =>
            field.options?.length
                ? !field.options.some((option) => option.value === item)
                : false
        )
        if (invalid) return `${field.label} 包含不支持的选项。`
    }

    if (field.kind === 'tuple-table' || field.kind === 'object-table') {
        const rows = Array.isArray(value) ? value : []
        const columns = field.columns ?? []

        for (const row of rows) {
            for (let index = 0; index < columns.length; index++) {
                const column = columns[index]
                const cell =
                    field.kind === 'tuple-table' && Array.isArray(row)
                        ? row[index]
                        : row && typeof row === 'object' && !Array.isArray(row)
                          ? (row as Record<string, unknown>)[column.key]
                          : undefined
                const error = validateColumn(column, cell ?? column.default)
                if (error) return error
            }
        }
    }
}

const validateExtraConfig = (
    descriptor: EditorDescriptor,
    config: Record<string, unknown>
) => {
    for (const section of descriptor.configSections) {
        for (const field of section.fields) {
            const error = validateField(field, config)
            if (error) return error
        }
    }
}

/**
 * Adapter feature: the "模型适配器" card plus its add-type picker and
 * configuration editor dialogs. Coordinates with the model catalogue through
 * the injected `refreshModels` callback (toggle/save/delete reload both lists).
 */
export function useAdapters(refreshModels: () => Promise<void>) {
    const adapterLoading = ref(false)
    const adapterData = ref<ChatLunaAdapterListResult>(emptyAdapterData())
    const adapterKeyword = ref('')
    const adapterScope = ref<AdapterScope>('all')
    const busyKey = ref<string | null>(null)

    const pickerVisible = ref(false)
    const pickerKeyword = ref('')
    const editorVisible = ref(false)
    const editorDescriptor = ref<EditorDescriptor | null>(null)
    const editorInstanceKey = ref<string | undefined>(undefined)
    const editorPlatform = ref('')
    const editorCredentials = reactive<ChatLunaAdapterCredentialEntry[]>([])
    const editorExtraConfig = reactive<Record<string, unknown>>({})
    const savingAdapter = ref(false)

    const instances = computed(() => adapterData.value.instances)
    const types = computed(() => adapterData.value.types)
    const adapterWritable = computed(() => adapterData.value.writable)
    const adapterCount = computed(() => instances.value.length)
    // NOTE: configuredCount is intentionally identical to adapterCount; the
    // original page derived both from instances.value.length. Preserved as-is.
    const configuredCount = computed(() => instances.value.length)
    const runningCount = computed(
        () => instances.value.filter((item) => item.status === 'running').length
    )

    const adapterReason = computed(() => adapterData.value.reason ?? '')

    const adapterUpdatedText = computed(() => {
        if (!adapterData.value.updatedAt) return '尚未刷新'
        // formatDateTime(value, value) preserves the original formatTime
        // behavior: return the raw string when it is unparseable.
        return `刷新于 ${formatDateTime(
            adapterData.value.updatedAt,
            adapterData.value.updatedAt
        )}`
    })

    const normalizedAdapterKeyword = computed(() =>
        adapterKeyword.value.trim().toLowerCase()
    )

    const filteredInstances = computed(() => {
        const text = normalizedAdapterKeyword.value

        return instances.value.filter((instance) => {
            if (
                adapterScope.value === 'running' &&
                instance.status !== 'running'
            ) {
                return false
            }
            if (adapterScope.value === 'disabled' && !instance.disabled) {
                return false
            }

            if (!text) return true

            return [instance.title, instance.platform, instance.pluginName]
                .join(' ')
                .toLowerCase()
                .includes(text)
        })
    })

    // NOTE: the 'configured' scope branch is dead (no scope option emits it);
    // preserved exactly from the original as this is a structural refactor.
    const scopeCount = (scope: AdapterScope) => {
        if (scope === 'running') {
            return instances.value.filter((item) => item.status === 'running')
                .length
        }
        if (scope === 'disabled') {
            return instances.value.filter((item) => item.disabled).length
        }
        return instances.value.length
    }

    const platformLabel = (platform: string) => {
        const title = adapterData.value.platformMap[platform]
        return title ? `${title} · ${platform}` : platform
    }

    const adapterTitleOf = (platform: string) => {
        return adapterData.value.platformMap[platform] ?? platform
    }

    const statusLabel = (status: ChatLunaAdapterStatus) => statusLabels[status]

    const openCreatePicker = async () => {
        pickerKeyword.value = ''
        const refreshed = await fetchAdapters()
        if (!refreshed) return

        pickerVisible.value = true
    }

    const chooseType = (type: ChatLunaAdapterType) => {
        if (!type.canCreate) {
            if (type.createReason) ElMessage.warning(type.createReason)
            return
        }

        editorDescriptor.value = {
            adapterId: type.id,
            title: type.title,
            pluginName: type.pluginName,
            credentialKind: type.credentialKind,
            platformConfigurable: type.platformConfigurable,
            endpointPlaceholder: type.endpointPlaceholder,
            platformDefault: type.platformDefault,
            configSections: type.configSections,
            defaultExtraConfig: type.defaultExtraConfig
        }
        editorInstanceKey.value = undefined
        editorPlatform.value = ''
        editorCredentials.splice(
            0,
            editorCredentials.length,
            ...(type.credentialKind === 'opaque' ? [] : [createCredentialEntry()])
        )
        resetRecord(editorExtraConfig, type.defaultExtraConfig)

        pickerVisible.value = false
        editorVisible.value = true
    }

    const openEditor = (instance: ChatLunaAdapterInstance) => {
        if (!instance.installed) {
            ElMessage.warning(instance.unavailableReason)
            return
        }

        editorDescriptor.value = {
            adapterId: instance.adapterId,
            title: instance.title,
            pluginName: instance.pluginName,
            credentialKind: instance.credentialKind,
            platformConfigurable: instance.platformConfigurable,
            endpointPlaceholder: instance.endpointPlaceholder,
            platformDefault: instance.platform,
            configSections: instance.configSections,
            defaultExtraConfig: instance.defaultExtraConfig
        }
        editorInstanceKey.value = instance.instanceKey
        editorPlatform.value = instance.platformConfigurable
            ? instance.platform
            : ''
        editorCredentials.splice(
            0,
            editorCredentials.length,
            ...instance.credentials.map((entry) => ({ ...entry }))
        )

        if (
            instance.credentialKind !== 'opaque' &&
            editorCredentials.length === 0
        ) {
            editorCredentials.push(createCredentialEntry())
        }

        resetRecord(editorExtraConfig, {
            ...instance.defaultExtraConfig,
            ...instance.extraConfig
        })
        editorVisible.value = true
    }

    const addCredential = () => {
        editorCredentials.push(createCredentialEntry())
    }

    const removeCredential = (index: number) => {
        editorCredentials.splice(index, 1)
    }

    const fetchAdapters = async (): Promise<boolean> => {
        adapterLoading.value = true

        try {
            adapterData.value = await api.listChatLunaAdapters()
            return true
        } catch (error) {
            reportError(error, '加载适配器失败')
            return false
        } finally {
            adapterLoading.value = false
        }
    }

    const saveEditor = async () => {
        const descriptor = editorDescriptor.value
        if (!descriptor) return

        savingAdapter.value = true

        try {
            const validationError = validateExtraConfig(
                descriptor,
                editorExtraConfig
            )
            if (validationError) {
                ElMessage.error(validationError)
                return
            }

            const result = await api.saveChatLunaAdapter({
                adapterId: descriptor.adapterId,
                instanceKey: editorInstanceKey.value,
                platform: descriptor.platformConfigurable
                    ? editorPlatform.value
                    : undefined,
                credentials: editorCredentials.map((entry) => ({ ...entry })),
                extraConfig: cloneConfigValue(editorExtraConfig)
            })

            if (!result.ok) {
                ElMessage.error(result.reason ?? '保存失败')
                return
            }

            ElMessage.success('适配器配置已保存')
            editorVisible.value = false
            await Promise.all([fetchAdapters(), refreshModels()])
        } catch (error) {
            reportError(error, '保存适配器失败')
        } finally {
            savingAdapter.value = false
        }
    }

    const handleToggle = async (instance: ChatLunaAdapterInstance) => {
        if (!instance.installed) {
            ElMessage.warning(instance.unavailableReason)
            return
        }

        busyKey.value = instance.instanceKey

        try {
            const result = await api.toggleChatLunaAdapter({
                instanceKey: instance.instanceKey,
                enabled: instance.disabled
            })

            if (!result.ok) {
                ElMessage.error(result.reason ?? '操作失败')
                return
            }

            ElMessage.success(
                instance.disabled ? '适配器已启用' : '适配器已停用'
            )
            await Promise.all([fetchAdapters(), refreshModels()])
        } catch (error) {
            reportError(error, '切换适配器失败')
        } finally {
            busyKey.value = null
        }
    }

    const handleDelete = async (instance: ChatLunaAdapterInstance) => {
        try {
            await ElMessageBox.confirm(
                `确认删除「${instance.title} · ${instance.platform}」的配置？此操作会从 Koishi 配置中移除该插件条目，且不可撤销。`,
                '删除适配器配置',
                {
                    type: 'warning',
                    confirmButtonText: '删除',
                    cancelButtonText: '取消',
                    confirmButtonClass: 'el-button--danger'
                }
            )
        } catch {
            return
        }

        busyKey.value = instance.instanceKey

        try {
            const result = await api.deleteChatLunaAdapter({
                instanceKey: instance.instanceKey
            })

            if (!result.ok) {
                ElMessage.error(result.reason ?? '删除失败')
                return
            }

            ElMessage.success('适配器配置已删除')
            await Promise.all([fetchAdapters(), refreshModels()])
        } catch (error) {
            reportError(error, '删除适配器失败')
        } finally {
            busyKey.value = null
        }
    }

    return {
        adapterScopeOptions,
        adapterLoading,
        adapterData,
        adapterKeyword,
        adapterScope,
        busyKey,
        pickerVisible,
        pickerKeyword,
        editorVisible,
        editorDescriptor,
        editorInstanceKey,
        editorPlatform,
        editorCredentials,
        editorExtraConfig,
        savingAdapter,
        instances,
        types,
        adapterWritable,
        adapterCount,
        configuredCount,
        runningCount,
        adapterReason,
        adapterUpdatedText,
        filteredInstances,
        scopeCount,
        platformLabel,
        adapterTitleOf,
        statusLabel,
        openCreatePicker,
        chooseType,
        openEditor,
        addCredential,
        removeCredential,
        fetchAdapters,
        saveEditor,
        handleToggle,
        handleDelete
    }
}
