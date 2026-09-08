import { createServer, type IncomingHttpHeaders, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

export interface RecordedRequest {
  method: string
  url: string
  headers: IncomingHttpHeaders
  body: unknown
}

interface FakeResponse {
  status: number
  body: unknown
}

/** Successful Daichi envelope */
export const ok = <T>(data: T) => ({
  done: true as const,
  errors: null,
  updateRequired: false,
  data
})

/** Failed Daichi envelope */
export const fail = (message: string, id = 'error') => ({
  done: false as const,
  errors: { id },
  updateRequired: false,
  message,
  data: null
})

/**
 * Minimal in-process stand-in for web.daichicloud.ru.
 * Routes are keyed by method + path relative to the API base ("token", "devices/1")
 * and answer with a JSON body. Every request is recorded so tests can assert on
 * what the client sent.
 */
export class FakeDaichiServer {
  readonly requests: RecordedRequest[] = []
  baseUrl = ''
  private readonly routes = new Map<string, FakeResponse>()
  private server: Server | null = null

  route(method: string, path: string, body: unknown, status = 200) {
    this.routes.set(`${method} /api/v4/${path}`, { status, body })
    return this
  }

  requestsTo(method: string, path: string) {
    const url = `/api/v4/${path}`
    return this.requests.filter(r => r.method === method && r.url === url)
  }

  async start() {
    const server = createServer((req, res) => {
      const chunks: Buffer[] = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString()
        const recorded: RecordedRequest = {
          method: req.method ?? '',
          url: req.url ?? '',
          headers: req.headers,
          body: raw ? JSON.parse(raw) : undefined
        }
        this.requests.push(recorded)
        const response = this.routes.get(`${recorded.method} ${recorded.url}`) ?? {
          status: 404,
          body: fail(`Unhandled ${recorded.method} ${recorded.url}`, 'not_found')
        }
        res.writeHead(response.status, { 'content-type': 'application/json' })
        res.end(JSON.stringify(response.body))
      })
    })
    this.server = server
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as AddressInfo
    this.baseUrl = `http://127.0.0.1:${port}/api/v4/`
    return this.baseUrl
  }

  async stop() {
    const server = this.server
    if (!server) return
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) =>
      server.close(err => (err ? reject(err) : resolve()))
    )
    this.server = null
  }
}
