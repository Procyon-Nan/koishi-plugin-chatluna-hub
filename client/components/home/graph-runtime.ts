interface GraphRuntimeOptions {
    getStageElement: () => HTMLElement
    refreshStageSize: () => void
    clearTransientState: () => void
    tickFrame: (time: number) => void
}

export const createGraphRuntime = (options: GraphRuntimeOptions) => {
    let animationFrame = 0
    let isActive = false
    let resizeObserver: ResizeObserver

    const handleResize = () => {
        options.refreshStageSize()
        options.clearTransientState()
    }

    const tick = (time: number) => {
        if (!isActive) return

        options.tickFrame(time)
        animationFrame = window.requestAnimationFrame(tick)
    }

    return {
        start() {
            if (isActive) return

            isActive = true
            options.refreshStageSize()
            options.clearTransientState()

            resizeObserver = new ResizeObserver(handleResize)
            resizeObserver.observe(options.getStageElement())
            animationFrame = window.requestAnimationFrame(tick)
        },

        stop() {
            if (!isActive) return

            isActive = false
            window.cancelAnimationFrame(animationFrame)
            resizeObserver.disconnect()
            options.clearTransientState()
        }
    }
}
