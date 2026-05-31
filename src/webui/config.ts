import { Schema } from 'koishi'

export interface Config {
    hideDependencyGraphEntry?: boolean
}

export const Config: Schema<Config> = Schema.object({
    hideDependencyGraphEntry: Schema.boolean()
        .default(false)
        .description('隐藏 Koishi 侧边栏依赖图页面入口')
})
