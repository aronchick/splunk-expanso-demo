# Expanso + Splunk Edge Pipeline Demo

Replace Splunk's heavyweight "Fat Forwarders" with lightweight **Expanso Edge** pipelines. This demo showcases faster data onboarding, intelligent routing, and edge aggregation.

**This demo runs entirely locally - no cloud services or external VMs required.**

## Quick Start

```bash
# Start edge nodes (scale as needed)
docker compose up -d --scale edge=6

# Tail logs by index
tail -f logs/web.log
tail -f logs/security.log

# Stop
docker compose down
```

Or open [docs/index.html](docs/index.html) in your browser for a client-side demo.

## Demo Scenarios

| Scenario | Description | Key Concept |
|----------|-------------|-------------|
| **A. Hello Edge** | Single node, single index | Simplicity of getting started |
| **B. Multi-Index Routing** | Route by sourcetype | Replaces outputs.conf |
| **C. GDPR Compliance** | Geographic routing | Data residency at the edge |
| **D. Edge Aggregation** | Pre-aggregate metrics | 99% bandwidth savings |
| **E. Fleet at Scale** | N nodes, 3 regions | Central orchestration |

## Why Expanso Over Fat Forwarders?

| Aspect | Heavy Forwarder | Expanso Edge |
|--------|-----------------|--------------|
| Memory | 1-4 GB | 64 MB |
| Configuration | props.conf + transforms.conf | Single YAML file |
| Expertise | Splunk certification | Any developer |
| Routing | outputs.conf complexity | Bloblang logic |
| Compliance | Manual configuration | Built-in rules |

## Pipeline Files

```markdown
pipelines/
├── hello-edge.yaml      # Scenario A: Simple one-to-one
├── multi-index.yaml     # Scenario B: Sourcetype routing
├── gdpr-routing.yaml    # Scenario C: Geographic compliance
├── aggregation.yaml     # Scenario D: Edge aggregation
└── fleet-universal.yaml # Scenario E: Universal fleet pipeline
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SPLUNK_HEC_TOKEN` | `demo` | HEC authentication token |
| `EMIT_INTERVAL` | `500ms` | Data generation interval |

## Docker Compose

```bash
# Scale to any number of edge nodes
docker compose up -d --scale edge=12

# Each node randomly assigns itself to us/eu/apac region
# Events write to ./logs/<index>.log

tail -f logs/web.log        # Web traffic
tail -f logs/security.log   # Security events
tail -f logs/os.log         # Syslog
tail -f logs/metrics.log    # Metrics

# HTTP API
curl http://localhost:8088/indexes
curl http://localhost:8088/tail/web/20
```

## File Structure

```markdown
splunk-demo/
├── docs/
│   ├── index.html              # Interactive web demo
│   └── js/data-generators.js   # Sample data generation
├── pipelines/                  # Expanso pipeline configs
├── docker/
│   └── hec-receiver.py         # Mock HEC → local files
├── logs/                       # Output (one file per index)
├── docker-compose.yaml
└── README.md
```

## Learn More

- [Expanso Documentation](https://docs.expanso.io)
- [Bloblang Reference](https://docs.expanso.io/bloblang)
- [Splunk HEC Documentation](https://docs.splunk.com/Documentation/Splunk/latest/Data/UsetheHTTPEventCollector)
