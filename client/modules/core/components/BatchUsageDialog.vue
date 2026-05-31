<template>
    <el-dialog
        v-model="visibleProxy"
        :title="batchDialogTitle"
        width="420px"
    >
        <el-select
            v-if="field === 'model'"
            v-model="valueProxy"
            filterable
            placeholder="选择模型"
            class="batch-select"
            :loading="optionsLoading"
        >
            <el-option
                v-for="model in options.models"
                :key="model.value"
                :label="model.label"
                :value="model.value"
            />
        </el-select>

        <el-select
            v-else
            v-model="valueProxy"
            filterable
            placeholder="选择预设"
            class="batch-select"
            :loading="optionsLoading"
        >
            <el-option
                v-for="preset in options.presets"
                :key="preset.value"
                :label="preset.label"
                :value="preset.value"
            />
        </el-select>

        <template #footer>
            <el-button @click="visibleProxy = false">
                取消
            </el-button>
            <el-button
                type="primary"
                :disabled="!valueProxy"
                :loading="saving"
                @click="emit('apply')"
            >
                应用到选中对话
            </el-button>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElButton, ElDialog, ElOption, ElSelect } from 'element-plus'
import type { ChatLunaConversationOptions } from '../types'

type BatchUsageField = 'model' | 'preset'

const props = defineProps<{
    visible: boolean
    value: string
    field: BatchUsageField
    options: ChatLunaConversationOptions
    optionsLoading: boolean
    saving: boolean
}>()

const emit = defineEmits<{
    (event: 'update:visible', value: boolean): void
    (event: 'update:value', value: string): void
    (event: 'apply'): void
}>()

const visibleProxy = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
})

const valueProxy = computed({
    get: () => props.value,
    set: (value) => emit('update:value', value)
})

const batchDialogTitle = computed(() =>
    props.field === 'model' ? '批量切换模型' : '批量切换预设'
)
</script>

<style scoped>
.batch-select {
    width: 100%;
}
</style>
