/**
 * The catalogue of ChatLuna adapters the Hub can manage, plus a lookup helper.
 * Pure data — adding support for a new adapter is a single entry here.
 */
import type { ChatLunaAdapterDescriptor } from './types'

export const adapterDescriptors: ChatLunaAdapterDescriptor[] = [
    {
        id: 'openai',
        title: 'OpenAI',
        pluginName: 'chatluna-openai-adapter',
        platformDefault: 'openai',
        platformConfigurable: false,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'https://api.openai.com/v1'
    },
    {
        id: 'openai-like',
        title: 'OpenAI Like',
        pluginName: 'chatluna-openai-like-adapter',
        platformDefault: 'openai-like',
        platformConfigurable: true,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'https://api.openai.com/v1'
    },
    {
        id: 'deepseek',
        title: 'DeepSeek',
        pluginName: 'chatluna-deepseek-adapter',
        platformDefault: 'deepseek',
        platformConfigurable: false,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'https://api.deepseek.com'
    },
    {
        id: 'claude',
        title: 'Claude',
        pluginName: 'chatluna-claude-adapter',
        platformDefault: 'claude',
        platformConfigurable: true,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'https://api.anthropic.com/v1'
    },
    {
        id: 'gemini',
        title: 'Google Gemini',
        pluginName: 'chatluna-google-gemini-adapter',
        platformDefault: 'gemini',
        platformConfigurable: true,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'https://generativelanguage.googleapis.com/v1beta'
    },
    {
        id: 'doubao',
        title: '豆包',
        pluginName: 'chatluna-doubao-adapter',
        platformDefault: 'doubao',
        platformConfigurable: false,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'https://ark.cn-beijing.volces.com/api/v3'
    },
    {
        id: 'rwkv',
        title: 'RWKV',
        pluginName: 'chatluna-rmkv-adapter',
        platformDefault: 'rwkv',
        platformConfigurable: false,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'http://127.0.0.1:8000/v1'
    },
    {
        id: 'azure-openai',
        title: 'Azure OpenAI',
        pluginName: 'chatluna-azure-openai-adapter',
        platformDefault: 'azure',
        platformConfigurable: false,
        credentialKind: 'api-endpoint-enabled',
        credentialField: 'apiKeys',
        endpointPlaceholder: 'https://xxx.openai.azure.com'
    },
    {
        id: 'hunyuan',
        title: '腾讯混元',
        pluginName: 'chatluna-hunyuan-adapter',
        platformDefault: 'hunyuan',
        platformConfigurable: false,
        credentialKind: 'api-enabled',
        credentialField: 'apiKeys'
    },
    {
        id: 'qwen',
        title: '通义千问',
        pluginName: 'chatluna-qwen-adapter',
        platformDefault: 'qwen',
        platformConfigurable: false,
        credentialKind: 'api-enabled',
        credentialField: 'apiKeys'
    },
    {
        id: 'wenxin',
        title: '文心一言',
        pluginName: 'chatluna-wenxin-adapter',
        platformDefault: 'wenxin',
        platformConfigurable: false,
        credentialKind: 'api-enabled',
        credentialField: 'apiKeys'
    },
    {
        id: 'zhipu',
        title: '智谱 ChatGLM',
        pluginName: 'chatluna-zhipu-adapter',
        platformDefault: 'zhipu',
        platformConfigurable: false,
        credentialKind: 'api-enabled',
        credentialField: 'apiKeys'
    },
    {
        id: 'ollama',
        title: 'Ollama',
        pluginName: 'chatluna-ollama-adapter',
        platformDefault: 'ollama',
        platformConfigurable: false,
        credentialKind: 'endpoint-enabled',
        credentialField: 'apiEndpoints',
        endpointPlaceholder: 'http://127.0.0.1:11434'
    },
    {
        id: 'dify',
        title: 'Dify',
        pluginName: 'chatluna-dify-adapter',
        platformDefault: 'dify',
        platformConfigurable: false,
        credentialKind: 'opaque',
        credentialField: 'additionalModels'
    },
    {
        id: 'spark',
        title: '讯飞星火',
        pluginName: 'chatluna-spark-adapter',
        platformDefault: 'spark',
        platformConfigurable: false,
        credentialKind: 'opaque',
        credentialField: 'appConfigs'
    }
]

export const getAdapterDescriptor = (
    id: string
): ChatLunaAdapterDescriptor | undefined => {
    return adapterDescriptors.find((item) => item.id === id)
}
