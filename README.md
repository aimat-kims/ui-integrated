# Model Template - Complete Setup Guide

This is a template for creating and deploying machine learning models with a web API. Follow these steps **in order** to set up your model.

## 🚀 Quick Overview
This template provides:
- A web interface to test your model
- An API endpoint for programmatic access
- Automatic input/output validation
- Easy configuration system

## 📋 Step-by-Step Setup

### Step 1: Configure Your Model's Input and Output
**File to edit: [`utils/config.py`](utils/config.py)**

This file defines what data your model expects as input and what it will return as output.

#### What you need to do:
1. Open [`utils/config.py`](utils/config.py)
2. Change `MODEL_NAME` to your actual model name (e.g., "image_classifier", "price_predictor")
3. Update `MODEL_VERSION` if needed
4. **Configure INPUT_FEATURE_LIST**: This defines what inputs your model needs
   - `name`: The name of the input feature (e.g., "age", "income", "image_url")
   - `type`: The data type - can be "float", "int", "string" or "image"
   - `value`: A sample/default value for testing
   - **Important for image data**: When using type "image", the value must be a base64-encoded string of the image

5. **Configure MODEL_PREDICTION_TEMPLATE**: This defines what your model will output
   - `name`: The name of the output (e.g., "prediction", "confidence", "category")
   - `type`: The data type of the output - can be "float", "int", "string", "image", or "plot"
   - **Important for image output**: When using type "image", the output value must be a base64-encoded string of the generated image
   - **Important for plot output**: When using type "plot", include `x`, `y`, `x_label`, and `y_label` in the output value structure

#### Example:
```python
MODEL_NAME = "house_price_predictor"
INPUT_FEATURE_LIST = [
    {"name": "bedrooms", "type": "int", "value": 3},
    {"name": "square_feet", "type": "float", "value": 1500.0},
    {"name": "location", "type": "string", "value": "downtown"}
]
MODEL_PREDICTION_TEMPLATE = [
    {"name": "predicted_price", "type": "float"},
    {"name": "confidence", "type": "float"}
]
```

#### Example with Plot Output:
```python
MODEL_NAME = "Sample Model output Plot"
INPUT_FEATURE_LIST = [
    {"name": "bedrooms", "type": "int", "value": 3},
    {"name": "square_feet", "type": "float", "value": 1500.0},
    {"name": "location", "type": "string", "value": "downtown"}
]
MODEL_PREDICTION_TEMPLATE = [
    {
        "name": "predicted plot",
        "type": "plot",
    }
]
```

#### Example with Image Input:
```python
MODEL_NAME = "image_classifier"
INPUT_FEATURE_LIST = [
    {"name": "image", "type": "image", "value": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="}
]
MODEL_PREDICTION_TEMPLATE = [
    {"name": "predicted_class", "type": "string"},
    {"name": "confidence", "type": "float"}
]
```

#### Example with Image Output (e.g., Image Generation Model):
```python
MODEL_NAME = "image_generator"
INPUT_FEATURE_LIST = [
    {"name": "prompt", "type": "string", "value": "a beautiful sunset"},
    {"name": "style", "type": "string", "value": "realistic"}
]
MODEL_PREDICTION_TEMPLATE = [
    {"name": "generated_image", "type": "image"},
    {"name": "generation_time", "type": "float"}
]
```

**Note**: For Plot outputs, the `value` should be a dictionary containing:
- `x`: List of x-coordinates
- `y`: List of y-coordinates
- `x_label`: Label for the x-axis
- `y_label`: Label for the y-axis
- The len(x) should match len(y).


**Note**: For image inputs, you need to:
- Convert your image to base64 string format
- Use type "image" in the configuration
- In your inference code, decode the base64 string back to image format for processing

**Note**: For image outputs, you need to:
- Generate or process your image in your inference code
- Convert the output image to base64 string format before returning
- Use type "image" in the MODEL_PREDICTION_TEMPLATE

### Step 2: Implement Your Model Logic
**File to edit: [`utils/infer.py`](utils/infer.py)**

This is where you write the actual code that makes predictions.

#### What you need to do:
1. **Add your imports** in the "YOUR IMPORTS HERE" section
   ```python
   # YOUR IMPORTS HERE
   import pandas as pd
   import joblib
   import numpy as np
   import base64
   from PIL import Image
   import io
   # etc.
   ```

2. **Load your model** in the initialization section
   ```python
   # Initialize your model here
   model = joblib.load('path/to/your/model.pkl')
   # or however you load your specific model
   ```

3. **Implement the `run_infer` function**
   - The input `model_input` is a list of dictionaries with your configured inputs
   - Extract the values you need from this list
   - For image inputs, decode base64 string to image format
   - Run your model prediction
   - Return results in the same format as your `MODEL_PREDICTION_TEMPLATE` with actual predicted values

