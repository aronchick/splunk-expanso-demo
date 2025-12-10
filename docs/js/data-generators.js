/**
 * Data Generators for Splunk-style Events
 * Generates realistic sample data for Apache, Syslog, IoT, and Infrastructure metrics
 */

// Utility functions
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatApacheTimestamp(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = n => n.toString().padStart(2, '0');
  return `${pad(date.getDate())}/${months[date.getMonth()]}/${date.getFullYear()}:` +
         `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} -0800`;
}

function formatSplunkTimestamp(date) {
  return date.toISOString().replace('T', ' ').slice(0, -1);
}

// Sample data pools
const IP_POOLS = {
  us: ['192.168.1.100', '10.0.0.50', '172.16.0.1', '10.10.10.42', '192.168.10.15'],
  eu: ['10.20.30.40', '172.20.0.100', '192.168.50.25', '10.100.0.5', '172.30.0.1'],
  apac: ['10.50.0.100', '172.50.0.50', '192.168.100.1', '10.200.0.25', '172.100.0.10']
};

const PATHS = [
  '/api/users', '/api/orders', '/api/products', '/api/auth/login', '/api/auth/logout',
  '/api/search', '/api/cart', '/api/checkout', '/health', '/metrics',
  '/static/app.js', '/static/style.css', '/static/logo.png', '/favicon.ico'
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Mobile Chrome/120.0',
  'curl/8.4.0',
  'python-requests/2.31.0'
];

const SYSLOG_MESSAGES = {
  info: [
    'Connection established from {ip}',
    'User {user} logged in successfully',
    'Service started normally',
    'Configuration reloaded',
    'Scheduled backup completed'
  ],
  notice: [
    'Disk usage at {pct}%',
    'Memory usage at {pct}%',
    'New device connected: {ip}',
    'Certificate expires in {days} days'
  ],
  warning: [
    'High CPU usage detected: {pct}%',
    'Connection timeout from {ip}',
    'Rate limit reached for user {user}',
    'Slow query detected: {ms}ms'
  ],
  error: [
    'Failed password for {user} from {ip}',
    'Connection refused to database',
    'Out of memory error',
    'Disk write error on /dev/sda1'
  ],
  critical: [
    'Service crashed: pid={pid}',
    'Kernel panic detected',
    'Hardware failure on CPU {cpu}',
    'Database corruption detected'
  ]
};

const IOT_SENSOR_TYPES = ['temperature', 'humidity', 'pressure', 'co2', 'light'];

// Generator Classes

class ApacheLogGenerator {
  constructor(options = {}) {
    this.host = options.host || 'web-01';
    this.region = options.region || 'us';
    this.sourcetype = 'access_combined';
  }

  generate() {
    const now = new Date();
    const ip = randomChoice(IP_POOLS[this.region] || IP_POOLS.us);
    const method = randomChoice(['GET', 'GET', 'GET', 'POST', 'PUT', 'DELETE']);
    const path = randomChoice(PATHS);
    const status = this._getStatus(path, method);
    const bytes = status === 200 ? randomInt(100, 50000) : randomInt(50, 500);
    const user = Math.random() > 0.85 ? randomChoice(['admin', 'api-user', 'service-account']) : '-';

    const raw = `${ip} - ${user} [${formatApacheTimestamp(now)}] "${method} ${path} HTTP/1.1" ` +
                `${status} ${bytes} "https://app.example.com${path}" "${randomChoice(USER_AGENTS)}"`;

    return {
      _time: now.toISOString(),
      _raw: raw,
      host: this.host,
      source: '/var/log/httpd/access_log',
      sourcetype: this.sourcetype,
      index: 'web',
      // Extracted fields
      clientip: ip,
      method: method,
      uri_path: path,
      status: status,
      bytes: bytes,
      user: user,
      region: this.region
    };
  }

  _getStatus(path, method) {
    if (path.includes('health')) return 200;
    if (path.includes('login') && method === 'POST') {
      return randomChoice([200, 200, 200, 401, 401, 403]);
    }
    return randomChoice([200, 200, 200, 200, 200, 201, 301, 400, 404, 500]);
  }
}

class ApacheErrorGenerator {
  constructor(options = {}) {
    this.host = options.host || 'web-01';
    this.region = options.region || 'us';
    this.sourcetype = 'apache_error';
  }

