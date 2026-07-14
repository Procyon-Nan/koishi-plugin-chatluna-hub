<template>
    <hub-return-button v-if="visible" @click="returnHome" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { router } from '@koishijs/client'
import HubReturnButton from './hub-return-button.vue'

const visible = computed(
    () =>
        router.currentRoute.value.path === '/chatluna-agent' ||
        router.currentRoute.value.path === '/chatluna-livingmemory' ||
        router.currentRoute.value.path === '/media-luna' ||
        router.currentRoute.value.path === '/memesluna/' ||
        router.currentRoute.value.path === '/memesluna' ||
        router.currentRoute.value.path === '/chatluna-affinity/dashboard'
)

const returnHome = () => {
    void router.push({
        path: '/chatluna',
        query: {
            home: '1'
        }
    })
}
</script>
