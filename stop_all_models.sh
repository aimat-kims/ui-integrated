#!/bin/bash

# Script to stop all running model containers
echo "Stopping all model containers..."

# Get all container names from the status file if it exists
if [ -f "model_status.json" ] && command -v jq > /dev/null 2>&1; then
    model_names=$(jq -r '.models | keys[]' model_status.json)
    for model in $model_names; do
        if docker ps | grep -q "$model"; then
            echo "Stopping container: $model"
            docker stop "$model" > /dev/null 2>&1
        fi
    done
else
    # Fallback: stop all containers that might be model containers
    echo "Stopping all running containers (no status file found)..."
    docker ps -q | xargs -r docker stop
fi

echo "All model containers stopped."