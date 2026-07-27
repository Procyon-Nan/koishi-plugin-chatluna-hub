/**
 * Build the client bundle with the shared Vite overrides.
 *
 * This is the `npm run build:client` entry. The monorepo root path
 * (`yarn build chatluna-hub`) does not go through this file: yakumo's `client`
 * step imports scripts/client-vite-config.cjs directly via the `yakumo.client`
 * field in package.json and hands it to the same `build()` used here. Keep
 * every Vite override in that shared config so both paths stay identical.
 */
const path = require('path')
const { build } = require('@koishijs/client/lib')

const clientViteConfig = require('./client-vite-config.cjs')

const root = path.resolve(__dirname, '..')

build(root, clientViteConfig).catch((error) => {
    console.error(error)
    process.exit(1)
})
