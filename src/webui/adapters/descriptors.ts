/**
 * The catalogue of ChatLuna adapters the Hub can manage, plus the static
 * config form metadata copied from the adapter Koishi schemas.
 */
import type {
    ChatLunaAdapterConfigField,
    ChatLunaAdapterConfigOption,
    ChatLunaAdapterConfigSection,
    ChatLunaAdapterDescriptor
} from './types'

const modelCapabilities: ChatLunaAdapterConfigOption[] = [
    { label: '文本输入', value: 'text_input' },
    { label: '工具调用', value: 'tool_call' },
    { label: '图片视觉输入', value: 'image_input' },
    { label: '图片生成', value: 'image_generation' },
    { label: '文件输入', value: 'file_input' }
]

const responseBuiltinTools: ChatLunaAdapterConfigOption[] = [
    { label: '网页搜索', value: 'web_search' },
    { label: '网页搜索预览', value: 'web_search_preview' },
    { label: '图片生成', value: 'image_generation' },
    { label: '代码解释器', value: 'code_interpreter' },
    { label: '文件搜索', value: 'file_search' }
]

const modelTypeOptions: ChatLunaAdapterConfigOption[] = [
    { label: 'LLM 大语言模型', value: 'LLM 大语言模型' },
    { label: 'Embeddings 嵌入模型', value: 'Embeddings 嵌入模型' },
    { label: 'Reranker 重排序模型', value: 'Reranker 重排序模型' }
]

const azureModelTypeOptions: ChatLunaAdapterConfigOption[] = [
    { label: 'LLM 大语言模型', value: 'LLM 大语言模型' },
    {
        label: 'LLM 大语言模型（函数调用）',
        value: 'LLM 大语言模型（函数调用）'
    },
    { label: 'Embeddings 嵌入模型', value: 'Embeddings 嵌入模型' }
]

const workflowTypeOptions: ChatLunaAdapterConfigOption[] = [
    { label: 'Agent', value: 'Agent' },
    { label: 'Workflow', value: 'Workflow' },
    { label: 'ChatBot', value: 'ChatBot' }
]

const openAIResponseBuiltinToolSupportModelDefault = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'gpt-5',
    'gpt-5-mini',
    'gpt-5-nano',
    'o3',
    'o3-mini',
    'o4-mini'
]

const openAILikeResponseBuiltinToolSupportModelDefault = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-5.1',
    'gpt-5.2',
    'gpt-5.3',
    'gpt-5.4',
    'gpt-5.5',
    'gpt-5',
    'gpt-5-mini',
    'gpt-5-nano'
]

const defaultSparkAppConfig = {
    'spark-lite': '',
    'spark-pro': '',
    'spark-pro-128k': '',
    'spark-max': '',
    'spark-max-32k': '',
    'spark-4.0-ultra': '',
    'spark-x1.5': '',
    'spark-x2': ''
}

const commonRequestFields: ChatLunaAdapterConfigField[] = [
    {
        key: 'chatConcurrentMaxSize',
        label: '最大并发聊天数',
        kind: 'number',
        default: 3,
        min: 1,
        max: 8,
        step: 1,
        description: '当前适配器支持的模型最大并发聊天数。'
    },
    {
        key: 'chatTimeLimit',
        label: '每小时 API 调用次数限制',
        kind: 'number',
        default: 200,
        min: 1,
        max: 2000,
        step: 1
    },
    {
        key: 'configMode',
        label: '请求配置模式',
        kind: 'select',
        default: 'default',
        options: [
            { label: '顺序配置模式', value: 'default' },
            { label: '负载均衡模式', value: 'balance' }
        ]
    },
    {
        key: 'maxRetries',
        label: '最大重试次数',
        kind: 'number',
        default: 5,
        min: 1,
        max: 6,
        step: 1
    },
    {
        key: 'timeout',
        label: '请求超时时间（毫秒）',
        kind: 'number',
        default: 300000,
        min: 1,
        step: 1000
    },
    {
        key: 'proxyMode',
        label: '代理设置模式',
        kind: 'select',
        default: 'system',
        options: [
            { label: '遵循 ChatLuna 主插件全局代理设置', value: 'system' },
            { label: '禁用代理', value: 'off' },
            { label: '使用自定义代理设置', value: 'on' }
        ]
    },
    {
        key: 'proxyAddress',
        label: '自定义代理地址',
        kind: 'text',
        default: 'http://127.0.0.1:7897',
        description: '仅在代理设置模式为“使用自定义代理设置”时生效。'
    }
]

