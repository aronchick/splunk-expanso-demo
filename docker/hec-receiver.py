#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Mock Splunk HEC Receiver
Accepts HTTP Event Collector format and writes events to local index files.
Each index gets its own file: logs/web.log, logs/security.log, etc.
"""

import http.server
import json
import os
import sys
from datetime import datetime
from pathlib import Path

REGION = os.environ.get('REGION', 'US')
LOG_DIR = Path(os.environ.get('LOG_DIR', './logs'))
PORT = int(os.environ.get('PORT', '8088'))

# Ensure log directory exists
LOG_DIR.mkdir(parents=True, exist_ok=True)

# Index log files (opened on demand)
INDEX_FILES = {}


def get_index_file(index_name):
    """Get or create a file handle for an index."""
    if index_name not in INDEX_FILES:
        filepath = LOG_DIR / f"{index_name}.log"
        INDEX_FILES[index_name] = open(filepath, 'a', buffering=1)
    return INDEX_FILES[index_name]


def log_event(event_data):
    """Log an event to the appropriate index file."""
    index = event_data.get('index', 'main')
    host = event_data.get('host', 'unknown')
    sourcetype = event_data.get('sourcetype', 'unknown')
    source = event_data.get('source', 'unknown')
    event = event_data.get('event', '')

    # Extract region from fields (sent by pipeline) or fall back to server's region
    fields = event_data.get('fields', {})
    region = fields.get('region', REGION)

    # Handle event as string or dict
    if isinstance(event, dict):
        event_str = json.dumps(event)
    else:
        event_str = str(event)

    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]

    # JSON format for easy parsing
    log_entry = {
        'timestamp': timestamp,
        'host': host,
        'source': source,
        'sourcetype': sourcetype,
        'index': index,
        'region': region,
        'event': event_str
    }

    # Write JSON line to index file
    f = get_index_file(index)
    f.write(json.dumps(log_entry) + '\n')

    # Also print summary to stdout
    print(f"[{REGION}][{index}] {host} {sourcetype}: {event_str[:80]}"
          f"{'...' if len(event_str) > 80 else ''}")
    sys.stdout.flush()


class HECHandler(http.server.BaseHTTPRequestHandler):
    """HTTP Handler for Splunk HEC requests."""

    def log_message(self, format, *args):
        """Suppress default HTTP logging."""
        pass

    def send_cors_headers(self):
        """Send CORS headers for browser access."""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        """Health check and index list endpoints."""
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'healthy',
                'region': REGION,
                'log_dir': str(LOG_DIR)
            }).encode())

        elif self.path == '/indexes':
            # List available index files
            indexes = [f.stem for f in LOG_DIR.glob('*.log')]
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'indexes': indexes}).encode())

        elif self.path.startswith('/tail/'):
            # Tail last N lines from an index
            parts = self.path.split('/')
            index_name = parts[2] if len(parts) > 2 else 'main'
            lines = int(parts[3]) if len(parts) > 3 else 50

            filepath = LOG_DIR / f"{index_name}.log"
            if filepath.exists():
                with open(filepath, 'r') as f:
                    all_lines = f.readlines()
                    tail_lines = all_lines[-lines:]

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({
                    'index': index_name,
                    'total_lines': len(all_lines),
                    'lines': [json.loads(l) for l in tail_lines if l.strip()]
                }).encode())
            else:
                self.send_response(404)
                self.send_header('Content-Type', 'application/json')
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': f'Index {index_name} not found'
                }).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        """Handle HEC event submissions."""
        if self.path.startswith('/services/collector'):
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')

            try:
                # Try parsing as single JSON object first
                if body.strip().startswith('['):
                    events = json.loads(body)
                else:
                    # Could be newline-delimited JSON
                    events = []
                    for line in body.strip().split('\n'):
                        if line.strip():
                            events.append(json.loads(line))

                # Process each event
                for event_data in events if isinstance(events, list) else [events]:
                    log_event(event_data)

                # Return success
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({
                    'text': 'Success',
                    'code': 0
                }).encode())

            except json.JSONDecodeError as e:
                print(f"[{REGION}] JSON parse error: {e}", file=sys.stderr)
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({
                    'text': 'Invalid JSON',
                    'code': 6
                }).encode())

            except Exception as e:
                print(f"[{REGION}] Error processing event: {e}", file=sys.stderr)
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({
                    'text': 'Internal error',
                    'code': 8
                }).encode())
        else:
            self.send_response(404)
            self.end_headers()


def main():
    """Start the HEC receiver server."""
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║           Mock Splunk HEC Receiver                           ║
╠══════════════════════════════════════════════════════════════╣
║  Region:    {REGION:<48} ║
║  Log Dir:   {str(LOG_DIR):<48} ║
║  Port:      {PORT:<48} ║
╠══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                  ║
║    POST /services/collector/event  - Submit events           ║
║    GET  /health                    - Health check            ║
║    GET  /indexes                   - List index files        ║
║    GET  /tail/<index>/<n>          - Tail last N lines       ║
╚══════════════════════════════════════════════════════════════╝
""")

    server = http.server.HTTPServer(('0.0.0.0', PORT), HECHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print(f"\n[{REGION}] Shutting down...")
    finally:
        for f in INDEX_FILES.values():
            f.close()


if __name__ == '__main__':
    main()
