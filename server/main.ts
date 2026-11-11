import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createApp } from './server.ts'
import { MAX_PLANNINGS, openStore } from './store.ts'

// Defaults match the local Docker setup (.env.docker): port 8080, data in ./elternzeit.
const port = Number(process.env.PORT ?? 8080)
const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(import.meta.dirname, '..', 'elternzeit'))
const htmlFile = path.join(import.meta.dirname, '..', 'dist', 'index.html')

mkdirSync(dataDir, { recursive: true })
const store = openStore(path.join(dataDir, 'elternzeit.db'), { maxPlannings: Number(process.env.MAX_PLANNINGS ?? MAX_PLANNINGS) })
const server = createApp(store, { html: existsSync(htmlFile) ? readFileSync(htmlFile) : null })

server.listen(port, () => console.log(`Elternzeit-Planer listening on port ${port}, data in ${dataDir}`))

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close()
    store.close()
    process.exit(0)
  })
}
