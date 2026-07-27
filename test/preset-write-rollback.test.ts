import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, test } from 'node:test'

import type { Context } from 'koishi'

import {
    createChatLunaCorePreset,
    getChatLunaCorePreset,
    updateChatLunaCorePreset
} from '../src/webui/core/presets.ts'

/**
 * The write-then-reload contract of `src/webui/core/presets.ts`.
 *
 * `reloadPresetSourceAfterWrite` is module-private, so every case drives it
 * through `createChatLunaCorePreset` / `updateChatLunaCorePreset` — the path a
 * real request takes. Its four branches are selected purely by which reload
 * throws, so a scripted `loadAllPreset` is the only lever the tests need.
 *
 * The rollback callback is *created inside* the production function and cannot
 * be injected, so "did the rollback run?" is asserted on its observable effect:
 * the bytes on disk. That is the stronger assertion anyway — it is what the
 * feature promises the user.
 */

/** Valid core preset YAML: one keyword, one prompt. */
const PREVIOUS_RAW = [
    'keywords:',
    '  - alpha',
    'prompts:',
    '  - role: system',
    '    content: 旧内容',
    ''
].join('\n')

/** Valid core preset YAML with a different keyword and two prompts. */
const NEXT_RAW = [
    'keywords:',
    '  - beta',
    'prompts:',
    '  - role: system',
    '    content: 新内容',
    '  - role: user',
    '    content: 你好',
    ''
].join('\n')

const CREATED_RAW = [
    'keywords:',
    '  - gamma',
    'prompts:',
    '  - role: system',
    '    content: 新建内容',
    ''
].join('\n')

const CHARACTER_RAW = [
    'name: 小助手',
    'input: <message>{prompt}</message>',
    'system: 你是群聊里的小助手。',
    ''
].join('\n')

let workDir: string
let presetDir: string

beforeEach(async () => {
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chatluna-hub-preset-'))
    presetDir = path.join(workDir, 'presets')
    await fs.mkdir(presetDir, { recursive: true })
})

afterEach(async () => {
    await fs.rm(workDir, { recursive: true, force: true })
})

interface ReloadProbe {
    /** How many times ChatLuna's `loadAllPreset` was called. */
    calls: number
}

const succeed = async () => {}

const failWith = (error: Error) => async () => {
    throw error
}

/**
 * A ctx exposing just enough of ChatLuna for the core preset path:
 * `resolvePresetDir` (directory resolution), `getAllPreset` / `getPreset`
 * (keyword-conflict scan, empty here) and `loadAllPreset` (the reload).
 *
 * `steps[n]` runs on the (n+1)-th `loadAllPreset()` call; a missing entry means
 * that reload succeeds.
 */
const createChatLunaCtx = (
    steps: (() => Promise<void>)[] = []
): { ctx: Context; probe: ReloadProbe } => {
    const probe: ReloadProbe = { calls: 0 }
    const preset = {
        resolvePresetDir: () => presetDir,
        getAllPreset: () => ({ value: [] as string[] }),
        getPreset: () => ({ value: undefined }),
        loadAllPreset: async () => {
            const step = steps[probe.calls]
            probe.calls += 1
            if (step) await step()
        }
    }

    const ctx = {
        baseDir: workDir,
        get: (name: string) => (name === 'chatluna' ? { preset } : undefined)
    }

    return { ctx: ctx as unknown as Context, probe }
}

/** A ctx where neither ChatLuna nor Character is running. */
const createBareCtx = (): Context =>
    ({ baseDir: workDir, get: () => undefined }) as unknown as Context

/**
 * Turn the preset file into a directory so the rollback's `fs.writeFile` fails
 * with EISDIR. Making the rollback itself throw is only reachable from outside
 * by breaking its target, since the callback is not injectable.
 */
const breakRollbackTarget = async (filePath: string) => {
    await fs.rm(filePath, { force: true })
    await fs.mkdir(filePath)
}

const captureRejection = async (
    run: () => Promise<unknown>
): Promise<Error> => {
    try {
        await run()
    } catch (error) {
        assert.ok(error instanceof Error, 'expected an Error to be thrown')
        return error
    }

    assert.fail('expected the call to reject, but it resolved')
}

const readIfExists = async (filePath: string): Promise<string | null> => {
    try {
        return await fs.readFile(filePath, 'utf-8')
    } catch (error) {
        assert.equal((error as NodeJS.ErrnoException).code, 'ENOENT')
        return null
    }
}

