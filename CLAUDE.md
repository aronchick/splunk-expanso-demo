# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a demo project showcasing Expanso Edge as a lightweight alternative to Splunk's Heavy Forwarders. It demonstrates data pipeline configurations for log routing, GDPR compliance, and edge aggregation.

**The demo runs entirely locally using Docker Compose - no cloud services required.**

## Common Commands

```bash
# Start the demo with edge nodes
docker compose up -d --scale edge=6

# Watch logs by index
tail -f logs/web.log
tail -f logs/security.log
tail -f logs/os.log
tail -f logs/metrics.log

# Stop the demo
docker compose down

# HTTP API (mock HEC receiver)
curl http://localhost:8088/health
curl http://localhost:8088/indexes
curl http://localhost:8088/tail/web/20
```

## Architecture

### Components

- **Edge nodes**: Expanso Edge containers (`ghcr.io/expanso-io/expanso-edge:nightly`) that run pipeline configurations
- **HEC receiver**: Python mock of Splunk's HTTP Event Collector (`docker/hec-receiver.py`) that writes events to local log files
- **Web demo**: Browser-based demo at `docs/index.html`

### Pipeline Files (`pipelines/`)

Pipelines use YAML format with Bloblang for data transformation:

| File | Purpose |
|------|---------|
| `01-hello-edge.yaml` | Simplest pipeline: single index output |
| `02-multi-index.yaml` | Route events by sourcetype to different indexes |
| `03-gdpr-routing.yaml` | Geographic routing for GDPR compliance |
| `aggregation.yaml` | Pre-aggregate metrics at edge for bandwidth savings |

### Pipeline Structure

Each pipeline follows this pattern:
```yaml
config:
  input:
    generate:          # Data generator with Bloblang mapping
      interval: 500ms
      mapping: |
        # Bloblang code to generate events

  pipeline:
    processors:
      - bloblang: |
          # Transform and route logic
          meta "index" = "..."

  output:
    http_client:       # Send to HEC endpoint
      url: http://hec:8088/services/collector/event
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `EXPANSO_EDGE_BOOTSTRAP_URL` | Expanso Edge bootstrap URL |
| `EXPANSO_EDGE_BOOTSTRAP_TOKEN` | Expanso Edge auth token |
| `SPLUNK_HEC_TOKEN` | HEC authentication token (default: `demo`) |
| `EMIT_INTERVAL` | Data generation interval (default: `500ms`) |

## Key Concepts

- **Bloblang**: Expanso's transformation language used in pipeline processors
- **Switch output**: Routes messages to different outputs based on metadata conditions
- **Metadata (`meta`)**: Used to pass routing information between processors
