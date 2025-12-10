# Expanso Splunk Edge Pipeline Demo - Design Document

## Executive Summary

This demo showcases **Expanso** as a lightweight replacement for Splunk's "fat forwarder" architecture. Through a progressive, self-paced web walkthrough, users experience how Expanso enables:

- **Instant onboarding** of new data sources
- **Edge-native processing** with minimal resource footprint
- **Intelligent routing** by sourcetype, geography, and compliance rules
- **Bandwidth optimization** through edge aggregation

---

## The Story We're Telling

### The Problem (Splunk Fat Forwarder Pain Points)
1. **Heavy Forwarders are resource hogs** - 1-4GB RAM vs Expanso's 64MB
2. **Slow data onboarding** - Requires Splunk expertise, props.conf/transforms.conf mastery
3. **Complex routing** - outputs.conf configurations are error-prone
4. **Compliance is hard** - GDPR/CCPA data residency requires manual configuration
5. **No edge intelligence** - Raw data shipped, bandwidth wasted

### The Solution (Expanso Edge)
1. **Lightweight agent** - Runs anywhere, minimal footprint
2. **Visual pipeline building** - Bloblang is readable and powerful
3. **Dynamic routing** - Route by content, source, geography at the edge
4. **Built-in compliance** - Data residency rules enforced at ingestion
5. **Edge aggregation** - Reduce volume before transmission

---

## Scenarios

### Scenario A: Hello Edge
**Goal**: Show simplicity of getting started
**Duration**: ~30 seconds of viewing

**Architecture**:
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Edge Node      │     │   Expanso       │     │  main_index     │
│  (web-01)       │────▶│   Pipeline      │────▶│  (Splunk)       │
│  Apache Logs    │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Data Generated**:
- Apache Combined Log Format
- 1 event every 500ms

**Sample Event**:
```
192.168.1.100 - admin [09/Dec/2025:14:23:45 -0800] "GET /api/users HTTP/1.1" 200 1234 "https://app.example.com" "Mozilla/5.0..."
```

**Pipeline Config Shown** (simplified):
```yaml
input:
  generate:
    mapping: |
      root = generate_apache_log()

output:
  splunk_hec:
    index: main
```

**What User Sees**:
- Single node card with status
- Events flowing in terminal-style viewer
- Event count incrementing

---

### Scenario B: Multi-Index Routing
**Goal**: Show sourcetype-based routing (replaces outputs.conf)
**Duration**: ~60 seconds of viewing

**Architecture**:
```
┌─────────────────┐     ┌─────────────────────────────┐     ┌──────────────┐
│  Edge Node      │     │      Expanso Pipeline       │     │  web_index   │
│  (web-01)       │     │  ┌─────────────────────┐    │────▶│              │
│                 │────▶│  │ sourcetype router   │    │     └──────────────┘
│  Mixed Logs:    │     │  │                     │    │     ┌──────────────┐
│  - access_log   │     │  │ access → web        │    │────▶│ security_idx │
│  - error_log    │     │  │ error  → security   │    │     └──────────────┘
│  - syslog       │     │  │ syslog → os         │    │     ┌──────────────┐
│                 │     │  └─────────────────────┘    │────▶│  os_index    │
└─────────────────┘     └─────────────────────────────┘     └──────────────┘
```

**Data Generated**:
- Apache access logs (70%)
- Apache error logs (15%)
- Syslog messages (15%)

**Pipeline Config Shown**:
```yaml
pipeline:
  processors:
    - bloblang: |
        meta "index" = if this.sourcetype == "access_combined" {
          "web"
        } else if this.sourcetype == "error_log" {
          "security"
        } else {
          "os"
        }

output:
  switch:
    cases:
      - check: meta("index") == "web"
        output: { splunk_hec: { index: web } }
      - check: meta("index") == "security"
        output: { splunk_hec: { index: security } }
      - check: true
        output: { splunk_hec: { index: os } }
```

**What User Sees**:
- Events color-coded by destination index
- Three index destination panels
- Real-time routing visualization with animated paths

---

### Scenario C: Geographic/Compliance Routing (GDPR)
**Goal**: Show data residency enforcement at the edge
**Duration**: ~90 seconds of viewing

