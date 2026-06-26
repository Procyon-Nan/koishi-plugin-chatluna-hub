import { AsyncLocalStorage } from 'async_hooks'
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { coerceReason, coerceString, isRecord } from '../shared'
import { stringifyLogBody } from './log-types'
import type { ChatLunaCoreLogStore, ChatLunaModelRunStart } from './log-store'

type RequesterMethod = ChatLunaModelRunStart['method']
type ModelRunRef = ReturnType<ChatLunaCoreLogStore['startModelRun']>
type HttpExchangeRef = NonNullable<
    ReturnType<ChatLunaCoreLogStore['startHttpExchange']>
>

export interface ChatLunaRequesterLogService {
    fetch?: (...args: unknown[]) => Promise<Response>
}

interface ChatLunaComputedRefLike<T = unknown> {
    value?: T
}

interface ChatLunaPlatformServiceLike {
    getClient?: (platform: string) => Promise<ChatLunaComputedRefLike<unknown>>
}

export interface ChatLunaCreateModelService extends ChatLunaRequesterLogService {
    createChatModel?: (...args: unknown[]) => Promise<unknown>
    platform?: ChatLunaPlatformServiceLike
}

interface ModelRequesterLike {
    _plugin?: ChatLunaRequesterLogService
}

interface PlatformClientLike {
    _createModel?: (...args: unknown[]) => unknown
}

interface ChatLunaChatModelLike {
    _requester?: ModelRequesterLike
    modelName?: string
    modelInfo?: {
        name?: string
    }
    _options?: {
        model?: string
        modelInfo?: {
            name?: string
        }
    }
}

interface ChatLunaChatModelPrototype {
    _completion?: (
        this: ChatLunaChatModelLike,
        params: unknown
    ) => Promise<unknown>
    _createStream?: (
        this: ChatLunaChatModelLike,
        params: unknown
    ) => Promise<unknown> | unknown
}

interface ChatLunaModelModule {
    ChatLunaChatModel?: {
        prototype?: ChatLunaChatModelPrototype
    }
}

interface RequesterLogMeta {
    source: string | null
    requestId: string | null
    platform: string | null
    model: string | null
    conversationId: string | null
    conversationTitle: string | null
    bindingKey: string | null
    preset: string | null
    chatMode: string | null
    selfId: string | null
    userId: string | null
    guildId: string | null
    channelId: string | null
    message: unknown
}

interface ModelRequestContext {
    ref: ModelRunRef
}

type FetchTargetPatcher = (target: unknown) => void
type CurrentContextResolver = () => ModelRequestContext | null
type ModelSourceResolver = (model: ChatLunaChatModelLike) => string | null
type ChatModelMethodKey = '_completion' | '_createStream'

const maxLoggedBodyLength = 512 * 1024

const captureStack = () => {
    const limit = Error.stackTraceLimit
    Error.stackTraceLimit = Math.max(limit, 80)
    try {
        return new Error().stack
    } finally {
        Error.stackTraceLimit = limit
    }
}

const stackLineToFile = (line: string): string | null => {
    const match =
        line.match(
            /^\s*at\s+(?:[^()]+)?\(?((?:[A-Za-z]:[\\/]|\/|file:\/\/\/).+):\d+:\d+\)?$/
        ) ?? line.match(/^((?:[A-Za-z]:[\\/]|\/|file:\/\/\/).+):\d+:\d+$/)

    if (!match) return null

    try {
        return match[1].startsWith('file:///')
            ? fileURLToPath(match[1])
            : path.resolve(match[1])
    } catch {
        return null
    }
}

const packageSourceFromFile = (file: string): string | null => {
    let dir = path.dirname(file)

    while (dir !== path.dirname(dir)) {
        const packagePath = path.join(dir, 'package.json')
        if (fs.existsSync(packagePath)) {
            try {
                const parsed = JSON.parse(
                    fs.readFileSync(packagePath, 'utf8')
                ) as { name?: unknown }
                const name = typeof parsed.name === 'string' ? parsed.name : ''
                const base = name.split('/').pop()?.replaceAll('_', '-')

                if (!base?.startsWith('koishi-plugin-')) return null

                const source = base.slice('koishi-plugin-'.length)
                if (
                    source &&
                    !name.startsWith('@koishijs/') &&
                    !name.startsWith('@cordisjs/')
                ) {
                    return source.endsWith('-entry-point')
                        ? source.slice(0, -'-entry-point'.length)
                        : source
                }
            } catch {
                return null
            }
            return null
        }

        dir = path.dirname(dir)
    }

    return null
}

