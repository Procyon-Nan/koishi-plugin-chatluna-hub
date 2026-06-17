<template>
    <el-dialog
        v-model="visible"
        width="720px"
        class="adapter-dialog picker-dialog"
        align-center
        append-to-body
        :show-close="false"
    >
        <template #header>
            <div class="dialog-hero">
                <div class="dialog-hero-icon">
                    <el-icon :size="22"><Plus /></el-icon>
                </div>
                <div class="dialog-hero-text">
                    <span class="dialog-hero-kicker">Adapter</span>
                    <h3>添加适配器</h3>
                    <p>
                        选择适配器类型。平台名可自定义的适配器可重复添加多份配置实例，平台固定的适配器每种仅可配置一份。
                    </p>
                </div>
                <el-button
                    class="dialog-hero-close"
                    text
                    :icon="Close"
                    @click="visible = false"
                />
            </div>
        </template>

        <el-input
            v-model="keyword"
            class="picker-search"
            placeholder="搜索适配器名称或平台"
            clearable
        >
            <template #prefix>
                <el-icon><Search /></el-icon>
            </template>
        </el-input>

        <div v-if="filteredPickerTypes.length === 0" class="picker-empty">
            没有匹配的适配器类型
        </div>

        <div v-else class="type-grid">
            <button
                v-for="type in filteredPickerTypes"
                :key="type.id"
                type="button"
                class="type-tile"
                :class="{
                    'is-disabled': !type.canCreate,
                    'is-missing': !type.installed
                }"
                :aria-disabled="!type.canCreate"
                :title="type.createReason"
                @click="emit('choose', type)"
            >
                <span class="type-avatar">{{ typeInitial(type) }}</span>
                <span class="type-info">
                    <span class="type-title">{{ type.title }}</span>
                    <span class="type-platform">{{
                        type.platformDefault
                    }}</span>
                </span>
                <span
                    v-if="!type.installed"
                    class="type-badge is-blocked"
                >
                    未安装
                </span>
                <span
                    v-else-if="type.instanceCount > 0"
                    class="type-badge is-count"
                >
                    已配置 {{ type.instanceCount }}
                </span>
                <span
                    v-else-if="!type.canCreate"
                    class="type-badge is-blocked"
                >
                    不可添加
                </span>
                <el-icon v-else class="type-arrow"><ArrowRight /></el-icon>
            </button>
        </div>
    </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElButton, ElDialog, ElIcon, ElInput } from 'element-plus'
import { ArrowRight, Close, Plus, Search } from '@element-plus/icons-vue'
import type { ChatLunaAdapterType } from '../../types'

const props = defineProps<{
    types: ChatLunaAdapterType[]
}>()

const emit = defineEmits<{
    (event: 'choose', type: ChatLunaAdapterType): void
}>()

// Dialog visibility and search keyword are owned by the parent via v-model so
// the parent can reset the keyword when opening the picker.
const visible = defineModel<boolean>('visible', { required: true })
const keyword = defineModel<string>('keyword', { required: true })

const filteredPickerTypes = computed(() => {
    const text = keyword.value.trim().toLowerCase()
    if (!text) return props.types

    return props.types.filter((type) =>
        [type.title, type.platformDefault, type.pluginName]
            .join(' ')
            .toLowerCase()
            .includes(text)
    )
})

const typeInitial = (type: ChatLunaAdapterType) => {
    const source = type.title || type.platformDefault || '?'
    return source.trim().charAt(0).toUpperCase()
}
</script>

<style scoped>
.adapter-dialog :deep(.el-dialog__header) {
    margin-right: 0;
    padding: 0;
}

.adapter-dialog :deep(.el-dialog__body) {
    padding-top: 18px;
}

.dialog-hero {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 20px 22px;
    border-radius: 12px 12px 0 0;
    background:
        radial-gradient(
            120% 160% at 0% 0%,
            color-mix(in srgb, var(--k-color-primary), transparent 86%),
            transparent 62%
        ),
        var(--k-card-bg);
    border-bottom: 1px solid var(--k-color-divider);
}

.dialog-hero::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 3px;
    border-radius: 12px 12px 0 0;
    background: linear-gradient(
        90deg,
        var(--k-color-primary),
        color-mix(in srgb, var(--k-color-primary), transparent 55%) 60%,
        transparent
    );
}

.dialog-hero-icon {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    color: #fff;
    background: linear-gradient(
        135deg,
        var(--k-color-primary),
        color-mix(in srgb, var(--k-color-primary), #7c5cff 50%)
    );
    box-shadow: 0 8px 18px
        color-mix(in srgb, var(--k-color-primary), transparent 68%);
}

.dialog-hero-text {
    min-width: 0;
    flex: 1;
}

.dialog-hero-kicker {
    display: inline-block;
    margin-bottom: 4px;
    padding: 2px 9px;
    border-radius: 999px;
    color: var(--k-color-primary);
    background: color-mix(in srgb, var(--k-color-primary), transparent 88%);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.dialog-hero-text h3 {
    margin: 2px 0 0;
    color: var(--k-text-dark);
    font-size: 19px;
    font-weight: 700;
    line-height: 1.2;
}

.dialog-hero-text p {
    margin: 5px 0 0;
    color: var(--k-text-light);
    font-size: 12px;
    line-height: 1.6;
}

.dialog-hero-text code {
    padding: 1px 6px;
    border-radius: 6px;
    background: var(--k-color-fill);
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    color: var(--k-text-dark);
}

.dialog-hero-close {
    flex-shrink: 0;
    margin: -4px -8px 0 0;
}

.picker-search {
    margin-bottom: 14px;
}

.picker-empty {
    min-height: 100px;
    display: grid;
    place-items: center;
    color: var(--k-text-light);
    font-size: 14px;
}

.type-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px;
    max-height: 52vh;
    overflow-y: auto;
    padding: 2px;
}

.type-tile {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    background: var(--k-card-bg);
    text-align: left;
    cursor: pointer;
    transition:
        border-color 0.15s ease,
        transform 0.15s ease,
        box-shadow 0.15s ease;
}

.type-tile:hover:not(.is-disabled) {
    border-color: color-mix(in srgb, var(--k-color-primary), transparent 40%);
    transform: translateY(-2px);
    box-shadow: var(--k-card-shadow);
}

.type-tile:hover:not(.is-disabled) .type-arrow {
    color: var(--k-color-primary);
    transform: translateX(2px);
}

.type-tile.is-disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.type-tile.is-missing .type-avatar {
    color: var(--k-text-light);
    background: var(--k-color-fill);
}

.type-avatar {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    font-size: 16px;
    font-weight: 700;
    color: var(--k-color-primary);
    background: color-mix(in srgb, var(--k-color-primary), transparent 86%);
}

.type-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
}

.type-title {
    font-size: 14px;
    font-weight: 650;
    color: var(--k-text-dark);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.type-platform {
    font-size: 12px;
    color: var(--k-text-light);
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.type-badge {
    flex-shrink: 0;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
}

.type-badge.is-count {
    color: var(--k-color-primary);
    background: color-mix(in srgb, var(--k-color-primary), transparent 88%);
}

.type-badge.is-blocked {
    color: var(--k-text-light);
    background: var(--k-color-fill);
}

.type-arrow {
    flex-shrink: 0;
    color: var(--k-color-divider);
    transition:
        color 0.15s ease,
        transform 0.15s ease;
}
</style>
