/**
 * Build the client bundle. This is the `npm run build:client` entry.
 *
 * `build()` writes the given root into Vite's `root`, and Vite discovers the
 * config file from there, so the overrides in vite.config.cjs apply without
 * being passed. Yakumo's `client` step calls the same helper with the same
 * root, so both build paths load the same config. Keep every Vite override in
 * vite.config.cjs rather than here.
 */
const path = require('path')
const { build } = require('@koishijs/client/lib')

const root = path.resolve(__dirname, '..')

build(root).catch((error) => {
    console.error(error)
    process.exit(1)
})
