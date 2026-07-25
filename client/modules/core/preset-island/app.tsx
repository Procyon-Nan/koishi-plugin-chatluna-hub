import { PresetShell } from './components/preset-shell'
import type { PresetHubApi } from './lib/hub-api'

export interface PresetIslandAppProps {
    api: PresetHubApi
    onDirtyChange: (dirty: boolean) => void
}

export function PresetIslandApp({ api, onDirtyChange }: PresetIslandAppProps) {
    return <PresetShell api={api} onDirtyChange={onDirtyChange} />
}
