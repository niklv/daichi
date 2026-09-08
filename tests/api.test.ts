import { FetchError } from 'ofetch'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import { DaichiApi } from '../src/api'
import { FakeDaichiServer, fail, ok } from './fake-daichi-server'
import { building, buildingDevice, controlResponse, device, omitDeep, userInfo } from './fixtures'

const CONTROL_PATH = 'devices/54300/ctrl?ignoreConflicts=false'

let server: FakeDaichiServer

beforeEach(async () => {
  server = new FakeDaichiServer()
  await server.start()
  server.route('POST', 'token', ok({ access_token: 'tok-123' }))
})

afterEach(() => server.stop())

const login = () => new DaichiApi('user@example.com', 'secret', server.baseUrl, 'client-abc')

describe('authentication', () => {
  it('logs in with a password grant using the given credentials and client id', async () => {
    server.route('GET', 'buildings', ok([]))

    await login().getBuildings()

    expect(server.requestsTo('POST', 'token').map(r => r.body)).toEqual([
      {
        grant_type: 'password',
        email: 'user@example.com',
        password: 'secret',
        clientId: 'client-abc'
      }
    ])
  })

  it('logs in without an authorization header', async () => {
    server.route('GET', 'buildings', ok([]))

    await login().getBuildings()

    const [request] = server.requestsTo('POST', 'token')
    expect(request?.headers.authorization).toBeUndefined()
  })

  it('sends the access token as a bearer header on API calls', async () => {
    server.route('GET', 'buildings', ok([]))

    await login().getBuildings()

    const [request] = server.requestsTo('GET', 'buildings')
    expect(request?.headers.authorization).toBe('Bearer tok-123')
  })

  it('does not log in until the first call', async () => {
    login()
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(server.requestsTo('POST', 'token')).toHaveLength(0)
  })

  it('logs in once for concurrent first calls', async () => {
    server.route('GET', 'buildings', ok([]))
    server.route('GET', 'user', ok(userInfo))
    const api = login()

    await Promise.all([api.getBuildings(), api.getMqttUserInfo(), api.getBuildings()])

    expect(server.requestsTo('POST', 'token')).toHaveLength(1)
  })

  it('asks the cloud for json so an invalid token yields 401 instead of a redirect', async () => {
    server.route('GET', 'buildings', ok([]))

    await login().getBuildings()

    const accepts = server.requests.map(r => r.headers.accept)
    expect(accepts).toEqual(['application/json', 'application/json'])
  })

  it('rejects instead of following a redirect', async () => {
    server.route('GET', 'buildings', '', 302)

    await expect(login().getBuildings()).rejects.toBeInstanceOf(FetchError)
  })

  it('retries the login on the next call after a failed one', async () => {
    server.route('POST', 'token', fail('Try later', 'busy'), 503)
    server.route('GET', 'buildings', ok([]))
    const api = login()

    await expect(api.getBuildings()).rejects.toThrow(/503/)
    server.route('POST', 'token', ok({ access_token: 'tok-123' }))

    await expect(api.getBuildings()).resolves.toEqual([])
    expect(server.requestsTo('POST', 'token')).toHaveLength(2)
  })

  it('logs in once and reuses the token across calls', async () => {
    server.route('GET', 'buildings', ok([]))
    server.route('GET', 'user', ok(userInfo))
    const api = login()

    await api.getBuildings()
    await api.getMqttUserInfo()
    await api.getBuildings()

    expect(server.requestsTo('POST', 'token')).toHaveLength(1)
  })

  it('rejects with the server message when login is refused', async () => {
    server.route('POST', 'token', fail('Wrong login or password'))

    await expect(login().getBuildings()).rejects.toThrow('Wrong login or password')
  })

  it('rejects with the server message when login is refused with an error status', async () => {
    server.route('POST', 'token', fail('Wrong login or password'), 401)

    await expect(login().getBuildings()).rejects.toThrow('Wrong login or password')
  })

  it('rejects with the HTTP status when the cloud answers with a server error', async () => {
    server.route('GET', 'buildings', fail('Internal error', 'server_error'), 503)

    await expect(login().getBuildings()).rejects.toThrow(/503/)
  })

  it('rejects when the server returns an empty access token', async () => {
    server.route('POST', 'token', ok({ access_token: '' }))

    await expect(login().getBuildings()).rejects.toThrow('No token received')
  })

  it('rejects with the server message when the API answers with an error status', async () => {
    server.route('GET', 'buildings', fail('Token expired', 'unauthorized'), 401)

    await expect(login().getBuildings()).rejects.toThrow('Token expired')
  })

  it('rejects when the response does not match the schema', async () => {
    server.route('GET', 'buildings', ok([{ id: 'not-a-number' }]))

    await expect(login().getBuildings()).rejects.toThrow(ZodError)
  })
})

describe('getMqttUserInfo', () => {
  it('returns the mqtt credentials together with the user id', async () => {
    server.route('GET', 'user', ok(userInfo))

    await expect(login().getMqttUserInfo()).resolves.toEqual({
      id: 1234,
      username: 'mqtt-user',
      password: 'mqtt-pass'
    })
  })

  it('fetches the user once and caches it', async () => {
    server.route('GET', 'user', ok(userInfo))
    const api = login()

    await api.getMqttUserInfo()
    await api.getMqttUserInfo()

    expect(server.requestsTo('GET', 'user')).toHaveLength(1)
  })

  it('rejects with the server message when the user request fails', async () => {
    server.route('GET', 'user', fail('User not found'))

    await expect(login().getMqttUserInfo()).rejects.toThrow('User not found')
  })
})

