/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

import {connect, MqttClient} from 'mqtt';
import {Adapter, AddonManagerProxy, Event} from 'gateway-addon';
import {Config} from '../config';
import {debug} from '../log';
import {ShellyDevice} from '../devices/shelly-device';
import {ShellyHT} from '../devices/shelly-ht';
import {Any} from 'gateway-addon/lib/schema';
import {Shelly1L} from '../devices/shelly-1l-relay';
import {MQTTShellyController} from './mqtt-shelly-controller';
import { ShellyDoorWindow2 } from '../devices/shelly-door-window-2';
import { ShellyHTPlus } from '../devices/shelly-ht-plus';

export class MqttShellyAdapter extends Adapter {
  private foundDevices: Record<string, ShellyDevice> = {};

  private mqttPrefixByDevice: Record<string, string> = {};

  private client: MqttClient;

  constructor(addonManager: AddonManagerProxy,
              id: string,
              config: Config,
              // eslint-disable-next-line no-unused-vars
              errorCallback: (error: string) => void) {
    super(addonManager, MqttShellyAdapter.name, id);
    addonManager.addAdapter(this);

    const {
      mqttBroker,
    } = config;

    const address = `mqtt://${mqttBroker ?? 'localhost'}`;
    this.client = connect(address);

    this.client.on('connect', () => {
      console.log(`Connected to ${address}`);
      const topic = 'shellies/#';

      this.client.subscribe(topic, () => {
        console.log(`Subscribed to ${topic}`);
      });
    });

    this.client.on('error', (err) => {
      errorCallback(`Mqtt error: ${err}`);
    });

    this.client.on('message', (topic, message) => {
      debug(`Received on ${topic}: ${message}`);
      const topicParts = topic.split('/');
      const [, device] = topicParts;

      if (device) {
        const delimiter = device.lastIndexOf('-');

        if (delimiter > 0) {
          const type = device.substring(0, delimiter);
          const id = device.substring(delimiter + 1);
          debug(`Received update for ${id} (${type})`);
          const property = this.getPropertyName(topicParts);
          const payload = message.toString();

          if (property) {
            this.mqttPrefixByDevice[`shelly-mqtt-${id}`] = device;
            this.updateDevice(type, `shelly-mqtt-${id}`, property, payload);
          }
        }
      }
    });
  }

  public updateShelly(id: string, subpath: string, value: string) {
    const mqttDevicePrefix = this.mqttPrefixByDevice[id];
    if (!mqttDevicePrefix) {
      return Promise.reject(new Error(`Unknown mqtt device ${id}`));
    }
    const path = `shellies/${mqttDevicePrefix}/${subpath}`;
    console.log('Sending', value, 'to', path);
    return new Promise<void>((resolve, reject) => {
      this.client.publish(path, value, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  private getPropertyName(parts: string[]) : string | null {
    switch (parts.length) {
      case 5: {
        const [,, property, index, subproperty] = parts;
        switch (property) {
          case 'relay':
            if (subproperty === 'power') {
              return `powerMeter${index}`;
            }
            console.log(`Unknown suproperty ${subproperty} of input ${index}`);
            break;
          default:
            console.log(`Unknown property ${property} with 5 parts`);
            break;
        }
        break;
      }
      case 4: {
        const [,, property, subproperty] = parts;
        switch (property) {
          case 'sensor':
            if (subproperty === 'lux') {
              return 'illuminance';
            }
            return subproperty;
          case 'relay':
          case 'input':
          case 'input_event':
            return `${property}${subproperty}`;
          case 'status':
            if (subproperty === 'devicepower:0') {
              return 'battery';
            }
            return subproperty.replace(':', '');
          default:
            console.log(`Unknown property ${property}`);
            break;
        }
        break;
      }
      case 3: {
        return parts[2];
      }
      default:
        console.log(`Unexpected parts length ${parts.length}`);
        break;
    }

    return null;
  }

  private updateDevice(type: string, id: string, name: string, value: string) {
    const device = this.getOrCreateDevice(type, id);

    if (device) {
      if (name.startsWith('input_event')) {
        const parsedPayload = JSON.parse(value);
        if (parsedPayload.event_cnt < 1 || parsedPayload.event === '') {
          return;
        }
        const eventName = `input${name[11]}${parsedPayload.event === 'S' ? 'Press' : 'LongPress'}`;
        console.log('Emitting', eventName);
        device.eventNotify(new Event(device, eventName));
        return;
      }
      const property = device.findProperty(name);
      let formattedValue: Any = value;

      if (property?.getType() === 'boolean') {
        formattedValue = value === '1' || value === 'on' || value === 'open';
      }
      if (type === 'shellyplusht') {
        switch (name) {
          case 'battery':
            formattedValue = JSON.parse(value).battery.percent;
            break;
          case 'temperature0':
            formattedValue = JSON.parse(value).tC;
            break;
          case 'humidity0':
            formattedValue = JSON.parse(value).rh;
            break;
          case 'online':
            device.connectedNotify(value === 'true');
            return;
        }
      }

      if (property) {
        property.setCachedValueAndNotify(formattedValue);
      } else {
        console.warn(`No property for ${name} in ${device.constructor.name} found`);
      }
    }
  }

  private getOrCreateDevice(type: string, id: string): ShellyDevice | null {
    const foundDevice = this.foundDevices[id];

    if (foundDevice) {
      return foundDevice;
    }

    const createdDevice = this.createDevice(type, id);

    if (createdDevice) {
      console.log(`Created device for ${createdDevice.constructor.name} ${id} (${type})`);
      this.foundDevices[id] = createdDevice;
      this.handleDeviceAdded(createdDevice);
      return createdDevice;
    }

    return null;
  }

  private createDevice(type: string, id: string): ShellyDevice | null {
    switch (type) {
      case 'shellyht':
        return new ShellyHT(this, id);
      case 'shelly1l':
        return new Shelly1L(this, id, new MQTTShellyController(this, id));
      case 'shellydw2':
        return new ShellyDoorWindow2(this, id);
      case 'shellyplusht':
        return new ShellyHTPlus(this, id);
      default:
        console.log(`Unknown device type ${type}`);
    }

    return null;
  }
}
