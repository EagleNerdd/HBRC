import { HttpTransporterOptions } from './http';
import { MqttTransporterOptions } from './mqtt';

export * from './base';
export * from './mqtt';
export * from './dummy';
export * from './http';

export enum TransporterType {
  HTTP = 'http',
  MQTT = 'mqtt',
  DUMMY = 'dummy',
}
export type TransporterOptions = HttpTransporterOptions | MqttTransporterOptions;
