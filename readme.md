# UI Integrated Project

This project contains multiple AI models that need to be built and run before starting the main application.

## Prerequisites

- Docker installed and running
- Python environment with required packages
- Bash shell access

## Setup and Running Instructions

Follow these steps in order to properly run the application:

### 1. Make Shell Scripts Executable

First, Create `models/` folder and put all your model templates there.

Then, make the shell scripts executable by running:

```bash
chmod +x run_models.sh
chmod +x stop_all_models.sh
```

### 2. Stop All Running Models

Stop any previously running models:

```bash
./stop_all_models.sh
```

### 3. Start All Models

Run all the models using:

```bash
./run_models.sh
```

This script will build and start Docker containers for all the AI models in the `models/` directory.

### 4. Check Model Status

After running the models, check that all models have started successfully:

```bash
cat model_status.json
```

Wait until all models show `"status": "success"` in the JSON file. This may take several minutes depending on your system.

### 5. Run Main Application

Once all models are successfully running, install dependencies and then start the main application:

```bash
pip install -r requirements.txt
python main.py
```

### 6. Access the Application

Open your web browser and navigate to:

```
http://localhost:8092
```

## Troubleshooting

- If models fail to start, check the individual log files in the `models/` directory (files starting with `build_` or `run_`)
- Make sure Docker is running before executing the scripts
- Ensure all required ports are available and not in use by other applications
- If the main application fails to start, check that all dependencies in `requirements.txt` are installed

## Project Structure

- `main.py` - Main application server
- `run_models.sh` - Script to start all AI models
- `stop_all_models.sh` - Script to stop all running models  
- `model_status.json` - Status file showing the state of all models
- `models/` - Directory containing individual AI model templates
- `templates/` - HTML templates for the web interface
- `requirements.txt` - Python dependencies

sudo lsof -i:8092