<template>
    <div ref="hostRef" class="preset-island-host" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
    mountPresetIsland,
    unmountPresetIsland
} from '../preset-island'

const hostRef = ref<HTMLElement | null>(null)

onMounted(() => {
    const el = hostRef.value
    if (!el) return
    mountPresetIsland(el)
})

onBeforeUnmount(() => {
    unmountPresetIsland()
})
</script>

<style scoped>
.preset-island-host {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    min-height: calc(100vh - 220px);
    display: flex;
    flex-direction: column;
}
</style>
