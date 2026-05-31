<template>
    <el-dialog
        v-model="visible"
        width="680px"
        class="adapter-dialog editor-dialog"
        align-center
        append-to-body
        :show-close="false"
    >
        <template #header>
            <div class="dialog-hero" v-if="descriptor">
                <div class="dialog-hero-icon">
                    <el-icon :size="22"><Setting /></el-icon>
                </div>
                <div class="dialog-hero-text">
                    <span class="dialog-hero-kicker">
                        {{ instanceKey ? '编辑配置' : '新建配置' }}
                    </span>
                    <h3>{{ descriptor.title }}</h3>
                    <p>
                        配置写入
                        <code>{{ descriptor.pluginName }}</code>
                        并自动重载。
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

        <div v-if="descriptor" class="dialog-body">
            <el-form
                v-if="descriptor.platformConfigurable"
                label-position="top"
                class="editor-form"
            >
                <el-form-item label="平台名称">
                    <el-input
                        v-model="platform"
                        :placeholder="descriptor.platformDefault"
                    />
                    <span class="form-hint">
                        多份配置请使用不同的平台名称以避免冲突。
                    </span>
                </el-form-item>
            </el-form>

            <div class="cred-section">
                <div class="cred-section-head">
                    <span class="cred-section-title">
                        凭据
                        <span class="cred-section-count">{{
                            credentials.length
                        }}</span>
                    </span>
                    <span class="cred-section-hint">
                        多条凭据组成负载均衡池，取模型时以选中凭据为准。
                    </span>
                </div>

                <div class="cred-list">
                    <div
                        v-for="(entry, index) in credentials"
                        :key="index"
                        class="cred-row"
                        :class="{ 'is-off': !entry.enabled }"
                    >
                        <span class="cred-index">{{ index + 1 }}</span>
                        <div class="cred-fields">
                            <el-input
                                v-if="editorShowApiKey"
                                v-model="entry.apiKey"
                                class="cred-key"
                                type="password"
                                show-password
                                placeholder="API Key"
                            />
                            <el-input
                                v-if="editorShowEndpoint"
                                v-model="entry.apiEndpoint"
                                class="cred-endpoint"
                                :placeholder="
                                    descriptor.endpointPlaceholder ||
                                    'API 端点'
                                "
                            />
                        </div>
                        <el-switch
                            v-model="entry.enabled"
                            class="cred-enabled"
                            inline-prompt
                            active-text="启用"
                            inactive-text="停用"
                        />
                        <el-button
                            class="cred-remove"
                            text
                            type="danger"
                            :icon="DeleteIcon"
                            @click="emit('remove-credential', index)"
                        />
                    </div>

                    <div v-if="credentials.length === 0" class="cred-empty">
                        暂无凭据，点击下方按钮添加一条。
                    </div>

                    <el-button
                        class="cred-add"
                        :icon="Plus"
                        plain
                        @click="emit('add-credential')"
                    >
                        添加凭据
                    </el-button>
                </div>
            </div>
        </div>

        <template #footer>
            <el-button @click="visible = false">取消</el-button>
            <el-button
                type="primary"
                :loading="saving"
                @click="emit('save')"
            >
                保存并应用
            </el-button>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
    ElButton,
    ElDialog,
    ElForm,
    ElFormItem,
    ElIcon,
    ElInput,
    ElSwitch
} from 'element-plus'
import { Close, Delete as DeleteIcon, Plus, Setting } from '@element-plus/icons-vue'
import type { ChatLunaAdapterCredentialEntry } from '../../types'
import type { EditorDescriptor } from './use-adapters'

const props = defineProps<{
    descriptor: EditorDescriptor | null
    instanceKey: string | undefined
    credentials: ChatLunaAdapterCredentialEntry[]
    saving: boolean
}>()

const emit = defineEmits<{
    (event: 'save'): void
    (event: 'add-credential'): void
    (event: 'remove-credential', index: number): void
}>()

const visible = defineModel<boolean>('visible', { required: true })
const platform = defineModel<string>('platform', { required: true })

const editorShowApiKey = computed(() => {
    return props.descriptor?.credentialKind !== 'endpoint-enabled'
})

const editorShowEndpoint = computed(() => {
    return props.descriptor?.credentialKind !== 'api-enabled'
})
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

.dialog-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.editor-form {
    padding: 14px 16px 4px;
    border: 1px solid var(--k-color-divider);
    border-radius: 12px;
    background: var(--k-color-fill);
}

.cred-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.cred-section-head {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.cred-section-title {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 14px;
    font-weight: 650;
    color: var(--k-text-dark);
}

.cred-section-count {
    min-width: 20px;
    padding: 0 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--k-color-primary), transparent 86%);
    color: var(--k-color-primary);
    font-size: 12px;
    font-weight: 600;
    text-align: center;
}

.cred-section-hint {
    color: var(--k-text-light);
    font-size: 12px;
    line-height: 1.5;
}

.cred-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.cred-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--k-color-divider);
    border-radius: 10px;
    background: var(--k-card-bg);
    transition:
        border-color 0.15s ease,
        opacity 0.15s ease;
}

.cred-row.is-off {
    opacity: 0.6;
}

.cred-index {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    border-radius: 7px;
    display: grid;
    place-items: center;
    background: var(--k-color-fill);
    color: var(--k-text-light);
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
}

.cred-fields {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
}

.cred-key {
    flex: 1.4;
    min-width: 0;
}

.cred-endpoint {
    flex: 1;
    min-width: 0;
}

.cred-enabled {
    flex-shrink: 0;
}

.cred-remove {
    flex-shrink: 0;
}

.cred-empty {
    padding: 12px;
    border: 1px dashed var(--k-color-divider);
    border-radius: 10px;
    text-align: center;
    color: var(--k-text-light);
    font-size: 13px;
}

.cred-add {
    align-self: flex-start;
}

.form-hint {
    display: block;
    margin-top: 4px;
    color: var(--k-text-light);
    font-size: 12px;
}
</style>
