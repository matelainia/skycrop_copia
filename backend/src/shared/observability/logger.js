import env from '../config/env.js';

class Logger {
  static log(level, message, meta = {}) {
    const logObj = {
      timestamp: new Date().toISOString(),
      level,
      message,
      environment: env.NODE_ENV,
      ...meta
    };

    if (env.NODE_ENV === 'production') {
      // Formato JSON para agregadores en la nube (Datadog/Grafana)
      console.log(JSON.stringify(logObj));
    } else {
      // Terminal amigable con colores para desarrollo local
      const colorMap = {
        INFO: '\x1b[36m', // Cyan
        WARN: '\x1b[33m', // Amarillo
        ERROR: '\x1b[31m', // Rojo
        AUDIT: '\x1b[32m', // Verde
        RESET: '\x1b[0m'
      };
      const color = colorMap[level] || colorMap.RESET;

      const metaStr = Object.keys(meta).length ? ` | Meta: ${JSON.stringify(meta)}` : '';
      console.log(`${color}[${level}]${colorMap.RESET} [${logObj.timestamp}] ${message}${metaStr}`);
    }
  }

  static info(message, meta) {
    this.log('INFO', message, meta);
  }

  static warn(message, meta) {
    this.log('WARN', message, meta);
  }

  static error(message, meta) {
    this.log('ERROR', message, meta);
  }

  static audit(message, meta) {
    this.log('AUDIT', message, meta);
  }
}

export default Logger;
export { Logger };
