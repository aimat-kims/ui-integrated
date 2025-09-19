let configData = null;
let sequenceData = null;
let currentModelIndex = 0;
let currentModelOutput = null;

// Load Chart.js library dynamically
function loadChartJS() {
    return new Promise((resolve, reject) => {
        if (window.Chart) {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Global variables for plot management
let currentPlotData = {};
let plotCharts = {};

// Global variables for CSV management
let currentCsvData = null;
let currentCsvFilename = null;
let currentCsvOutput = null; // Store CSV output for passing to next model

// Load configuration on page load
async function loadConfig() {
    try {
        const [configResponse, sequenceResponse] = await Promise.all([
            fetch('/config'),
            fetch('/sequence-info')
        ]);
        
        configData = await configResponse.json();
        sequenceData = await sequenceResponse.json();

        // Update page title and header
        const title = `${configData.sequence_name} API - Model Sequence Inference`;
        document.getElementById('pageTitle').textContent = title;
        document.getElementById('pageHeader').textContent = `${configData.sequence_name} ${configData.sequence_version} - Model Sequence (${sequenceData.total_models} models)`;

        // Generate interface based on sequence
        generateSequenceInterface();

        // Enable the inference button
        document.getElementById('inferButton').disabled = false;

    } catch (error) {
        document.getElementById('inputFields').innerHTML = `<div class="error">Failed to load configuration: ${error.message}</div>`;
    }
}

// Generate sequence interface
function generateSequenceInterface() {
    const inputFieldsContainer = document.getElementById('inputFields');
    
    let fieldsHtml = '';

    // Check if sequence has any image inputs or outputs (for CSV functionality)
    const hasImageInput = sequenceData.models.some(model => 
        configData.model_sequence.find(m => m.id === model.id)?.input_features.some(f => f.type === 'image')
    );
    const hasImageOutput = sequenceData.models.some(model => 
        configData.model_sequence.find(m => m.id === model.id)?.output_template.some(f => f.type === 'image')
    );
    const hasImages = hasImageInput || hasImageOutput;

    // Generate sequence progress indicator with clickable steps
    fieldsHtml += `
        <div id="sequenceProgress" class="sequence-progress">
            <h3>Model Sequence Progress - Click any model to run it individually</h3>
            <div class="progress-steps">
    `;
    
    sequenceData.models.forEach((model, index) => {
        const isActive = index === currentModelIndex;
        const isCompleted = index < currentModelIndex;
        const statusClass = isCompleted ? 'completed' : (isActive ? 'active' : 'pending');
        
        fieldsHtml += `
            <div class="progress-step ${statusClass} clickable-step" id="step_${index}" onclick="selectModel(${index})">
                <div class="step-number">${index + 1}</div>
                <div class="step-info">
                    <div class="step-name">${model.name}</div>
                    <div class="step-id">${model.id}</div>
                </div>
            </div>
        `;
        
        if (index < sequenceData.models.length - 1) {
            fieldsHtml += `<div class="step-arrow">→</div>`;
        }
    });
    
    fieldsHtml += `
            </div>
            <div class="sequence-info">
                <p><strong>How to use:</strong> Click on any model step above to select and configure that specific model for inference. Models can be run independently or in sequence.</p>
            </div>
        </div>
    `;

    // Current model input section
    fieldsHtml += `
        <div id="currentModelSection" class="current-model-section">
            <h3 id="currentModelTitle">Current Model: ${sequenceData.models[0].name}</h3>
            <div id="currentModelInputs">
                <!-- Dynamic inputs will be generated here -->
            </div>
        </div>
    `;

    // Previous outputs section (always visible when available)
    fieldsHtml += `
        <div id="previousOutputsSection" class="previous-outputs-section" style="display: none;">
            <h3>Previous Model Outputs</h3>
            <div id="previousOutputs">
                <!-- Previous outputs will be shown here -->
            </div>
        </div>
    `;

    inputFieldsContainer.innerHTML = fieldsHtml;
    
    // Generate inputs for the current model
    generateCurrentModelInputs();
}

// Function to select a specific model
function selectModel(modelIndex) {
    if (modelIndex < 0 || modelIndex >= sequenceData.models.length) {
        return;
    }
    
    currentModelIndex = modelIndex;
    updateProgressSteps();
    generateCurrentModelInputs();
    showPreviousOutputs();
    
    // Remove any existing next/reset buttons since user is manually selecting
    const nextBtn = document.getElementById('nextButton');
    if (nextBtn) nextBtn.remove();
    
    const resetBtn = document.getElementById('resetButton');
    if (resetBtn) resetBtn.remove();
    
    // Update inference button text
    const inferButton = document.getElementById('inferButton');
    if (currentModelIndex === sequenceData.models.length - 1) {
        inferButton.textContent = 'Run Final Model';
    } else {
        inferButton.textContent = 'Run Selected Model';
    }
}

// Generate inputs for current model
function generateCurrentModelInputs() {
    const currentModelInputsContainer = document.getElementById('currentModelInputs');
    const currentModelTitle = document.getElementById('currentModelTitle');
    
    if (!sequenceData || !configData) return;
    
    const currentModel = sequenceData.models[currentModelIndex];
    const modelConfig = configData.model_sequence.find(m => m.id === currentModel.id);
    
    if (!modelConfig) return;
    
    // Update title
    currentModelTitle.textContent = `Current Model: ${currentModel.name} (${currentModel.id})`;
    
    let inputsHtml = `<div class="model-description">${modelConfig.description}</div>`;
    
    // Check if model supports CSV (no image inputs/outputs)
    const hasImageInput = modelConfig.input_features.some(f => f.type === 'image');
    const hasImageOutput = modelConfig.output_template.some(f => f.type === 'image');
    const supportsCsv = !hasImageInput && !hasImageOutput;
    
    // Create the container for side-by-side layout
    if (supportsCsv) {
        inputsHtml += `<div class="current-model-inputs-container">`;
        
        // CSV section wrapper
        inputsHtml += `<div class="csv-section-wrapper">`;
        inputsHtml += `
            <div class="csv-upload-section" id="csvUploadSection">
                <h3>📊 CSV Batch Processing (Optional)</h3>
                <p>Upload a CSV file to process multiple rows at once. The CSV must contain columns matching the input feature names.</p>
                
                <div class="csv-info">
                    <p><strong>Required CSV columns:</strong> ${modelConfig.input_features.map(f => f.name).join(', ')}</p>
                    <p><strong>Expected format:</strong> CSV with header row containing the exact column names above</p>
                </div>
                
                <input type="file" id="csvUpload" accept=".csv" onchange="handleCsvUpload(this)">
                <button type="button" id="uploadCsvBtn" onclick="processCsvForCurrentModel()" style="display: none;">
                    📤 Process CSV for ${currentModel.name}
                </button>
                
                <div id="csvPreview" style="display: none;"></div>
            </div>
        `;
        inputsHtml += `</div>`; // Close csv-section-wrapper
        
        // Inputs section wrapper
        inputsHtml += `<div class="inputs-section-wrapper">`;
        inputsHtml += `<h3>Input Features</h3>`;
    }
    
    // Generate input fields for current model
    modelConfig.input_features.forEach(feature => {
        if (feature.type === 'image') {
            inputsHtml += `
                <div class="input-group">
                    <label for="input_${feature.name}">${feature.name} <span class="type-label">(${feature.type})</span></label>
                    <input type="file" id="input_${feature.name}" accept="image/*" required onchange="previewImage(this, '${feature.name}')">
                    <div class="image-preview-container">
                        <img id="preview_${feature.name}" class="image-preview" alt="Image preview">
                        <br>
                        <button type="button" class="download-btn" id="download_input_${feature.name}" style="display: none;" onclick="downloadImage('preview_${feature.name}', '${feature.name}_input')">Download</button>
                    </div>
                </div>
            `;
        } else {
            const inputType = feature.type === 'string' ? 'text' : 'number';
            const stepAttr = feature.type === 'float' ? 'step="any"' : '';
            
            // Check if this input should be auto-filled from previous output
            let inputValue = feature.value;
            let isReadonly = false;
            let autoFillNote = '';
            
            if (currentModelOutput && currentModelIndex > 0) {
                const matchingOutput = currentModelOutput.find(output => output.name === feature.name);
                if (matchingOutput) {
                    inputValue = matchingOutput.value;
                    isReadonly = true;
                    autoFillNote = '<small class="auto-fill-note">Auto-filled from previous model output</small>';
                }
            }

            inputsHtml += `
                <div class="input-group">
                    <label for="input_${feature.name}">${feature.name} <span class="type-label">(${feature.type})</span></label>
                    <input type="${inputType}" ${stepAttr} id="input_${feature.name}" value="${inputValue}" ${isReadonly ? 'readonly' : 'required'} ${isReadonly ? 'class="auto-filled"' : ''}>
                    ${autoFillNote}
                </div>
            `;
        }
    });
    
    // Close the wrappers if CSV is supported
    if (supportsCsv) {
        inputsHtml += `</div>`; // Close inputs-section-wrapper
        inputsHtml += `</div>`; // Close current-model-inputs-container
    }
    
    currentModelInputsContainer.innerHTML = inputsHtml;
}

// Handle CSV file upload
function handleCsvUpload(input) {
    const uploadBtn = document.getElementById('uploadCsvBtn');
    const csvPreview = document.getElementById('csvPreview');
    
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            alert('Please select a CSV file');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const csvText = e.target.result;
            try {
                const lines = csvText.trim().split('\n');
                const headers = lines[0].split(',').map(h => h.trim());
                const rows = lines.slice(1, 6); // Preview first 5 rows
                
                // Validate required columns
                const currentModel = sequenceData.models[currentModelIndex];
                const modelConfig = configData.model_sequence.find(m => m.id === currentModel.id);
                const requiredColumns = modelConfig.input_features.map(f => f.name);
                const missingColumns = requiredColumns.filter(col => !headers.includes(col));
                
                if (missingColumns.length > 0) {
                    alert(`Missing required columns: ${missingColumns.join(', ')}`);
                    return;
                }
                
                // Show preview
                let previewHtml = `
                    <div class="csv-info">
                        <p><strong>File:</strong> ${file.name} (${lines.length - 1} rows)</p>
                        <p><strong>Columns found:</strong> ${headers.join(', ')}</p>
                        <p><strong>Preview (first 5 rows):</strong></p>
                    </div>
                    <div class="csv-table-container">
                        <table class="csv-table">
                            <thead><tr>
                `;
                
                headers.forEach(header => {
                    previewHtml += `<th>${escapeHtml(header)}</th>`;
                });
                previewHtml += '</tr></thead><tbody>';
                
                rows.forEach(row => {
                    const cells = row.split(',').map(cell => cell.trim());
                    previewHtml += '<tr>';
                    cells.forEach(cell => {
                        previewHtml += `<td>${escapeHtml(cell)}</td>`;
                    });
                    previewHtml += '</tr>';
                });
                
                previewHtml += '</tbody></table></div>';
                
                csvPreview.innerHTML = previewHtml;
                csvPreview.style.display = 'block';
                uploadBtn.style.display = 'inline-block';
                
                // Store CSV data
                currentCsvData = csvText;
                currentCsvFilename = file.name;
                
            } catch (error) {
                alert('Error reading CSV file: ' + error.message);
            }
        };
        reader.readAsText(file);
    } else {
        csvPreview.style.display = 'none';
        uploadBtn.style.display = 'none';
        currentCsvData = null;
        currentCsvFilename = null;
    }
}

// Process CSV for current model
async function processCsvForCurrentModel() {
    if (!currentCsvData) {
        alert('No CSV data available');
        return;
    }
    
    const uploadBtn = document.getElementById('uploadCsvBtn');
    const output = document.getElementById('output');
    
    try {
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Processing CSV...';
        output.innerHTML = '<div class="loading">Processing CSV through current model...</div>';
        
        const currentModelId = sequenceData.models[currentModelIndex].id;
        
        // Create FormData to send CSV file
        const formData = new FormData();
        const csvBlob = new Blob([currentCsvData], { type: 'text/csv' });
        formData.append('file', csvBlob, currentCsvFilename);
        formData.append('model_id', currentModelId);
        
        const response = await fetch('/infer-csv-single/', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const result = await response.json();
            
            // Store CSV output for next model
            currentCsvOutput = {
                csvData: result.csv_data,
                filename: result.filename,
                modelId: currentModelId,
                modelName: result.model_name
            };
            
            // Show CSV preview
            showCsvPreview(result.csv_data, result.filename);
            
            // Add next button if applicable
            addNextButtonWithCsv();
            addResetButton();
            
        } else {
            const errorData = await response.json();
            output.innerHTML = `<div class="error">Error processing CSV: ${errorData.detail}</div>`;
        }
        
    } catch (error) {
        output.innerHTML = `<div class="error">Network error: ${error.message}</div>`;
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = `📤 Process CSV for ${sequenceData.models[currentModelIndex].name}`;
    }
}

// Modified next button with CSV support
function addNextButtonWithCsv() {
    const existingNextBtn = document.getElementById('nextButton');
    if (existingNextBtn) existingNextBtn.remove();
    
    if (currentModelIndex < sequenceData.models.length - 1 && (currentModelOutput || currentCsvOutput)) {
        const nextBtn = document.createElement('button');
        nextBtn.id = 'nextButton';
        nextBtn.type = 'button';
        
        if (currentCsvOutput) {
            nextBtn.textContent = 'Next Model (CSV) →';
            nextBtn.onclick = proceedToNextModelWithCsv;
        } else {
            nextBtn.textContent = 'Next Model →';
            nextBtn.onclick = proceedToNextModel;
        }
        
        nextBtn.className = 'next-button';
        
        const form = document.getElementById('inferenceForm');
        const inferButton = document.getElementById('inferButton');
        form.insertBefore(nextBtn, inferButton.nextSibling);
    }
}

// Proceed to next model with CSV
async function proceedToNextModelWithCsv() {
    if (!currentCsvOutput || currentModelIndex >= sequenceData.models.length - 1) {
        return;
    }
    
    try {
        // Move to next model
        currentModelIndex++;
        updateProgressSteps();
        
        // Clear previous outputs for clean transition
        currentModelOutput = null;
        
        generateCurrentModelInputs();
        showPreviousOutputs();
        
        // Check if next model supports CSV
        const nextModel = sequenceData.models[currentModelIndex];
        const nextModelConfig = configData.model_sequence.find(m => m.id === nextModel.id);
        const nextHasImage = nextModelConfig.input_features.some(f => f.type === 'image') || 
                           nextModelConfig.output_template.some(f => f.type === 'image');
        
        if (nextHasImage) {
            // Next model has images, can't pass CSV
            alert(`Next model "${nextModel.name}" contains image inputs/outputs and cannot process CSV data. Please use manual input.`);
            currentCsvOutput = null;
        } else {
            // Auto-populate CSV for next model
            await populateCsvForNextModel();
        }
        
        // Remove next button
        const nextBtn = document.getElementById('nextButton');
        if (nextBtn) nextBtn.remove();
        
        // Update inference button text
        const inferButton = document.getElementById('inferButton');
        if (currentModelIndex === sequenceData.models.length - 1) {
            inferButton.textContent = 'Run Final Model';
        } else {
            inferButton.textContent = 'Run Current Model';
        }
        
    } catch (error) {
        alert(`Error proceeding to next model: ${error.message}`);
    }
}

// Populate CSV for next model
async function populateCsvForNextModel() {
    if (!currentCsvOutput) return;
    
    const csvUploadSection = document.getElementById('csvUploadSection');
    if (!csvUploadSection) return;
    
    try {
        // Parse the CSV output from previous model
        const lines = currentCsvOutput.csvData.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        // Get current model config
        const currentModel = sequenceData.models[currentModelIndex];
        const modelConfig = configData.model_sequence.find(m => m.id === currentModel.id);
        const requiredColumns = modelConfig.input_features.map(f => f.name);
        
        // Check if CSV has required columns
        const hasRequiredColumns = requiredColumns.every(col => headers.includes(col));
        
        if (hasRequiredColumns) {
            // Auto-populate the CSV
            currentCsvData = currentCsvOutput.csvData;
            currentCsvFilename = `${currentCsvOutput.filename.replace('.csv', '')}_for_${currentModel.id}.csv`;
            
            // Update UI to show CSV is ready
            const csvInfo = csvUploadSection.querySelector('.csv-info');
            if (csvInfo) {
                csvInfo.innerHTML = `
                    <p><strong>✅ CSV automatically transferred from previous model</strong></p>
                    <p><strong>File:</strong> ${currentCsvFilename} (${lines.length - 1} rows)</p>
                    <p><strong>Columns available:</strong> ${headers.join(', ')}</p>
                    <p><strong>Required columns:</strong> ${requiredColumns.join(', ')}</p>
                `;
            }
            
            // Show upload button
            const uploadBtn = document.getElementById('uploadCsvBtn');
            if (uploadBtn) {
                uploadBtn.style.display = 'inline-block';
                uploadBtn.textContent = `📤 Process Transferred CSV for ${currentModel.name}`;
            }
            
            // Show preview
            const csvPreview = document.getElementById('csvPreview');
            if (csvPreview) {
                const previewRows = lines.slice(1, 6); // First 5 rows
                let previewHtml = `
                    <div class="csv-info">
                        <p><strong>Transferred CSV Preview (first 5 rows):</strong></p>
                    </div>
                    <div class="csv-table-container">
                        <table class="csv-table">
                            <thead><tr>
                `;
                
                headers.forEach(header => {
                    previewHtml += `<th>${escapeHtml(header)}</th>`;
                });
                previewHtml += '</tr></thead><tbody>';
                
                previewRows.forEach(row => {
                    const cells = row.split(',').map(cell => cell.trim());
                    previewHtml += '<tr>';
                    cells.forEach(cell => {
                        previewHtml += `<td>${escapeHtml(cell)}</td>`;
                    });
                    previewHtml += '</tr>';
                });
                
                previewHtml += '</tbody></table></div>';
                csvPreview.innerHTML = previewHtml;
                csvPreview.style.display = 'block';
            }
            
        } else {
            const missingColumns = requiredColumns.filter(col => !headers.includes(col));
            alert(`CSV from previous model is missing required columns for ${currentModel.name}: ${missingColumns.join(', ')}`);
            currentCsvOutput = null;
        }
        
    } catch (error) {
        console.error('Error populating CSV for next model:', error);
        alert('Error processing CSV for next model. Please upload CSV manually.');
        currentCsvOutput = null;
    }
}

// Proceed to next model
async function proceedToNextModel() {
    if (!currentModelOutput || currentModelIndex >= sequenceData.models.length - 1) {
        return;
    }
    
    try {
        // Prepare input for next model
        const currentModelId = sequenceData.models[currentModelIndex].id;
        const prepareResponse = await fetch('/prepare-next/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                current_model_id: currentModelId,
                current_output: currentModelOutput
            })
        });
        
        if (prepareResponse.ok) {
            currentModelIndex++;
            updateProgressSteps();
            generateCurrentModelInputs();
            showPreviousOutputs();
            
            // Remove next button
            const nextBtn = document.getElementById('nextButton');
            if (nextBtn) nextBtn.remove();
            
            // Update inference button text
            const inferButton = document.getElementById('inferButton');
            if (currentModelIndex === sequenceData.models.length - 1) {
                inferButton.textContent = 'Run Final Model';
            } else {
                inferButton.textContent = 'Run Current Model';
            }
        } else {
            const errorData = await prepareResponse.json();
            alert(`Error preparing next model: ${errorData.detail}`);
        }
    } catch (error) {
        alert(`Network error: ${error.message}`);
    }
}

