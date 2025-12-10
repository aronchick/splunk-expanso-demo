#!/usr/bin/env bash

# Script to manage a session of background tasks
# Compatible with both Linux and macOS (BSD) systems
#
# This script uses portable POSIX-compliant commands where possible:
# - Uses 'ps -o command=' instead of 'ps -o cmd=' for BSD compatibility
# - Handles process groups for better child process cleanup
# - Works with different locations of bash (via env)

# --- Configuration ---
SESSION_NAME="my_dev_session"
INSTANCE_ID="i-017e196cd2e5cd005"  # EC2 instance ID for SSM sessions
# Directory to store PID files and logs
STATE_DIR="$HOME/.${SESSION_NAME}"
PID_DIR="$STATE_DIR/pids"
LOG_DIR="$STATE_DIR/logs"
# File to store PIDs of background processes, one per line with a name:pid format
COMMAND_PIDS_FILE="$PID_DIR/pids.txt"

# --- Commands to be managed in the background ---
# Format: ["command_name"]="actual_command_to_run"
declare -A MANAGED_COMMANDS
MANAGED_COMMANDS=(
    ["ssm_port_8000"]="aws ssm start-session --target $INSTANCE_ID --document-name AWS-StartPortForwardingSession --parameters '{\"portNumber\":[\"8000\"],\"localPortNumber\":[\"8000\"]}' --region us-east-1"
    ["ssm_port_1234"]="aws ssm start-session --target $INSTANCE_ID --document-name AWS-StartPortForwardingSession --parameters '{\"portNumber\":[\"1234\"],\"localPortNumber\":[\"1234\"]}' --region us-east-1"
)

# --- Helper Functions ---

# Ensure PID and Log directories exist
ensure_dirs() {
    mkdir -p "$PID_DIR"
    mkdir -p "$LOG_DIR"
}

# Check for existing SSM sessions and prompt user
check_existing_ssm_sessions() {
    # Check for existing SSM sessions (both aws ssm commands and session-manager-plugin)
    # Note: session-manager-plugin may not have instance ID in command line, so we check for it separately
    local ssm_processes=$(ps aux | grep -E "(ssm start-session|session-manager-plugin)" | grep -v grep | grep -v "manage_session")
    
    if [ -n "$ssm_processes" ]; then
        echo "⚠️  Found existing SSM sessions running:"
        echo ""
        
        # Display the processes
        echo "$ssm_processes" | while IFS= read -r line; do
            local pid=$(echo "$line" | awk '{print $2}')
            local port=$(echo "$line" | grep -oE 'localPortNumber":\s*\["[0-9]+"\]' | grep -oE '[0-9]+' || echo "N/A")
            local process_type="SSM session"
            
            if echo "$line" | grep -q "session-manager-plugin"; then
                process_type="Session Manager Plugin"
            fi
            
            if [ "$port" != "N/A" ]; then
                echo "   - PID $pid ($process_type): Port forwarding on port $port"
            else
                echo "   - PID $pid ($process_type): General session"
            fi
        done
        
        echo ""
        read -p "Do you want to kill these existing SSM sessions? (y/N): " -n 1 -r
        echo ""
        
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "❌ Exiting without starting new services."
            echo "   You can manually kill the processes or use '$0 stop' if they were started by this script."
            exit 0
        else
            echo "🔪 Killing existing SSM sessions..."
            echo "$ssm_processes" | awk '{print $2}' | while read pid; do
                echo "   Killing PID $pid..."
                kill "$pid" 2>/dev/null || true
            done
            
            # Wait a moment for processes to terminate
            sleep 2
            
            # Check if any are still running and force kill if necessary
            local remaining=$(ps aux | grep -E "(ssm start-session.*$INSTANCE_ID|session-manager-plugin.*$INSTANCE_ID)" | grep -v grep)
            if [ -n "$remaining" ]; then
                echo "   Some processes still running, force killing..."
                echo "$remaining" | awk '{print $2}' | while read pid; do
                    kill -9 "$pid" 2>/dev/null || true
                done
                sleep 1
            fi
            
            echo "✅ Existing SSM sessions terminated."
            echo ""
        fi
    fi
}

