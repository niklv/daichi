import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import { DaichiMqttNotificationSchema } from '../src'
import { deviceBase, deviceWithControls, updateFlags } from './fixtures'

const notification = (devices: unknown[]) => ({
  devices,
  presets: [],
  groupPresets: [],
  schedules: [],
  placeSchedules: []
})

describe('DaichiMqttNotificationSchema', () => {
  it('keeps the remote-control functions of a device sent with controls', () => {
    const parsed = DaichiMqttNotificationSchema.parse(
      notification([{ ...deviceWithControls(54300), ...updateFlags }])
    )

    const [parsedDevice] = parsed.devices
    const functionIds =
      parsedDevice && 'pult' in parsedDevice
        ? parsedDevice.pult[0]?.functions.map(f => f.id)
        : undefined
    expect(functionIds).toEqual([472, 473])
  })

  it('accepts a device sent with only its base fields', () => {
    const parsed = DaichiMqttNotificationSchema.parse(
      notification([{ ...deviceBase(54300), ...updateFlags, isTimerUpdated: true }])
    )

    expect(parsed.devices[0]).toMatchObject({ id: 54300, isTimerUpdated: true })
    expect(parsed.devices[0]).not.toHaveProperty('pult')
  })

  it('rejects a device that lacks the update flags', () => {
    expect(() => DaichiMqttNotificationSchema.parse(notification([deviceBase(54300)]))).toThrow(
      ZodError
    )
  })
})
