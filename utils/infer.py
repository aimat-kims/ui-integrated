# PLEASE DO NOT CHANGE THIS FILE NAME
# PLEASE DO NOT CHANGE THE FUNCTION SIGNATURE
# PLEASE DO NOT REMOVE THESE IMPORTS
import os
from utils.verification import *
from utils.config import *

# YOUR IMPORTS HERE
# ================================================================

# ================================================================

# Initialize your model here
# ================================================================
# For example, if you are using a machine learning model, you can load it here
# model = load_your_model_function(MODEL_NAME, MODEL_VERSION)
# ================================================================

def run_infer(model_input:list): # PLEASE DO NOT CHANGE THE FUNCTION SIGNATURE
    verify_types(model_input) # PLEASE DO NOT REMOVE THIS LINE
    
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
    # Process the model_input and return results in the same format as MODEL_PREDICTION_TEMPLATE
    results = MODEL_PREDICTION_TEMPLATE.copy() # <= REPLACE THIS LINE WITH YOUR INFERENCE LOGIC
    
    # Example of populating results (this is just a placeholder, replace with actual model inference)
    for output in results:
        if output["type"] == "string":
            output["value"] = "predicted_value"  # Replace with actual prediction
        elif output["type"] == "float":
            output["value"] = 0.0  # Replace with actual prediction
        elif output["type"] == "int":
            output["value"] = 0  # Replace with actual prediction
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

# YOU CAN ADD MORE FUNCTIONS IF NEEDED
# ================================================================

# ================================================================


if __name__ == "__main__":
    # For local testing only
    sample_input = INPUT_FEATURE_LIST
    output = run_infer(sample_input)
    print("Sample Inference Output:", output)