describe('getBuildings', () => {
  it('returns the buildings with their devices', async () => {
    server.route(
      'GET',
      'buildings',
      ok([building(777, [buildingDevice(54300), buildingDevice(54301)])])
    )

    const buildings = await login().getBuildings()

    expect(buildings.map(b => b.id)).toEqual([777])
    expect(buildings[0]?.places.map(p => p.id)).toEqual([54300, 54301])
  })

  it('accepts buildings whose unknown-typed details are omitted', async () => {
    const sparse = omitDeep(
      [building(777, [buildingDevice(54300)])],
      [
        'triggeredBy',
        'ownTrigger',
        'groupId',
        'progress',
        'currentPreset',
        'timer',
        'vrfTitle',
        'subscription'
      ]
    )
    server.route('GET', 'buildings', ok(sparse))

    const buildings = await login().getBuildings()

    expect(buildings[0]?.places.map(p => p.id)).toEqual([54300])
  })

  it('rejects with the server message when the buildings request fails', async () => {
    server.route('GET', 'buildings', fail('Access denied'))

    await expect(login().getBuildings()).rejects.toThrow('Access denied')
  })
})

describe('getDevices', () => {
  it('fetches the state of every device across all buildings', async () => {
    server.route(
      'GET',
      'buildings',
      ok([
        building(777, [buildingDevice(54300), buildingDevice(54301)]),
        building(778, [buildingDevice(54302, 778)])
      ])
    )
    for (const id of [54300, 54301, 54302]) server.route('GET', `devices/${id}`, ok(device(id)))

    const devices = await login().getDevices()

    expect(devices.map(d => d.id).sort((a, b) => a - b)).toEqual([54300, 54301, 54302])
  })

  it('returns an empty list when the account has no buildings', async () => {
    server.route('GET', 'buildings', ok([]))

    await expect(login().getDevices()).resolves.toEqual([])
  })
})

describe('getDeviceState', () => {
  it('returns the device state for the requested id', async () => {
    server.route('GET', 'devices/54300', ok(device(54300)))

    const state = await login().getDeviceState(54300)

    expect(state.id).toBe(54300)
    expect(state.pult[0]?.functions.map(f => [f.id, f.state.value])).toEqual([
      [472, 24],
      [473, null]
    ])
  })

  it('accepts a device without subscription details', async () => {
    const {
      subscriptionId,
      contractId,
      warrantyNumber,
      conditionerSerial,
      tarificationInfo,
      ...bareDevice
    } = device(54300)
    server.route('GET', 'devices/54300', ok(bareDevice))

    await expect(login().getDeviceState(54300)).resolves.toMatchObject({
      id: 54300
    })
  })

  it('accepts a device whose unknown-typed details are omitted', async () => {
    const sparse = omitDeep(device(54300), [
      'progress',
      'currentPreset',
      'timer',
      'indicators',
      'subscription',
      'tarificationConflictPopUp',
      'summaryPacketsData',
      'value',
      'tag',
      'bleOffCommand',
      'linkedFunction'
    ])
    server.route('GET', 'devices/54300', ok(sparse))

    const state = await login().getDeviceState(54300)

    expect(state.pult[0]?.functions.map(f => f.id)).toEqual([472, 473])
  })

  it('rejects with the server message when the device request fails', async () => {
    server.route('GET', 'devices/54300', fail('Device not found'))

    await expect(login().getDeviceState(54300)).rejects.toThrow('Device not found')
  })
})

describe('controlDevice', () => {
  it('sends a numeric value as a value command', async () => {
    server.route('POST', CONTROL_PATH, ok(controlResponse(54300)))

    await login().controlDevice(54300, 472, 24)

    const [request] = server.requestsTo('POST', CONTROL_PATH)
    expect(request?.body).toEqual({
      cmdId: expect.any(Number),
      value: { functionId: 472, value: 24, parameters: null },
      conflictResolveData: null
    })
  })

  it('sends a boolean value as an on/off command', async () => {
    server.route('POST', CONTROL_PATH, ok(controlResponse(54300)))

    await login().controlDevice(54300, 473, false)

    const [request] = server.requestsTo('POST', CONTROL_PATH)
    expect(request?.body).toEqual({
      cmdId: expect.any(Number),
      value: { functionId: 473, isOn: false, parameters: null },
      conflictResolveData: null
    })
  })

  it('uses an integer command id within the cloud range', async () => {
    server.route('POST', CONTROL_PATH, ok(controlResponse(54300)))

    await login().controlDevice(54300, 472, 24)

    const [request] = server.requestsTo('POST', CONTROL_PATH)
    const { cmdId } = request?.body as { cmdId: number }
    expect(Number.isInteger(cmdId)).toBe(true)
    expect(cmdId).toBeGreaterThanOrEqual(0)
    expect(cmdId).toBeLessThanOrEqual(99999999)
  })

  it('returns the devices reported by the control response', async () => {
    server.route('POST', CONTROL_PATH, ok(controlResponse(54300)))

    const result = await login().controlDevice(54300, 473, true)

    expect(result.devices.map(d => [d.id, d.isProgressUpdated])).toEqual([[54300, true]])
  })

  it('rejects with the server message when the command is refused', async () => {
    server.route('POST', CONTROL_PATH, fail('Device is offline'))

    await expect(login().controlDevice(54300, 472, 24)).rejects.toThrow('Device is offline')
  })
})
