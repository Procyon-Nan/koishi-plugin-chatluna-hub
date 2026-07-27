/**
 * Type-check the console client and report only diagnostics owned by this
 * repository.
 *
 * `@koishijs/client` and `schemastery-vue` publish raw `.ts`/`.vue` sources
 * instead of declaration files, so `tsc` type-checks their implementation with
 * this project's stricter options and emits a large number of errors that no
 * change here can fix (`skipLibCheck` does not help: it only skips `.d.ts`
 * files). Stubbing the packages through `paths` is worse — it drops their real
 * types, breaks the `declare module '@koishijs/client'` augmentations in
 * `client/`, and turns every callback parameter into an implicit-any error.
 *
 * So the program keeps the real vendor types and this wrapper drops vendor
 * diagnostics from the output, exiting non-zero only for local ones.
 */
const { spawnSync } = require('child_process')
const { relative, resolve } = require('path')

const root = resolve(__dirname, '..')
const project = resolve(root, 'client/tsconfig.json')
const tsc = require.resolve('typescript/bin/tsc')

const result = spawnSync(
    process.execPath,
    [tsc, '-p', project, '--pretty', 'false'],
    { cwd: root, encoding: 'utf8' }
)

if (result.error) throw result.error
if (result.stderr) process.stderr.write(result.stderr)

// `file.ts(12,34): error TS1234: ...`, followed by indented continuation lines.
// Only the file path may be tested for `node_modules`: the message itself often
// quotes absolute paths (e.g. duplicated package copies in a type mismatch).
const diagnosticStart = /^(\S.*?)\(\d+,\d+\): (?:error|warning) TS\d+:/
const localLines = []
let parsedDiagnosticCount = 0
let keepingCurrent = true

for (const line of result.stdout.split(/\r?\n/)) {
    if (line === '') continue
    if (/^\S/.test(line)) {
        const [, file] = diagnosticStart.exec(line) ?? []
        if (file) parsedDiagnosticCount += 1
        keepingCurrent = !file || !file.includes('node_modules')
    }
    if (keepingCurrent) localLines.push(line)
}

const localErrorCount = localLines.filter((line) => /^\S/.test(line)).length

if (localLines.length > 0) {
    console.log(localLines.join('\n'))
}

const label = relative(root, project)
if (localErrorCount === 0) {
    // tsc exits non-zero for any diagnostic at all, and the vendor diagnostics
    // described above are the expected steady state here, so the exit status
    // alone cannot tell a crash apart from a clean local run. A crash (bad
    // config, missing compiler) reports through a message that carries no
    // file position, so it leaves the parsed diagnostic count at zero: only an
    // empty diagnostic set combined with a non-zero status is a crash.
    if (parsedDiagnosticCount === 0 && result.status !== 0) {
        console.error(`[typecheck:client] tsc exited with ${result.status}.`)
        process.exit(result.status ?? 1)
    }

    console.log(`[typecheck:client] ${label}: no errors in repository sources.`)
    process.exit(0)
}

console.log(
    `[typecheck:client] ${label}: ${localErrorCount} error(s) in repository sources.`
)
process.exit(1)