const sourceFromStack = (stack?: string): string | null => {
    if (!stack) return null

    let fallback: string | null = null

    for (const line of stack.split('\n')) {
        const normalized = line.replaceAll('\\', '/').toLowerCase()

        if (normalized.includes('chatluna-character')) {
            return 'character'
        }

        const file = stackLineToFile(line)
        const source = file ? packageSourceFromFile(file) : null

        if (source?.includes('character')) return 'character'
        if (source === 'chatluna') fallback = 'chatluna'
    }

    return fallback
}

const readRecord = (value: unknown, key: string): unknown => {
    return isRecord(value) ? value[key] : undefined
}

const getStringOrNull = (value: unknown): string | null => {
    const text = coerceString(value)
    return text || null
}

const removeContext = (
    stack: ModelRequestContext[],
    context: ModelRequestContext
) => {
    const index = stack.lastIndexOf(context)
    if (index >= 0) stack.splice(index, 1)
}

const resolveCurrentContext = (
    storage: AsyncLocalStorage<ModelRequestContext>,
    stack: ModelRequestContext[]
) => {
    const stored = storage.getStore()
    if (stored) return stored

    return stack.length === 1 ? stack[0] : null
}

const withModelContext = async <T>(
    storage: AsyncLocalStorage<ModelRequestContext>,
    stack: ModelRequestContext[],
    context: ModelRequestContext,
    callback: () => Promise<T>
): Promise<T> => {
    stack.push(context)
    try {
        return await storage.run(context, callback)
    } finally {
        removeContext(stack, context)
    }
}

const normalizeRequesterSource = (value: string | null): string | null => {
    if (!value) return null
    if (value === 'character' || value === 'chatluna') return value
    return value.includes('character') ? 'character' : 'chatluna'
}

const resolveModelName = (
    model: ChatLunaChatModelLike,
    params: unknown
): string | null => {
    return (
        getStringOrNull(readRecord(params, 'model')) ??
        getStringOrNull(model.modelName) ??
        getStringOrNull(model.modelInfo?.name) ??
        getStringOrNull(model._options?.model) ??
        getStringOrNull(model._options?.modelInfo?.name)
    )
}

const splitPlatformModel = (value: string | null) => {
    if (!value) return { platform: null, model: null }

    const index = value.indexOf('/')
    if (index <= 0 || index >= value.length - 1) {
        return { platform: null, model: value }
    }

    return {
        platform: value.slice(0, index),
        model: value.slice(index + 1)
    }
}

const modelSourceKey = (platform: string, model: string) =>
    `${platform}/${model}`

const createModelKeyFromArgs = (args: unknown[]) => {
    const first = getStringOrNull(args[0])
    if (!first) return null

    if (args.length > 1) {
        const model = getStringOrNull(args[1])
        return model ? { platform: first, model } : null
    }

    const split = splitPlatformModel(first)
    return split.platform && split.model
        ? { platform: split.platform, model: split.model }
        : null
}

const createBindingKey = (meta: RequesterLogMeta): string | null => {
    const source = meta.source ?? 'chatluna'
    const platform = meta.platform ?? source

    if (meta.userId || meta.guildId || meta.channelId) {
        const selfId = meta.selfId ?? '-'
        const userId = meta.userId ?? '-'
        const guildId = meta.guildId ?? meta.channelId

        if (!guildId) return `personal:${platform}:${selfId}:direct:${userId}`
        return `personal:${platform}:${selfId}:${guildId}:${userId}`
    }

    if (meta.conversationId) return meta.conversationId

    return null
}

