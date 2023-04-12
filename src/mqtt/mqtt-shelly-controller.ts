import { ShellyController } from "../shelly-controller";
import { MqttShellyAdapter } from "./mqtt-shelly-adapter";

export class MQTTShellyController implements ShellyController {
  private adapter: MqttShellyAdapter;

  private id: string;

  constructor(adapter: MqttShellyAdapter, id: string) {
    this.adapter = adapter;
    this.id = id;
  }

  setRollerState(state: string, duration?: number) {
    console.warn('Unable to accept duration', duration);
    return this.adapter.updateShelly(this.id, `roller/0/command`, state);
  }

  setRollerPosition(position: number) {
    return this.adapter.updateShelly(this.id, `roller/0/command/pos`, position.toString());
  }

  on(type: string, listener: (prop: string, newValue: unknown, oldValue: unknown) => void) {
    // Dummy implementation.
    if (type !== 'change') {
      listener(type, null, null);
    }
  }

  setRelay(index: number, value: boolean) {
    return this.adapter.updateShelly(this.id, `relay/${index}/command`, value ? 'on' : 'off');
  }

  setWhite(brightness: number, on: boolean) {
    return this.adapter.updateShelly(this.id, `white/0/set`, JSON.stringify({
      brightness,
      turn: on,
    }));
  }
}
