#!/usr/bin/env python3
"""
Mock Splunk HEC Receiver
Accepts HTTP Event Collector format and logs events to files and stdout.
Used for demo purposes when a real Splunk instance isn't available.
"""

import http.server
import json
import os
import sys
from datetime import datetime
from pathlib import Path

REGION = os.environ.get('REGION', 'US')
LOG_DIR = Path(os.environ.get('LOG_DIR', '/var/log/splunk'))
PORT = 8088

# Ensure log directory exists
LOG_DIR.mkdir(parents=True, exist_ok=True)

# Index log files
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

    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]

    # Format like Splunk raw log
    log_line = f"{timestamp} host={host} source={source} sourcetype={sourcetype} | {event}"

    # Write to index file
    f = get_index_file(index)
    f.write(log_line + '\n')

    # Also print to stdout for docker logs
    print(f"[{REGION}][{index}] {log_line[:120]}{'...' if len(log_line) > 120 else ''}")
    sys.stdout.flush()


class HECHandler(http.server.BaseHTTPRequestHandler):
    """HTTP Handler for Splunk HEC requests."""

    def log_message(self, format, *args):
        """Suppress default HTTP logging."""
        pass

    def do_GET(self):
        """Health check endpoint."""
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'healthy', 'region': REGION}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        """Handle HEC event submissions."""
        if self.path.startswith('/services/collector'):
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')

            # HEC can send multiple events, one per line or as JSON array
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
                self.end_headers()
                self.wfile.write(json.dumps({
                    'text': 'Success',
                    'code': 0
                }).encode())

            except json.JSONDecodeError as e:
                print(f"[{REGION}] JSON parse error: {e}", file=sys.stderr)
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'text': 'Invalid JSON',
                    'code': 6
                }).encode())

            except Exception as e:
                print(f"[{REGION}] Error processing event: {e}", file=sys.stderr)
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
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
    print(f"Starting Mock Splunk HEC Receiver")
    print(f"  Region: {REGION}")
    print(f"  Log directory: {LOG_DIR}")
    print(f"  Port: {PORT}")
    print(f"  Endpoints:")
    print(f"    POST /services/collector/event - Submit events")
    print(f"    GET  /health - Health check")
    print()

    server = http.server.HTTPServer(('0.0.0.0', PORT), HECHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print(f"\n[{REGION}] Shutting down...")
    finally:
        # Close all index files
        for f in INDEX_FILES.values():
            f.close()


if __name__ == '__main__':
    main()
