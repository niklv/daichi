import { z, type ZodTypeAny } from 'zod'

export const DaichiResponseSchema = <T extends ZodTypeAny>(schema: T) =>
  z.discriminatedUnion('done', [
    z.object({
      done: z.literal(true),
      errors: z.null(),
      updateRequired: z.boolean(),
      data: schema
    }),
    z.object({
      done: z.literal(false),
      updateRequired: z.boolean(),
      errors: z.object({ id: z.string() }),
      message: z.string(),
      data: z.null()
    })
  ])

export const DaichiTokenSchema = z.object({
  access_token: z.string()
})

export const DaichiUserSchema = z.object({
  id: z.number(),
  token: z.string(),
  email: z.string(),
  mqttUser: z.object({ username: z.string(), password: z.string() }),
  isEmailConfirmed: z.boolean(),
  phone: z.string().nullable(),
  isPhoneConfirmed: z.boolean(),
  fio: z.string(),
  company: z.string(),
  userType: z.string(),
  expiredIn: z.string().nullable(),
  deleteAccountRequestedAt: z.string().nullable(),
  image: z.string().nullable(),
  accessRequests: z.array(z.unknown())
})

export const DeviceStateSchema = z.object({
  isOn: z.boolean(),
  info: z.object({
    text: z.string(),
    icons: z.array(z.string()),
    iconsSvg: z.array(z.string()),
    iconNames: z.array(z.string())
  })
})

export const DaichiBuildingDeviceSchema = z.object({
  id: z.number(),
  serial: z.string(),
  status: z.string(),
  title: z.string(),
  curTemp: z.number(),
  state: DeviceStateSchema,
  features: z.record(z.boolean()),
  groupId: z.unknown().nullable(),
  buildingId: z.number(),
  lastOnline: z.string(),
  createdAt: z.string(),
  pinned: z.boolean(),
  access: z.string(),
  progress: z.unknown().nullable(),
  currentPreset: z.unknown().nullable(),
  timer: z.unknown().nullable(),
  cloudType: z.string(),
  distributionType: z.string(),
  company: z.string(),
  isBle: z.boolean(),
  deviceControlType: z.string(),
  firmwareType: z.string(),
  vrfTitle: z.unknown().nullable(),
  deviceType: z.string(),
  subscription: z.unknown().nullable(),
  subscriptionId: z.number().optional(),
  warrantyNumber: z.string().optional(),
  conditionerSerial: z.string().optional()
})

export const DaichiBuildingSchema = z.object({
  id: z.number(),
  title: z.string(),
  places: z.array(DaichiBuildingDeviceSchema),
  access: z.string(),
  placesCount: z.number(),
  shareCount: z.number(),
  utc: z.number(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }),
  geoMode: z.boolean(),
  geoState: z.string(),
  geoZone: z.number(),
  address: z.string(),
  triggeredBy: z.unknown().nullable(),
  hasSettings: z.boolean(),
  ownTrigger: z.unknown().nullable(),
  cloudType: z.string(),
  timeZone: z.string(),
  image: z.string(),
  slogan: z.string()
})

export const DeviceBaseSchema = z.object({
  id: z.number(),
  serial: z.string(),
  status: z.string(),
  lastOnline: z.string(),
  curTemp: z.number(),
  progress: z.unknown().nullable(),
  currentPreset: z.unknown()
})

