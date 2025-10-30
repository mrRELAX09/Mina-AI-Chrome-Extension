function localizeHtml() {
    document.querySelectorAll('[data-i18n-key]').forEach(el => {
        const key = el.getAttribute('data-i18n-key');
        if (key) el.textContent = chrome.i18n.getMessage(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (key) el.title = chrome.i18n.getMessage(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) el.placeholder = chrome.i18n.getMessage(key);
    });
    const titleTag = document.querySelector('title[data-i18n-key]');
    if (titleTag) titleTag.textContent = chrome.i18n.getMessage(titleTag.getAttribute('data-i18n-key'));
}

document.addEventListener('DOMContentLoaded', () => {
    localizeHtml();
    
    const apiKeyInput = document.getElementById('api-key');
    const saveButton = document.getElementById('save-button');
    const statusDiv = document.getElementById('status');
    const themeToggleButton = document.getElementById('theme-toggle-button');
    

    
    function applyTheme(theme) {
        document.body.setAttribute('data-theme', theme); 
        const sunIcon = themeToggleButton.querySelector('.icon-sun');
        const moonIcon = themeToggleButton.querySelector('.icon-moon');
        if (theme === 'dark') {
            moonIcon.style.display = 'none';
            sunIcon.style.display = 'block';
        } else {
            moonIcon.style.display = 'block';
            sunIcon.style.display = 'none';
        }
    }

    chrome.storage.local.get({ theme: 'light' }, data => applyTheme(data.theme));

    themeToggleButton.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        chrome.storage.local.set({ theme: newTheme });
        applyTheme(newTheme);
    });

    
    chrome.storage.local.get(['apiKey'], (result) => {
        if (result.apiKey) apiKeyInput.value = result.apiKey;
    });

    saveButton.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        statusDiv.classList.remove('success', 'error');
        if (apiKey) {
            chrome.storage.local.set({ apiKey: apiKey }, () => {
                statusDiv.textContent = chrome.i18n.getMessage("optionsSaveSuccess");
                statusDiv.classList.add('success');
                setTimeout(() => { statusDiv.textContent = ''; }, 2000);
            });
        } else {
            statusDiv.textContent = chrome.i18n.getMessage("optionsSaveError");
            statusDiv.classList.add('error');
        }
    });

    
});