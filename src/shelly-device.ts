/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

import { Device, Property } from 'gateway-addon';
import { Shelly } from 'shellies';
import { SwitchProperty } from './switch-property';
import { TemperatureProperty } from './temperature-property';
import { PowerProperty } from './power-property';
import { MainPowerProperty } from './main-power-property';
import { MainSwitchProperty } from './main-switch-property';
import { RollerPositionProperty } from "./roller-position-property";

export class ShellyDevice extends Device {
    private callbacks: { [key: string]: () => void } = {};
    private shellyProperties: { [key: string]: Property } = {};

    constructor(adapter: any, private device: Shelly) {
        super(adapter, device.id);
        this['@context'] = 'https://iot.mozilla.org/schemas/';
        this['@type'] = [];
        this.name = `${device.constructor.name} (${device.id})`;

        device.on('change', (prop: any, newValue: any, oldValue: any) => {
            console.log(`${prop} changed from ${oldValue} to ${newValue}`);
            const property = this.shellyProperties[prop];
            if (property) {
                property.setCachedValueAndNotify(newValue);
            } else {
                console.warn(`No property for ${prop} found`);
            }
        });

        let rollerMode = false;

        if (device.mode) {
            switch (device.mode) {
                case 'relay':
                    this.configureRelayMode();
                    break;
                case 'roller':
                    this.configureRollerPosition();
                    this.configureRollerMode();
                    rollerMode = true;
                    break;
                default:
                    console.warn(`Unknown device mode: ${device.mode}`);
                    break;
            }
        } else {
            console.log('No switch mode found, assuming relay');
            this.configureRelayMode();
        }

        if (device.deviceTemperature) {
            console.log(`Detected deviceTemperature property`);
            const property = new TemperatureProperty(this, 'internalTemperature', 'Device temperature');
            this.shellyProperties['deviceTemperature'] = property;
        }

        if (!rollerMode) {
            this.configurePowerMeters();
        }
    }

    private configureRollerPosition(): void {
        const rollerPositionProperty = new RollerPositionProperty(this, 'rollerPosition', 'Opening level in %', (value) => {
            this.device.setRollerPosition(value).catch(reason => {
                console.log(reason);
            })
        });
        rollerPositionProperty.setCachedValueAndNotify(this.device.rollerPosition);
        this.shellyProperties['rollerPosition'] = rollerPositionProperty;
    }

    addCallbackAction(name: string, description: any, callback: () => void) {
        this.addAction(name, description);
        this.callbacks[name] = callback;
    }

    async performAction(action: any) {
        action.start();

        const callback = this.callbacks[action.name];

        if (callback != undefined) {
            console.log(`Executing action ${action.name}`);
            callback();
        } else {
            console.warn(`Unknown action ${action.name}`);
        }

        action.finish();
    }

    private configureRelayMode(): void {
        console.log('Configuring relay mode');
        this['@type'].push('SmartPlug');

        const relays: number[] = []

        for (let i = 0; i < 4; i++) {
            const property = `relay${i}`;

            if ((<any>this.device)[property] != undefined) {
                relays.push(i);
            }
        }

        const multiple = relays.length > 1;
        let mainSwitchProperty: MainSwitchProperty | undefined;

        if (multiple) {
            mainSwitchProperty = new MainSwitchProperty(this, 'relay', 'All', true, (value) => {
                for (const i of relays) {
                    this.device.setRelay(i, value);
                }
            });
        }

        for (const i of relays) {
            const property = `relay${i}`;
            const switchProperty = new SwitchProperty(this, property, `Relay ${i}`, !multiple, (value) => this.device.setRelay(i, value), mainSwitchProperty);
            this.shellyProperties[property] = switchProperty;
        }
    }

    private configureRollerMode(): void {
        console.log('Configuring roller mode');

        this.addCallbackAction('open', {
            title: 'Open'
        }, () => {
            this.device.setRollerState('open');
        });

        this.addCallbackAction('stop', {
            title: 'Stop'
        }, () => {
            this.device.setRollerState('stop');
        });

        this.addCallbackAction('close', {
            title: 'Close'
        }, () => {
            this.device.setRollerState('close');
        });
    }

    private configurePowerMeters(): void {
        console.log('Configuring power meters');
        const powerMeters: number[] = []

        for (let i = 0; i < 4; i++) {
            const property = `power${i}`;

            if ((<any>this.device)[property] != undefined) {
                powerMeters.push(i);
            }
        }

        const multiple = powerMeters.length > 1;
        let mainPowerMeter: MainPowerProperty | undefined;

        if (multiple) {
            mainPowerMeter = new MainPowerProperty(this, 'power', 'Power all');
        }

        for (const i of powerMeters) {
            const property = `power${i}`;
            const powerProperty = new PowerProperty(this, `powerMeter${i}`, `Power ${i}`, !multiple, mainPowerMeter);
            this.shellyProperties[property] = powerProperty;
        }
    }
}