**Architecture**:
```
                                              ┌───────────────────────┐
                                              │  US Storage (Oregon)  │
┌────────────┐                           ┌───▶│  main_idx             │
│  US-WEST   │                           │    └───────────────────────┘
│  edge-us-1 │──┐                        │
└────────────┘  │                        │
                │   ┌────────────────┐   │    ┌───────────────────────┐
┌────────────┐  │   │                │   │    │  EU Storage (Ireland) │
│  EU-WEST   │──┼──▶│  Geo Router    │───┼───▶│  eu_main_idx          │
│  edge-eu-1 │  │   │                │   │    │  (GDPR Compliant)     │
└────────────┘  │   │  US → US       │   │    └───────────────────────┘
                │   │  EU → EU       │   │
┌────────────┐  │   │  APAC → US     │   │    ┌───────────────────────┐
│  APAC      │──┘   └────────────────┘   └───▶│  APAC routes to US    │
│  edge-ap-1 │                                │  (no local storage)   │
└────────────┘                                └───────────────────────┘
```

**Data Generated**:
- Web access logs from all regions
- Contains PII indicators (user IDs, IP addresses)
- EU events tagged with `gdpr: true`

**Pipeline Config Shown**:
```yaml
pipeline:
  processors:
    - bloblang: |
        meta "region" = this.source_region
        meta "has_pii" = this.user_id != null

        # GDPR: EU data with PII stays in EU
        meta "destination" = if meta("region") == "EU" && meta("has_pii") {
          "eu-storage"
        } else {
          "us-storage"
        }

output:
  switch:
    cases:
      - check: meta("destination") == "eu-storage"
        output:
          splunk_hec:
            endpoint: https://eu-hec.splunk.example.com
            index: eu_main
      - check: true
        output:
          splunk_hec:
            endpoint: https://us-hec.splunk.example.com
            index: main
```

**What User Sees**:
- Three edge nodes on a world map (stylized)
- Animated data flow showing routing decisions
- EU data clearly stays in EU (green path)
- US/APAC data flows to US (blue path)
- Compliance badge showing "GDPR Enforced"

---

### Scenario D: Edge Aggregation
**Goal**: Show bandwidth savings through pre-aggregation
**Duration**: ~60 seconds of viewing

**Architecture**:
```
┌─────────────────────────────────────────────────────────────────────┐
│  High-Volume Edge Node (IoT Gateway)                                │
│                                                                     │
│  ┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐    │
│  │ Raw Events  │    │   Aggregator    │    │ Aggregated Stats │    │
│  │             │    │                 │    │                  │    │
│  │ 1000/sec    │───▶│  Window: 10s    │───▶│  10/sec          │    │
│  │ ~50KB/sec   │    │  Group by: host │    │  ~500B/sec       │    │
│  └─────────────┘    └─────────────────┘    └──────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                                        │
                                                        ▼
                                              ┌──────────────────┐
                                              │  metrics_index   │
                                              │                  │
                                              │  99% bandwidth   │
                                              │  reduction!      │
                                              └──────────────────┘
```

**Data Generated**:
- IoT sensor readings (temperature, humidity, pressure)
- CPU/memory metrics
- Network throughput stats
- 1000 events/second (simulated)

**Pipeline Config Shown**:
```yaml
input:
  generate:
    interval: 1ms  # High volume simulation
    mapping: |
      root.host = "sensor-" + random_int(max: 10).string()
      root.temperature = 20 + random_int(max: 30)
      root.humidity = 40 + random_int(max: 40)
      root.cpu_pct = random_int(max: 100)

pipeline:
  processors:
    - group_by:
        window: 10s
        fields: [host]
    - bloblang: |
        root.host = this.host
        root.avg_temp = this.messages.map_each(m -> m.temperature).sum() / this.messages.length()
        root.avg_humidity = this.messages.map_each(m -> m.humidity).sum() / this.messages.length()
        root.avg_cpu = this.messages.map_each(m -> m.cpu_pct).sum() / this.messages.length()
        root.event_count = this.messages.length()
        root.window_start = now()
```

**What User Sees**:
- Split view: "Before" (raw events scrolling fast) vs "After" (aggregated stats)
- Bandwidth meter showing 99% reduction
- Event counter: "10,000 events → 10 aggregated records"

