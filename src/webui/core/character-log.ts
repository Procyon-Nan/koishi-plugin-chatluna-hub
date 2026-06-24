import { coerceString, getRecordString, isRecord } from '../shared'
import { extractLogText, stringifyLogBody, summarizeLogText } from './log-types'

interface CharacterLogPayloadBase {
    session?: unknown
    sessionKey?: string
    targetId?: string
    presetName?: string
    preset?: unknown
    messages?: readonly unknown[]
    focusMessage?: unknown
    triggerReason?: string
}

export type ChatLunaCharacterBeforeChatPayload = CharacterLogPayloadBase

export interface ChatLunaCharacterAfterChatPayload extends CharacterLogPayloadBase {
    persistedHumanMessage?: unknown
    lastResponseMessage?: unknown
    completionMessages?: readonly unknown[]
    status?: string | null
}

export interface NormalizedCharacterLogStart {
    key: string
    conversationId: string
    conversationTitle: string
    bindingKey: string
    preset: string
    platform: string | null
    userId: string | null
    guildId: string | null
    channelId: string | null
    messageSummary: string
    messageBody: string
    requestBody: string
}

export interface NormalizedCharacterLogEnd {
    key: string
    requestBody: string
    responseBody: string
}

export interface NormalizedCharacterModelCall {
    key: string
    method: 'invoke' | 'stream'
    requestBody: string
}

const characterLogSource = 'character'

const getRecordBoolean = (value: unknown, key: string): boolean | null => {
    if (!isRecord(value)) return null
    const field = value[key]
    return typeof field === 'boolean' ? field : null
}

const getStringOrNull = (value: unknown): string | null => {
    const text = coerceString(value)
    return text || null
}

const normalizeMessages = (
    value: readonly unknown[] | undefined
): unknown[] => {
    return Array.isArray(value) ? [...value] : []
}

const getPresetName = (payload: CharacterLogPayloadBase): string => {
    if (payload.presetName) return payload.presetName
    if (isRecord(payload.preset)) return coerceString(payload.preset.name)
    return ''
}

const getLastMessage = (messages: readonly unknown[]): unknown => {
    return messages.length > 0 ? messages[messages.length - 1] : undefined
}

const getPrimaryMessage = (payload: CharacterLogPayloadBase): unknown => {
    const messages = normalizeMessages(payload.messages)
    return payload.focusMessage ?? getLastMessage(messages)
}

const getPrimaryMessageText = (payload: CharacterLogPayloadBase): string => {
    return (
        extractLogText(getPrimaryMessage(payload)) ||
        coerceString(payload.triggerReason)
    )
}

const createSessionSnapshot = (session: unknown) => {
    return {
        platform: getStringOrNull(getRecordString(session, 'platform')),
        selfId: getStringOrNull(getRecordString(session, 'selfId')),
        botId: getStringOrNull(getRecordString(session, 'botId')),
        userId: getStringOrNull(getRecordString(session, 'userId')),
        guildId: getStringOrNull(getRecordString(session, 'guildId')),
        channelId: getStringOrNull(getRecordString(session, 'channelId')),
        messageId: getStringOrNull(getRecordString(session, 'messageId')),
        isDirect: getRecordBoolean(session, 'isDirect')
    }
}

const createCharacterBindingKey = (
    payload: CharacterLogPayloadBase
): string => {
    const session = payload.session
    const snapshot = createSessionSnapshot(session)
    const platform = snapshot.platform ?? 'character'
    const selfId = snapshot.selfId ?? snapshot.botId ?? '-'
    const userId =
        snapshot.userId ?? payload.targetId ?? payload.sessionKey ?? '-'
    const guildId =
        snapshot.guildId ?? snapshot.channelId ?? payload.targetId ?? '-'

    if (snapshot.isDirect === true || !snapshot.guildId) {
        return `personal:${platform}:${selfId}:direct:${userId}`
    }

    return `personal:${platform}:${selfId}:${guildId}:${userId}`
}

