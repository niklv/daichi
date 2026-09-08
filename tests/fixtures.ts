/**
 * Hand-written payloads shaped like real web.daichicloud.ru responses.
 * Every field the schemas declare is present so tests exercise the full shape.
 */

/** Deep copy of `value` with every property named in `keys` removed, at any depth */
export const omitDeep = <T>(value: T, keys: string[]): T =>
  JSON.parse(JSON.stringify(value, (key, v) => (keys.includes(key) ? undefined : v)))

export const userInfo = {
  id: 1234,
  token: 'user-token',
  email: 'user@example.com',
  mqttUser: { username: 'mqtt-user', password: 'mqtt-pass' },
  isEmailConfirmed: true,
  phone: null,
  isPhoneConfirmed: false,
  fio: 'Test User',
  company: 'daichi',
  userType: 'user',
  expiredIn: null,
  deleteAccountRequestedAt: null,
  image: null,
  accessRequests: []
}

const deviceState = {
  isOn: true,
  info: {
    text: '24°',
    icons: ['cool'],
    iconsSvg: ['<svg/>'],
    iconNames: ['cool']
  }
}

/** Device entry as it appears inside a building's `places` list */
export const buildingDevice = (id: number, buildingId = 777) => ({
  id,
  serial: `SN-${id}`,
  status: 'connected',
  title: `Device ${id}`,
  curTemp: 23.5,
  state: deviceState,
  features: { hasTimer: true },
  groupId: null,
  buildingId,
  lastOnline: '2026-09-04T10:00:00Z',
  createdAt: '2025-01-01T00:00:00Z',
  pinned: false,
  access: 'owner',
  progress: null,
  currentPreset: null,
  timer: null,
  cloudType: 'daichi',
  distributionType: 'retail',
  company: 'daichi',
  isBle: false,
  deviceControlType: 'wifi',
  firmwareType: 'standard',
  vrfTitle: null,
  deviceType: 'split',
  subscription: null
})

export const building = (id: number, places: ReturnType<typeof buildingDevice>[]) => ({
  id,
  title: `Building ${id}`,
  places,
  access: 'owner',
  placesCount: places.length,
  shareCount: 0,
  utc: 3,
  coordinates: { lat: 55.75, lng: 37.61 },
  geoMode: false,
  geoState: 'off',
  geoZone: 500,
  address: 'Moscow',
  triggeredBy: null,
  hasSettings: true,
  ownTrigger: null,
  cloudType: 'daichi',
  timeZone: 'Europe/Moscow',
  image: 'https://example.com/home.png',
  slogan: ''
})

const deviceFunction = (id: number, title: string, value: unknown, isOn: boolean) => ({
  id,
  title,
  uiInfo: {
    controlType: 'slider',
    units: '°C',
    displayInStateAsText: true,
    displaySpecialBackground: false
  },
  state: { value, isOn, blocked: false, controllable: true },
  metaData: {
    applyable: true,
    hasDescription: false,
    tag: null,
    isPowerOnFunction: false,
    ignorePowerOff: false,
    bleTagInfo: { bleTag: 'temp', bleOnCommand: null, bleOffCommand: null }
  },
  progress: null,
  linkedFunction: null
})

/** Minimal device fields, as sent in MQTT notifications without controls */
export const deviceBase = (id: number) => ({
  id,
  serial: `SN-${id}`,
  status: 'connected',
  lastOnline: '2026-09-04T10:00:00Z',
  curTemp: 23.5,
  progress: null,
  currentPreset: null
})

/** Device with its remote-control functions (function 472 = temperature, 473 = power) */
export const deviceWithControls = (id: number) => ({
  ...deviceBase(id),
  state: deviceState,
  pult: [
    {
      id: 1,
      title: 'Main',
      functions: [
        deviceFunction(472, 'Temperature', 24, true),
        deviceFunction(473, 'Power', null, true)
      ]
    }
  ]
})

/** Full device as returned by GET devices/{id} */
export const device = (id: number, buildingId = 777) => ({
  ...deviceWithControls(id),
  buildingId,
  title: `Device ${id}`,
  access: 'owner',
  pinned: false,
  deviceInfo: { brand: 'Daikin', seria: 'FTXB', model: 'FTXB25C' },
  presets: [],
  groupPresets: [],
  timer: null,
  createdAt: '2025-01-01T00:00:00Z',
  cloudType: 'daichi',
  firmwareVersion: '1.2.3',
  distributionType: 'retail',
  company: 'daichi',
  isBle: false,
  deviceControlType: 'wifi',
  bleAuthToken: null,
  latestFirmwareVersion: '1.2.3',
  firmwareType: 'standard',
  vrfTitle: null,
  deviceType: 'split',
  features: { hasTimer: true },
  climateOnline: { isEnabled: false, openErrors: 0, isActive: false },
  indicators: null,
  subscriptionId: 42,
  contractId: 7,
  warrantyNumber: 'W-1',
  conditionerSerial: 'C-1',
  subscription: null,
  tarificationInfo: {
    tarificationType: 'free',
    subscriptionInfo: { endDate: '2027-01-01T00:00:00Z', isUnlimited: true },
    summaryPacketsData: null,
    hasUnsyncedTransactions: false,
    labelType: 'none',
    isLabelButtonVisible: false,
    isLabelButtonInteractable: false
  },
  tarificationConflictPopUp: null
})

/** Flags the cloud attaches to devices in control responses and MQTT notifications */
export const updateFlags = {
  isCurrentScheduleUpdated: false,
  isProgressUpdated: false,
  isTimerUpdated: false,
  isCurrentPresetUpdated: false,
  isTarificationInfoUpdated: false
}

/** Response of POST devices/{id}/ctrl */
export const controlResponse = (deviceId: number) => ({
  devices: [{ ...deviceWithControls(deviceId), ...updateFlags, isProgressUpdated: true }],
  presets: [],
  groupPresets: [],
  schedules: [],
  placeSchedules: []
})
