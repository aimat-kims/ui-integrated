import json
import asyncio
from datetime import datetime
import re
import os
import sys
import importlib.util
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import httpx
import uvicorn

app = FastAPI(title="Model API Gateway", description="Gateway to access all model APIs")

# Setup templates
templates = Jinja2Templates(directory="templates")

# Cache for model endpoints to avoid repeated API calls
model_endpoints_cache = {}

# Cache for model info to avoid repeated file reads
model_info_cache = {}

def load_model_config(model_folder_name):
    """Load model configuration from utils/config.py file"""
    if model_folder_name in model_info_cache:
        return model_info_cache[model_folder_name]
    
    # Map folder names to actual folder names (handle case differences)
    folder_mapping = {}
    models_dir = "models"
    if os.path.exists(models_dir):
        for folder in os.listdir(models_dir):
            if os.path.isdir(os.path.join(models_dir, folder)):
                folder_mapping[folder.lower().replace('-', '_').replace('.', '_')] = folder
    
    # Find actual folder name
    actual_folder = folder_mapping.get(model_folder_name.lower().replace('-', '_').replace('.', '_'))
    if not actual_folder:
        return None
    
    config_path = os.path.join("models", actual_folder, "utils", "config.py")
    
    if not os.path.exists(config_path):
        return None
    
    try:
        # Load the config module
        spec = importlib.util.spec_from_file_location("config", config_path)
        config_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(config_module)
        
        model_info = {
            "type": "single",
            "folder_name": actual_folder,
            "config_path": config_path
        }
        
        # Check if it's a sequence model
        if hasattr(config_module, 'SEQUENCE_NAME') and hasattr(config_module, 'MODEL_SEQUENCE'):
            model_info.update({
                "type": "sequence",
                "sequence_name": getattr(config_module, 'SEQUENCE_NAME', 'Unknown Sequence'),
                "sequence_version": getattr(config_module, 'SEQUENCE_VERSION', 'v1.0.0'),
                "model_sequence": getattr(config_module, 'MODEL_SEQUENCE', [])
            })
        else:
            # Single model
            model_info.update({
                "model_name": getattr(config_module, 'MODEL_NAME', 'Unknown Model'),
                "model_version": getattr(config_module, 'MODEL_VERSION', 'v1.0.0'),
                "model_description": getattr(config_module, 'MODEL_DESCRIPTION', None),
                "model_figure": getattr(config_module, 'MODEL_FIGURE', None),
                "input_features": getattr(config_module, 'INPUT_FEATURE_LIST', []),
                "prediction_template": getattr(config_module, 'MODEL_PREDICTION_TEMPLATE', [])
            })
        
        # Cache the result
        model_info_cache[model_folder_name] = model_info
        return model_info
        
    except Exception as e:
        print(f"Error loading config for {model_folder_name}: {e}")
        return None

def get_model_display_info():
    """Get enriched model information with real names from config files"""
    status_data = load_model_status()
    models = status_data.get("models", {})
    
    single_models = []
    sequence_models = []
    
    for model_key, model_status in models.items():
        # Load config info
        config_info = load_model_config(model_key)
        
        if config_info:
            display_info = {
                "key": model_key,
                "status": model_status.get("status", "unknown"),
                "port": model_status.get("port"),
                "folder_name": config_info.get("folder_name", model_key),
                "type": config_info.get("type", "single")
            }
            
            if config_info["type"] == "sequence":
                display_info.update({
                    "sequence_name": config_info.get("sequence_name", "Unknown Sequence"),
                    "sequence_version": config_info.get("sequence_version", "v1.0.0"),
                    "model_sequence": config_info.get("model_sequence", [])
                })
                sequence_models.append(display_info)
            else:
                display_info.update({
                    "model_name": config_info.get("model_name", "Unknown Model"),
                    "model_version": config_info.get("model_version", "v1.0.0"),
                    "model_description": config_info.get("model_description"),
                    "model_figure": config_info.get("model_figure"),
                    "input_features": config_info.get("input_features", []),
                    "prediction_template": config_info.get("prediction_template", [])
                })
                single_models.append(display_info)
        else:
            # Fallback if no config found
            display_info = {
                "key": model_key,
                "status": model_status.get("status", "unknown"),
                "port": model_status.get("port"),
                "folder_name": model_key,
                "type": "single",
                "model_name": model_key.replace("_", " ").title(),
                "model_version": "Unknown",
                "input_features": [],
                "prediction_template": []
            }
            single_models.append(display_info)
    
    return single_models, sequence_models

