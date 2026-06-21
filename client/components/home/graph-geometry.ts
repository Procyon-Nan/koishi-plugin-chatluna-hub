export interface Point {
    x: number
    y: number
}

export interface StageSize {
    width: number
    height: number
}

export const graphViewBoxWidth = 1000
export const graphViewBoxHeight = 620

export const toScreenPoint = (point: Point, stage: StageSize): Point => ({
    x: (point.x / graphViewBoxWidth) * stage.width,
    y: (point.y / graphViewBoxHeight) * stage.height
})

export const toStagePoint = (point: Point, stage: StageSize): Point => ({
    x: (point.x / stage.width) * graphViewBoxWidth,
    y: (point.y / stage.height) * graphViewBoxHeight
})

export const toScreenDelta = (
    from: Point,
    to: Point,
    stage: StageSize
): Point => ({
    x: ((to.x - from.x) / graphViewBoxWidth) * stage.width,
    y: ((to.y - from.y) / graphViewBoxHeight) * stage.height
})

export const createStagePointFromScreenDelta = (
    origin: Point,
    delta: Point,
    stage: StageSize
): Point => ({
    x: origin.x + delta.x * (graphViewBoxWidth / stage.width),
    y: origin.y + delta.y * (graphViewBoxHeight / stage.height)
})

export const createOrbitPosition = (
    center: Point,
    angle: number,
    radiusPx: number,
    stage: StageSize
): Point =>
    createStagePointFromScreenDelta(
        center,
        {
            x: Math.cos(angle) * radiusPx,
            y: Math.sin(angle) * radiusPx
        },
        stage
    )

export const getScreenDistance = (
    left: Point,
    right: Point,
    stage: StageSize
) => {
    const delta = toScreenDelta(right, left, stage)

    return Math.hypot(delta.x, delta.y)
}

export const rotateStagePoint = (
    point: Point,
    center: Point,
    angle: number,
    stage: StageSize
): Point => {
    const delta = toScreenDelta(center, point, stage)
    const cosVal = Math.cos(angle)
    const sinVal = Math.sin(angle)

    return createStagePointFromScreenDelta(
        center,
        {
            x: delta.x * cosVal - delta.y * sinVal,
            y: delta.x * sinVal + delta.y * cosVal
        },
        stage
    )
}

export const projectStagePointToRadius = (
    point: Point,
    center: Point,
    radiusPx: number,
    stage: StageSize
): Point => {
    const delta = toScreenDelta(center, point, stage)
    const distance = Math.hypot(delta.x, delta.y)
    const scale = radiusPx / distance

    return createStagePointFromScreenDelta(
        center,
        {
            x: delta.x * scale,
            y: delta.y * scale
        },
        stage
    )
}