const extractRequesterMeta = (
    method: RequesterMethod,
    params: unknown,
    model: ChatLunaChatModelLike,
    fallbackSource: string | null
): ChatLunaModelRunStart => {
    const variables = readRecord(params, 'variables')
    const hiddenVariables = readRecord(params, 'variables_hide') ?? variables
    const built =
        readRecord(hiddenVariables, 'built') ?? readRecord(variables, 'built')
    const configurable = readRecord(params, 'configurable')
    const session =
        readRecord(configurable, 'session') ?? readRecord(variables, 'session')
    const agentContext = readRecord(configurable, 'agentContext')
    const source = normalizeRequesterSource(
        getStringOrNull(readRecord(agentContext, 'source')) ??
            getStringOrNull(readRecord(configurable, 'source')) ??
            getStringOrNull(readRecord(variables, 'source')) ??
            fallbackSource
    )
    const rawModel = resolveModelName(model, params)
    const splitModel = splitPlatformModel(rawModel)
    const platform =
        getStringOrNull(readRecord(built, 'chatPlatform')) ??
        getStringOrNull(readRecord(session, 'platform')) ??
        splitModel.platform
    const conversationId =
        getStringOrNull(readRecord(built, 'conversationId')) ??
        getStringOrNull(readRecord(agentContext, 'conversationId')) ??
        getStringOrNull(readRecord(configurable, 'conversationId')) ??
        getStringOrNull(readRecord(params, 'id'))
    const requestId =
        getStringOrNull(readRecord(built, 'requestId')) ??
        getStringOrNull(readRecord(agentContext, 'requestId'))
    const selfId =
        getStringOrNull(readRecord(built, 'selfId')) ??
        getStringOrNull(readRecord(agentContext, 'selfId')) ??
        getStringOrNull(readRecord(session, 'selfId'))
    const userId =
        getStringOrNull(readRecord(built, 'userId')) ??
        getStringOrNull(readRecord(agentContext, 'userId')) ??
        getStringOrNull(readRecord(configurable, 'userId')) ??
        getStringOrNull(readRecord(session, 'userId'))
    const guildId =
        getStringOrNull(readRecord(built, 'guildId')) ??
        getStringOrNull(readRecord(agentContext, 'guildId')) ??
        getStringOrNull(readRecord(session, 'guildId'))
    const channelId =
        getStringOrNull(readRecord(built, 'channelId')) ??
        getStringOrNull(readRecord(session, 'channelId'))
    const message =
        readRecord(variables, 'prompt') ??
        readRecord(params, 'input') ??
        readRecord(params, 'messages')
    const meta: RequesterLogMeta = {
        source,
        requestId,
        platform,
        model: splitModel.model ?? rawModel,
        conversationId,
        conversationTitle:
            getStringOrNull(readRecord(agentContext, 'agentName')) ??
            conversationId,
        bindingKey: null,
        preset:
            getStringOrNull(readRecord(configurable, 'preset')) ??
            getStringOrNull(readRecord(variables, 'preset')),
        chatMode: getStringOrNull(readRecord(variables, 'chatMode')),
        selfId,
        userId,
        guildId,
        channelId,
        message
    }

    meta.bindingKey = createBindingKey(meta)

    return {
        requestId: meta.requestId,
        source: meta.source,
        method,
        model: meta.model,
        platform: meta.platform,
        conversationId: meta.conversationId,
        conversationTitle: meta.conversationTitle,
        bindingKey: meta.bindingKey,
        preset: meta.preset,
        chatMode: meta.chatMode,
        selfId: meta.selfId,
        userId: meta.userId,
        guildId: meta.guildId,
        channelId: meta.channelId,
        message: meta.message,
        stream: method === 'completionStream'
    }
}

const truncateText = (value: string) => {
    if (value.length <= maxLoggedBodyLength) {
        return { text: value, truncated: false }
    }

    return {
        text: value.slice(0, maxLoggedBodyLength),
        truncated: true
    }
}

const describeBinaryBody = (value: ArrayBuffer | ArrayBufferView) => {
    return stringifyLogBody({
        type: value.constructor.name,
        byteLength: value.byteLength
    })
}

