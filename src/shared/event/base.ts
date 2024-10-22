import { Subject } from 'rxjs';

export interface EventSubscription {
  unsubscribe(): void;
}

export class Event<D> {
  private subject: Subject<D>;
  constructor() {
    this.subject = new Subject();
  }
  emit(d: D) {
    this.subject.next(d);
  }
  listen(listener: (d: D) => void): EventSubscription {
    return this.subject.subscribe({
      next: listener,
    });
  }

  getRxjsObservable() {
    return this.subject.asObservable();
  }
}

export class FireLatestOnAddEvent<D> extends Event<D> {
  private latestObj?: D;
  constructor() {
    super();
  }
  emit(d: D): void {
    super.emit(d);
    this.latestObj = d;
  }

  listen(listener: (d: D) => void): EventSubscription {
    if (this.latestObj !== undefined) {
      listener(this.latestObj);
    }
    return super.listen(listener);
  }
}