const generationFields = (
    options: {
        presencePenalty?: boolean
        frequencyPenalty?: boolean
        nonStreaming?: boolean
        temperatureMin?: number
        temperatureMax?: number
        temperatureStep?: number
        presenceMin?: number
        presenceMax?: number
    } = {}
): ChatLunaAdapterConfigField[] => {
    const fields: ChatLunaAdapterConfigField[] = [
        {
            key: 'maxContextRatio',
            label: '最大上下文使用比例',
            kind: 'number',
            default: 0.35,
            min: 0,
            max: 1,
            step: 0.0001
        },
        {
            key: 'temperature',
            label: '回复随机性',
            kind: 'number',
            default: 1,
            min: options.temperatureMin ?? 0,
            max: options.temperatureMax ?? 2,
            step: options.temperatureStep ?? 0.1
        }
    ]

    if (options.presencePenalty) {
        fields.push({
            key: 'presencePenalty',
            label: '重复惩罚系数',
            kind: 'number',
            default: 0,
            min: options.presenceMin ?? -2,
            max: options.presenceMax ?? 2,
            step: 0.1
        })
    }

    if (options.frequencyPenalty) {
        fields.push({
            key: 'frequencyPenalty',
            label: '频率惩罚系数',
            kind: 'number',
            default: 0,
            min: -2,
            max: 2,
            step: 0.1
        })
    }

    if (options.nonStreaming) {
        fields.push({
            key: 'nonStreaming',
            label: '强制不启用流式返回',
            kind: 'boolean',
            default: false
        })
    }

    return fields
}

const responseApiFields = (
    supportModelDefault: string[]
): ChatLunaAdapterConfigField[] => [
    {
        key: 'responseApi',
        label: '启用 OpenAI Responses API',
        kind: 'boolean',
        default: false
    },
    {
        key: 'responseBuiltinTools',
        label: 'Responses API 内置工具',
        kind: 'multi-select',
        default: [],
        options: responseBuiltinTools
    },
    {
        key: 'responseBuiltinToolSupportModel',
        label: '内置工具支持模型列表',
        kind: 'string-list',
        default: supportModelDefault
    },
    {
        key: 'responseFileSearchVectorStoreIds',
        label: '文件搜索 Vector Store ID',
        kind: 'string-list',
        default: []
    }
]

const additionalModelField = (
    options: {
        defaultCapabilities?: string[]
        capabilityOptions?: ChatLunaAdapterConfigOption[]
        typeOptions?: ChatLunaAdapterConfigOption[]
        includeModelType?: boolean
        requiredModel?: boolean
        defaultContextSize?: number
    } = {}
): ChatLunaAdapterConfigField => ({
    key: 'additionalModels',
    label: '额外模型列表',
    kind: 'object-table',
    default: [],
    columns: [
        {
            key: 'model',
            label: '模型名称',
            kind: 'text',
            default: '',
            required: options.requiredModel ?? true
        },
        ...(options.includeModelType === false
            ? []
            : [
                  {
                      key: 'modelType',
                      label: '模型类型',
                      kind: 'select' as const,
                      default: 'LLM 大语言模型',
                      options: options.typeOptions ?? modelTypeOptions
                  }
              ]),
        {
            key: 'modelCapabilities',
            label: '模型能力',
            kind: 'multi-select',
            default: options.defaultCapabilities ?? ['tool_call'],
            options: options.capabilityOptions ?? modelCapabilities
        },
        {
            key: 'contextSize',
            label: '上下文大小',
            kind: 'number',
            default: options.defaultContextSize ?? 128000,
            min: 1,
            step: 1
        }
    ]
})

const sections = (
    modelFields: ChatLunaAdapterConfigField[],
    extraFields: ChatLunaAdapterConfigField[] = [],
    requestFields: ChatLunaAdapterConfigField[] = commonRequestFields
): ChatLunaAdapterConfigSection[] => [
    { title: '请求配置', fields: requestFields },
    { title: '模型配置', fields: modelFields },
    ...(extraFields.length > 0
        ? [{ title: '其他设置', fields: extraFields }]
        : [])
]

const openAIModelFields = [
    ...generationFields({
        presencePenalty: true,
        frequencyPenalty: true
    }),
    ...responseApiFields(openAIResponseBuiltinToolSupportModelDefault)
]