const requestBodyToText = (value: unknown) => {
    if (value == null) return { text: '', truncated: false }

    if (typeof value === 'string') return truncateText(value)

    if (
        typeof URLSearchParams !== 'undefined' &&
        value instanceof URLSearchParams
    ) {
        return truncateText(value.toString())
    }

    if (typeof FormData !== 'undefined' && value instanceof FormData) {
        const entries: Record<string, unknown> = {}
        for (const [key, item] of value.entries()) {
            entries[key] =
                typeof File !== 'undefined' && item instanceof File
                    ? {
                          type: 'File',
                          name: item.name,
                          size: item.size,
                          mimeType: item.type
                      }
                    : item
        }
        return truncateText(stringifyLogBody({ type: 'FormData', entries }))
    }

    if (typeof Blob !== 'undefined' && value instanceof Blob) {
        return truncateText(
            stringifyLogBody({
                type: 'Blob',
                size: value.size,
                mimeType: value.type
            })
        )
    }

    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
        return truncateText(describeBinaryBody(value))
    }

    if (
        typeof ReadableStream !== 'undefined' &&
        value instanceof ReadableStream
    ) {
        return truncateText('[ReadableStream body]')
    }

    return truncateText(stringifyLogBody(value))
}

const fetchInfoToUrl = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (typeof URL !== 'undefined' && value instanceof URL) return value.href

    const url = readRecord(value, 'url')
    if (typeof url === 'string') return url

    return String(value ?? '')
}

const fetchMethodFromArgs = (info: unknown, init: unknown): string => {
    const initMethod = getStringOrNull(readRecord(init, 'method'))
    if (initMethod) return initMethod.toUpperCase()

    const requestMethod = getStringOrNull(readRecord(info, 'method'))
    if (requestMethod) return requestMethod.toUpperCase()

    return 'GET'
}

const fetchBodyFromArgs = (info: unknown, init: unknown): unknown => {
    const initBody = readRecord(init, 'body')
    if (initBody != null) return initBody

    return readRecord(info, 'body')
}

const readResponseBody = async (response: Response) => {
    const reader = response.body?.getReader()
    if (!reader) {
        return truncateText(await response.text())
    }

    const decoder = new TextDecoder()
    let text = ''
    let truncated = false

    try {
        while (true) {
            const { value, done } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const nextLength = text.length + chunk.length
            if (nextLength > maxLoggedBodyLength) {
                text += chunk.slice(0, maxLoggedBodyLength - text.length)
                truncated = true
                await reader.cancel()
                break
            }

            text += chunk
        }

        const tail = decoder.decode()
        if (!truncated && tail) {
            const nextLength = text.length + tail.length
            if (nextLength > maxLoggedBodyLength) {
                text += tail.slice(0, maxLoggedBodyLength - text.length)
                truncated = true
            } else {
                text += tail
            }
        }
    } finally {
        reader.releaseLock()
    }

    return { text, truncated }
}

const safelyStartRun = (
    store: ChatLunaCoreLogStore,
    input: ChatLunaModelRunStart,
    logger: { warn: (...args: unknown[]) => void }
): ModelRunRef | null => {
    try {
        return store.startModelRun(input)
    } catch (error) {
        logger.warn(
            'chatluna model HTTP log start failed: %s',
            coerceReason(error)
        )
        return null
    }
}

const safelyCompleteRun = (
    store: ChatLunaCoreLogStore,
    ref: ModelRunRef | null,
    logger: { warn: (...args: unknown[]) => void }
) => {
    if (!ref) return

    try {
        store.completeModelRun(ref)
    } catch (error) {
        logger.warn(
            'chatluna model HTTP log completion failed: %s',
            coerceReason(error)
        )
    }
}

const safelyFailRun = (
    store: ChatLunaCoreLogStore,
    ref: ModelRunRef | null,
    error: unknown,
    logger: { warn: (...args: unknown[]) => void }
) => {
    if (!ref) return

    try {
        store.failModelRun(ref, error)
    } catch (logError) {
        logger.warn(
            'chatluna model HTTP log failure failed: %s',
            coerceReason(logError)
        )
    }
}

