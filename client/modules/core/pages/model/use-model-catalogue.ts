import { computed, ref } from 'vue'
import * as api from '../../api'
import { formatDateTime } from '../../format'
import { reportError } from '../../use-error-toast'
import type {
    ChatLunaCoreModelItem,
    ChatLunaCoreModelListResult,
    ChatLunaCoreModelType
} from '../../types'

type ModelTypeFilter = ChatLunaCoreModelType | 'all'

const emptyModelData = (): ChatLunaCoreModelListResult => ({
    models: [],
    platforms: [],
    summary: {
        total: 0,
        llm: 0,
        embeddings: 0,
        reranker: 0,
        unknown: 0
    },
    updatedAt: ''
})

const capabilityLabels: Record<string, string> = {
    text_input: '文本输入',
    tool_call: '工具调用',
    image_input: '图像输入',
    thinking: '思考',
    image_generation: '图像生成',
    audio_input: '音频输入',
    video_input: '视频输入',
    file_input: '文件输入'
}

/**
 * Model catalogue feature: the "已加载模型" card. Owns the loaded model list,
 * the search/type/platform/capability filters, and the model-display helpers.
 * Independent of the adapter feature; they only share the page shell.
 */
export function useModelCatalogue() {
    const loading = ref(false)
    const keyword = ref('')
    const typeFilter = ref<ModelTypeFilter>('all')
    const platformFilter = ref('all')
    const capabilityFilters = ref<string[]>([])
    const modelData = ref<ChatLunaCoreModelListResult>(emptyModelData())

    const capabilityLabel = (capability: string) => {
        return capabilityLabels[capability] ?? capability
    }

    const availableCapabilities = computed(() => {
        return Array.from(
            new Set(modelData.value.models.flatMap((item) => item.capabilities))
        ).sort((left, right) =>
            capabilityLabel(left).localeCompare(
                capabilityLabel(right),
                undefined,
                {
                    numeric: true,
                    sensitivity: 'base'
                }
            )
        )
    })

    const updatedAtText = computed(() => {
        if (!modelData.value.updatedAt) return '尚未刷新'
        // formatDateTime(value, value) preserves the original formatTime
        // behavior: return the raw string when it is unparseable.
        return `刷新于 ${formatDateTime(
            modelData.value.updatedAt,
            modelData.value.updatedAt
        )}`
    })

    const normalizedKeyword = computed(() => keyword.value.trim().toLowerCase())

    const filteredModels = computed(() => {
        const text = normalizedKeyword.value

        return modelData.value.models.filter((model) => {
            if (typeFilter.value !== 'all' && model.type !== typeFilter.value) {
                return false
            }

            if (
                platformFilter.value !== 'all' &&
                model.platform !== platformFilter.value
            ) {
                return false
            }

            if (
                capabilityFilters.value.length > 0 &&
                !capabilityFilters.value.every((capability) =>
                    model.capabilities.includes(capability)
                )
            ) {
                return false
            }

            if (!text) return true

            const haystack = [
                model.name,
                model.fullName,
                model.platform,
                model.type,
                ...model.capabilities,
                ...model.capabilities.map(capabilityLabel)
            ]
                .join(' ')
                .toLowerCase()

            return haystack.includes(text)
        })
    })

    const hasMaxTokens = computed(() => {
        return modelData.value.models.some((model) => model.maxTokens != null)
    })

    const getRowKey = (row: ChatLunaCoreModelItem) => row.id

    const modelTypeLabel = (type: ChatLunaCoreModelType) => {
        if (type === 'llm') return 'LLM'
        if (type === 'embeddings') return 'Embedding'
        if (type === 'reranker') return 'Reranker'
        return 'Unknown'
    }

    // Model-specific token formatting; intentionally kept local (not in the
    // shared formatters) because it is the only byte/number formatter unique
    // to this page.
    const formatTokens = (tokens: number | null) => {
        if (tokens == null) return '-'
        return new Intl.NumberFormat().format(tokens)
    }

    const fetchModels = async () => {
        loading.value = true

        try {
            modelData.value = await api.listChatLunaCoreModels()
        } catch (error) {
            reportError(error, '加载 ChatLuna 模型失败')
        } finally {
            loading.value = false
        }
    }

    return {
        loading,
        keyword,
        typeFilter,
        platformFilter,
        capabilityFilters,
        modelData,
        capabilityLabel,
        availableCapabilities,
        updatedAtText,
        filteredModels,
        hasMaxTokens,
        getRowKey,
        modelTypeLabel,
        formatTokens,
        fetchModels
    }
}