# --- Main Functions ---

start_services() {
    ensure_dirs
    
    # Check for existing SSM sessions before proceeding
    check_existing_ssm_sessions
    
    if [ -f "$COMMAND_PIDS_FILE" ] && [ -s "$COMMAND_PIDS_FILE" ]; then
        echo "⚠️ Services might already be running (PID file exists and is not empty)."
        echo "   Run '$0 status' to check, or '$0 stop' first if you want to restart."
        # Check if PIDs are actually running
        local all_stopped=true
        while IFS= read -r line || [[ -n "$line" ]]; do
            pid=$(echo "$line" | cut -d: -f2)
            if ps -p "$pid" > /dev/null 2>&1; then
                all_stopped=false
                break
            fi
        done < "$COMMAND_PIDS_FILE"
        if [ "$all_stopped" = false ]; then
             return 1
        else
            echo "   PID file found, but no listed processes are running. Clearing old PID file."
            >"$COMMAND_PIDS_FILE"
        fi
    fi

    echo "🚀 Starting services..."

    echo "Starting background processes for SSM port forwarding:"
    # Clear any old PID file content before starting new processes
    >"$COMMAND_PIDS_FILE"

    for name in "${!MANAGED_COMMANDS[@]}"; do
        command_to_run="${MANAGED_COMMANDS[$name]}"
        log_file="$LOG_DIR/${name}.log"

        echo "   ⏳ Starting '$name'..."
        echo "      Command: $command_to_run"
        echo "      Log file: $log_file"

        # Execute the command in the background with nohup
        # Stderr is redirected to stdout (2>&1), then stdout is redirected to the log file
        nohup bash -c "$command_to_run" >"$log_file" 2>&1 &
        pid=$!

        # Store the command name and its PID
        echo "$name:$pid" >> "$COMMAND_PIDS_FILE"
        echo "      PID: $pid"
        sleep 1 # Small delay for process initialization, if needed
    done

    echo ""
    echo "✅ All specified SSM port forwarding services have been launched in the background."
    echo "   The script will now exit."
    echo "   You can use '$0 status' or '$0 stop' to manage these background services later."
}

stop_services() {
    ensure_dirs
    if [ ! -f "$COMMAND_PIDS_FILE" ] || ! [ -s "$COMMAND_PIDS_FILE" ]; then
        echo "🤷 PID file ($COMMAND_PIDS_FILE) not found or empty."
        echo "   Are the services running or were they started by this script?"
        return 1
    fi

    echo "🛑 Stopping services..."
    while IFS= read -r line || [[ -n "$line" ]]; do # process last line even if no newline
        name=$(echo "$line" | cut -d: -f1)
        pid=$(echo "$line" | cut -d: -f2)

        if ! [[ "$pid" =~ ^[0-9]+$ ]]; then
            echo "   ⚠️ Invalid PID found for $name: '$pid'. Skipping."
            continue
        fi

        echo -n "   Terminating '$name' (PID $pid)... "
        if ps -p "$pid" > /dev/null 2>&1; then
            # First, try to find and kill child processes
            # Note: pgrep -P is not available on all systems, so we handle both cases
            child_pids=""
            if command -v pgrep >/dev/null 2>&1 && pgrep -P "$pid" >/dev/null 2>&1; then
                # Get child PIDs using pgrep with parent PID (works on most modern systems)
                child_pids=$(pgrep -P "$pid" 2>/dev/null || true)
                if [ -n "$child_pids" ]; then
                    echo -n "(killing children: $child_pids) "
                fi
            fi
            
            # Try to kill the entire process group if possible
            # The negative PID kills all processes in the process group
            if kill -0 -"$pid" 2>/dev/null; then
                # Process group exists, kill it
                kill -TERM -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null
            else
                # Just kill the single process
                kill "$pid" 2>/dev/null
            fi
            
            sleep 2    # Wait for graceful shutdown
            
            # Kill child processes if they exist and weren't killed by process group
            if [ -n "$child_pids" ]; then
                for child_pid in $child_pids; do
                    if ps -p "$child_pid" > /dev/null 2>&1; then
                        kill "$child_pid" 2>/dev/null || true
                    fi
                done
            fi
            
            # Check if main process still exists
            if ps -p "$pid" > /dev/null 2>&1; then
                echo -n "Still alive, sending SIGKILL... "
                # Try process group kill first
                kill -9 -"$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null
                # Also force kill children
                if [ -n "$child_pids" ]; then
                    for child_pid in $child_pids; do
                        kill -9 "$child_pid" 2>/dev/null || true
                    done
                fi
                sleep 1
            fi

            if ps -p "$pid" > /dev/null 2>&1; then
                echo "❌ FAILED to stop."
            else
                echo "✔️ Stopped."
            fi
        else
            echo "💨 Process not found (already stopped or PID is stale)."
        fi
    done < "$COMMAND_PIDS_FILE"

    # Clean up the PID file after attempting to stop all processes
    echo "🗑️ Removing PID file: $COMMAND_PIDS_FILE"
    rm "$COMMAND_PIDS_FILE"

    echo "✅ Services stop process complete. Log files are retained in $LOG_DIR."
}