describe('reloadPresetSourceAfterWrite 的四条分支', () => {
    /**
     * A core update reloads twice on the happy path: once before the write as a
     * pre-check (presets.ts:619) and once after it (presets.ts:623). A third
     * call only happens when the after-write reload failed and the rollback
     * succeeded.
     */
    const writeExistingPreset = async () => {
        const filePath = path.join(presetDir, 'preset.yml')
        await fs.writeFile(filePath, PREVIOUS_RAW, 'utf-8')

        return filePath
    }

    test('刷新成功时不回滚：磁盘留下新内容，且不会有第三次刷新', async () => {
        const filePath = await writeExistingPreset()
        const { ctx, probe } = createChatLunaCtx()

        const detail = await updateChatLunaCorePreset(ctx, {
            id: 'core:preset.yml',
            rawText: NEXT_RAW
        })

        // If the rollback had run, the file would hold PREVIOUS_RAW again.
        assert.equal(await fs.readFile(filePath, 'utf-8'), NEXT_RAW)
        assert.equal(detail.rawText, NEXT_RAW)
        assert.deepEqual(detail.preset.keywords, ['beta'])
        assert.equal(detail.preset.promptCount, 2)
        assert.equal(probe.calls, 2)
    })

    test('刷新失败且回滚成功：抛出回滚提示并带上原始原因，磁盘被还原', async () => {
        const filePath = await writeExistingPreset()
        const reloadError = new Error('preset cache is corrupted')
        const { ctx, probe } = createChatLunaCtx([
            succeed,
            failWith(reloadError)
        ])

        const caught = await captureRejection(() =>
            updateChatLunaCorePreset(ctx, {
                id: 'core:preset.yml',
                rawText: NEXT_RAW
            })
        )

        assert.equal(
            caught.message,
            '预设文件变更已回滚，运行时刷新失败：preset cache is corrupted'
        )
        assert.equal(await fs.readFile(filePath, 'utf-8'), PREVIOUS_RAW)
        // Pre-check, failed after-write reload, then the post-rollback reload.
        assert.equal(probe.calls, 3)
    })

    test('回滚本身失败时抛出的是原始 error，而不是回滚抛出的 error', async () => {
        // The regression this case exists for: "throw the last error" reads as a
        // harmless cleanup, but it would replace the actionable reload reason
        // with an EISDIR/EACCES from the restore attempt, and hide the fact that
        // the file on disk is now in an unknown state.
        const filePath = await writeExistingPreset()
        const reloadError = new Error('preset cache is corrupted')
        const { ctx, probe } = createChatLunaCtx([
            succeed,
            async () => {
                await breakRollbackTarget(filePath)
                throw reloadError
            }
        ])

        const caught = await captureRejection(() =>
            updateChatLunaCorePreset(ctx, {
                id: 'core:preset.yml',
                rawText: NEXT_RAW
            })
        )

        assert.equal(caught, reloadError)
        assert.equal(caught.message, 'preset cache is corrupted')
        assert.doesNotMatch(caught.message, /已回滚/)
        assert.doesNotMatch(caught.message, /EISDIR/)
        // The rollback really did fail: its target is still a directory, so the
        // `fs.writeFile` inside it could not have succeeded.
        assert.equal((await fs.stat(filePath)).isDirectory(), true)
        // A failed rollback skips the post-rollback reload entirely.
        assert.equal(probe.calls, 2)
    })

    test('二次刷新失败被吞掉，仍抛出带原始原因的回滚提示', async () => {
        const filePath = await writeExistingPreset()
        const reloadError = new Error('preset cache is corrupted')
        const secondReloadError = new Error('second reload failed')
        const { ctx, probe } = createChatLunaCtx([
            succeed,
            failWith(reloadError),
            failWith(secondReloadError)
        ])

        const caught = await captureRejection(() =>
            updateChatLunaCorePreset(ctx, {
                id: 'core:preset.yml',
                rawText: NEXT_RAW
            })
        )

        assert.equal(
            caught.message,
            '预设文件变更已回滚，运行时刷新失败：preset cache is corrupted'
        )
        assert.doesNotMatch(caught.message, /second reload failed/)
        assert.equal(await fs.readFile(filePath, 'utf-8'), PREVIOUS_RAW)
        assert.equal(probe.calls, 3)
    })
})

