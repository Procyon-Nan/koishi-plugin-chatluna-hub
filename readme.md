# koishi-plugin-chatluna-hub

[![npm](https://img.shields.io/npm/v/koishi-plugin-chatluna-hub?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-chatluna-hub)

ChatLuna Hub 是一个面向 ChatLuna 生态的 Koishi Console 插件。它在 Koishi 侧边栏提供统一入口，用关系图谱展示 ChatLuna 主插件及生态插件状态，并集中提供 ChatLuna Core 的会话、模型、预设和请求日志管理能力。

## 功能

- 在 Koishi 侧边栏注册统一入口 `ChatLuna Hub`，页面路径为 `/chatluna`。
- 通过关系图谱展示 ChatLuna 主插件、生态 WebUI 插件和配置型生态插件的安装、配置、运行状态。
- 点击可用的生态 WebUI 节点时跳转到插件原有 WebUI 路由，并通过全局返回卡片回到 Hub 首页。
- 点击可用的配置型生态节点时跳转到 Koishi 插件配置页。
- 隐藏已接入生态插件的重复侧边栏入口，避免 Koishi Console 左侧导航过长。
- 可选隐藏 Koishi Insight 依赖图侧边栏入口，但不移除 `/graph` 路由。
- 提供 ChatLuna Core 管理页：
  - 会话管理：查看、筛选、批量调整或删除 ChatLuna 会话。
  - 模型管理：查看可用模型，并管理已支持的 ChatLuna adapter 配置。
  - 预设管理：查看、校验、创建、更新和删除 ChatLuna 主插件 / Character 预设。
  - 请求日志：捕获并查看 ChatLuna 模型请求的请求体、响应体和错误信息。

## 已接入模块

### Hub 与 WebUI 跳转模块

| 模块 | 类型 | 插件名 | 路由 |
| --- | --- | --- | --- |
| ChatLuna | Core | `chatluna` | `/chatluna` |
| Agent | Ecosystem WebUI | `chatluna-agent` | `/chatluna-agent` |
| Living Memory | Ecosystem WebUI | `chatluna-livingmemory` | `/chatluna-livingmemory` |
| media-luna | Ecosystem WebUI | `media-luna` | `/media-luna` |
| memesluna | Ecosystem WebUI | `memesluna` | `/memesluna/` |

生态 WebUI 插件的原始路由不会被移除。Hub 只隐藏重复侧边栏活动入口，并通过全局返回卡片让用户回到 `/chatluna?home=1`。

### 配置入口模块

这些模块没有嵌入式 Hub 页面。Hub 会检测其安装、配置和运行状态；当 Koishi loader 中恰好存在一份配置时，节点会跳转到对应的 `/plugins/<configPath>` 配置页。

| 模块 | 插件名 |
| --- | --- |
| Character | `chatluna-character` |
| Multimodal Service | `chatluna-multimodal-service` |
| Usage | `chatluna-usage` |
| Group Analysis | `chatluna-group-analysis` |
| Affinity | `chatluna-affinity` |
| Search Service | `chatluna-search-service` |
| Forward Msg | `chatluna-forward-msg` |
| LLM Web Search | `chatluna-llm-web-search` |
| Long Memory | `chatluna-long-memory` |

## Adapter 管理

模型管理页当前支持读取和修改下列 ChatLuna adapter 的 Koishi 配置：

- `chatluna-openai-adapter`
- `chatluna-openai-like-adapter`
- `chatluna-deepseek-adapter`
- `chatluna-claude-adapter`
- `chatluna-google-gemini-adapter`
- `chatluna-doubao-adapter`
- `chatluna-rmkv-adapter`
- `chatluna-azure-openai-adapter`
- `chatluna-hunyuan-adapter`
- `chatluna-qwen-adapter`
- `chatluna-wenxin-adapter`
- `chatluna-zhipu-adapter`
- `chatluna-ollama-adapter`
- `chatluna-dify-adapter`
- `chatluna-spark-adapter`

Hub 只在 Koishi loader 可写、目标 adapter 包已安装时执行新增、修改、启停或删除操作。

## 请求日志

请求日志由 Hub 在服务端捕获 ChatLuna 模型请求产生的 HTTP exchange，并通过 Core 请求日志页展示。日志最多保留 100 条；单个请求体或响应体最多记录 512 KiB，超过后会被截断。

日志持久化到 Koishi 数据目录下的 `data/chatluna-hub/core-logs.json`。日志可能包含模型请求内容和响应内容，生产环境开启时应注意访问权限和数据清理。

## 安装方式

### 在线安装

在 Koishi 插件市场中搜索 `chatluna-hub`，并点击添加。

### 本地开发

在本地 Koishi 项目的根目录中克隆仓库：

```powershell
yarn clone https://github.com/Procyon-Nan/koishi-plugin-chatluna-hub.git
```

在仓库内构建服务端、客户端或完整产物：

```powershell
yarn build:server
yarn build:client
yarn build
```

## 配置说明

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `hideDependencyGraphEntry` | `boolean` | `false` | 是否隐藏 Koishi Insight 依赖图侧边栏入口 |

## 维护说明

1. ChatLuna Hub 的目标是提供统一 WebUI 入口，而不是替代 ChatLuna 生态插件本身。各插件仍保留自己的 WebUI 路由和 RPC 合约。
2. Hub 的生态集成以路由跳转、状态识别、配置入口和侧边栏整理为主，不要求生态插件为 Hub 重写自身页面。
3. 模块状态以当前源码中的 `src/webui/modules.ts`、`client/types.ts` 和 `client/module-catalog.ts` 为准；新增或移除模块时需要同步服务端定义、客户端类型、fallback 元数据和详情文案。
4. Core RPC 合约以 `src/webui/events.ts` 和 `src/console/listeners.ts` 为准，客户端调用封装在 `client/modules/core/api.ts`。
