import { ISubscriptionMap, MqttClient } from 'mqtt';
import { BaseTransporter, BaseTransporterOptions } from './base';

const mqtt = require('mqtt');

export type MqttTransporterOptions = {
  url: string;
  clientId: string;
  username: string;
  password: string;
  publishTopic: string;
  subscribeTopics: string[];
  qos?: 0 | 1 | 2;
} & BaseTransporterOptions;

export class MqttTransporter extends BaseTransporter {
  private mqttClient?: MqttClient;
  constructor(protected name: string, protected readonly options: MqttTransporterOptions) {
    super(name, options);
    if (options.qos === undefined) {
      options.qos = 1;
    }
  }

  protected _disconnect(): void {
    if (this.mqttClient) {
      this.mqttClient.end();
    }
  }

  protected _connect(): void {
    this.logger.debug('connect mqtt', { mqttOptions: this.options });
    const { url, username, password, subscribeTopics, clientId, qos } = this.options;
    const client = mqtt.connect(url, {
      username: username,
      password: password,
      clientId: clientId,
      protocolVersion: 4,
      clean: qos == 0,
      connectTimeout: 30000,
      keepalive: 30,
    });
    const subscribeTopicsMap = subscribeTopics.reduce((acc: ISubscriptionMap, topic) => {
      acc[topic] = { qos: qos };
      return acc;
    }, {});
    this.mqttClient = client;
    client.on('connect', () => {
      this.logger.debug('mqtt connected', { subscribeTopicsMap });
      client.subscribe(subscribeTopicsMap);
      this.onConnectedCallback && this.onConnectedCallback();
    });
    client.on('message', this.onMessage.bind(this));
    client.on('disconnect', (e) => {
      this.logger.debug('mqtt disconnected', e);
    });
  }
  async _send(data: any) {
    if (!this.mqttClient) {
      throw new Error('mqtt client not connected');
    }
    const { publishTopic } = this.options;
    try {
      const message = JSON.stringify(data);
      this.mqttClient.publish(publishTopic, message);
      this.logger.debug('send message success', { message, publishTopic });
    } catch (e) {
      this.logger.error('send message failed', { data, publishTopic, error: e.toString() });
      throw e;
    }
  }

  private onMessage(topic: string, message: Buffer) {
    const msg = this.parseMessage(message);
    this.logger.debug('mqtt receive message', { topic, message: msg });
    if (this.onReceiveCallback && msg) {
      this.onReceiveCallback(msg);
    }
  }

  private parseMessage(message: Buffer) {
    try {
      return JSON.parse(message.toString());
    } catch (e) {
      return null;
    }
  }
}
