# daichi

TypeScript client for the **Daichi Comfort Cloud** ([web.daichicloud.ru](https://web.daichicloud.ru)), the cloud behind Daichi and Daikin Wi‑Fi HVAC modules. Read the state of your air conditioners, send them commands, and subscribe to live updates over MQTT.

- Every response is validated with [zod](https://zod.dev) and fully typed.
- Ships CommonJS and ESM builds with type declarations.
- Needs nothing but the e‑mail and password of your Daichi account.

> Unofficial. Not affiliated with Daichi or Daikin. The cloud API is undocumented and may change.

## Install

```sh
npm i daichi
```

## Quick start

```typescript
import { DaichiApi } from 'daichi'

const daichi = new DaichiApi('login@email.com', 'login_password_123')

for (const device of await daichi.getDevices()) {
  console.log(device.title, `${device.curTemp}°C`, device.state.isOn ? 'on' : 'off')
}
```

## How the cloud is organised

- An account owns **buildings**. Each building lists its **places**, which are the devices installed there.
- A **device** carries its current temperature, an on/off state and one or more **pults** (remote controls).
- A pult is a list of **functions**: power, mode, target temperature, fan speed, swing and so on. Each function has an `id`, a `title`, a `uiInfo.controlType` and a `state` with `isOn` and `value`.
- Commands target a function by id. Function ids differ between models, so discover them on your own device first (see [Discovering function ids](#discovering-function-ids)).

## API

### `new DaichiApi(username, password, baseUrl?, clientId?)`

| Param      | Type     | Default                                | Notes                  |
| ---------- | -------- | -------------------------------------- | ---------------------- |
| `username` | `string` | required                               | Account e‑mail         |
| `password` | `string` | required                               | Account password       |
| `baseUrl`  | `string` | `https://web.daichicloud.ru/api/v4/`   | Must end with a slash  |
| `clientId` | `string` | `sOJO7B6SqgaKudTfCzqLAy540cCuDzpI`     | OAuth client id        |

The constructor logs in immediately (password grant). The access token is fetched once and reused by every method for the lifetime of the instance. It is never refreshed, so if the cloud starts rejecting calls after a long uptime, create a new instance.

### `getBuildings()`

Returns `Promise<DaichiBuilding[]>`. Each building includes its `places`, a lightweight view of every device with `id`, `title`, `serial`, `curTemp` and `state`.

### `getDevices()`

Returns a promise of the full state of every device across all buildings. It calls `getBuildings()` and then `getDeviceState()` for every place in parallel, so the order of the result is not guaranteed.

### `getDeviceState(deviceId)`

Returns a promise of the full device: `title`, `curTemp`, `state`, `deviceInfo` (brand, series, model), `firmwareVersion`, `features` and the `pult` list with every controllable function.

### `controlDevice(deviceId, functionId, value)`

Sends one command and returns a promise of the cloud's control response, which contains the updated `devices` plus `presets`, `schedules` and related lists.

- `value: number` sets the function's value, for example a target temperature or fan speed.
- `value: boolean` switches the function on or off, for example power, a mode or a swing.

### `getMqttUserInfo()`

Returns `Promise<MqttUser>` with `id`, `username` and `password` for the cloud's MQTT broker. Cached after the first call.

## Discovering function ids

```typescript
import { DaichiApi } from 'daichi'

const daichi = new DaichiApi('login@email.com', 'login_password_123')
const device = await daichi.getDeviceState(54300)

for (const pult of device.pult) {
  for (const fn of pult.functions) {
    console.log(fn.id, fn.title, fn.uiInfo.controlType, fn.state.isOn, fn.state.value)
  }
}
```

A typical split unit reports a dozen functions such as cooling, heating, auto, dry, fan, quiet mode, vertical swing, comfort sleep, powerful and economy.

## Sending commands

```typescript
import { DaichiApi } from 'daichi'

const daichi = new DaichiApi('login@email.com', 'login_password_123')

// numeric function, e.g. target temperature
await daichi.controlDevice(54300, 472, 24)

// on/off function, e.g. power, a mode or a swing
await daichi.controlDevice(54300, 473, true)
```

The ids above are examples. Use the ones your device reports.

## Live updates over MQTT

The cloud pushes device changes to a broker at `wss://split.daichicloud.ru/mqtt`. Connect with the credentials from `getMqttUserInfo()` using any MQTT client, for example [mqtt](https://www.npmjs.com/package/mqtt):

```typescript
import { DaichiApi, DaichiMqttNotificationSchema } from 'daichi'
import { connect } from 'mqtt'

const daichi = new DaichiApi('login@email.com', 'login_password_123')
const mqttUser = await daichi.getMqttUserInfo()

const client = connect('wss://split.daichicloud.ru/mqtt', {
  username: mqttUser.username,
  password: mqttUser.password
})

client.subscribe(`user/${mqttUser.id}/#`)
client.on('message', (topic, payload) => {
  if (!topic.endsWith('notification')) return
  const { devices } = DaichiMqttNotificationSchema.parse(JSON.parse(payload.toString()))
  for (const device of devices) console.log(device.id, device.curTemp)
})
```

Known topics:

- `user/{id}/notification` and `user/{id}/pre-notification`: device state changes. Parse them with `DaichiMqttNotificationSchema`. Every device in a notification carries update flags; some also carry the full `pult`, others only the base fields.
- `user/{id}/out/control/commands/status`: command acknowledgements.

## Errors

- The cloud answered but refused the request: the promise rejects with an `Error` whose message is the cloud's own message, for example a wrong password or an offline device.
- The cloud answered with an unexpected shape: the promise rejects with a `ZodError` from zod.
- HTTP 5xx or a network failure: the promise rejects with an `AxiosError` from axios.

## Types

The package exports `DaichiApi`, `DaichiBuilding`, `DeviceBase`, `DeviceWithControls`, `MqttUser` and `DaichiMqttNotificationSchema`. The return types of `getDeviceState()`, `getDevices()` and `controlDevice()` are inferred, so pick them up from the class when you need them:

```typescript
import type { DaichiApi } from 'daichi'

type DaichiDevice = Awaited<ReturnType<DaichiApi['getDeviceState']>>
type DaichiControl = Awaited<ReturnType<DaichiApi['controlDevice']>>
```

## Debug logging

Set `DEBUG=daichi` to print every request and response through [debug](https://www.npmjs.com/package/debug).

## Development

```sh
npm test          # unit tests, offline against an in-process fake of the cloud
npm run test:live # read-only smoke test against the real cloud
npm run lint      # oxlint, type-aware (npm run lint:fix to autofix)
npm run fmt       # oxfmt (npm run fmt:check in CI)
npm run typecheck # tsc --noEmit
npm run build     # CommonJS + ESM + declarations into dist/
```

The live test needs the credentials of a Daichi account in `.env` (copy `.env.example`):

```sh
DAICHI_USERNAME=login@email.com
DAICHI_PASSWORD=login_password_123
```

It only reads data (mqtt user, buildings, device states) and never sends commands. It is skipped when the variables are missing.