# Load model status
def load_model_status():
    try:
        with open('model_status.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {"models": {}}

async def get_model_endpoints_internal(model_name: str, port: int):
    """Get all endpoints for a model and cache them"""
    if model_name in model_endpoints_cache:
        return model_endpoints_cache[model_name]
    
    endpoints = []
    async with httpx.AsyncClient() as client:
        try:
            # Try to get OpenAPI spec
            response = await client.get(f"http://localhost:{port}/openapi.json", timeout=10.0)
            if response.status_code == 200:
                openapi_spec = response.json()
                for path, methods in openapi_spec.get("paths", {}).items():
                    for method, details in methods.items():
                        endpoints.append({
                            "path": path,
                            "method": method.upper(),
                            "summary": details.get("summary", ""),
                            "description": details.get("description", "")
                        })
                
                # Cache the endpoints
                model_endpoints_cache[model_name] = endpoints
                return endpoints
        except Exception as e:
            print(f"Error getting endpoints for {model_name}: {e}")
    
    # Fallback to empty list if can't get endpoints
    return []

def rewrite_urls_in_content(content_text: str, model_name: str, endpoints: list):
    """Dynamically rewrite URLs based on actual model endpoints"""
    
    # Get all paths from endpoints
    paths = [endpoint["path"] for endpoint in endpoints]
    
    # Rewrite href attributes
    for path in paths:
        if path.startswith('/'):
            path_clean = path.lstrip('/')
            # Handle both with and without trailing slash
            content_text = content_text.replace(f'href="{path}"', f'href="/api/{model_name}/{path_clean}"')
            if not path.endswith('/'):
                content_text = content_text.replace(f'href="{path}/"', f'href="/api/{model_name}/{path_clean}/"')
    
    # Rewrite src attributes
    for path in paths:
        if path.startswith('/'):
            path_clean = path.lstrip('/')
            content_text = content_text.replace(f'src="{path}"', f'src="/api/{model_name}/{path_clean}"')
    
    # Rewrite action attributes in forms
    for path in paths:
        if path.startswith('/'):
            path_clean = path.lstrip('/')
            content_text = content_text.replace(f'action="{path}"', f'action="/api/{model_name}/{path_clean}"')
    
    # Rewrite fetch() calls in JavaScript
    for path in paths:
        if path.startswith('/'):
            path_clean = path.lstrip('/')
            content_text = content_text.replace(f'fetch("{path}"', f'fetch("/api/{model_name}/{path_clean}"')
            content_text = content_text.replace(f"fetch('{path}'", f"fetch('/api/{model_name}/{path_clean}'")
    
    # Rewrite XMLHttpRequest calls
    for path in paths:
        if path.startswith('/'):
            path_clean = path.lstrip('/')
            content_text = content_text.replace(f'open("GET", "{path}"', f'open("GET", "/api/{model_name}/{path_clean}"')
            content_text = content_text.replace(f'open("POST", "{path}"', f'open("POST", "/api/{model_name}/{path_clean}"')
            content_text = content_text.replace(f"open('GET', '{path}'", f"open('GET', '/api/{model_name}/{path_clean}'")
            content_text = content_text.replace(f"open('POST', '{path}'", f"open('POST', '/api/{model_name}/{path_clean}'")
    
    # Rewrite any remaining absolute paths that start with /
    # Use regex to find patterns like href="/something" or src="/something"
    content_text = re.sub(
        r'(href|src|action)="(/[^"]*)"',
        lambda m: f'{m.group(1)}="/api/{model_name}{m.group(2)}"' if not m.group(2).startswith('/api/') else m.group(0),
        content_text
    )
    
    # Rewrite fetch calls with regex
    content_text = re.sub(
        r'fetch\("(/[^"]*)"\)',
        lambda m: f'fetch("/api/{model_name}{m.group(1)}")' if not m.group(1).startswith('/api/') else m.group(0),
        content_text
    )
    content_text = re.sub(
        r"fetch\('(/[^']*)'\)",
        lambda m: f"fetch('/api/{model_name}{m.group(1)}')" if not m.group(1).startswith('/api/') else m.group(0),
        content_text
    )
    
    return content_text

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    # Get enriched model information with real names
    single_models, sequence_models = get_model_display_info()
    
    # Calculate stats
    total_models = len(single_models) + len(sequence_models)
    success_count = sum(1 for m in single_models + sequence_models if m.get("status") == "success")
    failed_count = sum(1 for m in single_models + sequence_models if m.get("status") == "failed")
    
    return templates.TemplateResponse("index.html", {
        "request": request,
        "single_models": single_models,
        "sequence_models": sequence_models,
        "total_models": total_models,
        "success_count": success_count,
        "failed_count": failed_count
    })

# Reverse proxy for model APIs - handle ALL paths including root and static resources
@app.api_route("/api/{model_name}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
@app.api_route("/api/{model_name}/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_to_model(model_name: str, request: Request, path: str = ""):
    status_data = load_model_status()
    models = status_data.get("models", {})
    
    if model_name not in models:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
    
    model_info = models[model_name]
    if model_info.get("status") != "success":
        raise HTTPException(status_code=503, detail=f"Model {model_name} is not running")
    
    port = model_info.get("port")
    if not port:
        raise HTTPException(status_code=503, detail=f"Model {model_name} has no port assigned")
    
    # Check if it's a request for a static file (image, css, js, etc.)
    if path and ('.' in path.split('/')[-1]):  # Has file extension
        file_extension = path.split('.')[-1].lower()
        static_extensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'css', 'js', 'ico', 'pdf', 'txt']
        
        if file_extension in static_extensions:
            # Try to serve from model directory first
            config_info = load_model_config(model_name)
            if config_info and config_info.get("folder_name"):
                local_file_path = os.path.join("models", config_info["folder_name"], path)
                if os.path.exists(local_file_path) and os.path.isfile(local_file_path):
                    try:
                        from fastapi.responses import FileResponse
                        
                        # Set appropriate content type
                        content_type_map = {
                            'png': 'image/png',
                            'jpg': 'image/jpeg',
                            'jpeg': 'image/jpeg',
                            'gif': 'image/gif',
                            'svg': 'image/svg+xml',
                            'css': 'text/css',
                            'js': 'application/javascript',
                            'ico': 'image/x-icon',
                            'pdf': 'application/pdf',
                            'txt': 'text/plain'
                        }
                        
                        media_type = content_type_map.get(file_extension, 'application/octet-stream')
                        return FileResponse(local_file_path, media_type=media_type)
                    except Exception as e:
                        print(f"Error serving static file {local_file_path}: {e}")
                        # Fall back to proxy if local file serving fails
                        pass
    
    # Construct target URL
    target_url = f"http://localhost:{port}/{path}" if path else f"http://localhost:{port}/"
    
    async with httpx.AsyncClient() as client:
        try:
            # Get request body if any
            body = await request.body()
            
            # Prepare headers (exclude problematic headers)
            headers = {}
            for key, value in request.headers.items():
                key_lower = key.lower()
                # Skip headers that can cause conflicts
                if key_lower not in [
                    'host', 'content-length', 'connection', 'upgrade', 
                    'transfer-encoding', 'te', 'trailer', 'proxy-authorization',
                    'proxy-authenticate', 'accept-encoding'  # Let httpx handle compression
                ]:
                    headers[key] = value
            
            # Forward the request
            response = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                params=dict(request.query_params),
                content=body,
                timeout=60.0,
                follow_redirects=False
            )
            
            # Handle different content types
            content_type = response.headers.get("content-type", "")
            
            # Prepare response headers (filter out problematic ones)
            response_headers = {}
            for key, value in response.headers.items():
                key_lower = key.lower()
                # Skip headers that FastAPI/Uvicorn will handle automatically
                if key_lower not in [
                    'content-encoding', 'transfer-encoding', 'connection',
                    'server', 'date', 'content-length'  # Let FastAPI calculate this
                ]:
                    response_headers[key] = value
            
            # Get response content
            content = response.content
            
            # For HTML responses, rewrite URLs to go through the gateway
            if "text/html" in content_type and response.status_code == 200:
                try:
                    content_text = content.decode('utf-8')
                    
                    # Get model endpoints for dynamic URL rewriting
                    endpoints = await get_model_endpoints_internal(model_name, port)
                    
                    # Rewrite URLs dynamically based on actual endpoints
                    content_text = rewrite_urls_in_content(content_text, model_name, endpoints)
                    
                    # Inject Back to Home button CSS and JavaScript
                    back_to_home_css = """
<style>
.gateway-back-button {
    position: fixed !important;
    top: 20px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    z-index: 9999 !important;
    background: #007bff !important;
    color: white !important;
    border: none !important;
    padding: 10px 15px !important;
    border-radius: 5px !important;
    cursor: pointer !important;
    font-size: 14px !important;
    font-weight: bold !important;
    text-decoration: none !important;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3) !important;
    transition: all 0.3s ease !important;
    display: flex !important;
    align-items: center !important;
    gap: 5px !important;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
}
.gateway-back-button:hover {
    background: #0056b3 !important;
    transform: translateX(-50%) translateY(-1px) !important;
    box-shadow: 0 4px 15px rgba(0,0,0,0.4) !important;
}
.gateway-back-button:active {
    transform: translateX(-50%) translateY(0) !important;
}
@media (max-width: 768px) {
    .gateway-back-button {
        top: 10px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        padding: 8px 12px !important;
        font-size: 12px !important;
    }
}
</style>"""

                    back_to_home_js = f"""
<script>
document.addEventListener('DOMContentLoaded', function() {{
    // Create back to home button
    const backButton = document.createElement('a');
    backButton.href = '/';
    backButton.className = 'gateway-back-button';
    backButton.innerHTML = '🏠 Back to Gateway';
    backButton.title = 'Return to Model API Gateway';
    
    // Add click event for smooth transition
    backButton.addEventListener('click', function(e) {{
        e.preventDefault();
        window.location.href = '/';
    }});
    
    // Insert button into page
    document.body.appendChild(backButton);
    
    // Add keyboard shortcut (Escape key)
    document.addEventListener('keydown', function(e) {{
        if (e.key === 'Escape') {{
            window.location.href = '/';
        }}
    }});
}});
</script>"""
                    
                    # Inject CSS and JS before closing </head> and </body> tags
                    if '</head>' in content_text:
                        content_text = content_text.replace('</head>', back_to_home_css + '\n</head>')
                    elif '<head>' in content_text:
                        content_text = content_text.replace('<head>', f'<head>\n{back_to_home_css}')
                    else:
                        # If no head tag, add to the beginning
                        content_text = back_to_home_css + content_text
                    
                    if '</body>' in content_text:
                        content_text = content_text.replace('</body>', back_to_home_js + '\n</body>')
                    else:
                        # If no body tag, add to the end
                        content_text = content_text + back_to_home_js
                    
                    # Convert back to bytes
                    content = content_text.encode('utf-8')
                    
                    # Set proper content type
                    response_headers['Content-Type'] = 'text/html; charset=utf-8'
                except UnicodeDecodeError:
                    # If can't decode as UTF-8, pass through as-is
                    pass
            
            # For JavaScript files, also rewrite URLs
            elif "javascript" in content_type or path.endswith('.js') or path == 'main-js':
                try:
                    content_text = content.decode('utf-8')
                    
                    # Get model endpoints for dynamic URL rewriting
                    endpoints = await get_model_endpoints_internal(model_name, port)
                    
                    # Rewrite URLs in JavaScript
                    content_text = rewrite_urls_in_content(content_text, model_name, endpoints)
                    
                    content = content_text.encode('utf-8')
                    response_headers['Content-Type'] = 'application/javascript'
                except UnicodeDecodeError:
                    pass
                    
            # Set content type for specific file types
            elif path == 'style-css' or path.endswith('.css'):
                response_headers['Content-Type'] = 'text/css'
            elif "application/json" in content_type:
                response_headers['Content-Type'] = 'application/json'
            
            return Response(
                content=content,
                status_code=response.status_code,
                headers=response_headers
            )
            
        except httpx.ConnectError:
            raise HTTPException(status_code=503, detail=f"Cannot connect to model {model_name} on port {port}")
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail=f"Timeout connecting to model {model_name}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error proxying to model {model_name}: {str(e)}")

