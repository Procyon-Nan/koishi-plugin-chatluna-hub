<template>
    <div class="hub-container" :class="{ 'graph-mode': !active }">
        <div class="main-content">
            <div v-if="active" class="module-view">
                <hub-return-button @click="showHome" />

                <core-page
                    v-if="activeModule?.id === 'chatluna' && activeModule.available"
                />

                <el-scrollbar v-else class="module-scroll">
                    <div class="content-wrapper">
                        <section v-if="activeModule" class="module-page">
                            <header class="module-header">
                                <div class="module-icon">
                                    <el-icon :size="34">
                                        <component :is="resolveIcon(activeModule.icon)" />
                                    </el-icon>
                                </div>
                                <div>
                                    <span class="module-kicker">
                                        {{ activeModule.group === 'core' ? 'Core' : 'Ecosystem' }}
                                    </span>
                                    <h1>{{ activeModule.title }}</h1>
                                    <p>{{ moduleDescription }}</p>
                                </div>
                            </header>

                            <div class="unavailable-panel">
                                <div class="panel-icon">
                                    <el-icon :size="28">
                                        <CircleClose />
                                    </el-icon>
                                </div>
                                <div>
                                    <h2>Module not enabled</h2>
                                    <p>{{ activeModule.reason ?? 'This module is not available.' }}</p>
                                </div>
                            </div>
                        </section>
                    </div>
                </el-scrollbar>
            </div>

            <div v-else class="content-wrapper home-wrapper">
                <hub-relationship-graph
                    :modules="modules"
                    :animations-enabled="homeGraphAnimationsEnabled"
                    @select="handleSelect"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'
import { router, send, store } from '@koishijs/client'
import { ElMessage } from 'element-plus'
import {
    ChatRound,
    CircleClose,
    Collection,
    Connection,
    Brush,
    DataAnalysis,
    Link,
    Message,
    Picture,
    Search,
    Star,
    TrendCharts,
    UserFilled
} from '@element-plus/icons-vue'
import HubRelationshipGraph from '../home/hub-relationship-graph.vue'
import HubReturnButton from './hub-return-button.vue'
import CorePage from '../../modules/core/page.vue'
import MemesLunaIcon from '../../icons/memesluna.vue'
import {
    canCreateHubModuleConfig,
    canOpenHubModule,
    canOpenHubModuleMarket
} from '../../module-access'
import { fallbackModules } from '../../module-catalog'
import type {
    HubModuleCreateConfigResult,
    HubModuleIconName,
    HubModuleId,
    HubModuleItem
} from '../../types'

const icons = {
    ChatRound,
    Collection,
    Connection,
    DataAnalysis,
    Link,
    Message,
    Palette: Brush,
    Picture,
    Search,
    Star,
    TrendCharts,
    UserFilled,
    MemesLunaEmoji: MemesLunaIcon
} satisfies Record<HubModuleIconName, Component>

const hubHomePath = '/chatluna'
/** Only Core (chatluna) embeds inside Hub; ecosystem modules navigate away. */
const active = ref<HubModuleId | null>(null)
const pendingConfigCreations = new Set<HubModuleId>()
const data = computed(() => store.chatluna_hub_webui)
const homeGraphAnimationsEnabled = computed(
    () => data.value?.config?.enableHomeGraphAnimations !== false
)
const modules = computed<HubModuleItem[]>(() => {
    const items = data.value?.modules
    return items?.length ? items : fallbackModules
})
const activeModule = computed(() => {
    if (!active.value) return null
    return modules.value.find((item) => item.id === active.value) ?? null
})
const moduleDescription = computed(() => {
    if (!activeModule.value) return ''
    if (activeModule.value.id === 'chatluna') {
        return 'Core management surfaces for the main ChatLuna plugin.'
    }

    return activeModule.value.reason ?? 'This module is not available.'
})

const resolveIcon = (icon: HubModuleIconName) => icons[icon]
const showHome = () => {
    active.value = null
}