export const DeviceWithControlsSchema = DeviceBaseSchema.extend({
  state: z.object({
    isOn: z.boolean(),
    info: z.object({
      text: z.string(),
      icons: z.array(z.string()),
      iconsSvg: z.array(z.string()),
      iconNames: z.array(z.string())
    })
  }),
  pult: z.array(
    z.object({
      id: z.number(),
      title: z.string().nullable(),
      functions: z.array(
        z.object({
          id: z.number(),
          title: z.string().nullable(),
          uiInfo: z.object({
            controlType: z.string(),
            units: z.string().nullable(),
            iconSvg: z.string().optional(),
            onIcon: z.string().optional(),
            stateIcon: z.string().optional(),
            offIcon: z.string().optional(),
            icon: z.string().optional(),
            rangeIconsInfo: z.array(z.unknown()).optional(),
            displayInStateAsText: z.boolean(),
            displaySpecialBackground: z.boolean()
          }),
          state: z.object({
            value: z.unknown(),
            isOn: z.boolean(),
            blocked: z.boolean(),
            controllable: z.boolean()
          }),
          metaData: z.object({
            applyable: z.boolean(),
            hasDescription: z.boolean(),
            tag: z.unknown(),
            isPowerOnFunction: z.boolean(),
            ignorePowerOff: z.boolean(),
            bleTagInfo: z.object({
              bleTag: z.string(),
              bleOnCommand: z.string().nullable(),
              bleOffCommand: z.unknown()
            })
          }),
          progress: z.unknown(),
          linkedFunction: z.unknown()
        })
      )
    })
  )
})

export const DaichiDeviceSchema = DeviceWithControlsSchema.extend({
  buildingId: z.number(),
  title: z.string(),
  access: z.string(),
  pinned: z.boolean(),
  deviceInfo: z.object({
    brand: z.string(),
    seria: z.string(),
    model: z.string()
  }),
  presets: z.array(z.unknown()),
  groupPresets: z.array(z.unknown()),
  timer: z.unknown(),
  createdAt: z.string(),
  cloudType: z.string(),
  firmwareVersion: z.string(),
  distributionType: z.string(),
  company: z.string(),
  isBle: z.boolean(),
  deviceControlType: z.string(),
  bleAuthToken: z.string().nullable(),
  latestFirmwareVersion: z.string(),
  firmwareType: z.string(),
  vrfTitle: z.string().nullable(),
  deviceType: z.string(),
  features: z.record(z.boolean()),
  climateOnline: z.object({
    isEnabled: z.boolean(),
    openErrors: z.number(),
    isActive: z.boolean()
  }),
  indicators: z.unknown(),
  subscriptionId: z.number().optional(),
  contractId: z.number().optional(),
  warrantyNumber: z.string().optional(),
  conditionerSerial: z.string().optional(),
  subscription: z.unknown(),
  tarificationInfo: z.object({
    tarificationType: z.string(),
    subscriptionInfo: z.object({
      endDate: z.string(),
      isUnlimited: z.boolean()
    }),
    summaryPacketsData: z.unknown(),
    hasUnsyncedTransactions: z.boolean(),
    labelType: z.string(),
    isLabelButtonVisible: z.boolean(),
    isLabelButtonInteractable: z.boolean()
  }).optional(),
  tarificationConflictPopUp: z.unknown()
})

const DeviceAdditonalFlags = {
  isCurrentScheduleUpdated: z.boolean(),
  isProgressUpdated: z.boolean(),
  isTimerUpdated: z.boolean(),
  isCurrentPresetUpdated: z.boolean(),
  isTarificationInfoUpdated: z.boolean()
}

export const DaichiControlSchema = z.object({
  devices: z.array(DeviceWithControlsSchema.extend(DeviceAdditonalFlags)),
  presets: z.array(z.unknown()),
  groupPresets: z.array(z.unknown()),
  schedules: z.array(z.unknown()),
  placeSchedules: z.array(z.unknown())
})

export const DaichiMqttNotificationSchema = z.object({
  devices: z.array(
    z.union([
      DeviceWithControlsSchema.extend(DeviceAdditonalFlags),
      DeviceBaseSchema.extend(DeviceAdditonalFlags)
    ])
  ),
  presets: z.array(z.unknown()),
  groupPresets: z.array(z.unknown()),
  schedules: z.array(z.unknown()),
  placeSchedules: z.array(z.unknown())
})
