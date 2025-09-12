import base64

def verify_types(needed_verify_list):
    supported_types = {"image", "float", "int", "string", "plot"}
    for row in needed_verify_list:
        if 'type' not in row:
            raise ValueError("Missing 'type' key in row")
        if 'name' not in row:
            raise ValueError("Missing 'name' key in row")
        if 'value' not in row:
            raise ValueError("Missing 'value' key in row")
        
        if row['type'] not in supported_types:
            raise ValueError(f"Unsupported type: {row['type']}")
        
        if row['type'] == 'image':
            if not isinstance(row['value'], (str, bytes)):
                raise ValueError(f"Value for type 'image' must be a base64 string or bytes, got {type(row['value'])}")
            try:
                if isinstance(row['value'], str):
                    base64.b64decode(row['value'], validate=True)
                else:
                    base64.b64decode(row['value'], validate=True)
            except Exception as e:
                raise ValueError(f"Invalid base64 encoding for image: {e}")
            
        elif row['type'] == 'float':
            if not isinstance(row['value'], (float, int)):
                raise ValueError(f"Value for type 'float' must be a float or int, got {type(row['value'])}")
        elif row['type'] == 'int':
            if not isinstance(row['value'], int):
                raise ValueError(f"Value for type 'int' must be an int, got {type(row['value'])}")
        elif row['type'] == 'string':
            if not isinstance(row['value'], str):
                raise ValueError(f"Value for type 'string' must be a string, got {type(row['value'])}")
        elif row['type'] == 'plot':
            if not isinstance(row['value'], dict):
                raise ValueError(f"Value for type 'plot' must be a dict, got {type(row['value'])}")
            required_keys = {'x', 'y', 'x_label', 'y_label'}
            if not required_keys.issubset(row['value'].keys()):
                raise ValueError(f"Value for type 'plot' must contain keys: {required_keys}")
            if not isinstance(row['value']['x'], list) or not all(isinstance(i, (int, float)) for i in row['value']['x']):
                raise ValueError("The 'x' value in plot must be a list of numbers")
            if not isinstance(row['value']['y'], list) or not all(isinstance(i, (int, float)) for i in row['value']['y']):
                raise ValueError("The 'y' value in plot must be a list of numbers")
            if len(row['value']['x']) != len(row['value']['y']):
                raise ValueError("The 'x' and 'y' lists in plot must be of the same length")
            if not isinstance(row['value']['x_label'], str):
                raise ValueError("The 'x_label' value in plot must be a string")
            if not isinstance(row['value']['y_label'], str):
                raise ValueError("The 'y_label' value in plot must be a string")
        
    return True

