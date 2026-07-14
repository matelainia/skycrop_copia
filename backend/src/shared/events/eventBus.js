import { EventEmitter } from 'events';

class EventBus extends EventEmitter {
  constructor() {
    super();
    // Aumentar el límite máximo de oyentes para evitar advertencias de Node
    this.setMaxListeners(50);
  }

  emit(eventName, payload) {
    console.log(`[EventBus] [EVENT: ${eventName}] Dispatching:`, {
      timestamp: new Date().toISOString(),
      payload
    });
    return super.emit(eventName, payload);
  }
}

export const eventBus = new EventBus();
export default eventBus;