watch(
    () => router.currentRoute.value.fullPath,
    () => {
        const route = router.currentRoute.value
        if (route.path === hubHomePath && route.query.home === '1') {
            showHome()
        }
    },
    { immediate: true }
)

const openModuleRoute = (routePath: string) => {
    void router.push(routePath)
}

const handleSelect = async (id: HubModuleId) => {
    const target = modules.value.find((item) => item.id === id)
    if (!target) return

    if (canOpenHubModule(target)) {
        if (target.routePath) {
            openModuleRoute(target.routePath)
            return
        }

        // Hub-owned embed: ChatLuna Core only (no routePath).
        active.value = id
        return
    }

    if (canOpenHubModuleMarket(target)) {
        void router.push({
            path: '/market',
            query: {
                keyword: target.marketPackageName
            }
        })
        return
    }

    if (!canCreateHubModuleConfig(target)) return
    if (pendingConfigCreations.has(id)) return

    pendingConfigCreations.add(id)

    try {
        const result = (await send(
            'chatluna-hub/module/create-config',
            id
        )) as HubModuleCreateConfigResult | undefined

        if (!result?.ok || !result.routePath) {
            ElMessage.error(result?.reason ?? '无法创建插件配置')
            return
        }

        openModuleRoute(result.routePath)
    } catch (error) {
        ElMessage.error(
            error instanceof Error ? error.message : String(error)
        )
    } finally {
        pendingConfigCreations.delete(id)
    }
}
</script>

<style scoped>
.hub-container {
    position: relative;
    height: 100%;
    overflow: hidden;
    background: var(--k-page-bg);
    color: var(--k-text-dark);
}

.hub-container.graph-mode {
    background: var(--k-page-bg);
}

.main-content {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
}

.module-view {
    min-height: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
}

.module-scroll {
    min-height: 0;
    flex: 1;
}

.content-wrapper {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 28px 96px 120px 28px;
    flex: 1;
}

.home-wrapper {
    height: 100%;
    padding: 0;
    display: flex;
    flex-direction: column;
}

.module-page {
    width: min(1040px, 100%);
    display: grid;
    gap: 22px;
}

.module-header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 16px;
}

.module-icon,
.panel-icon {
    width: 58px;
    height: 58px;
    border: 1px solid var(--k-color-divider);
    border-radius: 8px;
    display: grid;
    place-items: center;
    color: var(--k-color-primary);
    background: var(--k-card-bg);
    box-shadow: var(--k-card-shadow);
}

.module-kicker {
    display: block;
    margin-bottom: 6px;
    color: var(--k-text-light);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0;
    text-transform: uppercase;
}

.module-header h1,
.unavailable-panel h2 {
    margin: 0;
    color: var(--k-text-dark);
}

.module-header h1 {
    font-size: 28px;
    line-height: 1.15;
}

.module-header p,
.unavailable-panel p {
    margin: 0;
    color: var(--k-text-light);
    line-height: 1.58;
}

.module-header p {
    margin-top: 8px;
    font-size: 14px;
}

.unavailable-panel {
    border: 1px solid var(--k-color-divider);
    border-radius: 8px;
    background: var(--k-card-bg);
    box-shadow: var(--k-card-shadow);
    padding: 20px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 16px;
}

.unavailable-panel h2 {
    font-size: 18px;
}

.unavailable-panel p {
    margin-top: 8px;
    font-size: 14px;
}

.unavailable-panel .panel-icon {
    color: var(--k-color-warning);
}

@media (max-width: 768px) {
    .content-wrapper {
        padding: 16px 16px 112px;
    }

    .home-wrapper {
        padding: 0;
    }

    .module-header {
        grid-template-columns: 1fr;
    }

    .module-header h1 {
        font-size: 24px;
    }

    .unavailable-panel {
        grid-template-columns: 1fr;
    }
}
</style>
