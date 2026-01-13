// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'autofill') {
        const result = autofillForm(request.data);
        sendResponse(result);
    }
    return true; // Keep message channel open for async response
});

// Main autofill function
function autofillForm(data) {
    let filledCount = 0;

    // Fill Full Name fields
    filledCount += fillField(data.fullName, [
        // Common name field patterns
        'name', 'fullname', 'full_name', 'full-name',
        'applicant_name', 'candidate_name', 'your_name',
        'firstname', 'lastname', 'fname', 'lname',
        'person_name', 'user_name', 'contact_name'
    ], false);

    // Fill Email fields
    filledCount += fillField(data.email, [
        'email', 'e-mail', 'mail', 'email_address',
        'emailaddress', 'contact_email', 'applicant_email',
        'candidate_email', 'user_email', 'your_email'
    ], false);

    // Fill Phone fields
    filledCount += fillField(data.phone, [
        'phone', 'telephone', 'mobile', 'cellphone',
        'phone_number', 'phonenumber', 'contact_phone',
        'applicant_phone', 'candidate_phone', 'your_phone',
        'tel', 'mobile_number', 'cell'
    ], false);

    // Fill Skills/Experience fields
    filledCount += fillField(data.skills, [
        'skills', 'experience', 'skills_experience',
        'qualifications', 'summary', 'about', 'bio',
        'description', 'profile', 'background',
        'work_experience', 'professional_experience',
        'technical_skills', 'competencies'
    ], true); // true indicates this might be a textarea

    // Also try to fill by placeholder text
    filledCount += fillByPlaceholder(data);

    // Try to fill by label text (more aggressive approach)
    filledCount += fillByLabel(data);

    // Show visual feedback
    showAutofillFeedback(filledCount);

    return {
        success: filledCount > 0,
        filledCount: filledCount
    };
}

// Generic field filling function
function fillField(value, fieldPatterns, isTextarea = false) {
    if (!value) return 0;

    let filled = 0;

    fieldPatterns.forEach(pattern => {
        // Try different selectors
        const selectors = [
            `input[id*="${pattern}" i]`,
            `input[name*="${pattern}" i]`,
            `textarea[id*="${pattern}" i]`,
            `textarea[name*="${pattern}" i]`,
            `[id*="${pattern}" i] input`,
            `[id*="${pattern}" i] textarea`
        ];

        if (isTextarea) {
            selectors.unshift(`textarea[id*="${pattern}" i]`);
            selectors.unshift(`textarea[name*="${pattern}" i]`);
        }

        selectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element && !element.disabled && element.offsetParent !== null) {
                        // Check if it's a visible element
                        const style = window.getComputedStyle(element);
                        if (style.display !== 'none' && style.visibility !== 'hidden') {
                            element.value = value;
                            element.dispatchEvent(new Event('input', { bubbles: true }));
                            element.dispatchEvent(new Event('change', { bubbles: true }));
                            filled++;
                        }
                    }
                });
            } catch (e) {
                // Silently fail for invalid selectors
            }
        });
    });

    return filled;
}

// Fill fields by placeholder text
function fillByPlaceholder(data) {
    let filled = 0;

    // Map of data keys to placeholder patterns
    const placeholderMap = {
        fullName: ['name', 'full name', 'your name', 'first name', 'last name'],
        email: ['email', 'e-mail', 'email address'],
        phone: ['phone', 'telephone', 'mobile', 'phone number'],
        skills: ['skills', 'experience', 'tell us about', 'describe your']
    };

    // Search all input and textarea elements
    const elements = document.querySelectorAll('input, textarea');

    elements.forEach(element => {
        if (element.placeholder) {
            const placeholder = element.placeholder.toLowerCase();

            // Check for each data type
            if (data.fullName && placeholderMap.fullName.some(p => placeholder.includes(p))) {
                element.value = data.fullName;
                triggerEvents(element);
                filled++;
            }
            else if (data.email && placeholderMap.email.some(p => placeholder.includes(p))) {
                element.value = data.email;
                triggerEvents(element);
                filled++;
            }
            else if (data.phone && placeholderMap.phone.some(p => placeholder.includes(p))) {
                element.value = data.phone;
                triggerEvents(element);
                filled++;
            }
            else if (data.skills && placeholderMap.skills.some(p => placeholder.includes(p))) {
                element.value = data.skills;
                triggerEvents(element);
                filled++;
            }
        }
    });

    return filled;
}

// Fill fields by associated label text
function fillByLabel(data) {
    let filled = 0;

    // Get all labels
    const labels = document.querySelectorAll('label');

    labels.forEach(label => {
        const labelText = label.textContent.toLowerCase().trim();

        // Check what type of field this label might be for
        let fieldValue = null;

        if (labelText.includes('name') && data.fullName) {
            fieldValue = data.fullName;
        } else if ((labelText.includes('email') || labelText.includes('mail')) && data.email) {
            fieldValue = data.email;
        } else if ((labelText.includes('phone') || labelText.includes('tel')) && data.phone) {
            fieldValue = data.phone;
        } else if ((labelText.includes('skill') || labelText.includes('experience') ||
            labelText.includes('about')) && data.skills) {
            fieldValue = data.skills;
        }

        if (fieldValue) {
            // Try to find the associated input
            let input = null;

            // Check if label has for attribute
            if (label.htmlFor) {
                input = document.getElementById(label.htmlFor);
            }

            // If not found, look for input within label
            if (!input) {
                input = label.querySelector('input, textarea, select');
            }

            // If still not found, try to find by name or other attributes
            if (!input) {
                // Extract possible id/name from label text
                const possibleId = labelText.replace(/\s+/g, '_');
                input = document.querySelector(`#${possibleId}, [name="${possibleId}"], [name*="${possibleId}"]`);
            }

            if (input && !input.disabled && input.offsetParent !== null) {
                input.value = fieldValue;
                triggerEvents(input);
                filled++;
            }
        }
    });

    return filled;
}

// Trigger input events
function triggerEvents(element) {
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
}

// Show visual feedback for filled fields
function showAutofillFeedback(filledCount) {
    // Highlight filled fields temporarily
    const filledFields = document.querySelectorAll('input[value]:not([value=""]), textarea[value]:not([value=""])');

    filledFields.forEach(field => {
        const originalBorder = field.style.border;
        const originalBackground = field.style.backgroundColor;

        // Add highlight
        field.style.border = '2px solid #3498db';
        field.style.backgroundColor = '#ebf5fb';

        // Remove highlight after 2 seconds
        setTimeout(() => {
            field.style.border = originalBorder;
            field.style.backgroundColor = originalBackground;
        }, 2000);
    });

    // Show notification if fields were filled
    if (filledCount > 0) {
        showNotification(`${filledCount} fields filled successfully!`);
    }
}

// Show a temporary notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #2ecc71;
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);

    // Add CSS animations
    if (!document.querySelector('#autofill-styles')) {
        const style = document.createElement('style');
        style.id = 'autofill-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}