const safelyStartExchange = (
    store: ChatLunaCoreLogStore,
    ref: ModelRunRef,
    info: unknown,
    init: unknown,
    logger: { warn: (...args: unknown[]) => void }
): HttpExchangeRef | null => {
    try {
        const requestBody = requestBodyToText(fetchBodyFromArgs(info, init))
        return store.startHttpExchange(ref, {
            url: fetchInfoToUrl(info),
            method: fetchMethodFromArgs(info, init),
            requestBody: requestBody.text,
            requestTruncated: requestBody.truncated
        })
    } catch (error) {
        logger.warn(
            'chatluna HTTP exchange log start failed: %s',
            coerceReason(error)
        )
        return null
    }
}

const safelyCompleteExchange = (
    store: ChatLunaCoreLogStore,
    ref: HttpExchangeRef | null,
    response: Response,
    responseBody: { text: string; truncated: boolean },
    logger: { warn: (...args: unknown[]) => void }
) => {
    if (!ref) return

    try {
        store.completeHttpExchange(ref, {
            httpStatus: response.status,
            httpStatusText: response.statusText,
            responseBody: responseBody.text,
            responseTruncated: responseBody.truncated
        })
    } catch (error) {
        logger.warn(
            'chatluna HTTP exchange log completion failed: %s',
            coerceReason(error)
        )
    }
}

const safelyFailExchange = (
    store: ChatLunaCoreLogStore,
    ref: HttpExchangeRef | null,
    error: unknown,
    logger: { warn: (...args: unknown[]) => void }
) => {
    if (!ref) return

    try {
        store.failHttpExchange(ref, error)
    } catch (logError) {
        logger.warn(
            'chatluna HTTP exchange log failure failed: %s',
            coerceReason(logError)
        )
    }
}

const isAsyncIterable = (value: unknown): value is AsyncIterable<unknown> => {
    return (
        value != null &&
        typeof value === 'object' &&
        typeof (value as AsyncIterable<unknown>)[Symbol.asyncIterator] ===
            'function'
    )
}

const wrapRequesterStream = (
    stream: AsyncIterable<unknown>,
    storage: AsyncLocalStorage<ModelRequestContext>,
    contextStack: ModelRequestContext[],
    context: ModelRequestContext,
    store: ChatLunaCoreLogStore,
    logger: { warn: (...args: unknown[]) => void }
): AsyncGenerator<unknown> => {
    const iterator = stream[Symbol.asyncIterator]()
    let settled = false

    const settleSuccess = () => {
        if (settled) return
        settled = true
        safelyCompleteRun(store, context.ref, logger)
    }

    const settleFailure = (error: unknown) => {
        if (settled) return
        settled = true
        safelyFailRun(store, context.ref, error, logger)
    }

    return {
        async next(...args: [] | [unknown]) {
            try {
                const result = await withModelContext(
                    storage,
                    contextStack,
                    context,
                    () => iterator.next(...args)
                )
                if (result.done) settleSuccess()
                return result
            } catch (error) {
                settleFailure(error)
                throw error
            }
        },
        async return(value?: unknown) {
            settleFailure(
                new Error('Requester stream was closed before completion.')
            )

            if (typeof iterator.return === 'function') {
                return withModelContext(storage, contextStack, context, () =>
                    iterator.return!(value)
                )
            }

            return { done: true, value }
        },
        async throw(error?: unknown) {
            settleFailure(error)

            if (typeof iterator.throw === 'function') {
                return withModelContext(storage, contextStack, context, () =>
                    iterator.throw!(error)
                )
            }

            throw error
        },
        [Symbol.asyncIterator]() {
            return this
        }
    }
}

