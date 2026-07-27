/**
 * Loaded through `--import` by the `test` script, before any test file runs.
 *
 * Node executes the TypeScript sources of this repository directly (native type
 * stripping, Node >= 22.18 / >= 24), but its ESM resolver requires explicit file
 * extensions while the sources use extensionless relative imports
 * (`import { isRecord } from '../shared'`). The registered hook adds the
 * extension resolution that bundlers and `moduleResolution: bundler` provide, so
 * modules under `src/` and `client/` can be imported unchanged.
 */
import { register } from 'node:module'

register('./resolve-extensionless.mjs', import.meta.url)
