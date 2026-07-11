import { emit } from '../events/machinery.events';

/**
 * Interface Telemetry Service for GPS, CAN Bus, and IoT sensors integration
 */
class TelemetryService {
  constructor() {
    this.isActive = false;
    this.pollingInterval = null;
  }

  /**
   * Connect to IoT telemetry systems
   */
  connectDevices() {
    this.isActive = true;
    console.log('[Telemetry Service] Connected to SkyCrop IoT telemetry gateways.');
    
    // Simulate real-time CAN Bus metrics dispatching
    this.pollingInterval = setInterval(() => {
      if (this.isActive) {
        this.emitHeartbeat();
      }
    }, 30000);
  }

  /**
   * Disconnect telemetry streams
   */
  disconnectDevices() {
    this.isActive = false;
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    console.log('[Telemetry Service] Telemetry gateways disconnected.');
  }

  /**
   * Send machinery sensor pulse
   */
  emitHeartbeat() {
    const pulse = {
      timestamp: new Date().toISOString(),
      location: { lat: 3.4516, lng: -76.5320 },
      fuelLevelPct: 85,
      engineTempCelsius: 82,
      rpm: 1800,
      connectionStrength: 'EXCELLENT'
    };
    emit('TelemetryPulseReceived', pulse);
  }
}

export const telemetry = new TelemetryService();
export default telemetry;
