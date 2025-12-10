# Expanso + Splunk Edge Pipeline Demo

Replace Splunk's heavyweight "Fat Forwarders" with lightweight **Expanso Edge** pipelines. This demo showcases faster data onboarding, intelligent routing, and edge aggregation.

![Demo Preview](docs/preview.png)

## Quick Start

### View the Demo (No Installation Required)

Open [docs/index.html](docs/index.html) in your browser. The demo runs entirely client-side with simulated data.

### Run with Live Splunk

```bash
# Install Expanso Edge
curl -sL https://get.expanso.io/edge/install.sh | bash

# Configure Splunk HEC
export SPLUNK_HEC_ENDPOINT=https://your-splunk:8088
export SPLUNK_HEC_TOKEN=your-hec-token

# Run a pipeline
expanso-edge run pipelines/hello-edge.yaml
```

## Demo Scenarios

The demo walks through 5 progressive scenarios, each building on the previous:

| Scenario | Description | Key Concept |
|----------|-------------|-------------|
| **A. Hello Edge** | Single node, single index | Simplicity of getting started |
| **B. Multi-Index Routing** | Route by sourcetype | Replaces outputs.conf |
| **C. GDPR Compliance** | Geographic routing | Data residency at the edge |
| **D. Edge Aggregation** | Pre-aggregate metrics | 99% bandwidth savings |
| **E. Fleet at Scale** | 12 nodes, 3 regions | Central orchestration |

## Why Expanso Over Fat Forwarders?

| Aspect | Heavy Forwarder | Expanso Edge |
|--------|-----------------|--------------|
| Memory | 1-4 GB | 64 MB |
| Configuration | props.conf + transforms.conf | Single YAML file |
| Expertise | Splunk certification | Any developer |
| Routing | outputs.conf complexity | Bloblang logic |
| Compliance | Manual configuration | Built-in rules |
| Edge Intelligence | None | Full processing |

## Pipeline Files

All pipelines are production-ready and can be customized:

```
pipelines/
├── hello-edge.yaml      # Scenario A: Simple one-to-one
├── multi-index.yaml     # Scenario B: Sourcetype routing
├── gdpr-routing.yaml    # Scenario C: Geographic compliance
├── aggregation.yaml     # Scenario D: Edge aggregation
└── fleet-universal.yaml # Scenario E: Universal fleet pipeline
```

## Running Pipelines

### Scenario A: Hello Edge
```bash
export SPLUNK_HEC_ENDPOINT=https://your-splunk:8088
export SPLUNK_HEC_TOKEN=your-token
expanso-edge run pipelines/hello-edge.yaml
```

### Scenario B: Multi-Index Routing
```bash
# Routes access logs to 'web', errors to 'security', syslog to 'os'
expanso-edge run pipelines/multi-index.yaml
```

### Scenario C: GDPR Compliance
```bash
# EU data stays in EU, US/APAC goes to US
export NODE_REGION=eu
export SPLUNK_HEC_EU=https://eu-splunk:8088
export SPLUNK_HEC_US=https://us-splunk:8088
expanso-edge run pipelines/gdpr-routing.yaml
```

### Scenario D: Edge Aggregation
```bash
# Aggregates high-volume IoT metrics
# Input: ~1000 events/sec, Output: ~10 aggregated/sec
expanso-edge run pipelines/aggregation.yaml
```

### Scenario E: Fleet at Scale
```bash
# Deploy same pipeline to all nodes
# Region auto-detected from node name
export NODE_NAME=edge-eu-01
expanso-edge run pipelines/fleet-universal.yaml
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SPLUNK_HEC_ENDPOINT` | `http://localhost:8088` | Splunk HEC URL |
| `SPLUNK_HEC_TOKEN` | `changeme` | HEC authentication token |
| `SPLUNK_HEC_US` | (same as above) | US region HEC endpoint |
| `SPLUNK_HEC_EU` | (same as above) | EU region HEC endpoint |
| `NODE_NAME` | `edge-web-01` | Edge node identifier |
| `NODE_REGION` | `us` | Node region (us/eu/apac) |
| `EMIT_INTERVAL` | `500ms` | Data generation interval |

## Docker Compose (Full Demo Environment)

Spin up a complete local demo with 6 Expanso Edge nodes, mock Splunk HEC receivers, Prometheus, and Grafana:

```bash
# Start the full stack
docker compose up -d

# View Grafana dashboards
open http://localhost:3000  # admin/admin

# View US HEC logs
docker logs -f splunk-hec-us

# View EU HEC logs
docker logs -f splunk-hec-eu

# View all container logs
open http://localhost:9999  # Dozzle log viewer

# Stop everything
docker compose down
```

