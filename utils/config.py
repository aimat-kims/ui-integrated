
MODEL_NAME="your_model_name"
MODEL_VERSION="v1.0.0"
INPUT_FEATURE_LIST=[
    {
        "name": "your_input_name1",
        "type": "float",
        "value": 0.3
    },
    {
        "name": "your_input_name2",
        "type": "int",
        "value": 0
    },
    {
        "name": "your_input_name3",
        "type": "string",
        "value": "test"
    },
    {
        "name": "your_input_name4",
        "type": "float",
        "value": 0.2
    }
]

MODEL_PREDICTION_TEMPLATE=[
    {
        "name": "your_output_name1",
        "type": "string",
    },
    {
        "name": "your_output_name2",
        "type": "float",
    },
    {
        "name": "your_output_name3",
        "type": "plot",
    },
]