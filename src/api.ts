import axios, { type AxiosInstance } from 'axios'
import Debug from 'debug'
import type { MqttUser } from './types'
import {
  DaichiBuildingSchema,
  DaichiDeviceSchema,
  DaichiControlSchema,
  DaichiResponseSchema,
  DaichiTokenSchema,
  DaichiUserSchema
} from './schemas/daichi'
import { z } from 'zod'

const debug = Debug('daichi')

export class DaichiApi {
  private axiosInstance: AxiosInstance | null = null
  private axiosInitPromise: Promise<AxiosInstance> | null = null
  private mqttUser: MqttUser | null = null

  constructor(
    protected readonly username: string,
    protected readonly password: string,
    protected readonly daichiApi: string = 'https://web.daichicloud.ru/api/v4/',
    protected readonly clientId: string = 'sOJO7B6SqgaKudTfCzqLAy540cCuDzpI'
  ) {
    this.axiosInitPromise = this.api()
  }

  /**
   * Init axios instance with token
   */
  private async api(): Promise<AxiosInstance> {
    if (this.axiosInstance) return this.axiosInstance
    if (this.axiosInitPromise) return await this.axiosInitPromise
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
    const res = await axios.post(this.daichiApi + 'token', {
      grant_type: 'password',
      email: this.username,
      password: this.password,
      clientId: this.clientId
    })
    debug('token response', res.data)
    const output = DaichiResponseSchema(DaichiTokenSchema).parse(res.data)
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
    debug('user', res.data)
    const output = DaichiResponseSchema(DaichiUserSchema).parse(res.data)
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
    debug('buildings', res.data)
    const output = DaichiResponseSchema(z.array(DaichiBuildingSchema)).parse(
      res.data
    )
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
  public async controlDevice(
    deviceId: number,
    functionId: number,
    val: number | boolean
  ) {
    let deviceFunctionControl
    if (typeof val === 'number')
      deviceFunctionControl = {
        functionId,
        value: val,
        parameters: null
      }
    else
      deviceFunctionControl = {
        functionId,
        isOn: val,
        parameters: null
      }

    const daichi = await this.api()
    const res = await daichi.post(
      `devices/${deviceId}/ctrl?ignoreConflicts=false`,
      {
        cmdId: DaichiApi.getRandomIntInclusive(0, 99999999),
        value: deviceFunctionControl,
        conflictResolveData: null
      }
    )
    debug('control device response', res.data)
    const output = DaichiResponseSchema(DaichiControlSchema).parse(res.data)
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
    const output = DaichiResponseSchema(DaichiDeviceSchema).parse(res.data)
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
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
}