describe('createChatLunaCorePreset 端到端', () => {
    test('写入成功后返回详情，文件落在解析出的预设目录内', async () => {
        const { ctx, probe } = createChatLunaCtx()

        const detail = await createChatLunaCorePreset(ctx, {
            source: 'core',
            filename: 'new-preset',
            rawText: CREATED_RAW
        })

        assert.equal(
            await fs.readFile(path.join(presetDir, 'new-preset.yml'), 'utf-8'),
            CREATED_RAW
        )
        assert.equal(detail.preset.id, 'core:new-preset.yml')
        assert.equal(detail.preset.filename, 'new-preset.yml')
        assert.equal(detail.preset.sourceLabel, '主插件预设')
        assert.deepEqual(detail.preset.keywords, ['gamma'])
        assert.equal(detail.preset.promptCount, 1)
        assert.equal(probe.calls, 2)
    })

    test('刷新失败时新建的文件被删除', async () => {
        const { ctx } = createChatLunaCtx([
            succeed,
            failWith(new Error('preset cache is corrupted'))
        ])

        const caught = await captureRejection(() =>
            createChatLunaCorePreset(ctx, {
                source: 'core',
                filename: 'new-preset',
                rawText: CREATED_RAW
            })
        )

        assert.equal(
            caught.message,
            '预设文件变更已回滚，运行时刷新失败：preset cache is corrupted'
        )
        assert.equal(
            await readIfExists(path.join(presetDir, 'new-preset.yml')),
            null
        )
    })

    test('已存在的文件名被拒绝，原文件不被覆盖', async () => {
        const filePath = path.join(presetDir, 'preset.yml')
        await fs.writeFile(filePath, PREVIOUS_RAW, 'utf-8')
        const { ctx, probe } = createChatLunaCtx()

        const caught = await captureRejection(() =>
            createChatLunaCorePreset(ctx, {
                source: 'core',
                filename: 'preset.yml',
                rawText: NEXT_RAW
            })
        )

        assert.equal(caught.message, 'Preset file "preset.yml" already exists.')
        assert.equal(await fs.readFile(filePath, 'utf-8'), PREVIOUS_RAW)
        // The existence check runs before any reload.
        assert.equal(probe.calls, 0)
    })

    test('非法预设在写入和刷新之前就被拒绝，目录里不会多出文件', async () => {
        const { ctx, probe } = createChatLunaCtx()

        const caught = await captureRejection(() =>
            createChatLunaCorePreset(ctx, {
                source: 'core',
                filename: 'broken',
                rawText: 'keywords: []\nprompts: []\n'
            })
        )

        assert.equal(
            caught.message,
            'Preset must contain at least one keyword.'
        )
        assert.deepEqual(await fs.readdir(presetDir), [])
        assert.equal(probe.calls, 0)
    })
})

describe('预设目录解析', () => {
    test('目录穿越的预设 id 被拒绝，目录外不会留下文件', async () => {
        const { ctx } = createChatLunaCtx()

        const caught = await captureRejection(() =>
            updateChatLunaCorePreset(ctx, {
                id: 'core:../escape.yml',
                rawText: NEXT_RAW
            })
        )

        assert.equal(
            caught.message,
            'Preset filename must be a plain file name.'
        )
        assert.equal(await readIfExists(path.join(workDir, 'escape.yml')), null)
    })

    test('ChatLuna 未运行时核心预设回落到 baseDir/data/chathub/presets', async () => {
        const fallbackDir = path.join(workDir, 'data', 'chathub', 'presets')
        await fs.mkdir(fallbackDir, { recursive: true })
        await fs.writeFile(
            path.join(fallbackDir, 'fallback.yml'),
            PREVIOUS_RAW,
            'utf-8'
        )

        const detail = await getChatLunaCorePreset(createBareCtx(), {
            id: 'core:fallback.yml'
        })

        assert.equal(detail.rawText, PREVIOUS_RAW)
        assert.equal(detail.preset.filename, 'fallback.yml')
        assert.deepEqual(detail.preset.keywords, ['alpha'])
    })

    test('Character 未运行时回落到 baseDir/data/chathub/character/presets', async () => {
        const fallbackDir = path.join(
            workDir,
            'data',
            'chathub',
            'character',
            'presets'
        )
        await fs.mkdir(fallbackDir, { recursive: true })
        await fs.writeFile(
            path.join(fallbackDir, 'role.yml'),
            CHARACTER_RAW,
            'utf-8'
        )

        const detail = await getChatLunaCorePreset(createBareCtx(), {
            id: 'character:role.yml'
        })

        assert.equal(detail.rawText, CHARACTER_RAW)
        assert.equal(detail.preset.sourceLabel, 'Character 预设')
        assert.deepEqual(detail.preset.keywords, ['小助手'])
    })
})