# Health check endpoint
@app.get("/health/{model_name}")
async def health_check(model_name: str):
    status_data = load_model_status()
    models = status_data.get("models", {})
    
    if model_name not in models:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
    
    model_info = models[model_name]
    port = model_info.get("port")
    
    if model_info.get("status") != "success" or not port:
        return {"status": "unhealthy", "model": model_name, "reason": "not running"}
    
    # Check if the service is actually responding
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"http://localhost:{port}/", timeout=10.0)
            return {
                "status": "healthy" if response.status_code < 400 else "unhealthy", 
                "model": model_name, 
                "port": port,
                "http_status": response.status_code,
                "response_time": "< 10s"
            }
        except Exception as e:
            return {
                "status": "unhealthy", 
                "model": model_name, 
                "port": port, 
                "reason": f"connection failed: {str(e)}"
            }

# Get model endpoints
@app.get("/endpoints/{model_name}")
async def get_model_endpoints(model_name: str):
    """Get available endpoints for a specific model"""
    status_data = load_model_status()
    models = status_data.get("models", {})
    
    if model_name not in models:
        raise HTTPException(status_code=404, detail=f"Model {model_name} not found")
    
    model_info = models[model_name]
    port = model_info.get("port")
    
    if model_info.get("status") != "success" or not port:
        return {"endpoints": [], "status": "model not running"}
    
    # Try to get OpenAPI spec from the model
    async with httpx.AsyncClient() as client:
        try:
            # Try to get OpenAPI JSON
            response = await client.get(f"http://localhost:{port}/openapi.json", timeout=10.0)
            if response.status_code == 200:
                openapi_spec = response.json()
                endpoints = []
                for path, methods in openapi_spec.get("paths", {}).items():
                    for method, details in methods.items():
                        endpoints.append({
                            "path": path,
                            "method": method.upper(),
                            "summary": details.get("summary", ""),
                            "description": details.get("description", "")
                        })
                return {"endpoints": endpoints, "status": "available"}
            else:
                # Fallback to common endpoints
                return {
                    "endpoints": [
                        {"path": "/", "method": "GET", "summary": "Web Interface", "description": "Model web interface"},
                        {"path": "/style-css", "method": "GET", "summary": "CSS Styles", "description": "Stylesheet for web interface"},
                        {"path": "/main-js", "method": "GET", "summary": "JavaScript", "description": "JavaScript for web interface"},
                        {"path": "/config", "method": "GET", "summary": "Model Config", "description": "Get model configuration"},
                        {"path": "/infer/", "method": "POST", "summary": "Single Inference", "description": "Run single prediction"},
                        {"path": "/infer-csv/", "method": "POST", "summary": "Batch Inference", "description": "Run batch predictions from CSV"},
                        {"path": "/docs", "method": "GET", "summary": "API Documentation", "description": "FastAPI auto-generated docs"}
                    ],
                    "status": "default endpoints"
                }
        except Exception as e:
            return {"endpoints": [], "status": f"error: {str(e)}"}

# API to refresh model status
@app.post("/refresh")
async def refresh_status():
    # Re-run the model status check
    import subprocess
    try:
        result = subprocess.run(['./run_models.sh'], capture_output=True, text=True, cwd='.')
        return {"message": "Models refreshed", "output": result.stdout, "errors": result.stderr}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8092)