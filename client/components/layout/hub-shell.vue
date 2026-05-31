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

                            <div
                                v-if="!activeModule.available"
                                class="unavailable-panel"
                            >
                                <div class="panel-icon">
                                    <el-icon :size="28">
                                        <CircleClose />
                                    </el-icon>
                                </div>
                                <div>
                                    <h2>Module not enabled</h2>
                                    <p>{{ activeModule.reason }}</p>
                                </div>
                            </div>

                            <div v-else class="adapter-panel">
                                <div class="panel-icon">
                                    <el-icon :size="28">
                                        <Connection />
                                    </el-icon>
                                </div>
                                <div>
                                    <h2>Adapter pending</h2>
                                    <p>{{ adapterDescription }}</p>
                                </div>
                            </div>
                        </section>
                    </div>
                </el-scrollbar>
            </div>

            <div v-else class="content-wrapper home-wrapper">
                <hub-relationship-graph
                    :modules="modules"
                    @select="handleSelect"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'
import { router, store } from '@koishijs/client'
import {
    ChatRound,
    CircleClose,
    Collection,
    Connection,
    Cpu,
    Brush
} from '@element-plus/icons-vue'
import HubRelationshipGraph from '../home/hub-relationship-graph.vue'
import HubReturnButton from './hub-return-button.vue'
import CorePage from '../../modules/core/page.vue'
import MemesLunaIcon from '../../icons/memesluna.vue'
import type { HubModuleId, HubModuleItem } from '../../types'

const fallbackModules: HubModuleItem[] = [
    {
        id: 'chatluna',
        group: 'core',
        title: 'ChatLuna',
        icon: 'ChatRound',
        order: 0,
        configured: true,
        available: true
    },
    {
        id: 'agent',
        group: 'ecosystem',
        title: 'Agent',
        icon: 'Connection',
        order: 10,
        configured: true,
        available: false,
        reason: 'Waiting for Hub module data.',
        activityId: 'chatluna-agent'
    },
    {
        id: 'livingMemory',
        group: 'ecosystem',
        title: 'Living Memory',
        icon: 'Collection',
        order: 20,
        configured: true,
        available: false,
        reason: 'Waiting for Hub module data.',
        activityId: 'chatluna-livingmemory'
    },
    {
        id: 'mediaLuna',
        group: 'ecosystem',
        title: 'media-luna',
        icon: 'Palette',
        order: 30,
        configured: true,
        available: false,
        reason: 'Waiting for Hub module data.',
        activityId: 'media-luna'
    },
    {
        id: 'memesLuna',
        group: 'ecosystem',
        title: 'memesluna',
        icon: 'MemesLunaEmoji',
        order: 40,
        configured: true,
        available: false,
        reason: 'Waiting for Hub module data.',
        activityId: 'memesluna'
    }
]

const icons: Record<string, Component> = {
    ChatRound,
    Collection,
    Connection,
    Cpu,
    Palette: Brush,
    MemesLunaEmoji: MemesLunaIcon
}

const hubHomePath = '/chatluna'
const externalModulePaths: Partial<Record<HubModuleId, string>> = {
    agent: '/chatluna-agent',
    livingMemory: '/chatluna-livingmemory',
    mediaLuna: '/media-luna',
    memesLuna: '/memesluna/'
}
const active = ref<HubModuleId | null>(null)
const data = computed(() => store.chatluna_hub_webui)
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
    if (!activeModule.value.available) {
        return activeModule.value.reason ?? 'This module is not available.'
    }
    return `${activeModule.value.title} is detected. The Hub adapter UI will be wired in a later pass.`
})
const adapterDescription = computed(() => {
    if (!activeModule.value) return ''
    if (activeModule.value.id === 'agent') {
        return 'This page will reuse chatluna_agent_webui and chatluna-agent/* RPC contracts.'
    }
    if (activeModule.value.id === 'mediaLuna') {
        return 'This page will host media-luna after its Hub adapter contract is confirmed.'
    }
    if (activeModule.value.id === 'memesLuna') {
        return 'This page will reuse memesluna/* RPC contracts through the original WebUI.'
    }
    return 'This page will reuse the living-memory/* RPC contracts.'
})

const resolveIcon = (icon: string) => icons[icon] ?? Cpu
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

const handleSelect = (id: HubModuleId) => {
    const target = modules.value.find((item) => item.id === id)
    if (!target?.available) return
    const externalPath = externalModulePaths[target.id]
    if (externalPath) {
        void router.push(externalPath)
        return
    }
    active.value = id
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
.adapter-panel h2,
.unavailable-panel h2 {
    margin: 0;
    color: var(--k-text-dark);
}

.module-header h1 {
    font-size: 28px;
    line-height: 1.15;
}

.module-header p,
.adapter-panel p,
.unavailable-panel p {
    margin: 0;
    color: var(--k-text-light);
    line-height: 1.58;
}

.module-header p {
    margin-top: 8px;
    font-size: 14px;
}

.adapter-panel,
.unavailable-panel {
    border: 1px solid var(--k-color-divider);
    border-radius: 8px;
    background: var(--k-card-bg);
    box-shadow: var(--k-card-shadow);
}

.adapter-panel,
.unavailable-panel {
    padding: 20px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 16px;
}

.adapter-panel h2,
.unavailable-panel h2 {
    font-size: 18px;
}

.adapter-panel p,
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

    .adapter-panel,
    .unavailable-panel {
        grid-template-columns: 1fr;
    }
}
</style>