// Modified addNextButton to use CSV-aware version
function addNextButton() {
    addNextButtonWithCsv();
}

// Show CSV preview with download functionality
function showCsvPreview(csvText, filename) {
    currentCsvData = csvText;
    currentCsvFilename = filename;
    
    const output = document.getElementById('output');
    
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim()));
    
    const previewRows = rows.slice(0, 10);
    const totalRows = rows.length;
    
    let tableHtml = `
        <div class="csv-preview-section">
            <div class="csv-preview-header">
                <h3>CSV Results Preview (Full Sequence)</h3>
                <button type="button" class="download-csv-btn" onclick="downloadCsv()">
                    📥 Download CSV
                </button>
            </div>
            <div class="csv-info-text">
                Showing first ${Math.min(10, totalRows)} of ${totalRows} rows. Total columns: ${headers.length}
            </div>
            <div class="csv-table-container">
                <table class="csv-table">
                    <thead>
                        <tr>
    `;
    
    headers.forEach(header => {
        tableHtml += `<th>${escapeHtml(header)}</th>`;
    });
    
    tableHtml += `
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    previewRows.forEach(row => {
        tableHtml += '<tr>';
        row.forEach(cell => {
            tableHtml += `<td>${escapeHtml(cell)}</td>`;
        });
        tableHtml += '</tr>';
    });
    
    tableHtml += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    output.innerHTML = tableHtml;
}

// Download CSV function
function downloadCsv() {
    if (!currentCsvData || !currentCsvFilename) {
        alert('No CSV data available for download');
        return;
    }
    
    const blob = new Blob([currentCsvData], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = currentCsvFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Update progress steps visual state
function updateProgressSteps() {
    if (!sequenceData) return;
    
    sequenceData.models.forEach((model, index) => {
        const stepElement = document.getElementById(`step_${index}`);
        if (stepElement) {
            const isActive = index === currentModelIndex;
            const isCompleted = index < currentModelIndex;
            
            stepElement.className = `progress-step ${isCompleted ? 'completed' : (isActive ? 'active' : 'pending')}`;
        }
    });
}

// Show previous outputs
function showPreviousOutputs() {
    const previousOutputsContainer = document.getElementById('previousOutputs');
    const previousOutputsSection = document.getElementById('previousOutputsSection');
    
    if (!currentModelOutput || currentModelIndex === 0) {
        previousOutputsSection.style.display = 'none';
        return;
    }
    
    previousOutputsSection.style.display = 'block';
    
    let outputsHtml = '<div class="previous-outputs-list">';
    currentModelOutput.forEach(output => {
        if (output.type === 'image') {
            outputsHtml += `
                <div class="output-item">
                    <strong>${output.name}</strong> (${output.type}):
                    <img src="data:image/jpeg;base64,${output.value}" style="max-width: 200px; max-height: 200px;">
                </div>
            `;
        } else if (output.type === 'plot') {
            outputsHtml += `
                <div class="output-item">
                    <strong>${output.name}</strong> (${output.type}): Plot data available
                </div>
            `;
        } else {
            outputsHtml += `
                <div class="output-item">
                    <strong>${output.name}</strong> (${output.type}): ${output.value}
                </div>
            `;
        }
    });
    outputsHtml += '</div>';
    
    previousOutputsContainer.innerHTML = outputsHtml;
}

// Add reset button
function addResetButton() {
    const existingResetBtn = document.getElementById('resetButton');
    if (existingResetBtn) existingResetBtn.remove();
    
    if (currentModelIndex > 0) {
        const resetBtn = document.createElement('button');
        resetBtn.id = 'resetButton';
        resetBtn.type = 'button';
        resetBtn.textContent = '↺ Reset to First Model';
        resetBtn.className = 'reset-button';
        resetBtn.onclick = resetSequence;
        
        const form = document.getElementById('inferenceForm');
        const inferButton = document.getElementById('inferButton');
        form.insertBefore(resetBtn, inferButton);
    }
}

// Reset sequence
function resetSequence() {
    currentModelIndex = 0;
    currentModelOutput = null;
    currentCsvOutput = null;
    updateProgressSteps();
    generateCurrentModelInputs();
    showPreviousOutputs();
    
    const nextBtn = document.getElementById('nextButton');
    if (nextBtn) nextBtn.remove();
    
    const inferButton = document.getElementById('inferButton');
    inferButton.textContent = 'Run Current Model';
}

// Preview uploaded image
function previewImage(input, featureName) {
    const preview = document.getElementById(`preview_${featureName}`);
    const downloadBtn = document.getElementById(`download_input_${featureName}`);

    if (input.files && input.files[0]) {
        const reader = new FileReader();

        reader.onload = function (e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            downloadBtn.style.display = 'inline-block';
        };

        reader.readAsDataURL(input.files[0]);
    } else {
        preview.style.display = 'none';
        downloadBtn.style.display = 'none';
    }
}

// Download image function
function downloadImage(imageId, filename) {
    const image = document.getElementById(imageId);
    if (!image || !image.src) {
        alert('No image to download');
        return;
    }

    const link = document.createElement('a');
    link.href = image.src;
    link.download = `${filename}.jpg`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Convert image to base64
function imageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Collect input data dynamically for current model
async function collectCurrentModelInputData() {
    const currentModel = sequenceData.models[currentModelIndex];
    const modelConfig = configData.model_sequence.find(m => m.id === currentModel.id);
    
    if (!modelConfig) {
        throw new Error(`Model configuration not found for ${currentModel.id}`);
    }
    
    const promises = modelConfig.input_features.map(async feature => {
        const element = document.getElementById(`input_${feature.name}`);
        let value;

        if (feature.type === 'image') {
            if (element.files && element.files[0]) {
                value = await imageToBase64(element.files[0]);
            } else {
                throw new Error(`Please select an image for ${feature.name}`);
            }
        } else if (feature.type === 'int') {
            value = parseInt(element.value);
        } else if (feature.type === 'float') {
            value = parseFloat(element.value);
        } else {
            value = element.value;
        }

        return {
            name: feature.name,
            value: value,
            type: feature.type
        };
    });

    return await Promise.all(promises);
}

// Update chart based on selected type
function updateChart(plotId, canvasId, chartType) {
    const plotData = currentPlotData[plotId];
    const ctx = document.getElementById(canvasId).getContext('2d');

    if (plotCharts[canvasId]) {
        plotCharts[canvasId].destroy();
    }

    let chartData, chartOptions;

    switch (chartType) {
        case 'line':
            chartData = {
                labels: plotData.x,
                datasets: [{
                    label: plotData.y_label || 'Data',
                    data: plotData.y,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1
                }]
            };
            chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: plotData.x_label || 'X-axis'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: plotData.y_label || 'Y-axis'
                        }
                    }
                }
            };
            break;

        case 'bar':
            chartData = {
                labels: plotData.x,
                datasets: [{
                    label: plotData.y_label || 'Data',
                    data: plotData.y,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            };
            chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: plotData.x_label || 'X-axis'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: plotData.y_label || 'Y-axis'
                        }
                    }
                }
            };
            break;

        case 'scatter':
            chartData = {
                datasets: [{
                    label: plotData.y_label || 'Data',
                    data: plotData.x.map((x, i) => ({ x: x, y: plotData.y[i] })),
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                }]
            };
            chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        title: {
                            display: true,
                            text: plotData.x_label || 'X-axis'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: plotData.y_label || 'Y-axis'
                        }
                    }
                }
            };
            break;

        default:
            chartType = 'line';
            chartData = {
                labels: plotData.x,
                datasets: [{
                    label: plotData.y_label || 'Data',
                    data: plotData.y,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1
                }]
            };
            chartOptions = {
                responsive: true,
                maintainAspectRatio: false
            };
    }

    plotCharts[canvasId] = new Chart(ctx, {
        type: chartType,
        data: chartData,
        options: chartOptions
    });
}

// Download plot image
function downloadPlotImage(canvasId, filename) {
    const canvas = document.getElementById(canvasId);
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${filename}.png`;
    link.click();
}

