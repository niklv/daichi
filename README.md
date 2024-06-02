# Daichi Comfort Cloud API

> Comfort cloud API wrapper to control HVAC ([web.daichicloud.ru](https://web.daichicloud.ru))

## Table of contents

- [Daichi Comfort Cloud API](#daichi-comfort-cloud-api)
  - [Table of contents](#table-of-contents)
  - [Installation & Quickstart](#installation--quickstart)
  - [API](#api)
    - [class DaichiApi(username: string, password: string, daichiApi?: string, clientId?: string)](#class-daichiapiusername-string-password-string-daichiapi-string-clientid-string)
    - [getBuildings()](#getbuildings)
    - [getDevices()](#getdevices)
    - [getDeviceState(deviceId: number)](#getdevicestatedeviceid-number)
    - [controlDevice(deviceId: number, functionId: number, val: number | boolean)](#controldevicedeviceid-number-functionid-number-val-number--boolean)
    - [getMqttUserInfo()](#getmqttuserinfo)
  - [Daichi cloud MQTT topics](#daichi-cloud-mqtt-topics)
  - [Troubleshoot](#troubleshoot)

## Installation & Quickstart

```sh
$ npm i daichi
```

```typescript
import { DaichiApi } from './api'

const daichi = new DaichiApi('login@email.com', 'login_password_123')
const devices = await daichi.getDevices()
```

## API

### class DaichiApi(username: string, password: string, daichiApi?: string, clientId?: string)

Params:

- username (`string`) - required
- password (`string`) - required
- daichiApi (`string`) - optional, defaults to `https://web.daichicloud.ru/api/v4/`
- clientId (`string`) - optional, defaults to `sOJO7B6SqgaKudTfCzqLAy540cCuDzpI`

### getBuildings()

Returns: `Promise<DaichiBuilding[]>`

### getDevices()

Returns: `Promise<DaichiDevice[]>`

### getDeviceState(deviceId: number)

Params:

- deviceId (`number`) - device id from `getBuildings()` or `getDevices()` response

Returns: `Promise<DaichiDevice>`

### controlDevice(deviceId: number, functionId: number, val: number | boolean)

Params:

- deviceId (`number`) - device id from `getBuildings()` or `getDevices()` response
- functionId (`number`) - function id, every device has list of functions. Functions may be uniq from model to model. So check your device response for function ids.
- val (`number | boolean`) - value, can be boolean for `isOn` functions (modes, on/off, start/stop slides, etc) or can be a number (temperature, fan speed, etc)

Returns: `Promise<DaichiControl>`

### getMqttUserInfo()

Returns: `Promise<MqttUser>`

- id (`number`) - userId to listen user topics
- username (`string`) - mqtt username
- password (`string`) - mqtt password

Example usage with [mqtt](https://www.npmjs.com/package/mqtt) package.

```typescript
const mqttUser = await daichi.getMqttUserInfo()

const mqtt = connect('wss://split.daichicloud.ru/mqtt', {
  username: mqttUser.username,
  password: mqttUser.password
})
mqtt.on('message', (topic, message) => {
  console.log(topic, message.toString())
})
mqtt.subscribe(`user/${mqttUser.id}/#`, (err, granted) => {
  if (err) console.error(err)
  else console.log(granted)
})
```

## Daichi cloud MQTT topics

Currently discovered topics are:

- `user/${mqttUser.id}/notification`
- `user/${mqttUser.id}/pre-notification`
- `user/${mqttUser.id}/out/control/commands/status`

For `notification` and `pre-notification` you can use Zod schemas:
Example:

```typescript
import { DaichiMqttNotificationSchema } from 'daichi'

function onNotification(message: string) {
  return DaichiMqttNotificationSchema.parse(JSON.parse(message))
}
```

## Troubleshoot

For troubleshooting use env `DEBUG=daichi` for verbose loggings.
