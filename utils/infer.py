# PLEASE DO NOT CHANGE THIS FILE NAME
# PLEASE DO NOT CHANGE THE FUNCTION SIGNATURES
# PLEASE DO NOT REMOVE THESE IMPORTS
import os
from utils.verification import *
from utils.config import *

# YOUR IMPORTS HERE
# ================================================================

# ================================================================

# Initialize your models here
# ================================================================
# For example, if you are using machine learning models, you can load them here
# model_1 = load_your_model_function("model_1")
# model_2 = load_your_model_function("model_2")
# etc.
# ================================================================

def run_infer_single_model(model_input: list, model_id: str): # PLEASE DO NOT CHANGE THE FUNCTION SIGNATURE
    """
    Run inference for a single model in the sequence
    """
    verify_types(model_input) # PLEASE DO NOT REMOVE THIS LINE
    
    # Find the model configuration
    model_config = None
    for model in MODEL_SEQUENCE:
        if model['id'] == model_id:
            model_config = model
            break
    
    if not model_config:
        raise ValueError(f"Model with id '{model_id}' not found in sequence")
    
    # YOUR INFERENCE LOGIC HERE
    # ================================================================
    # model_input is now a list of objects with structure:
    # [
    #     {"name": "feature1", "value": 0.5, "type": "float"},
    #     {"name": "feature2", "value": 10, "type": "int"},
    #     {"name": "feature3", "value": "text", "type": "string"}
    # ]
    # 
    # Example of how to extract values by name:
    # input_dict = {item["name"]: item["value"] for item in model_input}
    # feature1_value = input_dict.get("feature1")
    # 
    # Process the model_input and return results in the same format as the model's output_template
    
    # Get the output template for this specific model
    results = model_config['output_template'].copy() # <= REPLACE THIS LINE WITH YOUR ACTUAL INFERENCE LOGIC
    
    # Example of populating results (this is just a placeholder, replace with actual model inference)
    for output in results:
        if output["type"] == "string":
            output["value"] = f"predicted_value_from_{model_id}"  # Replace with actual prediction
        elif output["type"] == "float":
            output["value"] = 0.5 if model_id == "model_1" else 0.8  # Replace with actual prediction
        elif output["type"] == "int":
            output["value"] = 1  # Replace with actual prediction
        elif output["type"] == "plot":
            output["value"] = {
                "x": [0, 1, 2, 3],
                "y": [0, 1, 4, 9],
                "x_label": "X-axis",
                "y_label": "Y-axis",
            }
            
    # ================================================================

    verify_types(results) # PLEASE DO NOT REMOVE THIS LINE
    return results

def run_infer(model_input: list): # PLEASE DO NOT CHANGE THE FUNCTION SIGNATURE
    """
    Run inference for the entire model sequence (for backward compatibility with single inference)
    This runs all models in sequence automatically
    """
    verify_types(model_input) # PLEASE DO NOT REMOVE THIS LINE
    
    current_input = model_input
    
    # Run through each model in sequence
    for i, model_config in enumerate(MODEL_SEQUENCE):
        model_id = model_config['id']
        
        # For the first model, use the provided input
        if i == 0:
            current_output = run_infer_single_model(current_input, model_id)
        else:
            # For subsequent models, combine previous output with any additional inputs needed
            next_model_inputs = model_config['input_features']
            
            # Create input for next model
            next_input = []
            output_dict = {item["name"]: item for item in current_output}
            
            for input_feature in next_model_inputs:
                if input_feature['name'] in output_dict:
                    # Use output from previous model
                    next_input.append(output_dict[input_feature['name']])
                else:
                    # Use default value or prompt for additional input
                    # For now, use default value from config
                    next_input.append({
                        'name': input_feature['name'],
                        'value': input_feature['value'],
                        'type': input_feature['type']
                    })
            
            current_output = run_infer_single_model(next_input, model_id)
        
        current_input = current_output
    
    return current_output

def get_model_by_id(model_id: str):
    """
    Get model configuration by ID
    """
    for model in MODEL_SEQUENCE:
        if model['id'] == model_id:
            return model
    return None

def get_next_model_id(current_model_id: str):
    """
    Get the next model ID in the sequence
    """
    for i, model in enumerate(MODEL_SEQUENCE):
        if model['id'] == current_model_id and i < len(MODEL_SEQUENCE) - 1:
            return MODEL_SEQUENCE[i + 1]['id']
    return None

def prepare_next_model_input(current_output: list, next_model_id: str, additional_inputs: dict = None):
    """
    Prepare input for the next model using current output and any additional inputs
    """
    next_model = get_model_by_id(next_model_id)
    if not next_model:
        raise ValueError(f"Model with id '{next_model_id}' not found")
    
    next_input = []
    output_dict = {item["name"]: item for item in current_output}
    
    for input_feature in next_model['input_features']:
        if input_feature['name'] in output_dict:
            # Use output from previous model
            next_input.append(output_dict[input_feature['name']])
        elif additional_inputs and input_feature['name'] in additional_inputs:
            # Use additional input provided
            next_input.append({
                'name': input_feature['name'],
                'value': additional_inputs[input_feature['name']],
                'type': input_feature['type']
            })
        else:
            # Use default value
            next_input.append({
                'name': input_feature['name'],
                'value': input_feature['value'],
                'type': input_feature['type']
            })
    
    return next_input

# YOU CAN ADD MORE FUNCTIONS IF NEEDED
# ================================================================

# ================================================================

if __name__ == "__main__":
    # For local testing only
    print("Testing Model Sequence...")
    
    # Test first model
    sample_input = MODEL_SEQUENCE[0]['input_features']
    print(f"\nTesting {MODEL_SEQUENCE[0]['name']}:")
    print("Input:", sample_input)
    output = run_infer_single_model(sample_input, MODEL_SEQUENCE[0]['id'])
    print("Output:", output)
    
    # Test full sequence
    print(f"\nTesting full sequence:")
    full_output = run_infer(sample_input)
    print("Final Output:", full_output)