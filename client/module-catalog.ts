/**
 * Static frontend metadata for Hub modules.
 *
 * Runtime module list / install / config / routes are owned by
 * `src/webui/modules.ts` (`moduleDefinitions`). This file only provides:
 * - graph node fallbacks when Console DataService data is not ready
 * - detail-card copy (`moduleDetails`) for the home relationship graph
 *
 * Keep fallback ids, order, ring, entryType, activityId, and routePath aligned
 * with the server definitions when adding or renaming modules.
 */
import type { HubModuleIconName, HubModuleId, HubModuleItem } from './types'

export interface ModuleDetail {
    title: string
    subtitle: string
    description: string
    features: string[]
    tip?: string
}

type FallbackModuleDefinition = Omit<
    HubModuleItem,
    | 'available'
    | 'configPath'
    | 'configStatus'
    | 'configured'
    | 'installed'
    | 'reason'
>

interface ConfigFallbackDefinitionInput {
    id: HubModuleId
    title: string
    icon: HubModuleIconName
    order: number
}

const fallbackReason = 'Waiting for Hub module data.'

const createFallbackModule = (
    definition: FallbackModuleDefinition
): HubModuleItem => {
    const isCoreModule = definition.group === 'core'

    return {
        ...definition,
        installed: isCoreModule,
        configured: isCoreModule,
        available: isCoreModule,
        configStatus: isCoreModule ? 'none' : 'missing-package',
        reason: isCoreModule ? undefined : fallbackReason
    }
}

const createConfigFallbackDefinition = (
    definition: ConfigFallbackDefinitionInput
): FallbackModuleDefinition => ({
    ...definition,
    group: 'ecosystem',
    entryType: 'config',
    ring: 'config',
    toggleable: true
})

const configFallbackModuleDefinitions = [
    createConfigFallbackDefinition({
        id: 'character',
        title: 'Character',
        icon: 'UserFilled',
        order: 110
    }),
    createConfigFallbackDefinition({
        id: 'multimodalService',
        title: 'Multimodal Service',
        icon: 'Picture',
        order: 120
    }),
    createConfigFallbackDefinition({
        id: 'usage',
        title: 'Usage',
        icon: 'TrendCharts',
        order: 130
    }),
    createConfigFallbackDefinition({
        id: 'groupAnalysis',
        title: 'Group Analysis',
        icon: 'DataAnalysis',
        order: 140
    }),
    createConfigFallbackDefinition({
        id: 'affinity',
        title: 'Affinity',
        icon: 'Star',
        order: 150
    }),
    createConfigFallbackDefinition({
        id: 'searchService',
        title: 'Search Service',
        icon: 'Search',
        order: 160
    }),
    createConfigFallbackDefinition({
        id: 'forwardMsg',
        title: 'Forward Msg',
        icon: 'Message',
        order: 170
    }),
    createConfigFallbackDefinition({
        id: 'llmWebSearch',
        title: 'LLM Web Search',
        icon: 'Link',
        order: 180
    }),
    createConfigFallbackDefinition({
        id: 'longMemory',
        title: 'Long Memory',
        icon: 'Collection',
        order: 190
    })
]

export const fallbackModules: HubModuleItem[] = [
    {
        id: 'chatluna',
        group: 'core',
        entryType: 'hub',
        ring: 'core',
        title: 'ChatLuna',
        icon: 'ChatRound',
        order: 0,
        toggleable: false
    },
    {
        id: 'agent',
        group: 'ecosystem',
        entryType: 'webui',
        ring: 'webui',
        title: 'Agent',
        icon: 'Connection',
        order: 10,
        toggleable: true,
        activityId: 'chatluna-agent',
        routePath: '/chatluna-agent'
    },
    {
        id: 'livingMemory',
        group: 'ecosystem',
        entryType: 'webui',
        ring: 'webui',
        title: 'Living Memory',
        icon: 'Collection',
        order: 20,
        toggleable: true,
        activityId: 'chatluna-livingmemory',
        routePath: '/chatluna-livingmemory'
    },
    {
        id: 'mediaLuna',
        group: 'ecosystem',
        entryType: 'webui',
        ring: 'webui',
        title: 'media-luna',
        icon: 'Palette',
        order: 30,
        toggleable: true,
        activityId: 'media-luna',
        routePath: '/media-luna'
    },
    {
        id: 'memesLuna',
        group: 'ecosystem',
        entryType: 'webui',
        ring: 'webui',
        title: 'memesluna',
        icon: 'MemesLunaEmoji',
        order: 40,
        toggleable: true,
        activityId: 'memesluna',
        routePath: '/memesluna/'
    },
    ...configFallbackModuleDefinitions
].map(createFallbackModule)