const simplePenaltyModelFields = generationFields({
    presencePenalty: true,
    frequencyPenalty: true
})

export const adapterDescriptors: ChatLunaAdapterDescriptor[] = [
    {
        id: 'openai',
        title: 'OpenAI',
        pluginName: 'chatluna-openai-adapter',
        platformDefault: 'openai',
        platformConfigurable: false,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'https://api.openai.com/v1',
        configSections: sections(openAIModelFields)
    },
    {
        id: 'openai-like',
        title: 'OpenAI Like',
        pluginName: 'chatluna-openai-like-adapter',
        platformDefault: 'openai-like',
        platformConfigurable: true,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'https://api.openai.com/v1',
        configSections: sections(
            [
                {
                    key: 'pullModels',
                    label: '自动拉取模型列表',
                    kind: 'boolean',
                    default: true
                },
                additionalModelField({
                    defaultCapabilities: ['text_input', 'tool_call'],
                    capabilityOptions: modelCapabilities.filter(
                        (option) => option.value !== 'file_input'
                    )
                }),
                {
                    key: 'blacklistModels',
                    label: '关键词黑名单模型列表',
                    kind: 'string-list',
                    default: []
                },
                ...generationFields({
                    presencePenalty: true,
                    frequencyPenalty: true,
                    nonStreaming: true
                }),
                ...responseApiFields(
                    openAILikeResponseBuiltinToolSupportModelDefault
                )
            ],
            [
                {
                    key: 'additionCookies',
                    label: '额外 Cookie',
                    kind: 'tuple-table',
                    default: [],
                    columns: [
                        {
                            key: '0',
                            label: 'Cookie 名称',
                            kind: 'text',
                            default: ''
                        },
                        {
                            key: '1',
                            label: 'Cookie 值',
                            kind: 'text',
                            default: ''
                        }
                    ]
                },
                {
                    key: 'googleSearch',
                    label: '启用 Google 搜索',
                    kind: 'boolean',
                    default: false
                },
                {
                    key: 'googleSearchSupportModel',
                    label: 'Google 搜索支持模型列表',
                    kind: 'string-list',
                    default: ['gemini-2.0']
                }
            ]
        )
    },
    {
        id: 'deepseek',
        title: 'DeepSeek',
        pluginName: 'chatluna-deepseek-adapter',
        platformDefault: 'deepseek',
        platformConfigurable: false,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'https://api.deepseek.com/v1',
        configSections: sections(simplePenaltyModelFields)
    },
    {
        id: 'claude',
        title: 'Claude',
        pluginName: 'chatluna-claude-adapter',
        platformDefault: 'claude',
        platformConfigurable: true,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'https://api.anthropic.com/v1',
        configSections: sections([
            {
                key: 'pullModels',
                label: '自动拉取模型列表',
                kind: 'boolean',
                default: true
            },
            additionalModelField({
                includeModelType: false,
                requiredModel: true,
                defaultContextSize: 200000,
                defaultCapabilities: ['tool_call', 'image_input', 'file_input'],
                capabilityOptions: [
                    { label: '工具调用', value: 'tool_call' },
                    { label: '图片视觉输入', value: 'image_input' },
                    { label: '文件输入', value: 'file_input' }
                ]
            }),
            ...simplePenaltyModelFields
        ])
    },
    {
        id: 'gemini',
        title: 'Google Gemini',
        pluginName: 'chatluna-google-gemini-adapter',
        platformDefault: 'gemini',
        platformConfigurable: true,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'https://generativelanguage.googleapis.com/v1beta',
        configSections: sections(generationFields({ nonStreaming: true }), [
            {
                key: 'googleSearch',
                label: '启用谷歌搜索',
                kind: 'boolean',
                default: false
            },
            {
                key: 'codeExecution',
                label: '启用代码执行工具',
                kind: 'boolean',
                default: false
            },
            {
                key: 'urlContext',
                label: '启用 URL 内容获取工具',
                kind: 'boolean',
                default: false
            },
            {
                key: 'thinkingBudget',
                label: '思考预算',
                kind: 'number',
                default: -1,
                min: -1,
                max: 24576,
                step: 1
            },
            {
                key: 'includeThoughts',
                label: '获取模型思考内容',
                kind: 'boolean',
                default: false
            },
            {
                key: 'imageGeneration',
                label: '启用图像生成',
                kind: 'boolean',
                default: false
            },
            {
                key: 'imageModelSearch',
                label: '为图片生成模型启用搜索',
                kind: 'boolean',
                default: false
            },
            {
                key: 'groundingContentDisplay',
                label: '显示谷歌搜索结果',
                kind: 'boolean',
                default: false
            },
            {
                key: 'useCamelCaseSystemInstruction',
                label: '使用 systemInstruction 字段名',
                kind: 'boolean',
                default: false
            }
        ])
    },
    {
        id: 'doubao',
        title: '豆包',
        pluginName: 'chatluna-doubao-adapter',
        platformDefault: 'doubao',
        platformConfigurable: false,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'https://ark.cn-beijing.volces.com/api/v3',
        configSections: sections(simplePenaltyModelFields)
    },
    {
        id: 'rwkv',
        title: 'RWKV',
        pluginName: 'chatluna-rmkv-adapter',
        platformDefault: 'rwkv',
        platformConfigurable: false,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'http://127.0.0.1:8000/v1',
        configSections: sections(simplePenaltyModelFields)
    },
    {
        id: 'azure-openai',
        title: 'Azure OpenAI',
        pluginName: 'chatluna-azure-openai-adapter',
        platformDefault: 'azure',
        platformConfigurable: false,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'https://xxx.openai.azure.com',
        configSections: sections([
            {
                key: 'supportModels',
                label: '支持的模型列表',
                kind: 'object-table',
                default: [
                    {
                        model: 'gpt-4o',
                        modelType: 'LLM 大语言模型',
                        modelVersion: '2023-03-15-preview',
                        contextSize: 128000
                    }
                ],
                columns: [
                    {
                        key: 'model',
                        label: '模型名称（部署点名称）',
                        kind: 'text',
                        default: '',
                        required: true
                    },
                    {
                        key: 'modelType',
                        label: '模型类型',
                        kind: 'select',
                        default: 'LLM 大语言模型',
                        options: azureModelTypeOptions
                    },
                    {
                        key: 'modelVersion',
                        label: '模型版本',
                        kind: 'text',
                        default: '2023-03-15-preview'
                    },
                    {
                        key: 'contextSize',
                        label: '上下文大小',
                        kind: 'number',
                        default: 12000,
                        min: 1,
                        step: 1
                    }
                ]
            },
            ...simplePenaltyModelFields
        ])
    },
    {
        id: 'hunyuan',
        title: '腾讯混元',
        pluginName: 'chatluna-hunyuan-adapter',
        platformDefault: 'hunyuan',
        platformConfigurable: false,
        credentialKind: 'api-enabled',
        credentialField: 'apiKeys',
        configSections: sections([
            ...generationFields(),
            {
                key: 'enableSearch',
                label: '启用模型自带搜索功能',
                kind: 'boolean',
                default: true
            }
        ])
    },
    {
        id: 'qwen',
        title: '通义千问',
        pluginName: 'chatluna-qwen-adapter',
        platformDefault: 'qwen',
        platformConfigurable: false,
        credentialKind: 'api-enabled',
        credentialField: 'apiKeys',
        configSections: sections([
            additionalModelField({
                typeOptions: modelTypeOptions.filter(
                    (option) => option.value !== 'Reranker 重排序模型'
                ),
                defaultCapabilities: ['tool_call'],
                capabilityOptions: [
                    { label: '工具调用', value: 'tool_call' },
                    { label: '图片视觉输入', value: 'image_input' }
                ]
            }),
            ...generationFields(),
            {
                key: 'enableSearch',
                label: '启用模型自带夸克搜索功能',
                kind: 'boolean',
                default: true
            }
        ])
    },
    {
        id: 'wenxin',
        title: '文心一言',
        pluginName: 'chatluna-wenxin-adapter',
        platformDefault: 'wenxin',
        platformConfigurable: false,
        credentialKind: 'api-enabled',
        credentialField: 'apiKeys',
        configSections: sections([
            ...generationFields({
                presencePenalty: true,
                presenceMin: 0,
                presenceMax: 2
            }),
            {
                key: 'enableSearch',
                label: '启用模型自带搜索功能',
                kind: 'boolean',
                default: true
            }
        ])
    },
    {
        id: 'zhipu',
        title: '智谱 ChatGLM',
        pluginName: 'chatluna-zhipu-adapter',
        platformDefault: 'zhipu',
        platformConfigurable: false,
        credentialKind: 'api-enabled',
        credentialField: 'apiKeys',
        configSections: sections([
            ...simplePenaltyModelFields,
            {
                key: 'webSearch',
                label: '启用 Web 搜索功能',
                kind: 'boolean',
                default: false
            },
            {
                key: 'retrieval',
                label: '智谱知识库',
                kind: 'tuple-table',
                default: [],
                columns: [
                    {
                        key: '0',
                        label: '知识库 ID',
                        kind: 'text',
                        default: '',
                        required: true
                    },
                    {
                        key: '1',
                        label: '是否启用',
                        kind: 'boolean',
                        default: true
                    }
                ]
            },
            {
                key: 'knowledgePromptTemplate',
                label: '知识库查询模板',
                kind: 'textarea',
                default: `从文档
            """
            {{knowledge}}
            """

            中找问题

            """
            {{question}}
            """

            的答案，找到答案就仅使用文档语句回答问题，找不到答案就用自身知识回答并且告诉用户该信息不是来自文档。
            不要复述问题，直接开始回答`
            }
        ])
    },
    {
        id: 'ollama',
        title: 'Ollama',
        pluginName: 'chatluna-ollama-adapter',
        platformDefault: 'ollama',
        platformConfigurable: false,
        credentialKind: 'endpoint-enabled',
        credentialField: 'apiEndpoints',
        endpointPlaceholder: 'http://127.0.0.1:11434',
        configSections: sections(simplePenaltyModelFields, [
            {
                key: 'supportImageModels',
                label: '支持视觉图片输入的模型列表',
                kind: 'string-list',
                default: ['gemma3']
            },
            {
                key: 'keepAlive',
                label: '保持长连接',
                kind: 'boolean',
                default: true
            }
        ])
    },
    {
        id: 'dify',
        title: 'Dify',
        pluginName: 'chatluna-dify-adapter',
        platformDefault: 'dify',
        platformConfigurable: false,
        credentialKind: 'opaque',
        credentialField: '',
        configSections: sections([
            {
                key: 'apiURL',
                label: 'Dify API 后端地址',
                kind: 'text',
                default: '',
                required: true
            },
            {
                key: 'enableFileUpload',
                label: '启用 Dify local_file 上传',
                kind: 'boolean',
                default: true
            },
            {
                key: 'additionalModels',
                label: 'Dify 工作流列表',
                kind: 'object-table',
                default: [],
                columns: [
                    {
                        key: 'apiKey',
                        label: 'API Key',
                        kind: 'password',
                        default: ''
                    },
                    {
                        key: 'workflowName',
                        label: '工作流名称',
                        kind: 'text',
                        default: '',
                        required: true
                    },
                    {
                        key: 'workflowType',
                        label: '工作流类型',
                        kind: 'select',
                        default: 'ChatBot',
                        options: workflowTypeOptions
                    },
                    {
                        key: 'enabled',
                        label: '是否启用',
                        kind: 'boolean',
                        default: true
                    }
                ]
            },
            ...generationFields()
        ])
    },
    {
        id: 'spark',
        title: '讯飞星火',
        pluginName: 'chatluna-spark-adapter',
        platformDefault: 'spark',
        platformConfigurable: false,
        credentialKind: 'opaque',
        credentialField: '',
        configSections: sections(
            generationFields({
                temperatureMin: 0.1,
                temperatureMax: 1,
                temperatureStep: 0.01
            }),
            [
                {
                    key: 'appConfigs',
                    label: '讯飞星火平台配置',
                    kind: 'dict-table',
                    default: [defaultSparkAppConfig],
                    description:
                        '左边填写模型别名，右边填写该模型对应的 API Password。'
                }
            ]
        )
    }
]

const cloneDefault = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map((item) => cloneDefault(item))
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
                key,
                cloneDefault(item)
            ])
        )
    }
    return value
}

export const getAdapterDescriptor = (
    id: string
): ChatLunaAdapterDescriptor | undefined => {
    return adapterDescriptors.find((item) => item.id === id)
}

export const listAdapterConfigFields = (
    descriptor: ChatLunaAdapterDescriptor
): ChatLunaAdapterConfigField[] => {
    return descriptor.configSections.flatMap((section) => section.fields)
}

export const buildDefaultExtraConfig = (
    descriptor: ChatLunaAdapterDescriptor
): Record<string, unknown> => {
    const result: Record<string, unknown> = {}

    for (const field of listAdapterConfigFields(descriptor)) {
        if ('default' in field) {
            result[field.key] = cloneDefault(field.default)
        }
    }

    return result
}