const createCharacterSessionKey = (
    payload: CharacterLogPayloadBase
): string => {
    const session = createSessionSnapshot(payload.session)
    const targetId = coerceString(payload.targetId)

    if (session.userId && (session.isDirect === true || !session.guildId)) {
        return `private:${session.userId}`
    }

    if (session.guildId) return `group:${session.guildId}`
    if (targetId && payload.sessionKey?.startsWith('private:')) {
        return `private:${targetId}`
    }
    if (targetId && payload.sessionKey?.startsWith('group:')) {
        return `group:${targetId}`
    }

    return ''
}

export const getCharacterLogKey = (
    payload: CharacterLogPayloadBase
): string => {
    return (
        coerceString(payload.sessionKey) ||
        createCharacterSessionKey(payload) ||
        createCharacterBindingKey(payload)
    )
}

const getRunnableConfigurable = (options: unknown): Record<string, unknown> => {
    if (!isRecord(options)) return {}
    const configurable = options.configurable
    return isRecord(configurable) ? configurable : {}
}

export const normalizeCharacterModelCall = (
    method: NormalizedCharacterModelCall['method'],
    input: unknown,
    options: unknown
): NormalizedCharacterModelCall | null => {
    const configurable = getRunnableConfigurable(options)
    const session = configurable.session
    const source = getRecordString(configurable, 'source')
    const key = createCharacterSessionKey({ session })

    if (!key) return null

    return {
        key,
        method,
        requestBody: stringifyLogBody({
            source: characterLogSource,
            phase: 'model-call',
            method,
            runnableSource: source || null,
            input,
            options
        })
    }
}

export const normalizeCharacterLogStart = (
    payload: ChatLunaCharacterBeforeChatPayload
): NormalizedCharacterLogStart => {
    const key = getCharacterLogKey(payload)
    const messages = normalizeMessages(payload.messages)
    const preset = getPresetName(payload)
    const bindingKey = createCharacterBindingKey(payload)
    const messageBody = getPrimaryMessageText(payload)
    const session = createSessionSnapshot(payload.session)

    return {
        key,
        conversationId: coerceString(payload.targetId) || bindingKey,
        conversationTitle: preset ? `Character ${preset}` : 'Character',
        bindingKey,
        preset,
        platform: session.platform,
        userId: session.userId,
        guildId: session.guildId,
        channelId: session.channelId,
        messageSummary: summarizeLogText(messageBody),
        messageBody,
        requestBody: stringifyLogBody({
            source: characterLogSource,
            phase: 'before-chat',
            session,
            sessionKey: key,
            targetId: payload.targetId,
            presetName: preset,
            preset: payload.preset,
            messages,
            focusMessage: payload.focusMessage,
            triggerReason: payload.triggerReason
        })
    }
}

export const normalizeCharacterLogEnd = (
    payload: ChatLunaCharacterAfterChatPayload
): NormalizedCharacterLogEnd => {
    const key = getCharacterLogKey(payload)
    const messages = normalizeMessages(payload.messages)
    const completionMessages = normalizeMessages(payload.completionMessages)
    const preset = getPresetName(payload)
    const session = createSessionSnapshot(payload.session)

    return {
        key,
        requestBody: stringifyLogBody({
            source: characterLogSource,
            phase: 'after-chat',
            session,
            sessionKey: key,
            targetId: payload.targetId,
            presetName: preset,
            preset: payload.preset,
            triggerReason: payload.triggerReason,
            focusMessage: payload.focusMessage,
            persistedHumanMessage: payload.persistedHumanMessage,
            completionMessages
        }),
        responseBody: stringifyLogBody({
            source: characterLogSource,
            phase: 'after-chat',
            session,
            sessionKey: key,
            targetId: payload.targetId,
            presetName: preset,
            status: payload.status,
            lastResponseMessage: payload.lastResponseMessage,
            messages
        })
    }
}