  generate() {
    const now = new Date();
    const levels = ['notice', 'warn', 'error', 'crit'];
    const level = randomChoice(levels);
    const ip = randomChoice(IP_POOLS[this.region] || IP_POOLS.us);

    const messages = {
      notice: 'Apache/2.4.54 configured -- resuming normal operations',
      warn: `[client ${ip}] ModSecurity: Warning. Pattern match "select|insert|update" at ARGS:query`,
      error: `[client ${ip}] File does not exist: /var/www/html${randomChoice(['/admin', '/wp-admin', '/.env'])}`,
      crit: `[client ${ip}] SSL handshake failed: SSL alert number 40`
    };

    const raw = `[${formatApacheTimestamp(now)}] [${level}] [pid ${randomInt(1000, 9999)}] ${messages[level]}`;

    return {
      _time: now.toISOString(),
      _raw: raw,
      host: this.host,
      source: '/var/log/httpd/error_log',
      sourcetype: this.sourcetype,
      index: 'security',
      level: level,
      clientip: ip,
      region: this.region
    };
  }
}

class SyslogGenerator {
  constructor(options = {}) {
    this.host = options.host || 'server-01';
    this.region = options.region || 'us';
    this.sourcetype = 'syslog';
  }

  generate() {
    const now = new Date();
    const facility = randomChoice(['kern', 'user', 'daemon', 'auth', 'syslog', 'cron']);
    const severity = randomChoice(['info', 'info', 'info', 'notice', 'warning', 'error']);
    const severityWeighted = Math.random() > 0.95 ? 'critical' : severity;

    const template = randomChoice(SYSLOG_MESSAGES[severityWeighted]);
    const message = template
      .replace('{ip}', randomChoice(IP_POOLS[this.region] || IP_POOLS.us))
      .replace('{user}', randomChoice(['root', 'admin', 'nobody', 'www-data']))
      .replace('{pct}', randomInt(60, 99))
      .replace('{days}', randomInt(7, 90))
      .replace('{ms}', randomInt(1000, 30000))
      .replace('{pid}', randomInt(1000, 65535))
      .replace('{cpu}', randomInt(0, 7));

    const raw = `<${randomInt(0, 191)}>${formatApacheTimestamp(now)} ${this.host} ${facility}[${randomInt(1000, 9999)}]: ${message}`;

    return {
      _time: now.toISOString(),
      _raw: raw,
      host: this.host,
      source: '/var/log/messages',
      sourcetype: this.sourcetype,
      index: 'os',
      facility: facility,
      severity: severityWeighted,
      message: message,
      region: this.region
    };
  }
}

class IoTSensorGenerator {
  constructor(options = {}) {
    this.sensorId = options.sensorId || 'sensor-' + randomInt(1, 100);
    this.location = options.location || 'warehouse-a';
    this.region = options.region || 'us';
    this.sourcetype = 'iot:sensor';
    this._baseTemp = 20 + Math.random() * 10;
    this._baseHumidity = 40 + Math.random() * 20;
  }

  generate() {
    const now = new Date();
    // Add slight drift to simulate realistic sensor data
    this._baseTemp += (Math.random() - 0.5) * 2;
    this._baseHumidity += (Math.random() - 0.5) * 5;

    const data = {
      sensor_id: this.sensorId,
      timestamp: now.toISOString(),
      readings: {
        temperature_c: Math.round(this._baseTemp * 10) / 10,
        humidity_pct: Math.round(Math.max(0, Math.min(100, this._baseHumidity))),
        pressure_hpa: Math.round((1013 + (Math.random() - 0.5) * 50) * 10) / 10,
        co2_ppm: randomInt(400, 1200),
        light_lux: randomInt(100, 10000)
      },
      battery_pct: randomInt(20, 100),
      signal_strength_dbm: -randomInt(40, 90),
      location: this.location
    };

    return {
      _time: now.toISOString(),
      _raw: JSON.stringify(data),
      host: this.sensorId,
      source: 'iot-gateway',
      sourcetype: this.sourcetype,
      index: 'metrics',
      ...data,
      region: this.region
    };
  }
}

class InfraMetricsGenerator {
  constructor(options = {}) {
    this.host = options.host || 'server-01';
    this.region = options.region || 'us';
    this.sourcetype = 'metrics:host';
    this._baseCpu = 20 + Math.random() * 30;
    this._baseMemory = 2000 + Math.random() * 4000;
  }