#### Example implementation with image processing:
```python
def run_infer(model_input: list):
    verify_types(model_input)  # Don't remove this
    
    # Convert input list to a dictionary for easier access
    input_dict = {item["name"]: item["value"] for item in model_input}
    
    # Example: Processing image input
    if "image" in input_dict:
        # Decode base64 string to image
        image_data = base64.b64decode(input_dict["image"])
        image = Image.open(io.BytesIO(image_data))
        # Process image for your model
        # processed_image = preprocess(image)
        # prediction = model.predict(processed_image)
    
    # Your prediction logic here
    results = [
        {"name": "predicted_class", "type": "string", "value": "cat"},
        {"name": "confidence", "type": "float", "value": 0.95}
    ]
    
    verify_types(results)  # Don't remove this
    return results
```

#### Example implementation with image output:
```python
def run_infer(model_input: list):
    verify_types(model_input)  # Don't remove this
    
    # Convert input list to a dictionary for easier access
    input_dict = {item["name"]: item["value"] for item in model_input}
    
    # Example: Generate image based on text prompt
    prompt = input_dict.get("prompt", "")
    style = input_dict.get("style", "")
    
    # Your image generation logic here
    # generated_image = model.generate(prompt, style)
    
    # Convert PIL Image to base64 string
    # buffered = io.BytesIO()
    # generated_image.save(buffered, format="PNG")
    # img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
    
    # For example purposes (replace with actual generation)
    img_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    
    results = [
        {"name": "generated_image", "type": "image", "value": img_base64},
        {"name": "generation_time", "type": "float", "value": 2.5}
    ]
    
    verify_types(results)  # Don't remove this
    return results
```

### Step 3: Install Dependencies
**File to edit: [`requirements.txt`](requirements.txt)** 

Add all the Python packages your model needs.

#### Common packages you might need:
```
fastapi==0.104.1
uvicorn==0.24.0
scikit-learn==1.3.2
pandas==2.1.4
numpy==1.24.4
joblib==1.3.2
tensorflow==2.15.0  # if using TensorFlow
torch==2.1.0  # if using PyTorch
```

#### Install the packages:
```bash
pip install -r requirements.txt
```

### Step 4: Test Your Model
Before starting the server, test your inference function:

```bash
python utils/infer.py
```

This will run your model with the sample inputs from your config and show you the output. **Make sure this works before proceeding!**

### Step 5: Start the Server
```bash
uvicorn main:app --port 8000
```

If port 8000 is busy, try:
```bash
uvicorn main:app --port 8001
```


### Step 6: Test Your Model

#### Option 1: Web Interface
Open your browser and go to: `http://localhost:8000`

You'll see a simple web page where you can:
- Enter input values
- Click "Run Inference" 
- See the results

#### Option 2: API Testing
Use curl, Postman, or any HTTP client:

```bash
curl -X POST "http://localhost:8000/infer/" \
     -H "Content-Type: application/json" \
     -d '{
       "model_input": [
         {"name": "bedrooms", "value": 3, "type": "int"},
         {"name": "square_feet", "value": 1500.0, "type": "float"},
         {"name": "location", "value": "downtown", "type": "string"}
       ]
     }'
```

#### Get Configuration:
```bash
curl http://localhost:8000/config
```

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

1. **"ModuleNotFoundError"**: You need to install missing packages in [`requirements.txt`](requirements.txt)
2. **"Port already in use"**: Change the port number (8001, 8002, etc.)
3. **"Type verification failed"**: Make sure your input/output matches the types in [`config.py`](utils/config.py)
4. **Model not loading**: Check your model file paths and make sure files exist

### Debug Mode:
To see detailed error messages, run with debug mode:
```bash
uvicorn main:app --port 8000 --reload --log-level debug
```

## 📁 File Structure
```
├── main.py              # FastAPI server (DON'T EDIT)
├── index.html           # Web interface (DON'T EDIT)
├── requirements.txt     # Python dependencies (EDIT THIS)
├── utils/
│   ├── config.py        # Model configuration (EDIT THIS)
│   ├── infer.py         # Your model logic (EDIT THIS)
│   └── verification.py  # Validation logic (DON'T EDIT)
└── checkpoints/         # Put your model files here
```

## 🎯 Summary
1. Edit `config.py` - Define inputs and outputs
2. Edit `infer.py` - Write your model code  
3. Edit `requirements.txt` - Add dependencies
4. Test with `python utils/infer.py`
5. Start server with `uvicorn main:app --port 8000`
6. Visit `http://localhost:8000` to test

**That's it! Your model is now running as a web API.** 🎉
