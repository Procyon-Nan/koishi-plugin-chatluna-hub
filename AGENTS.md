# chatluna-hub 开发规范

## 项目定位

`chatluna-hub`（npm 包名 `koishi-plugin-chatluna-hub`）是 ChatLuna 生态的
Koishi Console 管理入口，位于 `koishi-dev` 工作区的 `external/chatluna-hub`。
本地运行环境由工作区根目录的 Koishi 实例提供，仓库也支持独立安装和构建。

Hub 负责首页关系图、生态插件入口与配置操作，以及 Core 会话、模型、适配器、
预设和请求日志管理。模型供应商协议、ChatLuna 对话执行、生态插件自身的 WebUI
和 Koishi Console 框架不属于本项目职责。

插件名为 `chatluna-hub`，服务名为 `chatluna_hub`，Console 数据字段为
`chatluna_hub_webui`，页面入口为 `/chatluna`，RPC 命名空间为 `chatluna-hub/*`。

## 代码文件结构

```text
chatluna-hub/
├── src/
│   ├── index.ts                 # 插件装配、可选服务注入、类型合并与公共导出
│   ├── console/                 # RPC 监听注册、权限与 Console DataService
│   └── webui/
│       ├── service.ts           # Hub 服务门面、模块启停与配置创建
│       ├── config.ts            # 插件配置 schema
│       ├── events.ts            # Console RPC 与数据服务契约
│       ├── modules.ts           # 生态模块定义、安装/配置/运行状态与路由
│       ├── loader.ts            # Koishi loader 配置匹配与操作辅助
│       ├── package-resolver.ts  # 包解析与安装状态检测
│       ├── adapters/            # 适配器描述、实例读取与配置变更
│       └── core/                # 会话、模型、预设文件、请求捕获与日志存储
├── client/
│   ├── index.ts                 # Hub 页面、侧边栏隐藏与全局返回卡片注册
│   ├── types.ts                 # 生态模块及 Console 契约镜像
│   ├── module-catalog.ts        # 模块静态回退元数据与展示文案
│   ├── module-access.ts         # 模块入口、配置创建和启停资格
│   ├── components/
│   │   ├── home/               # 关系图、物理运动、拖拽、持久化与详情面板
│   │   └── layout/             # Hub 页面壳、返回按钮与生态路由返回卡片
│   ├── icons/                  # Hub 与生态模块图标
│   └── modules/core/
│       ├── page.vue            # Core 标签状态与页面保活
│       ├── sidebar.vue         # Core 标签切换
│       ├── api.ts              # Core RPC 调用
│       ├── types.ts            # Core 服务端 DTO 类型重导出
│       ├── components/         # 页面头部、预设编辑器与日志查看器等
│       └── pages/              # 会话、模型、预设、预设广场与请求日志页面
├── scripts/                    # 服务端声明文件及 ESM/CJS 构建
└── .github/workflows/           # npm 自动发布
```

新增、删除、移动或重命名上述源码或脚本目录时同步更新本节；目录内普通文件的
变化不需要逐项记录。`src/webui/core.ts` 和 `adapters.ts` 是导出入口，具体业务
实现在同名目录中。

## 设计约束

### Console 装配与生态集成

- 先注册 `ChatLunaHubService`，再在 `ctx.inject(['console', 'chatluna_hub'])`
  中注册 Console bundle、RPC 和 DataService。请求日志集成单独依赖
  `chatluna_hub` 与 `chatluna`。
- 客户端只注册 Hub 顶层页面：名称 `ChatLuna Hub`、路径 `/chatluna`、权限
  `3`、字段 `['chatluna_hub_webui']`。
- Console 资源入口基于 loader baseDir 下的
  `node_modules/koishi-plugin-chatluna-hub`，不要改成 `external/` 的直接路径，
  后者可能无法通过 Koishi 生产资源服务加载。这与构建工具的依赖解析是两回事。
- Core 在 Hub 内展示；生态 WebUI 跳转插件原始路由。通过 `activity` bail hook
  隐藏重复侧边栏入口，不移除路由，不为生态插件另建顶层页面，不隐藏 Hub 自身。
- 生态返回卡片由全局 slot 注册，返回 `/chatluna?home=1`。
  `hideDependencyGraphEntry` 默认关闭，启用时也只隐藏 `/graph` 的侧边栏入口。
- 路由定义由 `modules.ts` 提供，`module-catalog.ts` 维护静态回退；页面壳读取
  `target.routePath`，不再维护第三份路由表。

### 模块状态与 loader 变更

- `installed`、`configured`、`available` 分别表示包可解析、配置存在、运行
  作用域可用，不能混用。模块 DTO 变化同步更新 `client/types.ts` 和静态目录。
- 启停要求 `toggleable && installed && configStatus === 'single'`；前端复用
  `canToggleHubModule()`，服务端独立校验。多配置返回 `ambiguous`，缺少配置
  返回 `not-configured`，不得猜测目标配置。
- 唯一配置的配置页路径由服务端生成。未安装模块可跳转市场，已安装但未配置
  的生态模块可创建配置后跳转；保留按模块合并在途创建请求的机制。
- 模块和适配器写操作必须检查 loader 能力、可写性及包安装状态。启用插件前
  校验配置；已启用但运行失败的配置仍允许重试加载。
