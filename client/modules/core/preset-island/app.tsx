import { PresetShell } from './components/preset-shell'
import type { PresetHubApi } from './lib/hub-api'

export interface PresetIslandAppProps {
    api: PresetHubApi
}

export function PresetIslandApp({ api }: PresetIslandAppProps) {
    return <PresetShell api={api} />
}
