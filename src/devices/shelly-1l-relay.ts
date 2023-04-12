/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

import {Adapter, Property} from 'gateway-addon';
import {Any} from 'gateway-addon/lib/schema';
import {ButtonProperty} from '../properties/button-property';
import {ShellyController} from '../shelly-controller';
import {OverheatableDevice} from './overheatable-device';

export class Shelly1L extends OverheatableDevice {
  constructor(adapter: Adapter, id: string, controller: ShellyController) {
    super(adapter, id);
    this['@type'].push('PushButton');
    this.addRelays(1, controller);
    this.addPowermeters(1);
    this.addProperty(new ButtonProperty(this, 'input0', 'Button 1'));
    this.addEvent('input0Press', {
      '@type': 'PressedEvent',
    });
    this.addEvent('input0LongPress', {
      '@type': 'LongPressedEvent',
    });
    this.addProperty(new ButtonProperty(this, 'input1', 'Button 2'));
    this.addEvent('input1Press', {
      '@type': 'PressedEvent',
    });
    this.addEvent('input1LongPress', {
      '@type': 'LongPressedEvent',
    });
  }

  findProperty(propertyName: string): Property<Any> | undefined {
    const existingProperty = super.findProperty(propertyName);
    if (existingProperty) {
      return existingProperty;
    }
    switch (propertyName) {
      case 'temperature':
        return super.findProperty('internalTemperature');
      default:
        console.warn('Unknown property', propertyName);
    }
    return existingProperty;
  }
}
