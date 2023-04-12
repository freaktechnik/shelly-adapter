/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

import {Adapter} from 'gateway-addon';
import {BatteryProperty} from '../properties/battery-property';
import {HumidityProperty} from '../properties/humidity-property';
import {ShellyDevice} from './shelly-device';
import {TemperatureProperty} from '../properties/temperature-property';

export class ShellyHTPlus extends ShellyDevice {
  constructor(adapter: Adapter, id: string) {
    super(adapter, id);
    this['@type'].push('TemperatureSensor');
    this['@type'].push('HumiditySensor');

    this.addProperty(new TemperatureProperty(this, 'temperature0', 'Temperature'));
    this.addProperty(new HumidityProperty(this, 'humidity0', 'Humidity'));
    this.addProperty(new BatteryProperty(this, 'battery', 'Battery'));
  }

}

//TODO battery optional, wifi, bluetooth state?
