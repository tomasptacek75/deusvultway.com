// Vite builds into php-forpsi/public with emptyOutDir:false (that directory also holds the
// PHP api/, router.php, uploads etc. that emptyOutDir would wipe) — so old content-hashed
// files in assets/ never get removed on their own and accumulate across builds. This prunes
// assets/ down to just what the freshly-built app actually references.
//
// Ground truth is Vite's own build manifest (build.manifest:true in vite.config.js), not
// index.html — with React.lazy() code-splitting, most page chunks are only ever reached via
// a runtime import() from inside the JS bundle and never appear as a literal string in
// index.html, so scraping the HTML (an earlier version of this script did that) silently
// deletes every lazy-loaded chunk. The manifest lists every emitted file regardless of how
// it's reached.
import { readFileSync, readdirSync, unlinkSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const PUBLIC_DIR = join(import.meta.dirname, '..', '..', 'php-forpsi', 'public')
const ASSETS_DIR = join(PUBLIC_DIR, 'assets')
const MANIFEST_PATH = join(PUBLIC_DIR, '.vite', 'manifest.json')

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
const referenced = new Set()
for (const entry of Object.values(manifest)) {
  if (entry.file) referenced.add(entry.file.replace(/^assets\//, ''))
  for (const css of entry.css ?? []) referenced.add(css.replace(/^assets\//, ''))
  for (const asset of entry.assets ?? []) referenced.add(asset.replace(/^assets\//, ''))
}

let removed = 0
for (const file of readdirSync(ASSETS_DIR)) {
  if (!referenced.has(file)) {
    unlinkSync(join(ASSETS_DIR, file))
    removed++
  }
}
// .vite/manifest.json is a build artifact for this script, not something the app needs at
// runtime — drop it so it doesn't get uploaded to the webroot by the FTP deploy scripts.
rmSync(join(PUBLIC_DIR, '.vite'), { recursive: true, force: true })

console.log(`clean-stale-assets: removed ${removed} stale file(s), kept ${referenced.size}.`)