- 适配器描述由 `adapters/descriptors.ts` 维护，读取与写入分别属于该目录中的
  专门模块。不可用实例仍需展示并说明原因，不能因运行失败从列表消失。

### 首页关系图

- `hub-relationship-graph.vue` 负责组合，运动、几何、拖拽、视图控制和持久化
  由 `components/home/` 内现有模块负责。布局为左侧图区域、右侧详情栏。
- 图节点和生态总数取自模块列表，不维护独立计数；调整节点行为时保持模块状态
  与实际 loader 操作一致。
- `enableHomeGraphAnimations` 默认开启，客户端缺少该字段也视为开启。关闭时
  仅停止自主运动和装饰动画，拖拽、缩放、选择、范围调整与插件启停继续工作。
  不因此停止整个 runtime，它还负责 resize 和 KeepAlive 生命周期。
- 有效范围椭圆只在调节时临时展示。重置同时清除节点位置、范围、详情字号、
  缩放、延续的视觉状态与速度，以及对应 localStorage 项。

### Core 页面与 RPC

- Core 标签为 `conversation`、`model`、`preset`、`square`、`log`，由
  `page.vue` 管理。紧凑模式默认开启，状态由 `use-compact-mode.ts` 共享持久化。
- 预设广场通过 `square-page.vue` 内的 iframe 加载线上站点。保留 `v-show`
  常驻 DOM，移出 DOM 即使配合 KeepAlive 也会导致外部页面重载。
- RPC 变更同步维护 `src/webui/events.ts`、`src/console/listeners.ts`、服务
  方法、`client/modules/core/api.ts` 及相关 DTO。权限与变更后数据刷新在
  listener 注册层维护；Core 客户端类型通过类型重导出复用服务端 DTO。
- 会话查询使用 ChatLuna 会话与绑定表，变更及缓存清理使用
  `ctx.chatluna.conversation`，不能引入 Living Memory 安装依赖。
- 模型目录读取 ChatLuna platform 提供的数据。能力标记按适配器上报元数据
  展示，不在客户端推断或重写。

### 预设文件

- 预设来源区分 `core` 与 `character`，分别通过各自 preset 服务解析目录；
  服务不可用时沿用 `data/chathub/presets` 与 `data/chathub/character/presets`。
- 客户端预设 ID 使用 `source:filename`，不暴露绝对路径。文件访问必须经
  `resolvePresetFile()` 约束在来源预设目录内。
- YAML 校验使用 `js-yaml` 与本地结构检查：Core 要求 `keywords` 和有效
  `prompts`，Character 要求 `name`、`input`、`system`。Core 支持 `.yml` 和
  `.txt`，Character 只支持 `.yml`。
- 编辑器为 `PresetCodeEditor.vue` 的 textarea 实现，保留行号与缩进辅助；
  未明确要求时不引入 Monaco 等编辑器依赖。

### 请求日志与补丁生命周期

- `requester-log.ts` 负责模型请求 HTTP 捕获，`log-store.ts` 负责内存和文件
  存储，`log-types.ts` 负责 DTO。日志持久化到 Koishi `ctx.baseDir` 下的
  `data/chatluna-hub/core-logs.json`。
- 同一个 ChatLuna 服务实例只允许一个 Hub 补丁所有者。替换 provider 前释放
  旧所有者；disposer 必须幂等，兼容 Hub 服务与注入作用域以不同顺序销毁。
- `_createStream` 必须同步返回 async iterable，不能用 async 包装函数将其
  改成 Promise。直接返回包装生成器，将原方法调用推迟至首次 `next()`；上游
  对返回值直接 `for await`，不会先 await。
- 保留最多 `100` 条日志，请求和响应正文最多各 `512 * 1024` 字符，截断状态
  随 DTO 返回。日志包含提示词与响应正文，保持清空入口及现有捕获范围。

## 工程与验证

- 格式与 lint 规则以 `.prettierrc`、`.eslintrc.yml` 为准。Console 类型合并
  使用 `namespace Console`，对应 lint 规则已关闭。
- `lib/`、`dist/` 是生成产物；`build:server` 输出类型声明和 ESM/CJS bundle，
  `build:client` 输出 Console 静态资源。
- 仅文档变更运行 `git diff --check`。`yarn lint` 只检查 `src` 的 TypeScript，
  不覆盖 Vue 客户端；按变更范围使用 `npm run build:server`、
  `npm run build:client` 或 `npm run build` 验证构建。
- 发布构建依赖必须在本仓库声明并使用标准解析，不能依赖上层工作区的固定
  `node_modules` 路径。`package-lock.json` 用于独立 CI 安装。

## 发布流程

- `.github/workflows/publish.yml` 在 `master` 的 `package.json` 或工作流文件
  变化后触发，也支持手动运行。当前版本已存在时跳过；npm 查询只有 `E404`
  进入发布，其他错误终止流程。
- CI 使用 Node 24，依次执行 `npm ci`、`npm run build` 和
  `npm publish --access public`。更新版本时同步锁文件的根包版本。
- npm Trusted Publisher 绑定 `Procyon-Nan/koishi-plugin-chatluna-hub` 与 `publish.yml`，
  工作流保留 `id-token: write`。当前采用直接发布，npm 侧必须允许
  `npm publish`；修改仓库或工作流文件名时同步更新绑定。配置步骤见 readme。
