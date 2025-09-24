# Multi-Model Sequence Configuration
# Define your model sequence here - each model's output must match the next model's input

# Global sequence information
SEQUENCE_NAME = "your_sequence_name"
SEQUENCE_VERSION = "v1.0.0"

# Define each model in the sequence
MODEL_SEQUENCE = [
    {
        "id": "model_1",
        "name": "First Model",
        "description": "Description of the first model",
        "input_features": [
            {
                "name": "input_feature_1",
                "type": "float",
                "value": 0.3
            },
            {
                "name": "input_feature_2", 
                "type": "int",
                "value": 0
            },
            {
                "name": "input_feature_3",
                "type": "string",
                "value": "test"
            },
            {
                "name": "input_feature_4",
                "type": "image",
                "value": "test"
            }
        ],
        "output_template": [
            {
                "name": "intermediate_result_1",
                "type": "float"
            },
            {
                "name": "intermediate_result_2", 
                "type": "string"
            }
        ]
    },
    {
        "id": "model_2", 
        "name": "Second Model",
        "description": "Description of the second model",
        "input_features": [
            {
                "name": "intermediate_result_1",  # Must match previous model's output
                "type": "float",
                "value": 0.0
            },
            {
                "name": "intermediate_result_2",  # Must match previous model's output
                "type": "string", 
                "value": ""
            },
        ],
        "output_template": [
            {
                "name": "final_prediction",
                "type": "string"
            },
            {
                "name": "confidence_score",
                "type": "float" 
            },
            {
                "name": "result_plot",
                "type": "plot"
            }
        ]
    }
]

# Validation: Check that outputs match next model's inputs
def validate_model_sequence():
    """Validate that each model's output matches the next model's input requirements"""
    for i in range(len(MODEL_SEQUENCE) - 1):
        current_model = MODEL_SEQUENCE[i]
        next_model = MODEL_SEQUENCE[i + 1]
        
        current_outputs = {output['name']: output['type'] for output in current_model['output_template']}
        next_inputs = {input_item['name']: input_item['type'] for input_item in next_model['input_features']}
        
        # Check if outputs match some of the next model's inputs
        for output_name, output_type in current_outputs.items():
            if output_name in next_inputs:
                if next_inputs[output_name] != output_type:
                    raise ValueError(f"Type mismatch between {current_model['name']} output '{output_name}' ({output_type}) and {next_model['name']} input '{output_name}' ({next_inputs[output_name]})")
    
    return True

# Backward compatibility - keep these for existing code that might reference them
MODEL_NAME = SEQUENCE_NAME
MODEL_VERSION = SEQUENCE_VERSION
INPUT_FEATURE_LIST = MODEL_SEQUENCE[0]['input_features'] if MODEL_SEQUENCE else []
MODEL_PREDICTION_TEMPLATE = MODEL_SEQUENCE[-1]['output_template'] if MODEL_SEQUENCE else []

# Validate the sequence on import
try:
    validate_model_sequence()
    print(f"✅ Model sequence validation passed for {SEQUENCE_NAME}")
except Exception as e:
    print(f"❌ Model sequence validation failed: {e}")
    raise e