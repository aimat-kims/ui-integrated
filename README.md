# Model Sequence Template - Complete Setup Guide

This is a template for creating and deploying **multi-model sequences** with a web API. Define a sequence of models where the output of one model becomes the input to the next model. Follow these steps **in order** to set up your model sequence.

## 🚀 Quick Overview
This template provides:
- A web interface to test your model sequence step-by-step
- Support for running individual models or the entire sequence
- An API endpoint for programmatic access
- Automatic input/output validation and sequence validation
- Easy configuration system for multi-model workflows

## 📋 Step-by-Step Setup

### Step 1: Configure Your Model Sequence
**File to edit: [`utils/config.py`](utils/config.py)**

This file defines your sequence of models, their inputs, outputs, and how they connect together.

#### What you need to do:
1. Open [`utils/config.py`](utils/config.py)
2. Change `SEQUENCE_NAME` to your actual sequence name (e.g., "image_processing_pipeline", "data_analysis_workflow")
3. Update `SEQUENCE_VERSION` if needed
4. **Configure MODEL_SEQUENCE**: This defines each model in your sequence
   - Each model has: `id`, `name`, `description`, `input_features`, `output_template`
   - **Critical**: Output of model N must match input requirements of model N+1
   - The system automatically validates sequence connectivity

#### Example Multi-Model Sequence:
```python
SEQUENCE_NAME = "image_analysis_pipeline"
SEQUENCE_VERSION = "v1.0.0"

MODEL_SEQUENCE = [
    {
        "id": "image_preprocessor",
        "name": "Image Preprocessor", 
        "description": "Preprocesses and enhances input images",
        "input_features": [
            {"name": "raw_image", "type": "image", "value": "base64_string_here"},
            {"name": "enhancement_level", "type": "float", "value": 0.5}
        ],
        "output_template": [
            {"name": "processed_image", "type": "image"},
            {"name": "image_metadata", "type": "string"}
        ]
    },
    {
        "id": "object_detector",
        "name": "Object Detector",
        "description": "Detects objects in the processed image", 
        "input_features": [
            {"name": "processed_image", "type": "image", "value": ""},  # From previous model
            {"name": "confidence_threshold", "type": "float", "value": 0.7}
        ],
        "output_template": [
            {"name": "detection_results", "type": "string"},
            {"name": "detection_plot", "type": "plot"}
        ]
    }
]
```

#### Important Notes:
- **Sequence Connectivity**: The output `processed_image` from the first model automatically becomes input to the second model
- **Additional Inputs**: Each model can have additional inputs not from previous models
- **Type Matching**: Output type must exactly match input type for connected features
- **Automatic Validation**: The system validates your sequence on startup

#### Supported Data Types:
- `"float"`: Floating point numbers
- `"int"`: Integers  
- `"string"`: Text data
- `"image"`: Base64-encoded images
- `"plot"`: Plot data with x, y coordinates and labels

### Step 2: Implement Your Model Logic
**File to edit: [`utils/infer.py`](utils/infer.py)**

This is where you write the actual code for each model in your sequence.

#### What you need to do:
1. **Add your imports** in the "YOUR IMPORTS HERE" section
2. **Load your models** in the initialization section
3. **Implement the `run_infer_single_model` function** for individual model inference
4. The `run_infer` function (full sequence) is already implemented and calls your single model function

#### Example implementation:
```python
# YOUR IMPORTS HERE
import pandas as pd
import joblib
import numpy as np
import base64
from PIL import Image
import io

# Initialize your models here
# image_preprocessor = load_model("preprocessor.pkl") 
# object_detector = load_model("detector.pkl")

def run_infer_single_model(model_input: list, model_id: str):
    verify_types(model_input)  # Don't remove this
    
    # Convert input to dictionary for easier access
    input_dict = {item["name"]: item["value"] for item in model_input}
    
    # Find model configuration
    model_config = None
    for model in MODEL_SEQUENCE:
        if model['id'] == model_id:
            model_config = model
            break
    
    if model_id == "image_preprocessor":
        # Handle image preprocessing
        raw_image_b64 = input_dict.get("raw_image")
        enhancement_level = input_dict.get("enhancement_level", 0.5)
        
        # Decode image, process it, encode back to base64
        # image_data = base64.b64decode(raw_image_b64)
        # image = Image.open(io.BytesIO(image_data))
        # processed = enhance_image(image, enhancement_level)
        # processed_b64 = encode_image_to_base64(processed)
        
        results = [
            {"name": "processed_image", "type": "image", "value": "processed_base64_here"},
            {"name": "image_metadata", "type": "string", "value": "metadata_info"}
        ]
        
    elif model_id == "object_detector":
        # Handle object detection
        processed_image_b64 = input_dict.get("processed_image")
        confidence_threshold = input_dict.get("confidence_threshold", 0.7)
        
        # Run detection on processed image
        # detections = detector.detect(processed_image_b64, confidence_threshold)
        
        results = [
            {"name": "detection_results", "type": "string", "value": "detected: car, person"},
            {"name": "detection_plot", "type": "plot", "value": {
                "x": [0, 1, 2, 3],
                "y": [0.8, 0.9, 0.7, 0.85],
                "x_label": "Objects",
                "y_label": "Confidence"
            }}
        ]
    
    else:
        raise ValueError(f"Unknown model_id: {model_id}")
    
    verify_types(results)  # Don't remove this
    return results
```

### Step 3: Install Dependencies
**File to edit: [`requirements.txt`](requirements.txt)**

Add all the Python packages your models need.

#### Example for a typical ML sequence:
```
fastapi==0.104.1
uvicorn==0.24.0
scikit-learn==1.3.2
pandas==2.1.4
numpy==1.24.4
joblib==1.3.2
pillow==10.0.1
opencv-python==4.8.1.78
tensorflow==2.15.0  # if using TensorFlow
torch==2.1.0  # if using PyTorch
```

