# Expanso Edge Demo - Splunk App

This Splunk app provides indexes, saved searches, and dashboards for monitoring data from Expanso Edge pipelines.

## Installation

### Option 1: Copy to Splunk apps directory

```bash
# Copy the app directory
cp -r expanso_edge_demo $SPLUNK_HOME/etc/apps/

# Restart Splunk
$SPLUNK_HOME/bin/splunk restart
```

### Option 2: Install via Splunk Web

1. Package the app: `tar -czf expanso_edge_demo.tgz expanso_edge_demo`
2. Go to Splunk Web → Apps → Manage Apps → Install app from file
3. Upload `expanso_edge_demo.tgz`

## Included Components

### Indexes

| Index | Description | Data Types |
|-------|-------------|------------|
| `web` | Web traffic | Apache access logs |
| `security` | Security events | Error logs, auth failures |
| `os` | System events | Syslog |
| `metrics` | Metrics data | IoT sensors, infrastructure |
| `us_main` | US regional storage | All US/APAC data |
| `eu_main` | EU regional storage | GDPR-compliant EU data |

### Dashboards

- **Overview** - Fleet-wide metrics and KPIs
- **Web Traffic** - Apache access log analysis
- **Security** - Error logs and security events
- **GDPR Compliance** - Geographic data distribution
- **Fleet Status** - Node health monitoring

### Saved Searches

Pre-built searches for common analysis tasks:
- Event volume by index/host/region
- HTTP status code distribution
- Error rate monitoring
- GDPR compliance reporting
- Node health checks

### Alerts

- **High Error Rate** - Triggers when error count exceeds threshold
- **Node Offline** - Triggers when a node stops sending data

## HEC Configuration

The app includes an HEC token configuration. Update the token in `inputs.conf`:

```ini
[http://expanso_edge_token]
token = your-secure-token-here
```

## Usage with Expanso Edge

Configure your Expanso Edge pipelines to send to this Splunk instance:

```bash
export SPLUNK_HEC_ENDPOINT=https://your-splunk:8088
export SPLUNK_HEC_TOKEN=your-secure-token-here
expanso-edge run pipelines/fleet-universal.yaml
```