const createFetchPatcher = (
    store: ChatLunaCoreLogStore,
    resolveContext: CurrentContextResolver,
    logger: { warn: (...args: unknown[]) => void }
) => {
    const restores: (() => void)[] = []
    const patchedTargets = new WeakSet<object>()

    const patchTarget: FetchTargetPatcher = (value) => {
        if (!value || typeof value !== 'object') return
        if (patchedTargets.has(value)) return

        const target = value as ChatLunaRequesterLogService
        if (typeof target.fetch !== 'function') return

        const originalMethod = target.fetch
        const originalFetch = originalMethod.bind(target)

        const patchedFetch = async (...args: unknown[]) => {
            const context = resolveContext()
            if (!context) return originalFetch(...args)

            const exchangeRef = safelyStartExchange(
                store,
                context.ref,
                args[0],
                args[1],
                logger
            )

            try {
                const response = await originalFetch(...args)

                try {
                    const clone = response.clone()

                    readResponseBody(clone)
                        .then((body) =>
                            safelyCompleteExchange(
                                store,
                                exchangeRef,
                                response,
                                body,
                                logger
                            )
                        )
                        .catch((error) =>
                            safelyFailExchange(
                                store,
                                exchangeRef,
                                error,
                                logger
                            )
                        )
                } catch (error) {
                    safelyFailExchange(store, exchangeRef, error, logger)
                }

                return response
            } catch (error) {
                safelyFailExchange(store, exchangeRef, error, logger)
                throw error
            }
        }

        target.fetch = patchedFetch
        patchedTargets.add(value)

        restores.push(() => {
            if (target.fetch === patchedFetch) {
                target.fetch = originalMethod
            } else {
                logger.warn(
                    'chatluna.fetch was patched by another consumer; skipping HTTP log restore.'
                )
            }
        })
    }

    return {
        patchTarget,
        dispose() {
            for (const restore of restores.splice(0).reverse()) {
                restore()
            }
        }
    }
}

const createModelClientPatcher = (
    modelSources: WeakMap<object, string>,
    pendingModelSources: Map<string, string>,
    patchModelInstance: (model: unknown) => void,
    logger: { warn: (...args: unknown[]) => void }
) => {
    const restores: (() => void)[] = []
    const patchedClients = new WeakSet<object>()

    const patchClient = (platform: string, value: unknown) => {
        if (!value || typeof value !== 'object') return
        if (patchedClients.has(value)) return

        const target = value as PlatformClientLike
        if (typeof target._createModel !== 'function') return

        const originalCreateModel = target._createModel

        const patchedCreateModel = function patchedCreateModel(
            this: unknown,
            ...args: unknown[]
        ) {
            const modelName = getStringOrNull(args[0])
            const key = modelName ? modelSourceKey(platform, modelName) : null
            const stackSource = sourceFromStack(captureStack())
            const fallbackSource = key ? pendingModelSources.get(key) : null
            const source = normalizeRequesterSource(
                stackSource === 'character'
                    ? stackSource
                    : (fallbackSource ?? stackSource)
            )
            const output = originalCreateModel.apply(this, args)

            if (source && output && typeof output === 'object') {
                modelSources.set(output, source)
            }
            patchModelInstance(output)

            return output
        }

        target._createModel = patchedCreateModel
        patchedClients.add(value)

        restores.push(() => {
            if (target._createModel === patchedCreateModel) {
                target._createModel = originalCreateModel
            } else {
                logger.warn(
                    'chatluna platform client model factory was patched by another consumer; skipping requester log restore.'
                )
            }
        })
    }

    return {
        patchClient,
        rememberSource(
            key: { platform: string; model: string },
            source: string | null
        ) {
            const normalized = normalizeRequesterSource(source)
            if (!normalized) return

            pendingModelSources.set(
                modelSourceKey(key.platform, key.model),
                normalized
            )
        },
        dispose() {
            for (const restore of restores.splice(0).reverse()) {
                restore()
            }
            pendingModelSources.clear()
        }
    }
}

const patchChatLunaCreateModel = (
    chatluna: ChatLunaCreateModelService,
    patchClient: (platform: string, client: unknown) => void,
    rememberSource: (
        key: { platform: string; model: string },
        source: string | null
    ) => void,
    logger: { warn: (...args: unknown[]) => void }
) => {
    if (typeof chatluna.createChatModel !== 'function') return () => {}

    const originalMethod = chatluna.createChatModel
    const originalCreateChatModel = originalMethod.bind(chatluna)

    const patchedCreateChatModel = async (...args: unknown[]) => {
        const key = createModelKeyFromArgs(args)
        const source = sourceFromStack(captureStack())
        const ref = await originalCreateChatModel(...args)

        if (!key) return ref

        rememberSource(key, source)

        try {
            const clientRef = await chatluna.platform?.getClient?.(key.platform)
            patchClient(key.platform, clientRef?.value)
        } catch (error) {
            logger.warn(
                'chatluna platform client requester log patch failed: %s',
                coerceReason(error)
            )
        }

        return ref
    }

    chatluna.createChatModel = patchedCreateChatModel

    return () => {
        if (chatluna.createChatModel === patchedCreateChatModel) {
            chatluna.createChatModel = originalMethod
        } else {
            logger.warn(
                'chatluna.createChatModel was patched by another consumer; skipping requester log restore.'
            )
        }
    }
}

