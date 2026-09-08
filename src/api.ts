import axios, { type AxiosInstance } from 'axios'
import createDebug from 'debug'
import { z } from 'zod'
import {
  DaichiBuildingSchema,
  DaichiDeviceSchema,
  DaichiControlSchema,
  daichiResponseSchema,
  DaichiTokenSchema,
  DaichiUserSchema
} from './schemas/daichi'
import type { MqttUser } from './types'

const debug = createDebug('daichi')

export class DaichiApi {
  private axiosInstance: AxiosInstance | null = null
  private readonly axiosInitPromise: Promise<AxiosInstance> | null = null
  private mqttUser: MqttUser | null = null

  constructor(
    protected readonly username: string,
    protected readonly password: string,
    protected readonly daichiApi = 'https://web.daichicloud.ru/api/v4/',
    protected readonly clientId = 'sOJO7B6SqgaKudTfCzqLAy540cCuDzpI'
  ) {
    this.axiosInitPromise = this.api()
  }

  /**
   * Init axios instance with token
   */
  private async api(): Promise<AxiosInstance> {
    if (this.axiosInstance) return this.axiosInstance
    if (this.axiosInitPromise) return this.axiosInitPromise
    debug('init axios instance')
    const token = await this.getToken()
    this.axiosInstance = axios.create({
      baseURL: this.daichiApi,
      headers: {
        Authorization: `Bearer ${token}`
      },
      validateStatus: number => number < 500
    })
    return this.axiosInstance
  }

  /**
   * Login into 'Daichi Comfort Cloud' and return access_token
   */
  private async getToken() {
    const res = await axios.post(`${this.daichiApi}token`, {
      grant_type: 'password',
      email: this.username,
      password: this.password,
      clientId: this.clientId
    })
    debug('token response', res.data)
    const output = daichiResponseSchema(DaichiTokenSchema).parse(res.data)
    if (!output.done) throw new Error(output.message)
    const accessToken = output.data.access_token
    debug('api token', accessToken)
    if (!accessToken) throw new Error('No token received')
    return accessToken
  }

  /**
   * Get Mqtt user
   */
  public async getMqttUserInfo() {
    if (this.mqttUser) return this.mqttUser
    const daichi = await this.api()
    const res = await daichi.get('user')
    debug('user', JSON.stringify(res.data))
    const output = daichiResponseSchema(DaichiUserSchema).parse(res.data)
    if (!output.done) throw new Error(output.message)
    this.mqttUser = {
      ...output.data.mqttUser,
      id: output.data.id
    }
    return this.mqttUser
  }

  public async getBuildings() {
    const daichi = await this.api()
    const res = await daichi.get('buildings')
    debug('buildings', JSON.stringify(res.data))
    const output = daichiResponseSchema(z.array(DaichiBuildingSchema)).parse(res.data)
    if (!output.done) throw new Error(output.message)
    return output.data
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

    const daichi = await this.api()
    const res = await daichi.post(`devices/${deviceId}/ctrl?ignoreConflicts=false`, {
      cmdId: DaichiApi.getRandomIntInclusive(0, 99_999_999),
      value: deviceFunctionControl,
      conflictResolveData: null
    })
    debug('control device response', JSON.stringify(res.data))
    const output = daichiResponseSchema(DaichiControlSchema).parse(res.data)
    if (!output.done) throw new Error(output.message)
    return output.data
  }

  /**
   * Get device state
   * @param devId Device id
   * @returns
   */
  public async getDeviceState(devId: number) {
    const daichi = await this.api()
    const res = await daichi.get(`devices/${devId}`)
    debug('control state response', JSON.stringify(res.data))
    const output = daichiResponseSchema(DaichiDeviceSchema).parse(res.data)
    if (!output.done) throw new Error(output.message)
    return output.data
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
