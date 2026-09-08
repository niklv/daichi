import { beforeAll, describe, expect, it } from 'vitest'
import { DaichiApi } from '../../src'

const username = process.env.DAICHI_USERNAME
const password = process.env.DAICHI_PASSWORD
const hasCredentials = Boolean(username && password)

if (!hasCredentials)
  console.warn('Skipping live tests: set DAICHI_USERNAME and DAICHI_PASSWORD in .env')

describe.runIf(hasCredentials)('Daichi Comfort Cloud (live, read-only)', () => {
  let api: DaichiApi

  beforeAll(() => {
    if (!username || !password) throw new Error('credentials missing')
    api = new DaichiApi(username, password)
  })

  it('logs in and returns the mqtt credentials of the account', async () => {
    const user = await api.getMqttUserInfo()

    expect(user.id).toBeGreaterThan(0)
    expect(user.username).not.toBe('')
    expect(user.password).not.toBe('')
  })

  it('lists the buildings of the account with their devices', async () => {
    const buildings = await api.getBuildings()

    expect(buildings.length).toBeGreaterThan(0)
    for (const building of buildings) {
      const places = building.places
        .map(p => `${p.title} (#${p.id}, ${p.curTemp}°C, ${p.state.isOn ? 'on' : 'off'})`)
        .join(', ')
      console.log(`building #${building.id} "${building.title}": ${places}`)
    }
  })

  it('pulls the current state of every device', async () => {
    const devices = await api.getDevices()

    expect(devices.length).toBeGreaterThan(0)
    for (const device of devices) {
      expect(device.id).toBeGreaterThan(0)
      const functions = device.pult.flatMap(p => p.functions)
      console.log(
        `device #${device.id} "${device.title}" (${device.deviceInfo.brand} ${device.deviceInfo.model}): ` +
          `${device.curTemp}°C, ${device.state.isOn ? 'on' : 'off'}, "${device.state.info.text}", ` +
          `${functions.length} functions: ${functions.map(f => `${f.title ?? '?'}#${f.id}`).join(', ')}`
      )
    }
  })

  it('returns the same device by id as listed in the buildings', async () => {
    const [building] = await api.getBuildings()
    const [place] = building?.places ?? []
    if (!building || !place) throw new Error('account has no devices')

    const device = await api.getDeviceState(place.id)

    expect(device.id).toBe(place.id)
    expect(device.serial).toBe(place.serial)
    expect(device.buildingId).toBe(building.id)
  })
})