  generate() {
    const now = new Date();
    // Simulate realistic metric drift
    this._baseCpu = Math.max(5, Math.min(95, this._baseCpu + (Math.random() - 0.5) * 20));
    this._baseMemory = Math.max(1000, Math.min(7500, this._baseMemory + (Math.random() - 0.5) * 500));

    const data = {
      timestamp: now.toISOString(),
      host: this.host,
      cpu: {
        usage_pct: Math.round(this._baseCpu * 10) / 10,
        user_pct: Math.round(this._baseCpu * 0.7 * 10) / 10,
        system_pct: Math.round(this._baseCpu * 0.3 * 10) / 10,
        iowait_pct: Math.round(Math.random() * 10 * 10) / 10,
        cores: 8
      },
      memory: {
        used_mb: Math.round(this._baseMemory),
        total_mb: 8192,
        cached_mb: randomInt(500, 2000),
        buffers_mb: randomInt(100, 500)
      },
      disk: {
        read_iops: randomInt(50, 500),
        write_iops: randomInt(20, 200),
        read_mbps: Math.round(Math.random() * 100 * 10) / 10,
        write_mbps: Math.round(Math.random() * 50 * 10) / 10,
        usage_pct: randomInt(30, 80)
      },
      network: {
        rx_mbps: Math.round(Math.random() * 100 * 10) / 10,
        tx_mbps: Math.round(Math.random() * 50 * 10) / 10,
        rx_packets: randomInt(10000, 100000),
        tx_packets: randomInt(5000, 50000),
        errors: Math.random() > 0.95 ? randomInt(1, 10) : 0
      }
    };

    return {
      _time: now.toISOString(),
      _raw: JSON.stringify(data),
      host: this.host,
      source: 'collectd',
      sourcetype: this.sourcetype,
      index: 'metrics',
      ...data,
      region: this.region
    };
  }
}

// Edge Node - combines multiple generators for a realistic edge deployment
class EdgeNode {
  constructor(options = {}) {
    this.nodeId = options.nodeId || 'edge-01';
    this.region = options.region || 'us';
    this.type = options.type || 'mixed'; // 'web', 'iot', 'infra', 'mixed'

    this.generators = this._createGenerators();
    this.eventCount = 0;
    this.bytesGenerated = 0;
    this.status = 'healthy';
  }

  _createGenerators() {
    const common = { host: this.nodeId, region: this.region };

    switch (this.type) {
      case 'web':
        return [
          { gen: new ApacheLogGenerator(common), weight: 0.85 },
          { gen: new ApacheErrorGenerator(common), weight: 0.15 }
        ];
      case 'iot':
        return [
          { gen: new IoTSensorGenerator({ ...common, sensorId: `${this.nodeId}-sensor-1` }), weight: 0.5 },
          { gen: new IoTSensorGenerator({ ...common, sensorId: `${this.nodeId}-sensor-2` }), weight: 0.5 }
        ];
      case 'infra':
        return [
          { gen: new InfraMetricsGenerator(common), weight: 0.4 },
          { gen: new SyslogGenerator(common), weight: 0.6 }
        ];
      default: // mixed
        return [
          { gen: new ApacheLogGenerator(common), weight: 0.4 },
          { gen: new ApacheErrorGenerator(common), weight: 0.1 },
          { gen: new SyslogGenerator(common), weight: 0.25 },
          { gen: new IoTSensorGenerator({ ...common, sensorId: `${this.nodeId}-sensor` }), weight: 0.1 },
          { gen: new InfraMetricsGenerator(common), weight: 0.15 }
        ];
    }
  }

  generate() {
    // Weighted random selection
    const rand = Math.random();
    let cumulative = 0;
    for (const { gen, weight } of this.generators) {
      cumulative += weight;
      if (rand <= cumulative) {
        const event = gen.generate();
        event.node_id = this.nodeId;
        this.eventCount++;
        this.bytesGenerated += event._raw.length;
        return event;
      }
    }
    // Fallback
    const event = this.generators[0].gen.generate();
    event.node_id = this.nodeId;
    return event;
  }

  getStats() {
    return {
      nodeId: this.nodeId,
      region: this.region,
      type: this.type,
      status: this.status,
      eventCount: this.eventCount,
      bytesGenerated: this.bytesGenerated
    };
  }

  reset() {
    this.eventCount = 0;
    this.bytesGenerated = 0;
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.DataGenerators = {
    ApacheLogGenerator,
    ApacheErrorGenerator,
    SyslogGenerator,
    IoTSensorGenerator,
    InfraMetricsGenerator,
    EdgeNode,
    utils: { randomChoice, randomInt, formatApacheTimestamp, formatSplunkTimestamp }
  };
}

// Also support ES modules
export {
  ApacheLogGenerator,
  ApacheErrorGenerator,
  SyslogGenerator,
  IoTSensorGenerator,
  InfraMetricsGenerator,
  EdgeNode,
  randomChoice,
  randomInt,
  formatApacheTimestamp,
  formatSplunkTimestamp
};