#### Install the packages:
```bash
pip install -r requirements.txt
```

### Step 4: Test Your Model Sequence
Before starting the server, test your sequence:

```bash
python utils/infer.py
```

This will:
- Validate your sequence configuration
- Test the first model with sample inputs
- Test the full sequence end-to-end
- Show you the output from each step

**Make sure this works before proceeding!**

### Step 5: Start the Server
```bash
uvicorn main:app --port 8000
```

If port 8000 is busy, try:
```bash
uvicorn main:app --port 8001
```

### Step 6: Test Your Model Sequence

#### Option 1: Web Interface (Step-by-Step Mode)
Open your browser and go to: `http://localhost:8000`

You'll see a web interface with two modes:

**Step-by-Step Mode (Recommended for development)**:
- Shows sequence progress with visual indicators
- Run one model at a time
- See intermediate outputs between models
- Use "Next Model" button to proceed through sequence
- Auto-fills inputs from previous model outputs

**Full Sequence Mode**:
- Runs all models automatically
- Only shows final output
- Good for production use

#### Option 2: API Testing

**Run Single Model**:
```bash
curl -X POST "http://localhost:8000/infer-single/" \
     -H "Content-Type: application/json" \
     -d '{
       "model_id": "image_preprocessor",
       "model_input": [
         {"name": "raw_image", "value": "base64_image_data", "type": "image"},
         {"name": "enhancement_level", "value": 0.5, "type": "float"}
       ]
     }'
```

**Run Full Sequence**:
```bash
curl -X POST "http://localhost:8000/infer/" \
     -H "Content-Type: application/json" \
     -d '{
       "model_input": [
         {"name": "raw_image", "value": "base64_image_data", "type": "image"},
         {"name": "enhancement_level", "value": 0.5, "type": "float"}
       ]
     }'
```

**Get Sequence Information**:
```bash
curl http://localhost:8000/sequence-info
```

**Prepare Next Model Input**:
```bash
curl -X POST "http://localhost:8000/prepare-next/" \
     -H "Content-Type: application/json" \
     -d '{
       "current_model_id": "image_preprocessor",
       "current_output": [
         {"name": "processed_image", "value": "base64_data", "type": "image"},
         {"name": "image_metadata", "value": "metadata", "type": "string"}
       ]
     }'
```

#### CSV Batch Processing (Full Sequence Only)
For models without image inputs/outputs, you can upload CSV files for batch processing:
- Upload a CSV with columns matching your first model's inputs
- Get back a CSV with your original data plus final model outputs
- Perfect for processing large datasets through your entire sequence

### Step 7: Docker Testing
**📖 Read and follow: [TestDocker.md](TestDocker.md)**

For production deployment or testing in an isolated environment, you should test your model using Docker:

1. **Configure Docker** (if needed):
   - Change Python version in [`Dockerfile`](Dockerfile) if required
   - Switch to GPU-enabled base image if your model needs GPU acceleration

2. **Build and run your model in Docker**:
   ```bash
   docker build -t model-template .
   docker run -p 8000:8000 model-template
   ```

3. **Verify everything works** without errors:
   - Container builds successfully
   - Server starts and stays running
   - Web interface loads at `http://localhost:8000`
   - API endpoints respond correctly

**📋 Important**: Make sure all steps in [TestDocker.md](TestDocker.md) complete successfully before considering your model deployment-ready.


## 🔧 Troubleshooting

### Common Issues:

1. **"Sequence validation failed"**: Check that output names/types from model N match input names/types for model N+1
2. **"Model with id 'xxx' not found"**: Ensure your model_id in the sequence matches what you handle in `run_infer_single_model`
3. **"ModuleNotFoundError"**: You need to install missing packages in [`requirements.txt`](requirements.txt)
4. **"Port already in use"**: Change the port number (8001, 8002, etc.)
5. **"Type verification failed"**: Make sure your input/output matches the types in [`config.py`](utils/config.py)

### Debug Mode:
To see detailed error messages, run with debug mode:
```bash
uvicorn main:app --port 8000 --reload --log-level debug
```

## 📁 File Structure
```
├── main.py              # FastAPI server with sequence endpoints (DON'T EDIT)
├── fe/
│   ├── index.html       # Web interface (DON'T EDIT)  
│   ├── main.js          # Frontend logic with sequence support (DON'T EDIT)
│   └── style.css        # Styling with sequence UI (DON'T EDIT)
├── requirements.txt     # Python dependencies (EDIT THIS)
├── utils/
│   ├── config.py        # Sequence configuration (EDIT THIS)
│   ├── infer.py         # Your model logic (EDIT THIS)
│   └── verification.py  # Validation logic (DON'T EDIT)
└── checkpoints/         # Put your model files here
```

## 🎯 Summary
1. Edit `config.py` - Define your model sequence, inputs and outputs
2. Edit `infer.py` - Write your model code for each model in the sequence
3. Edit `requirements.txt` - Add dependencies
4. Test with `python utils/infer.py`
5. Start server with `uvicorn main:app --port 8000`
6. Visit `http://localhost:8000` to test step-by-step or full sequence

## 🔄 Sequence Features
- **Step-by-step execution**: Run models individually with intermediate inspection
- **Automatic data flow**: Output from model N becomes input to model N+1
- **Sequence validation**: Automatic checking of model connectivity
- **Visual progress tracking**: See which models are completed/active/pending
- **Flexible inputs**: Each model can have additional inputs beyond previous outputs
- **Multiple inference modes**: Step-by-step for development, full sequence for production
- **Batch processing**: CSV upload for processing multiple records through the entire sequence

**That's it! Your model sequence is now running as a web API.** 🎉
