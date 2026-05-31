/**
 * Static descriptive content for each Hub module, shown in the relationship
 * graph's detail card. Pure content — no logic — kept out of the graph SFC so
 * the component focuses on layout and animation.
 */
import type { HubModuleId } from '../../types'

export interface ModuleDetail {
    title: string
    subtitle: string
    description: string
    features: string[]
    tip?: string
}

export const moduleDetails: Record<HubModuleId, ModuleDetail> = {
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
    }
}
