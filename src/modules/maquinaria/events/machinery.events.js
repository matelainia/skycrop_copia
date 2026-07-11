const listeners = {};

/**
 * Emit an event to internal subscribers and global window event bus
 */
export const emit = (event, payload) => {
  if (listeners[event]) {
    listeners[event].forEach(cb => {
      try {
        cb(payload);
      } catch (err) {
        console.error(`Error in event listener for ${event}:`, err);
      }
    });
  }
  
  // Decoupled global integration
  const customEvent = new CustomEvent(`skycrop:maquinaria:${event}`, { detail: payload });
  window.dispatchEvent(customEvent);
};

/**
 * Subscribe to an event. Returns an unsubscribe function.
 */
export const subscribe = (event, cb) => {
  if (!listeners[event]) {
    listeners[event] = [];
  }
  listeners[event].push(cb);
  
  return () => {
    listeners[event] = listeners[event].filter(fn => fn !== cb);
  };
};
export const subscribeToEvent = subscribe; // Alias matching potential imports