export const moduleDetails = {
    chatluna: {
        title: 'ChatLuna 主插件',
        subtitle: 'ChatLuna生态的核心',
        description:
            '承载模型管理、会话管理以及预设管理等功能的核心中枢，是整个 ChatLuna 生态网络的根基',
        features: [
            '模型接入与统一调度',
            '按私聊、群聊分层的多会话消息系统',
            '自定义AI人格预设，兼具角色扮演与助手职能',
            '指令控制及对外部插件的灵活调用'
        ],
        tip: '文档链接：https://chatluna.chat/guide/introduction.html'
    },
    agent: {
        title: 'ChatLuna-Agent',
        subtitle: '智能体协作系统',
        description:
            '提供完整的智能体自主规划决策框架。允许AI根据已装载的工具或 skills 自主解决多步骤的复杂任务',
        features: [
            '自主规划与多步骤执行',
            '动态可控的工具、skills 调用',
            '复杂场景自动容错与推理',
            '子智能体路由分发调度'
        ],
        tip: '文档链接：https://chatluna.chat/ecosystem/plugin/extension-agent.html'
    },
    livingMemory: {
        title: 'Living Memory',
        subtitle: '异步运行的记忆系统',
        description:
            '为 ChatLuna 主插件和 character 插件提供服务于预设的第一人称叙事记忆',
        features: [
            '基于关键词 / 向量检索的记忆召回',
            '对话自动总结与记忆生成',
            '依托于持久化快照的记忆条目注入',
            '记忆跨会话存在，快照以会话为单位生成',
            '以“Dream”形式进行记忆库的整理'
        ],
        tip: '文档链接：https://github.com/Procyon-Nan/koishi-plugin-chatluna-livingmemory'
    },
    mediaLuna: {
        title: 'Media-Luna',
        subtitle: '多媒体跨模态画板',
        description:
            '中间件驱动的多媒体生成插件，支持多种 AI 图像生成服务和 WebUI 管理',
        features: [
            'DALL-E、通用 Chat API 等多连接件支持',
            '创建和管理提示词模板，支持远程同步',
            '灵活的请求处理流程，支持计费、缓存、翻译等',
            '完整的生成历史和数据统计'
        ],
        tip: '文档链接：https://github.com/ziyi233/media-luna#readme'
    },
    memesLuna: {
        title: 'MemesLuna',
        subtitle: ' Koishi 表情路由工具',
        description: '为 Chatluna 主插件和 character 插件提供变量形式的表情包图片注入',
        features: [
            '兼顾本地图片和外链的表情合集管理',
            '图床端点管理',
            '支持静态图片与动态 GIF 表情',
            '通过关键词进行表情包库的分类'
        ],
        tip: '文档链接：https://www.npmjs.com/package/koishi-plugin-memesluna/v/0.2.10'
    },
    character: {
        title: 'ChatLuna character',
        subtitle: '基于人设的拟人化角色扮演系统',
        description:
            '基于 Prompt 工程，让大语言模型在群聊或私聊内以更生动的方式进行对话',
        features: [
            '通过白名单管理应用此插件的私聊与群聊',
            '配备空闲、固定间隔和计划任务触发等主动回复机制',
            '从适配器API自动获取到历史信息进入上下文',
            '支持agent能力足够的模型通过工具调用进行回复'
        ],
        tip: '文档链接：https://chatluna.chat/ecosystem/other/character.html'
    },
    multimodalService: {
        title: 'ChatLuna Multimodal Service',
        subtitle: '多模态内容处理服务',
        description:
            '为 ChatLuna 提供图像、语音、GIF 和文件读取能力，使模型能够处理更复杂的上下文输入',
        features: [
            '为不具备原生视觉能力的模型提供图片读取支持',
            '支持语音文件转写和多媒体内容解析',
            '提供 GIF 图片处理与文件读取工具',
            '可配合存储服务管理请求中的文件资源'
        ],
        tip: '文档链接：https://chatluna.chat/guide/best-practice/character-recommended-plugins.html#chatluna-multimodal-service'
    },
    usage: {
        title: 'ChatLuna Usage',
        subtitle: '模型调用用量记录',
        description:
            '记录 ChatLuna 模型调用产生的 token 用量、调用来源和执行结果，用于后续统计与审计',
        features: [
            '按模型、平台和调用来源记录 token 消耗',
            '保留调用成功状态和估算标记',
            '支持按时间范围查询调用明细',
            '提供 tokens 指令输出不同时间粒度的消耗趋势图表'
        ],
        tip: '文档链接：待补充'
    },
    groupAnalysis: {
        title: 'ChatLuna Group Analysis',
        subtitle: '群聊分析与报告生成',
        description:
            '分析群聊历史并生成统计报告，可借助大语言模型总结话题和用户画像',
        features: [
            '统计群聊消息量、活跃时段和发言排行',
            '使用自然语言指定分析时间、人物或话题',
            '支持生成图片形式的群聊分析报告',
            '可通过命令或定时任务触发分析'
        ],
        tip: '文档链接：https://github.com/ChatLunaLab/chatluna-group-analysis#readme'
    },
    affinity: {
        title: 'ChatLuna Affinity',
        subtitle: '角色长期互动状态系统',
        description:
            '为 ChatLuna Character 管理角色与用户之间的长期状态，包括好感度、关系、黑名单和昵称',
        features: [
            '按 scopeId 隔离角色互动数据',
            '提供好感度、关系等级和黑名单变量',
            '支持 XML 工具调用写入互动状态',
            '可将排行、黑名单和详情渲染为图片'
        ],
        tip: '文档链接：https://github.com/Sor85/AAAAACAT-chatluna-plugins/tree/main/plugins/chatluna-affinity#readme.md'
    },
    searchService: {
        title: 'ChatLuna Search Service',
        subtitle: '多源聚合搜索服务',
        description:
            '为 ChatLuna 提供联网搜索工具，支持多种搜索服务源和浏览器读取能力',
        features: [
            '支持 Bing、Google、DuckDuckGo 等搜索源',
            '提供 web_search 和浏览器相关工具',
            '可配置搜索结果数量、语言和地区',
            '可配合 Puppeteer 完成网页内容读取'
        ],
        tip: '文档链接：https://chatluna.chat/ecosystem/plugin/search-service.html'
    },
    forwardMsg: {
        title: 'ChatLuna Forward Msg',
        subtitle: 'OneBot 合并转发消息工具',
        description:
            '为 ChatLuna 提供 OneBot 合并转发消息读取、发送、伪造发送和图片描述工具',
        features: [
            '读取并解析 OneBot 合并转发消息节点',
            '支持嵌套解析和读取结果缓存',
            '以 Bot 身份发送文本与图片混合转发消息',
            '可调用图片描述能力生成适合模型阅读的内容'
        ],
        tip: '文档链接：https://github.com/CookSleep/chatluna-forward-msg'
    },
    llmWebSearch: {
        title: 'ChatLuna LLM Web Search',
        subtitle: '模型内置搜索工具接入',
        description:
            '为 ChatLuna 提供基于模型内置搜索能力的 Web Search、Web Read、X Search 和 X Read 工具',
        features: [
            '支持 GPT、Gemini 和 Grok 等模型搜索能力',
            '使用 Jina Reader 读取网页 URL 内容',
            '支持 X/Twitter 内容搜索与读取',
            '可为搜索和读取结果中的图片生成描述'
        ],
        tip: '文档链接：https://github.com/CookSleep/chatluna-llm-web-search'
    },
    longMemory: {
        title: 'ChatLuna Long Memory',
        subtitle: '分层长期记忆系统',
        description:
            '为 ChatLuna 提供按全局、预设、群组和用户作用域组织的长期记忆检索与注入能力',
        features: [
            '支持 Global、Preset、Guild 和 User 多层记忆作用域',
            '可为不同记忆层配置 Basic、HippoRAG 或 EMGAS 引擎',
            '按对话轮次自动抽取长期记忆，并支持查询改写',
            '提供 memory_search、memory_add、memory_delete、memory_update 工具'
        ],
        tip: '文档链接：https://chatluna.chat/ecosystem/plugin/long-term-memory.html'
    }
} satisfies Record<HubModuleId, ModuleDetail>