// Download plot data
function downloadPlotData(plotId, filename) {
    const plotData = currentPlotData[plotId];
    const csvContent = [
        [plotData.x_label || 'X', plotData.y_label || 'Y'].join(','),
        ...plotData.x.map((x, i) => [x, plotData.y[i]].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
}

// Main form submission handler
document.getElementById('inferenceForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const button = document.getElementById('inferButton');
    const output = document.getElementById('output');

    // Disable button and show loading
    button.disabled = true;
    const originalButtonText = button.textContent;
    button.textContent = 'Running...';
    output.innerHTML = '<div class="loading">Processing inference...</div>';

    try {
        // Only single model inference (step-by-step mode)
        const modelInput = await collectCurrentModelInputData();
        const currentModelId = sequenceData.models[currentModelIndex].id;

        const response = await fetch('/infer-single/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                model_id: currentModelId,
                model_input: modelInput 
            })
        });

        const result = await response.json();

        if (response.ok) {
            currentModelOutput = result.results;
            
            // Display results
            let resultHtml = `<div class="success">Model "${result.current_model_name}" completed successfully in ${result.duration.toFixed(3)} seconds</div>`;
            resultHtml += '<h3>Output:</h3>';

            result.results.forEach((item, index) => {
                if (item.type === 'image') {
                    const imageId = `result_image_${index}`;
                    resultHtml += `
                        <div class="result-item">
                            <strong>${item.name}</strong> (${item.type}):
                            <br>
                            <div class="image-result-container">
                                <img id="${imageId}" src="data:image/jpeg;base64,${item.value}" class="image-result" alt="Result image">
                                <br>
                                <button type="button" class="download-btn" onclick="downloadImage('${imageId}', '${item.name}_output')">Download</button>
                            </div>
                        </div>
                    `;
                } else if (item.type === 'plot') {
                    const plotId = `plot_${index}`;
                    const canvasId = `canvas_${index}`;
                    currentPlotData[plotId] = item.value;
                    
                    resultHtml += `
                        <div class="result-item plot-item">
                            <strong>${item.name}</strong> (${item.type}):
                            <div class="plot-controls">
                                <label for="chartType_${index}">Chart Type:</label>
                                <select id="chartType_${index}" onchange="updateChart('${plotId}', '${canvasId}', this.value)">
                                    <option value="line">Line Chart</option>
                                    <option value="bar">Column Chart</option>
                                    <option value="scatter">Scatter Plot</option>
                                </select>
                                <div class="plot-download-buttons">
                                    <button type="button" class="download-btn" onclick="downloadPlotImage('${canvasId}', '${item.name}_plot')">📥 Download Image</button>
                                    <button type="button" class="download-btn" onclick="downloadPlotData('${plotId}', '${item.name}_data')">📊 Download Data</button>
                                </div>
                            </div>
                            <div class="chart-container">
                                <canvas id="${canvasId}" width="400" height="200"></canvas>
                            </div>
                        </div>
                    `;
                } else if (item.type === 'csv') {
                    // Handle CSV output type
                    resultHtml += `
                        <div class="result-item">
                            <strong>${item.name}</strong> (${item.type}):
                            <div class="csv-output-container">
                                <p>CSV data generated with ${item.value.rows} rows</p>
                                <button type="button" class="download-btn" onclick="downloadCsvOutput('${item.name}', ${index})">📥 Download CSV</button>
                            </div>
                        </div>
                    `;
                } else {
                    resultHtml += `
                        <div class="result-item">
                            <strong>${item.name}</strong> (${item.type}): ${item.value}
                        </div>
                    `;
                }
            });

            if (!result.is_sequence_complete) {
                resultHtml += `<div class="info">Next model available: ${result.next_model_id}. Click "Next Model" to continue the sequence, or click any model step above to jump to a specific model.</div>`;
            } else {
                resultHtml += `<div class="success">🎉 This was the final model in the sequence!</div>`;
            }

            output.innerHTML = resultHtml;
            
            // Initialize charts for plot items
            await loadChartJS();
            result.results.forEach((item, index) => {
                if (item.type === 'plot') {
                    const plotId = `plot_${index}`;
                    const canvasId = `canvas_${index}`;
                    setTimeout(() => updateChart(plotId, canvasId, 'line'), 100);
                }
            });

            // Add next/reset buttons
            addNextButton();
            addResetButton();
        } else {
            output.innerHTML = `<div class="error">Error: ${result.detail}</div>`;
        }

    } catch (error) {
        output.innerHTML = `<div class="error">Network error: ${error.message}</div>`;
    } finally {
        // Re-enable button
        button.disabled = false;
        button.textContent = originalButtonText;
    }
});

// Load configuration when page loads
window.addEventListener('load', loadConfig);