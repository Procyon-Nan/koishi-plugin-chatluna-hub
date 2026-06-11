# koishi-plugin-chatluna-hub

[![npm](https://img.shields.io/npm/v/koishi-plugin-chatluna-hub?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-chatluna-hub)

ChatLuna Hub 是一个面向 ChatLuna 生态的 Koishi 控制台插件。它在 Koishi Console 中提供侧边栏 WebUI 入口，用于整合 ChatLuna 生态插件的 WebUI，并集中管理 ChatLuna 主插件的常用配置

## 功能

- 在 Koishi 侧边栏注册统一入口 `ChatLuna Hub`
- 通过关系图谱展示 ChatLuna 主插件和 ChatLuna 生态插件的配置、运行状态
- 通过点击插件节点跳转到插件原有的 WebUI，并在右上角显示返回 Hub 的入口
- 隐藏已接入生态插件的重复侧边栏入口，避免 Koishi Console 左侧导航过长
- 提供 ChatLuna 主插件的常用配置管理：
  - 会话管理：查看并编辑主插件的会话
  - 模型管理：根据已安装的 ChatLuna adapter 来进行可视化的模型适配器配置并查看可用模型
  - 预设管理：查看并编辑 ChatLuna 主插件 / Character 伪装插件预设
  - 请求日志：捕获并查看 ChatLuna 主插件的请求体 / 响应体日志

## 已接入的生态插件：

| 模块 | 类型 | 插件名 | WebUI 路由 |
| --- | --- | --- | --- |
| ChatLuna | Core | `chatluna` | `/chatluna` |
| Agent | Ecosystem | `chatluna-agent` | `/chatluna-agent` |
| Living Memory | Ecosystem | `chatluna-livingmemory` | `/chatluna-livingmemory` |
| media-luna | Ecosystem | `media-luna` | `/media-luna` |
| memesluna | Ecosystem | `memesluna` | `/memesluna/` |

生态插件的原始路由不会被移除。Hub 只隐藏重复侧边栏活动入口，并通过全局返回按钮让用户回到 chatluna-hub 的首页。

## 安装方式

### 在线安装

在 Koishi 的插件市场中搜索 `chatluna-hub`，并点击添加

### 本地开发

1. 在本地 Koishi 项目的根目录中克隆仓库：

```bash
yarn clone https://github.com/Procyon-Nan/koishi-plugin-chatluna-hub.git
```

2. 在本地 Koishi 项目的根目录中构建：

```bash
yarn build chatluna-hub
```

## 配置说明

| 配置项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `hideDependencyGraphEntry` | `boolean` | `false` | 是否隐藏 Koishi Insight 依赖图侧边栏入口 |

## 你需要知道

1. ChatLuna Hub 的目标是提供统一 WebUI 入口，**而不是替代 ChatLuna 生态插件本身**。各插件仍保留自己的WebUI 路由和 RPC 合约；Hub 通过路由跳转、状态识别和侧边栏整理来降低用户在多个 ChatLuna 生态插件 WebUI 之间切换的成本
2. ChatLuna Hub 不会要求其他插件主动适配自身（~~除非其提供的 WebUI 入口过于诡异，但想必不会有人这么干吧~~），且目前只接入了**确实提供 WebUI 入口**的插件，如果存在新的此类插件但首页中未出现，请提 issues 或 PR ，作者会及时进行适配
3. ChatLuna Hub 的大部分操作方式在首页右侧的卡片中已经说明，所以不在此赘述