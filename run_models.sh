#!/bin/bash

# Initialize variables
MODELS_DIR="models"
STATUS_FILE="model_status.json"
BASE_PORT=8000
CURRENT_PORT=$BASE_PORT

# Initialize JSON file
echo "{" > $STATUS_FILE
echo "  \"timestamp\": \"$(date -Iso8601)\"," >> $STATUS_FILE
echo "  \"models\": {" >> $STATUS_FILE

# Function to check if port is available
is_port_available() {
    local port=$1
    ! nc -z localhost $port 2>/dev/null
}

# Function to find next available port
find_available_port() {
    local port=$BASE_PORT
    while ! is_port_available $port; do
        port=$((port + 1))
    done
    echo $port
}

# Counter for JSON formatting
model_count=0
total_models=$(find $MODELS_DIR -maxdepth 1 -type d ! -path $MODELS_DIR | wc -l)

# Loop through each folder in models directory
for model_dir in $MODELS_DIR/*/; do
    if [ -d "$model_dir" ]; then
        # Extract folder name and convert to lowercase
        model_name=$(basename "$model_dir" | tr '[:upper:]' '[:lower:]')
        
        echo "Processing model: $model_name"
        
        # Find available port
        CURRENT_PORT=$(find_available_port)
        
        # Change to model directory
        cd "$model_dir" || continue
        
        # Build Docker image
        echo "Building Docker image for $model_name..."
        if docker build -t "$model_name" . > "../build_${model_name}.log" 2>&1; then
            echo "Build successful for $model_name"
            
            # Run Docker container
            echo "Running Docker container for $model_name on port $CURRENT_PORT..."
            if docker run --rm --runtime=runc -d -p "$CURRENT_PORT:8000" --name "$model_name" "$model_name" > "../run_${model_name}.log" 2>&1; then
                echo "Container started successfully for $model_name on port $CURRENT_PORT"
                
                # Wait a moment to check if container is still running
                sleep 3
                if docker ps | grep -q "$model_name"; then
                    status="success"
                    port=$CURRENT_PORT
                else
                    status="failed"
                    port="null"
                    echo "Container failed to stay running for $model_name"
                fi
            else
                echo "Failed to start container for $model_name"
                status="failed"
                port="null"
            fi
        else
            echo "Build failed for $model_name"
            status="failed"
            port="null"
        fi
        
        # Add to JSON
        model_count=$((model_count + 1))
        echo -n "    \"$model_name\": {" >> "../../$STATUS_FILE"
        echo "\"status\": \"$status\", \"port\": $port}" >> "../../$STATUS_FILE"
        
        # Add comma if not the last model
        if [ $model_count -lt $total_models ]; then
            echo "," >> "../../$STATUS_FILE"
        else
            echo "" >> "../../$STATUS_FILE"
        fi
        
        # Go back to root directory
        cd - > /dev/null
        
        # Increment port for next model (even if current failed)
        CURRENT_PORT=$((CURRENT_PORT + 1))
    fi
done

# Close JSON file
echo "  }" >> $STATUS_FILE
echo "}" >> $STATUS_FILE

echo "All models processed. Status saved to $STATUS_FILE"

# Display running containers
echo ""
echo "Currently running containers:"
docker ps --filter "ancestor=$(docker images --format 'table {{.Repository}}' | grep -v REPOSITORY | tr '\n' '|' | sed 's/|$//')" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Display summary from JSON
echo ""
echo "Summary:"
if command -v jq > /dev/null 2>&1; then
    echo "Successful models:"
    jq -r '.models | to_entries[] | select(.value.status == "success") | "\(.key): port \(.value.port)"' $STATUS_FILE
    echo ""
    echo "Failed models:"
    jq -r '.models | to_entries[] | select(.value.status == "failed") | .key' $STATUS_FILE
else
    echo "Install jq for better JSON parsing, or check $STATUS_FILE manually"
fi