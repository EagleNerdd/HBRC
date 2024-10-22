import { Event } from '@shared/event';
import { TransporterStatus } from '@shared/types/transporter';
import { BrowserInstance } from '@shared/types';

import { filter, bufferWhen, debounceTime, map } from 'rxjs';
import { HBRCApplication } from '@main/app';

export class ClientEvents {
  // Main -> Renderer
  onClientReady: Event<void>;
  onTransporterStatusChanged: Event<TransporterStatus>;
  onInstanceUpdated: Event<{ sessionId: string; updated: Partial<BrowserInstance> }>;

  // Renderer -> Main
  onDebugEnableClicked: Event<HBRCApplication>;
  constructor() {
    this.onClientReady = new Event();
    this.onTransporterStatusChanged = new Event();
    this.onInstanceUpdated = new Event();
    this.onDebugEnableClicked = new Event();
    this.listenEnableDebug();
  }

  private listenEnableDebug() {
    // Listen for 9 clicks within 300ms
    const sourceOb = this.onDebugEnableClicked.getRxjsObservable();
    const ob = sourceOb.pipe(
      bufferWhen(() => sourceOb.pipe(debounceTime(300))),
      filter((clicks) => clicks.length >= 9),
      map((data) => data[0])
    );
    ob.subscribe((app: HBRCApplication) => {
      app.enableDebugMode();
    });
  }
}
