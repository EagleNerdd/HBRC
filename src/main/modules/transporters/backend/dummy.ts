import { BaseTransporter } from './base';

export class DummyTransporter extends BaseTransporter {
  constructor(name: string) {
    super(name);
  }
  async _send(data: any): Promise<void> {
    console.log('sending data', data);
  }
  connect() {
    console.log('connected to dummy');
  }
}
