import { Event } from '@shared/event';
import { TransporterStatus } from '@shared/types/transporter';
import { BrowserInstance, BrowserInstanceMessage } from '@shared/types';

import { filter, bufferWhen, debounceTime, map } from 'rxjs';
import { HBRCApplication } from '@main/app';
import { isDebugging } from '@main/utils';

export class ClientEvents {
  // Main -> Renderer
  onClientReady: Event<void> = new Event();
  onTransporterStatusChanged: Event<TransporterStatus> = new Event();
  onInstanceUpdated: Event<{ sessionId: string; updated: Partial<BrowserInstance> }> = new Event();
  onInstanceMessage: Event<{ sessionId: string; message: BrowserInstanceMessage }> = new Event();

  // Renderer -> Main
  onDebugEnableClicked: Event<HBRCApplication> = new Event();
  onToggleDebugMode: Event<HBRCApplication> = new Event();

  constructor() {
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
      app.setDebugMode(!isDebugging());
    });
    // Toggle debug mode
    this.onToggleDebugMode.listen((app: HBRCApplication) => {
      app.setDebugMode(!isDebugging());
    });
  }
}