---

### Scenario E: Fleet at Scale
**Goal**: Show central management of distributed edge nodes
**Duration**: ~90 seconds of viewing

**Architecture**:
```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Expanso Fleet Management                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Dashboard / Control Plane                     │   │
│  │   Active: 12   |   Healthy: 11   |   Warning: 1   |   Error: 0  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   US Region     │ │   EU Region     │ │   APAC Region   │
│                 │ │                 │ │                 │
│ ┌──┐ ┌──┐ ┌──┐ │ │ ┌──┐ ┌──┐ ┌──┐ │ │ ┌──┐ ┌──┐ ┌──┐ │
│ │01│ │02│ │03│ │ │ │01│ │02│ │03│ │ │ │01│ │02│ │03│ │
│ └──┘ └──┘ └──┘ │ │ └──┘ └──┘ └──┘ │ │ └──┘ └──┘ └──┘ │
│ ┌──┐           │ │ ┌──┐           │ │ ┌──┐           │
│ │04│           │ │ │04│ ⚠️        │ │ │04│           │
│ └──┘           │ │ └──┘           │ │ └──┘           │
└─────────────────┘ └─────────────────┘ └─────────────────┘
         │                   │                   │
         ▼                   ▼                   ▼
    [US Storage]       [EU Storage]        [US Storage]
```

**Data Generated**:
- 12 edge nodes generating diverse data
- Mixed sourcetypes across all nodes
- One node showing degraded status

**What User Sees**:
- Grid of 12 node cards (4 per region)
- Real-time status indicators (green/yellow/red)
- Throughput sparklines per node
- Click on node to see its events
- Aggregate statistics dashboard

---

## Visual Components

### 1. Scenario Navigation Bar
```
┌─────────────────────────────────────────────────────────────────────────┐
│  [A. Hello Edge]  [B. Routing]  [C. GDPR]  [D. Aggregation]  [E. Fleet] │
│       ●               ○             ○            ○               ○       │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2. Architecture Diagram (Animated SVG)
- Nodes pulse when active
- Data packets animate along connection lines
- Destination indexes glow when receiving data

### 3. Edge Node Cards
```
┌────────────────────┐
│ 🟢 edge-us-01      │
│ Region: US-WEST    │
│ ─────────────────  │
│ Events/s: 142      │
│ Sourcetype: access │
│ Index: web         │
└────────────────────┘
```

### 4. Mock Splunk Index Viewer
```
┌─────────────────────────────────────────────────────────────────────────┐
│ 📁 web_index                                                    [tail] │
├─────────────────────────────────────────────────────────────────────────┤
│ 14:23:45.123  host=web-01  sourcetype=access_combined                  │
│ 192.168.1.100 - - [09/Dec/2025:14:23:45] "GET /api/users" 200 1234    │
│                                                                         │
│ 14:23:45.456  host=web-01  sourcetype=access_combined                  │
│ 10.0.0.50 - admin [09/Dec/2025:14:23:45] "POST /login" 401 89         │
│                                                                         │
│ 14:23:45.789  host=web-01  sourcetype=access_combined                  │
│ 172.16.0.1 - - [09/Dec/2025:14:23:45] "GET /static/app.js" 200 45678  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5. Pipeline Code Viewer
- Syntax-highlighted YAML
- Bloblang code with line numbers
- "This is running" indicator

