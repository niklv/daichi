import createDebug from 'debug'
import { type $Fetch, ofetch } from 'ofetch'
import { z } from 'zod'
import {
  DaichiBuildingSchema,
  DaichiControlSchema,
  DaichiDeviceSchema,
  DaichiTokenSchema,
  DaichiUserSchema,
  daichiResponseSchema
} from './schemas/daichi'
import type { MqttUser } from './types'

const debug = createDebug('daichi')

/** Response envelope with the payload left for the caller's schema */
const envelope = daichiResponseSchema(z.unknown())

const SECRET_KEYS = new Set(['access_token', 'token', 'password'])

/** JSON for the debug log with credentials masked at any depth */
const redacted = (value: unknown) =>
  JSON.stringify(value, (key, v: unknown) => (SECRET_KEYS.has(key) ? '[redacted]' : v))

export class DaichiApi {
  /** Unauthenticated client, unwraps the cloud's response envelope */
  private readonly cloud: $Fetch
  /** Same client with the bearer token, logs in on first use */
  private readonly client: $Fetch
  private token: Promise<string> | null = null
  private mqttUser: MqttUser | null = null

  constructor(
    protected readonly username: string,
    protected readonly password: string,
    protected readonly daichiApi = 'https://web.daichicloud.ru/api/v4/',
    protected readonly clientId = 'sOJO7B6SqgaKudTfCzqLAy540cCuDzpI'
  ) {
    this.cloud = ofetch.create({
      baseURL: this.daichiApi,
      // without an explicit json accept the cloud redirects a bad token to its html login page
      headers: { accept: 'application/json' },
      redirect: 'error',
      // 4xx answers carry the usual envelope, let them through to the hook
      ignoreResponseError: true,
      retry: 0,
      onResponse({ request, options, response }) {
        debug(
          '%s %s -> %d %s',
          options.method ?? 'GET',
          typeof request === 'string' ? request : request.url,
          response.status,
          redacted(response._data)
        )
        if (response.status >= 500)
          throw new Error(`Daichi cloud responded with HTTP ${response.status}`)
        const output = envelope.parse(response._data)
        if (!output.done) throw new Error(output.message)
        response._data = output.data
      }
    })
    this.client = this.cloud.create({
      onRequest: async ({ options }) => {
        // forget a failed login so the next call tries again
        this.token ??= this.login().catch((err: unknown) => {
          this.token = null
          throw err
        })
        options.headers.set('Authorization', `Bearer ${await this.token}`)
      }
    })
  }

  /**
   * Login into 'Daichi Comfort Cloud' and return access_token
   */
  private async login() {
    const data = await this.cloud<unknown>('token', {
      method: 'POST',
      body: {
        grant_type: 'password',
        email: this.username,
        password: this.password,
        clientId: this.clientId
      }
    })
    const { access_token: accessToken } = DaichiTokenSchema.parse(data)
    if (!accessToken) throw new Error('No token received')
    return accessToken
  }

  /**
   * Get Mqtt user
   */
  public async getMqttUserInfo() {
    if (this.mqttUser) return this.mqttUser
    const user = DaichiUserSchema.parse(await this.client<unknown>('user'))
    this.mqttUser = { ...user.mqttUser, id: user.id }
    return this.mqttUser
  }

  public async getBuildings() {
    return z.array(DaichiBuildingSchema).parse(await this.client<unknown>('buildings'))
  }

  /**
   * Get all devices by user
   * @returns Device list
   */
  public async getDevices() {
    const building = await this.getBuildings()
    const devices = building.flatMap(building => building.places)
    const results: Array<Awaited<ReturnType<typeof this.getDeviceState>>> = []
    await Promise.all(
      devices.map(async x => {
        const state = await this.getDeviceState(x.id)
        results.push(state)
      })
    )

    return results
  }

  /**
   * Device control method. Sends control requests to API
   * @param deviceId Device id
   * @param functionId Function id
   * @param val Value: number or boolean, depending on function
   * @returns
   */
  public async controlDevice(deviceId: number, functionId: number, val: number | boolean) {
    const deviceFunctionControl =
      typeof val === 'number'
        ? { functionId, value: val, parameters: null }
        : { functionId, isOn: val, parameters: null }

    const data = await this.client<unknown>(`devices/${deviceId}/ctrl?ignoreConflicts=false`, {
      method: 'POST',
      body: {
        cmdId: DaichiApi.getRandomIntInclusive(0, 99_999_999),
        value: deviceFunctionControl,
        conflictResolveData: null
      }
    })
    return DaichiControlSchema.parse(data)
  }

  /**
   * Get device state
   * @param devId Device id
   * @returns
   */
  public async getDeviceState(devId: number) {
    return DaichiDeviceSchema.parse(await this.client<unknown>(`devices/${devId}`))
  }

  /**
   * Get random integer
   * @param min Min value
   * @param max Max value
   * @returns Random integer
   */
  private static getRandomIntInclusive(min: number, max: number) {
    const lower = Math.ceil(min)
    const upper = Math.floor(max)
    return Math.floor(Math.random() * (upper - lower + 1)) + lower
  }
}
