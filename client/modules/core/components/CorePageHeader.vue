<template>
    <header class="page-header" :class="`mobile-${mobileVariant}`">
        <div class="page-icon">
            <slot name="icon" />
        </div>
        <div class="page-heading">
            <span class="page-kicker">{{ kicker }}</span>
            <h1>{{ title }}</h1>
            <p class="page-subtitle">{{ subtitle }}</p>
        </div>
        <div class="page-actions">
            <div class="stat-pills">
                <span
                    v-for="pill in pills"
                    :key="pill.label"
                    class="stat-pill"
                    :class="pill.variant ? `is-${pill.variant}` : undefined"
                >
                    <span class="stat-pill-value">{{ pill.value }}</span>
                    <span class="stat-pill-label">{{ pill.label }}</span>
                </span>
            </div>
            <el-button
                size="small"
                :type="compactMode ? 'primary' : 'default'"
                plain
                @click="compactMode = !compactMode"
            >
                {{ compactMode ? '紧凑模式' : '宽屏模式' }}
            </el-button>
        </div>
    </header>
</template>

<script setup lang="ts">
import { ElButton } from 'element-plus'
import { useCoreCompactMode } from '../use-compact-mode'

/** One stat pill; `variant` adds the matching `is-*` color accent. */
export interface CorePageStatPill {
    value: string | number
    label: string
    variant?: 'core' | 'character' | 'success' | 'error'
}

const props = withDefaults(
    defineProps<{
        kicker: string
        title: string
        subtitle: string
        pills: CorePageStatPill[]
        /**
         * Mobile (≤768px) header layout. `stack` (default) collapses to a
         * single column with left-aligned actions and wrapping pills
         * (model/preset/conversation pages). `row` keeps icon+heading side by
         * side and lays the actions out as a horizontal bar (log page).
         */
        mobileVariant?: 'stack' | 'row'
    }>(),
    { mobileVariant: 'stack' }
)

const { mobileVariant } = props

// Shared compact/wide toggle, persisted across all core pages.
const compactMode = useCoreCompactMode()
</script>

<style scoped>
.page-header {
    position: relative;
    flex-shrink: 0;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 18px;
    padding: 22px 26px;
    border: 1px solid var(--k-color-divider);
    border-radius: 16px;
    overflow: hidden;
    background: var(--k-card-bg);
}

.page-header::before {
    display: none;
}

.page-icon {
    width: 54px;
    height: 54px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    color: #fff;
    background: var(--k-color-primary);
}

.page-heading {
    min-width: 0;
}

.page-kicker {
    display: inline-block;
    margin-bottom: 4px;
    padding: 2px 10px;
    border-radius: 999px;
    color: var(--k-color-primary);
    background: color-mix(in srgb, var(--k-color-primary), transparent 88%);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.page-header h1 {
    margin: 2px 0 0;
    color: var(--k-text-dark);
    font-size: 26px;
    font-weight: 700;
    line-height: 1.15;
}

.page-subtitle {
    margin: 4px 0 0;
    color: var(--k-text-light);
    font-size: 13px;
}

.page-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
}

.stat-pills {
    display: flex;
    gap: 8px;
}

.stat-pill {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 62px;
    padding: 8px 12px;
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    background: var(--k-card-bg);
    line-height: 1.1;
}

.stat-pill-value {
    color: var(--k-text-dark);
    font-size: 18px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}

.stat-pill-label {
    margin-top: 3px;
    color: var(--k-text-light);
    font-size: 11px;
}

.stat-pill.is-core {
    border-color: color-mix(in srgb, var(--k-color-primary), transparent 55%);
}

.stat-pill.is-core .stat-pill-value {
    color: var(--k-color-primary);
}

.stat-pill.is-character {
    border-color: color-mix(in srgb, #7c5cff, transparent 55%);
}

.stat-pill.is-character .stat-pill-value {
    color: #7c5cff;
}

.stat-pill.is-success {
    border-color: color-mix(
        in srgb,
        var(--k-color-success, #67c23a),
        transparent 55%
    );
}

.stat-pill.is-success .stat-pill-value {
    color: var(--k-color-success, #67c23a);
}

.stat-pill.is-error {
    border-color: color-mix(
        in srgb,
        var(--k-color-danger, #f56c6c),
        transparent 55%
    );
}

.stat-pill.is-error .stat-pill-value {
    color: var(--k-color-danger, #f56c6c);
}

@media (max-width: 768px) {
    /* Default `stack` layout: single column, left-aligned, wrapping pills. */
    .page-header.mobile-stack {
        grid-template-columns: 1fr;
    }

    .page-header.mobile-stack .page-actions {
        align-items: flex-start;
        justify-content: flex-start;
    }

    .page-header.mobile-stack h1 {
        font-size: 24px;
    }

    /* `row` layout (log page): icon+heading stay paired, actions are a bar. */
    .page-header.mobile-row {
        grid-template-columns: auto 1fr;
        gap: 14px;
        padding: 18px;
    }

    .page-header.mobile-row .page-actions {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
    }

    .page-header.mobile-row h1 {
        font-size: 22px;
    }

    .stat-pills {
        flex-wrap: wrap;
    }
}
</style>
