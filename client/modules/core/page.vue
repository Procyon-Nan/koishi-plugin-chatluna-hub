<template>
    <div class="core-dashboard">
        <div class="core-main">
            <el-scrollbar>
                <div class="core-content">
                    <KeepAlive>
                        <conversation-page
                            v-if="activeTab === 'conversation'"
                            key="conversation"
                            class="view-container"
                        />
                    </KeepAlive>

                    <KeepAlive>
                        <model-page
                            v-if="activeTab === 'model'"
                            key="model"
                            class="view-container"
                        />
                    </KeepAlive>

                    <KeepAlive>
                        <preset-page
                            v-if="activeTab === 'preset'"
                            key="preset"
                            class="view-container"
                        />
                    </KeepAlive>
                </div>
            </el-scrollbar>
        </div>

        <core-sidebar :current="activeTab" @select="handleTabChange" />
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CoreSidebar from './sidebar.vue'
import ConversationPage from './pages/conversation-page.vue'
import ModelPage from './pages/model-page.vue'
import PresetPage from './pages/preset-page.vue'
import type { CoreTab } from './types'

const activeTab = ref<CoreTab>('conversation')

const handleTabChange = (tab: CoreTab) => {
    activeTab.value = tab
}
</script>

<style scoped>
.core-dashboard {
    position: relative;
    min-height: 0;
    height: 100%;
    flex: 1;
    background: var(--k-page-bg);
    color: var(--k-text-dark);
    overflow: hidden;
}

.core-main {
    min-height: 0;
    height: 100%;
    width: 100%;
}

.core-content {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 28px 96px 120px;
    margin: 0 auto;
}

.view-container {
    min-height: 500px;
}

@media (max-width: 768px) {
    .core-content {
        padding: 16px;
        padding-bottom: 112px;
    }
}
</style>