status_services() {
    ensure_dirs
    if [ ! -f "$COMMAND_PIDS_FILE" ] || ! [ -s "$COMMAND_PIDS_FILE" ]; then
        echo "ℹ️  PID file ($COMMAND_PIDS_FILE) not found or empty."
        echo "    No services seem to be actively managed by this script, or they were not started."
        echo "    You can try starting them with '$0 start'."
        # Optional: Search for processes by name if PID file is missing (more complex)
        # echo "Checking for known processes by name (this might find unrelated processes):"
        # for name in "${!MANAGED_COMMANDS[@]}"; do
        #     pgrep -lf "$(echo ${MANAGED_COMMANDS[$name]} | awk '{print $1;}')" | grep "$name" --color=auto
        # done
        return 1
    fi

    echo "📊 Status of managed services:"
    echo "--------------------------------"
    running_count=0
    total_count=0

    while IFS= read -r line || [[ -n "$line" ]]; do
        total_count=$((total_count + 1))
        name=$(echo "$line" | cut -d: -f1)
        pid=$(echo "$line" | cut -d: -f2)
        command_desc="${MANAGED_COMMANDS[$name]}" # Get the command for display

        echo "Service: $name"
        echo "  Expected PID: $pid"
        echo "  Command: $command_desc"
        echo "  Log File: $LOG_DIR/${name}.log"

        if ! [[ "$pid" =~ ^[0-9]+$ ]]; then
            echo "  Status: ⚠️ Invalid PID stored. Cannot check status."
            echo "--------------------------------"
            continue
        fi

        if ps -p "$pid" -o command= >/dev/null 2>&1 ; then
            # To be more certain, you could check if `ps -p $pid -o command=` contains parts of $command_desc
            process_cmd_output=$(ps -p "$pid" -o command= 2>/dev/null)
            echo "  Status: ✅ Running"
            # echo "     Actual command: $process_cmd_output" # Uncomment for verbose output
            running_count=$((running_count + 1))
        else
            echo "  Status: ❌ Not Running (or PID $pid has been reused by another process)"
        fi
        echo "--------------------------------"
    done < "$COMMAND_PIDS_FILE"

    if [ "$total_count" -eq 0 ]; then
        echo "No services found in the PID file, though the file exists."
    else
        echo "Summary: $running_count out of $total_count tracked services are actively running."
    fi
    echo "For detailed logs, check files in: $LOG_DIR"
    echo "Example: tail -f $LOG_DIR/brew_upgrade.log"
}

# --- Main script logic ---
# Determines action based on the first argument

# Ensure state directory exists for all operations
ensure_dirs

case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    status)
        status_services
        ;;
    *)
        echo "Usage: $0 {start|stop|status}"
        echo ""
        echo "Commands:"
        echo "  start   - Changes to ~/code/splunk-demo, displays SSH key, then starts all defined background services."
        echo "  stop    - Stops all background services managed by this script."
        echo "  status  - Reports the status of background services managed by this script."
        exit 1
        ;;
esac

exit 0