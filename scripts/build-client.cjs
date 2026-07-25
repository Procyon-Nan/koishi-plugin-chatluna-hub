/**
 * Wrap @koishijs/client build with React JSX settings for the preset island.
 * The monorepo tsconfig uses jsxImportSource=@satorijs/element for Satori;
 * client TSX must compile against react/jsx-runtime instead.
 */
const path = require('path')
const { build } = require('@koishijs/client/lib')

const root = path.resolve(__dirname, '..')

build(root, {
    esbuild: {
        jsx: 'automatic',
        jsxImportSource: 'react'
    }
}).catch((error) => {
    console.error(error)
    process.exit(1)
})