const loadChatModelPrototype = (
    baseDir: string | undefined,
    logger: { warn: (...args: unknown[]) => void }
): ChatLunaChatModelPrototype | null => {
    try {
        const requireFromBase = createRequire(
            path.join(baseDir ?? process.cwd(), 'package.json')
        )
        const module = requireFromBase(
            'koishi-plugin-chatluna/llm-core/platform/model'
        ) as ChatLunaModelModule
        return module.ChatLunaChatModel?.prototype ?? null
    } catch (error) {
        logger.warn(
            'chatluna model prototype is unavailable; model HTTP logs cannot be captured: %s',
            coerceReason(error)
        )
        return null
    }
}

const patchChatModelMethods = (
    target: ChatLunaChatModelPrototype,
    store: ChatLunaCoreLogStore,
    storage: AsyncLocalStorage<ModelRequestContext>,
    contextStack: ModelRequestContext[],
    patchFetchTarget: FetchTargetPatcher,
    resolveModelSource: ModelSourceResolver,
    logger: { warn: (...args: unknown[]) => void },
    options: {
        warnIfUnavailable: boolean
        completionRestoreWarning: string
        streamRestoreWarning: string
    }
) => {
    const originalCompletion = target._completion
    const originalCreateStream = target._createStream
    const originalCompletionDescriptor = Object.getOwnPropertyDescriptor(
        target,
        '_completion'
    )
    const originalCreateStreamDescriptor = Object.getOwnPropertyDescriptor(
        target,
        '_createStream'
    )

    if (
        typeof originalCompletion !== 'function' ||
        typeof originalCreateStream !== 'function'
    ) {
        if (options.warnIfUnavailable) {
            logger.warn(
                'chatluna model methods are unavailable; model HTTP logs cannot be captured.'
            )
        }
        return () => {}
    }

    const startRun = (
        model: ChatLunaChatModelLike,
        method: RequesterMethod,
        params: unknown
    ) => {
        const stackSource = sourceFromStack(captureStack())
        const modelSource = resolveModelSource(model)
        patchFetchTarget(model._requester?._plugin)

        return safelyStartRun(
            store,
            extractRequesterMeta(
                method,
                params,
                model,
                modelSource ?? stackSource
            ),
            logger
        )
    }

    const patchedCompletion = async function patchedCompletion(
        this: ChatLunaChatModelLike,
        params: unknown
    ) {
        const ref = startRun(this, 'completion', params)
        if (!ref) return originalCompletion.call(this, params)

        const context: ModelRequestContext = { ref }

        try {
            const output = await withModelContext(
                storage,
                contextStack,
                context,
                () => originalCompletion.call(this, params)
            )
            safelyCompleteRun(store, ref, logger)
            return output
        } catch (error) {
            safelyFailRun(store, ref, error, logger)
            throw error
        }
    }

    const patchedCreateStream = function patchedCreateStream(
        this: ChatLunaChatModelLike,
        params: unknown
    ) {
        const ref = startRun(this, 'completionStream', params)
        if (!ref) return originalCreateStream.call(this, params)

        const context: ModelRequestContext = { ref }

        return (async () => {
            let stream: unknown

            try {
                stream = await withModelContext(
                    storage,
                    contextStack,
                    context,
                    () =>
                        Promise.resolve(originalCreateStream.call(this, params))
                )
            } catch (error) {
                safelyFailRun(store, ref, error, logger)
                throw error
            }

            if (!isAsyncIterable(stream)) {
                safelyCompleteRun(store, ref, logger)
                return stream
            }

            return wrapRequesterStream(
                stream,
                storage,
                contextStack,
                context,
                store,
                logger
            )
        })()
    }

    target._completion = patchedCompletion
    target._createStream = patchedCreateStream

    const restoreModelMethod = (
        key: ChatModelMethodKey,
        descriptor: PropertyDescriptor | undefined
    ) => {
        if (descriptor) {
            Object.defineProperty(target, key, descriptor)
        } else {
            delete target[key]
        }
    }

    return () => {
        if (target._completion === patchedCompletion) {
            restoreModelMethod('_completion', originalCompletionDescriptor)
        } else {
            logger.warn(options.completionRestoreWarning)
        }

        if (target._createStream === patchedCreateStream) {
            restoreModelMethod('_createStream', originalCreateStreamDescriptor)
        } else {
            logger.warn(options.streamRestoreWarning)
        }
    }
}

