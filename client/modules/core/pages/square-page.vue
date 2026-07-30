<template>
    <section class="preset-square">
        <transition name="square-fade">
            <div v-if="loading" class="square-loading">
                <el-icon class="is-loading" :size="32"><Loading /></el-icon>
                <span>正在加载预设广场…</span>
            </div>
        </transition>
        <iframe
            v-show="!loading"
            class="square-frame"
            src="https://preset.chatluna.chat/"
            title="ChatLuna 预设广场"
            referrerpolicy="no-referrer"
            allow="clipboard-write; clipboard-read"
            @load="onLoad"
        />
    </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Loading } from '@element-plus/icons-vue'

const loading = ref(true)

const onLoad = () => {
    loading.value = false
}
</script>

<style scoped>
.preset-square {
    position: relative;
    width: 100%;
    min-height: 0;
    display: flex;
}

.square-frame {
    flex: 1;
    min-width: 0;
    border: 0;
    background: var(--k-card-bg);
}

.square-loading {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--k-text-light);
    font-size: 14px;
    background: var(--k-card-bg);
}

.square-loading .el-icon {
    color: var(--k-color-primary);
}

.square-fade-leave-active {
    transition: opacity 0.2s ease;
}

.square-fade-leave-to {
    opacity: 0;
}
</style>
