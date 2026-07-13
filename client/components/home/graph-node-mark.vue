<template>
    <svg
        v-if="moduleId === 'chatluna'"
        class="chatluna-mark"
        :class="{ mini }"
        viewBox="0 0 96 96"
        aria-hidden="true"
        focusable="false"
    >
        <path
            d="M45 20C25 20 12 32 12 49c0 17 14 29 34 29 6 0 13-1 18-4l16 8-5-17c4-5 7-10 7-17 0-16-14-28-37-28Z"
            fill="none"
            stroke="currentColor"
            stroke-width="6"
            stroke-linecap="round"
            stroke-linejoin="round"
        />
        <g fill="currentColor">
            <circle cx="36" cy="62" r="2.5" />
            <circle cx="46" cy="63" r="2.5" />
            <circle cx="56" cy="61" r="2.5" />
            <circle cx="65" cy="57" r="2.5" />
            <circle cx="42" cy="72" r="2.5" />
            <circle cx="52" cy="72" r="2.5" />
            <circle cx="62" cy="69" r="2.5" />
            <circle cx="69" cy="64" r="2.5" />
            <circle cx="59" cy="50" r="2.5" />
            <circle cx="67" cy="45" r="2.5" />
            <circle cx="72" cy="38" r="2.5" />
            <circle cx="73" cy="50" r="2.5" />
        </g>
    </svg>
    <svg
        v-else-if="moduleId === 'agent'"
        class="agent-mark"
        :class="{ mini }"
        viewBox="0 0 96 96"
        aria-hidden="true"
        focusable="false"
    >
        <path
            d="M48 18v10M34 28h28c11 0 18 7 18 18v16c0 11-7 18-18 18H34c-11 0-18-7-18-18V46c0-11 7-18 18-18Z"
            fill="none"
            stroke="currentColor"
            stroke-width="6"
            stroke-linecap="round"
            stroke-linejoin="round"
        />
        <circle cx="36" cy="54" r="5" fill="currentColor" />
        <circle cx="60" cy="54" r="5" fill="currentColor" />
        <path
            d="M38 67h20"
            fill="none"
            stroke="currentColor"
            stroke-width="6"
            stroke-linecap="round"
        />
        <circle cx="48" cy="14" r="4" fill="currentColor" />
    </svg>
    <svg
        v-else-if="moduleId === 'mediaLuna'"
        class="palette-mark"
        :class="{ mini }"
        viewBox="0 0 96 96"
        aria-hidden="true"
        focusable="false"
    >
        <path
            d="M47 16c-18 0-32 12-32 29 0 20 15 35 36 35h4c6 0 10-4 10-9 0-3-1-5-3-7-2-2-3-4-3-7 0-5 4-8 9-8h5c6 0 9-4 9-9 0-14-14-24-35-24Z"
            fill="none"
            stroke="currentColor"
            stroke-width="6"
            stroke-linecap="round"
            stroke-linejoin="round"
        />
        <circle cx="34" cy="38" r="4" fill="currentColor" />
        <circle cx="48" cy="31" r="4" fill="currentColor" />
        <circle cx="62" cy="38" r="4" fill="currentColor" />
        <circle cx="39" cy="55" r="4" fill="currentColor" />
    </svg>
    <MemesLunaIcon
        v-else-if="moduleId === 'memesLuna'"
        class="memesluna-mark"
        :class="{ mini }"
    />
    <TreeOfLifeIcon
        v-else-if="moduleId === 'livingMemory'"
        class="livingmemory-mark"
        :class="{ mini }"
        :style="livingMemoryStyle"
    />
    <el-icon v-else :size="iconSize">
        <component :is="resolveIcon(icon)" />
    </el-icon>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import {
    Brush,
    ChatRound,
    Collection,
    Connection,
    DataAnalysis,
    Link,
    Message,
    Picture,
    Search,
    Star,
    TrendCharts,
    UserFilled
} from '@element-plus/icons-vue'
import MemesLunaIcon from '../../icons/memesluna.vue'
import TreeOfLifeIcon from '../../icons/tree-of-life.vue'
import type { HubModuleIconName, HubModuleId } from '../../types'

const props = withDefaults(
    defineProps<{
        moduleId: HubModuleId
        icon: HubModuleIconName
        mini?: boolean
    }>(),
    {
        mini: false
    }
)

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

const iconSize = computed(() => (props.mini ? 22 : 34))

const livingMemoryStyle = computed(() => {
    const size = props.mini ? 22 : 36
    return {
        width: `${size}px`,
        height: `${size}px`,
        color: 'currentColor'
    }
})

const resolveIcon = (icon: HubModuleIconName) => icons[icon]
</script>
