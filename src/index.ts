import type { z } from 'zod'
import {
  DaichiBuildingSchema,
  DeviceWithControlsSchema,
  DeviceBaseSchema
} from './schemas/daichi'
export type DeviceBase = z.infer<typeof DeviceBaseSchema>
export type DeviceWithControls = z.infer<typeof DeviceWithControlsSchema>
export type DaichiBuilding = z.infer<typeof DaichiBuildingSchema>

export { DaichiMqttNotificationSchema } from './schemas/daichi'

export * from './api'
export * from './types'