### Services Included

| Service | Port | Description |
|---------|------|-------------|
| `splunk-hec-us` | 8080 | Mock US region HEC receiver |
| `splunk-hec-eu` | 8081 | Mock EU region HEC receiver |
| `prometheus` | 9090 | Metrics collection |
| `grafana` | 3000 | Dashboards (admin/admin) |
| `log-viewer` | 9999 | Dozzle container log viewer |
| `edge-us-01/02` | - | US region Expanso nodes |
| `edge-eu-01/02` | - | EU region Expanso nodes |
| `edge-ap-01/02` | - | APAC region Expanso nodes |

## Splunk App

A pre-built Splunk app with indexes, dashboards, and saved searches:

```bash
# Install to Splunk
cp -r splunk-app/expanso_edge_demo $SPLUNK_HOME/etc/apps/
$SPLUNK_HOME/bin/splunk restart
```

See [splunk-app/README.md](splunk-app/README.md) for details.

## File Structure

```
splunk-demo/
├── docs/
│   ├── index.html              # Interactive web demo
│   └── js/
│       └── data-generators.js  # Sample data generation
├── pipelines/                  # Production-ready Expanso pipelines
│   ├── hello-edge.yaml
│   ├── multi-index.yaml
│   ├── gdpr-routing.yaml
│   ├── aggregation.yaml
│   └── fleet-universal.yaml
├── docker/                     # Docker Compose support files
│   ├── hec-receiver.py         # Mock Splunk HEC server
│   ├── prometheus.yaml         # Prometheus config
│   └── grafana/                # Grafana provisioning
├── splunk-app/                 # Splunk app package
│   └── expanso_edge_demo/      # App with indexes & dashboards
├── .github/workflows/          # CI/CD automation
│   ├── pages.yaml              # GitHub Pages deployment
│   └── ci.yaml                 # Pipeline validation
├── docker-compose.yaml         # Full demo environment
├── DESIGN.md                   # Architecture decisions
└── README.md                   # This file
```

## Bloblang Patterns

Key patterns used in the pipelines:

```yaml
# Conditional routing
meta "index" = if this.sourcetype == "access_combined" {
  "web"
} else if this.sourcetype.contains("error") {
  "security"
} else {
  "os"
}

# Geographic compliance
meta "destination" = if meta("region") == "eu" && meta("has_pii") {
  "eu-storage"
} else {
  "us-storage"
}

# Aggregation (simplified)
root.avg_temp = this.messages.map_each(m -> m.temperature).sum() / this.messages.length()
```

## Splunk Index Setup

Create these indexes in Splunk for the full demo:

```
# indexes.conf
[web]
homePath = $SPLUNK_DB/web/db
coldPath = $SPLUNK_DB/web/colddb
thawedPath = $SPLUNK_DB/web/thaweddb

[security]
homePath = $SPLUNK_DB/security/db
coldPath = $SPLUNK_DB/security/colddb
thawedPath = $SPLUNK_DB/security/thaweddb

[os]
homePath = $SPLUNK_DB/os/db
coldPath = $SPLUNK_DB/os/colddb
thawedPath = $SPLUNK_DB/os/thaweddb

[metrics]
homePath = $SPLUNK_DB/metrics/db
coldPath = $SPLUNK_DB/metrics/colddb
thawedPath = $SPLUNK_DB/metrics/thaweddb
datatype = metric

[eu_main]
homePath = $SPLUNK_DB/eu_main/db
coldPath = $SPLUNK_DB/eu_main/colddb
thawedPath = $SPLUNK_DB/eu_main/thaweddb

[us_main]
homePath = $SPLUNK_DB/us_main/db
coldPath = $SPLUNK_DB/us_main/colddb
thawedPath = $SPLUNK_DB/us_main/thaweddb
```

## Development

### Run the Demo Locally

```bash
# Using Python
cd docs && python -m http.server 8000
# Open http://localhost:8000

# Or just open the file directly
open docs/index.html
```

### Validate Pipelines

```bash
# Install Expanso CLI
curl -sL https://get.expanso.io/cli/install.sh | bash

# Validate pipeline syntax
expanso-cli job validate pipelines/hello-edge.yaml --offline
```

## Learn More

- [Expanso Documentation](https://docs.expanso.io)
- [Bloblang Reference](https://docs.expanso.io/bloblang)
- [Splunk HEC Documentation](https://docs.splunk.com/Documentation/Splunk/latest/Data/UsetheHTTPEventCollector)

## License

MIT License - See [LICENSE](LICENSE) for details.
