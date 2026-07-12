import { Schema } from 'koishi'

export interface Config {
    hideDependencyGraphEntry?: boolean
    enableHomeGraphAnimations?: boolean
}

export const Config: Schema<Config> = Schema.object({
    hideDependencyGraphEntry: Schema.boolean()
        .default(false)
        .description('隐藏 Koishi 侧边栏依赖图页面入口'),
    enableHomeGraphAnimations: Schema.boolean()
        .default(true)
        .description('启用首页关系图动态效果')
})