const patchChatModelPrototype = (
    prototype: ChatLunaChatModelPrototype,
    store: ChatLunaCoreLogStore,
    storage: AsyncLocalStorage<ModelRequestContext>,
    contextStack: ModelRequestContext[],
    patchFetchTarget: FetchTargetPatcher,
    resolveModelSource: ModelSourceResolver,
    logger: { warn: (...args: unknown[]) => void }
) =>
    patchChatModelMethods(
        prototype,
        store,
        storage,
        contextStack,
        patchFetchTarget,
        resolveModelSource,
        logger,
        {
            warnIfUnavailable: true,
            completionRestoreWarning:
                'chatluna model completion was patched by another consumer; skipping requester log restore.',
            streamRestoreWarning:
                'chatluna model stream was patched by another consumer; skipping requester log restore.'
        }
    )

export const registerChatLunaRequesterLogProvider = (
    chatluna: ChatLunaCreateModelService,
    store: ChatLunaCoreLogStore,
    logger: { warn: (...args: unknown[]) => void },
    baseDir?: string
) => {
    const storage = new AsyncLocalStorage<ModelRequestContext>()
    const contextStack: ModelRequestContext[] = []
    const modelSources = new WeakMap<object, string>()
    const pendingModelSources = new Map<string, string>()
    const fetchPatcher = createFetchPatcher(
        store,
        () => resolveCurrentContext(storage, contextStack),
        logger
    )
    let prototype: ChatLunaChatModelPrototype | null = null
    const instanceRestores: (() => void)[] = []
    const patchedInstances = new WeakSet<object>()
    const resolveModelSource: ModelSourceResolver = (model) =>
        model && typeof model === 'object'
            ? (modelSources.get(model) ?? null)
            : null
    const patchModelInstance = (model: unknown) => {
        if (!model || typeof model !== 'object') return
        if (patchedInstances.has(model)) return
        if (
            prototype &&
            Object.prototype.isPrototypeOf.call(prototype, model)
        ) {
            return
        }

        const restore = patchChatModelMethods(
            model as ChatLunaChatModelPrototype,
            store,
            storage,
            contextStack,
            fetchPatcher.patchTarget,
            resolveModelSource,
            logger,
            {
                warnIfUnavailable: false,
                completionRestoreWarning:
                    'chatluna model instance completion was patched by another consumer; skipping requester log restore.',
                streamRestoreWarning:
                    'chatluna model instance stream was patched by another consumer; skipping requester log restore.'
            }
        )

        patchedInstances.add(model)
        instanceRestores.push(restore)
    }
    const modelClientPatcher = createModelClientPatcher(
        modelSources,
        pendingModelSources,
        patchModelInstance,
        logger
    )

    fetchPatcher.patchTarget(chatluna)
    const restoreCreateChatModel = patchChatLunaCreateModel(
        chatluna,
        modelClientPatcher.patchClient,
        modelClientPatcher.rememberSource,
        logger
    )

    prototype = loadChatModelPrototype(baseDir, logger)
    const restorePrototype = prototype
        ? patchChatModelPrototype(
              prototype,
              store,
              storage,
              contextStack,
              fetchPatcher.patchTarget,
              resolveModelSource,
              logger
          )
        : () => {}

    return () => {
        restorePrototype()
        for (const restore of instanceRestores.splice(0).reverse()) {
            restore()
        }
        restoreCreateChatModel()
        modelClientPatcher.dispose()
        fetchPatcher.dispose()
        storage.disable()
    }
}
