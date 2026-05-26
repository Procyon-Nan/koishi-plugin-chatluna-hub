const { execFileSync } = require('child_process')
const { resolve } = require('path')
const { buildSync } = require('esbuild')

const cwd = resolve(__dirname, '..')
const tsc = resolve(
    __dirname,
    '..',
    '..',
    '..',
    'node_modules',
    'typescript',
    'bin',
    'tsc'
)

execFileSync(process.execPath, [tsc, '-b', '--force'], {
    cwd,
    stdio: 'inherit'
})

const sharedOptions = {
    entryPoints: [resolve(cwd, 'src/index.ts')],
    bundle: true,
    platform: 'node',
    target: 'es2022',
    packages: 'external',
    keepNames: true,
    logLevel: 'info'
}

buildSync({
    ...sharedOptions,
    format: 'esm',
    outfile: resolve(cwd, 'lib/index.mjs')
})

buildSync({
    ...sharedOptions,
    format: 'cjs',
    outfile: resolve(cwd, 'lib/index.cjs')
})
