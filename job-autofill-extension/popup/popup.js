// Load saved data when popup opens
document.addEventListener('DOMContentLoaded', () => {
    loadSavedData();

    // Save button click handler
    document.getElementById('saveData').addEventListener('click', saveData);

    // Autofill button click handler
    document.getElementById('autofillBtn').addEventListener('click', triggerAutofill);
});

// Load saved data from Chrome storage
function loadSavedData() {
    chrome.storage.sync.get([
        'fullName',
        'email',
        'phone',
        'skills'
    ], (data) => {
        if (data.fullName) document.getElementById('fullName').value = data.fullName;
        if (data.email) document.getElementById('email').value = data.email;
        if (data.phone) document.getElementById('phone').value = data.phone;
        if (data.skills) document.getElementById('skills').value = data.skills;
    });
}

// Save data to Chrome storage
function saveData() {
    const data = {
        fullName: document.getElementById('fullName').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        skills: document.getElementById('skills').value.trim()
    };

    chrome.storage.sync.set(data, () => {
        showStatus('Data saved successfully!', 'success');
        setTimeout(() => {
            hideStatus();
        }, 2000);
    });
}

// Send message to content script to trigger autofill
function triggerAutofill() {
    // Get current data
    const data = {
        fullName: document.getElementById('fullName').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        skills: document.getElementById('skills').value.trim()
    };

    // Validate data
    if (!data.fullName || !data.email) {
        showStatus('Please fill in at least Name and Email', 'error');
        return;
    }

    // Get active tab and send message
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'autofill',
                data: data
            }, (response) => {
                if (chrome.runtime.lastError) {
                    showStatus('Error: Could not autofill. Make sure you\'re on a job application page.', 'error');
                } else if (response && response.success) {
                    showStatus(`Form filled! Found and filled ${response.filledCount} fields.`, 'success');
                    setTimeout(() => {
                        window.close(); // Close popup after successful autofill
                    }, 1500);
                } else {
                    showStatus('No form fields detected. Make sure you\'re on a job application page.', 'error');
                }
            });
        }
    });
}

// Show status message
function showStatus(message, type) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
}

// Hide status message
function hideStatus() {
    const statusEl = document.getElementById('status');
    statusEl.className = 'status';
    statusEl.textContent = '';
}