### 6. Metrics Dashboard
```
┌─────────────────────────────────────────────────────────────────────────┐
│  Events Processed    Bandwidth Saved     Active Indexes    Nodes Online │
│       12,453              89.2%               4                12       │
│        ↑ 15%             ↑ 2.1%                               11 🟢 1 🟡 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Sample Data Generators

### Apache Access Log
```javascript
function generateApacheLog() {
  const ips = ['192.168.1.100', '10.0.0.50', '172.16.0.1', '203.0.113.42'];
  const paths = ['/api/users', '/api/orders', '/login', '/static/app.js', '/health'];
  const methods = ['GET', 'POST', 'PUT', 'DELETE'];
  const statuses = [200, 200, 200, 201, 301, 400, 401, 404, 500];

  return {
    ip: randomChoice(ips),
    user: Math.random() > 0.8 ? 'admin' : '-',
    timestamp: formatApacheTimestamp(new Date()),
    method: randomChoice(methods),
    path: randomChoice(paths),
    status: randomChoice(statuses),
    bytes: Math.floor(Math.random() * 50000),
    referrer: 'https://app.example.com',
    userAgent: 'Mozilla/5.0 (compatible; Demo/1.0)'
  };
}
```

### Syslog
```javascript
function generateSyslog() {
  const facilities = ['kern', 'user', 'daemon', 'auth', 'syslog'];
  const severities = ['info', 'notice', 'warning', 'error', 'critical'];
  const messages = [
    'Connection established',
    'User login successful',
    'Disk usage at 80%',
    'Failed password for admin',
    'Service restarted'
  ];

  return {
    facility: randomChoice(facilities),
    severity: randomChoice(severities),
    timestamp: new Date().toISOString(),
    host: 'server-01',
    message: randomChoice(messages)
  };
}
```

### IoT Sensor
```javascript
function generateIoTReading() {
  return {
    sensor_id: 'sensor-' + Math.floor(Math.random() * 100),
    temperature: 20 + Math.random() * 30,
    humidity: 40 + Math.random() * 40,
    pressure: 1000 + Math.random() * 50,
    battery_pct: 20 + Math.random() * 80,
    timestamp: new Date().toISOString()
  };
}
```

### Infrastructure Metrics
```javascript
function generateInfraMetrics() {
  return {
    host: 'server-' + Math.floor(Math.random() * 10),
    cpu_pct: Math.random() * 100,
    memory_used_mb: 1000 + Math.random() * 7000,
    memory_total_mb: 8192,
    disk_read_iops: Math.floor(Math.random() * 1000),
    disk_write_iops: Math.floor(Math.random() * 500),
    network_rx_mbps: Math.random() * 100,
    network_tx_mbps: Math.random() * 50,
    timestamp: new Date().toISOString()
  };
}
```

---

## Color Palette (Splunk-Inspired + Expanso)

```css
:root {
  /* Primary */
  --splunk-green: #65A637;
  --splunk-dark: #1A1A1A;
  --expanso-purple: #6366F1;
  --expanso-dark: #4F46E5;

  /* Semantic */
  --healthy: #22C55E;
  --warning: #F59E0B;
  --critical: #EF4444;

  /* Background */
  --bg-primary: #0F172A;
  --bg-secondary: #1E293B;
  --bg-tertiary: #334155;

  /* Text */
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --text-muted: #64748B;

  /* Index Colors */
  --index-main: #3B82F6;
  --index-web: #10B981;
  --index-security: #F59E0B;
  --index-os: #8B5CF6;
  --index-metrics: #EC4899;
}
```

---

## File Structure

```
splunk-demo/
├── docs/
│   ├── index.html              # Main demo page (standalone)
│   ├── js/
│   │   ├── data-generators.js  # Sample data generation
│   │   ├── scenario-engine.js  # Scenario state management
│   │   ├── animation.js        # SVG animations
│   │   └── mock-splunk.js      # Mock index viewer
│   └── assets/
│       └── (any static assets)
├── pipelines/                   # Reference Expanso pipelines
│   ├── hello-edge.yaml
│   ├── multi-index.yaml
│   ├── geo-routing.yaml
│   ├── aggregation.yaml
│   └── fleet-sample.yaml
├── README.md                    # User documentation
├── DESIGN.md                    # This file
└── docker-compose.yaml          # (Optional) Live backend
```

---

## Questions for User

Before proceeding with implementation:

1. **Splunk Branding**: Should we include actual Splunk terminology/logos, or keep it generic ("index", "sourcetype" are fine, but should we show Splunk logo)?

2. **Live Backend Option**: Do you want a docker-compose.yaml that can optionally spin up real Expanso nodes, even though the main demo is standalone?

3. **Pipeline Files**: Should we create actual Expanso pipeline YAML files that could theoretically run, or are they purely for display in the demo?

4. **Mobile Responsiveness**: Is the demo primarily for desktop/projector presentation, or should it work well on tablets too?

5. **GitHub Pages**: Should this be deployable to GitHub Pages (pure static), or is local file serving acceptable?
