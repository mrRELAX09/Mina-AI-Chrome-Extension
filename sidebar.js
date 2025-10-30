
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
    document.title = chrome.i18n.getMessage("appName");
}


const welcomeContainer = document.getElementById('welcome-container');
const chatContainer = document.getElementById('chat-container');
const chatHistory = document.getElementById('chat-history');
const promptForm = document.getElementById('prompt-form');
const promptInput = document.getElementById('prompt-input');
const promptButton = document.getElementById('prompt-button');
const newChatButton = document.getElementById('new-chat-button');
const copyChatButton = document.getElementById('copy-chat-button');
const themeToggleButton = document.getElementById('theme-toggle-button');
const settingsButton = document.getElementById('settings-button');
const modelButtons = document.querySelectorAll('.model-btn');
const summarizePageButton = document.getElementById('summarize-page-button');
const stopButton = document.getElementById('stop-button');
const quickActionsContainer = document.getElementById('quick-actions-container');
const summarizePageQuickButton = document.getElementById('summarize-page-quick-button');
const ctrlCaptureToggleHeader = document.getElementById('ctrl-capture-toggle-header');

let currentAiMessageBubble = null;
let isFirstChunk = true;
let fullResponseText = '';
let chatHistoryArray = [];



function triggerPageSummarize() {
    startChat();
    const userBubble = createMessageBubble('user');
    userBubble.textContent = chrome.i18n.getMessage("userPromptSummarizePage");
    promptButton.style.display = 'none';
    stopButton.style.display = 'flex';
    isFirstChunk = true;
    fullResponseText = '';

    currentAiMessageBubble = createMessageBubble('ai'); 

    currentAiMessageBubble.innerHTML = `<div class="thinking-animation"><div class="dot-flashing"></div></div>`;
    currentAiMessageBubble.classList.add('streaming');

    scrollToBottom();
    chrome.runtime.sendMessage({ type: 'SUMMARIZE_CURRENT_PAGE' });
}

function startChat() {
    if (welcomeContainer.style.display !== 'none') {
        welcomeContainer.style.display = 'none';
        chatHistory.style.display = 'flex';
        quickActionsContainer.style.display = 'flex';
    }
}

function createMessageBubble(sender) {
    startChat();
    const wrapper = document.createElement('div');
    wrapper.classList.add('message-wrapper', `${sender}-wrapper`);

    if (sender === 'ai') {
        const icon = document.createElement('div');
        icon.classList.add('message-icon');
        icon.innerHTML = `<img src="icons/icon48.png" alt="AI" width="24" height="24">`;
        wrapper.appendChild(icon);
    }

    const messageBubble = document.createElement('div');
    messageBubble.classList.add('message-bubble', `${sender}-message`);
    wrapper.appendChild(messageBubble);
    chatHistory.appendChild(wrapper);

    
    
    if (sender === 'ai') {
        requestAnimationFrame(() => {
            wrapper.classList.add('animate-message-in');
        });
    }
    

    return messageBubble;
}

function scrollToBottom() {
    setTimeout(() => { 
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 50);
}


function startAiTask(action, data, imageDataUrl = null) {
    isFirstChunk = true;
    fullResponseText = '';
    promptButton.style.display = 'none';
    stopButton.style.display = 'flex';
    promptInput.value = '';
    promptInput.style.height = 'auto';

    currentAiMessageBubble = createMessageBubble('ai'); 

    currentAiMessageBubble.innerHTML = `<div class="thinking-animation"><div class="dot-flashing"></div></div>`;
    currentAiMessageBubble.classList.add('streaming');

    scrollToBottom();
    chrome.runtime.sendMessage({ type: 'RUN_AI', action, data: data, imageDataUrl: imageDataUrl });
}

function stopAiTask() {
    stopButton.style.display = 'none';
    promptButton.style.display = 'flex';
    promptButton.disabled = false;
    if (currentAiMessageBubble) {
        currentAiMessageBubble.classList.remove('streaming');
        if (isFirstChunk) {
            currentAiMessageBubble.closest('.message-wrapper').remove();
        }
        currentAiMessageBubble = null;
    }
}

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

function updateModelSelectionUI(selectedModel) {
    modelButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.model === selectedModel);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    localizeHtml();
    chrome.storage.local.get({ theme: 'light' }, data => applyTheme(data.theme));
    chrome.storage.local.get({ selectedModel: 'flash' }, data => updateModelSelectionUI(data.selectedModel));
    chrome.storage.local.get({ ctrlCaptureEnabled: true }, (result) => {
        ctrlCaptureToggleHeader.checked = result.ctrlCaptureEnabled;
    });
});
ctrlCaptureToggleHeader.addEventListener('change', (event) => {
    chrome.storage.local.set({ ctrlCaptureEnabled: event.target.checked });
});
themeToggleButton.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    chrome.storage.local.set({ theme: newTheme });
    applyTheme(newTheme);
});
settingsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});
modelButtons.forEach(button => {
    button.addEventListener('click', () => {
        const selectedModel = button.dataset.model;
        chrome.storage.local.set({ selectedModel: selectedModel });
        updateModelSelectionUI(selectedModel);
    });
});
promptForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const userText = promptInput.value.trim();
    if (!userText || promptButton.disabled) return;
    const userBubble = createMessageBubble('user');
    userBubble.textContent = userText;
    scrollToBottom();
    chatHistoryArray.push({ role: 'user', text: userText });
    startAiTask('chat', chatHistoryArray);
});
summarizePageButton.addEventListener('click', triggerPageSummarize);
summarizePageQuickButton.addEventListener('click', triggerPageSummarize);
stopButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'STOP_GENERATING' });
    stopAiTask();
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'NEW_TASK') {
        const userBubble = createMessageBubble('user');
        if (message.action === 'analyze_screen') {
            userBubble.textContent = chrome.i18n.getMessage("userPromptAnalyzeScreen");
            startAiTask('analyze_screen', null, message.imageDataUrl);
        } else {
            const messageKey = message.action === 'rewrite' ? "userPromptContextRewrite" : "userPromptContextSummarize";
            userBubble.textContent = chrome.i18n.getMessage(messageKey, [message.text]);
            startAiTask(message.action, message.text);
        }
        scrollToBottom();
    }
    else if (message.type === 'AI_CHUNK') {
        if (currentAiMessageBubble) {
            if (isFirstChunk) {
                
                currentAiMessageBubble.closest('.message-wrapper').classList.remove('animate-message-in');
                currentAiMessageBubble.innerHTML = ''; 
                isFirstChunk = false;
            }
            fullResponseText += message.chunk;
            currentAiMessageBubble.innerHTML = marked.parse(fullResponseText);
            scrollToBottom();
        }
    }
    else if (message.type === 'AI_STREAM_END' || message.type === 'AI_ERROR') {
        if (currentAiMessageBubble) {
            currentAiMessageBubble.classList.remove('streaming');
            
            currentAiMessageBubble.closest('.message-wrapper').classList.remove('animate-message-in');
        }
        if (message.type === 'AI_STREAM_END' && currentAiMessageBubble && fullResponseText) {
            currentAiMessageBubble.innerHTML = marked.parse(fullResponseText);
            const lastMessage = chatHistoryArray.length > 0 ? chatHistoryArray[chatHistoryArray.length - 1] : null;
            if (lastMessage && lastMessage.role === 'user' && fullResponseText.trim()) {
                 chatHistoryArray.push({ role: 'model', text: fullResponseText });
            }
            scrollToBottom();
        }
        stopButton.style.display = 'none';
        promptButton.style.display = 'flex';
        promptButton.disabled = false;
        if (message.type === 'AI_ERROR' && currentAiMessageBubble) {
            currentAiMessageBubble.classList.add('error-message');
            const apiKeyErrorText = "API anahtarı bulunamadı";
            if (message.error.includes(apiKeyErrorText)) {
                currentAiMessageBubble.innerHTML = `PLEASE ENTER API KEY`; 
                currentAiMessageBubble.querySelector('#go-to-settings-link').addEventListener('click', (e) => {
                    e.preventDefault();
                    chrome.runtime.openOptionsPage();
                });
            } else {
                currentAiMessageBubble.innerHTML = `WRONG PAGE PLEASE REFRESH THE PAGE OR TRY AGAIN ON ANOTHER PAGE`; 
            }
            scrollToBottom();
        }
        currentAiMessageBubble = null;
    }
});
newChatButton.addEventListener('click', () => {
    
    const animatedElements = document.querySelectorAll('.animate-on-load');
    animatedElements.forEach(el => { /* ... */ });
    chatHistory.innerHTML = '';
    chatHistory.style.display = 'none';
    welcomeContainer.style.display = 'flex';
    quickActionsContainer.style.display = 'none';
    promptInput.value = '';
    promptButton.disabled = true;
    chatHistoryArray = [];
});
promptInput.addEventListener('input', () => {
    
    promptInput.style.height = 'auto';
    promptInput.style.height = `${promptInput.scrollHeight}px`;
    promptButton.disabled = promptInput.value.trim() === '';
});
copyChatButton.addEventListener('click', () => {
    
    const messages = Array.from(chatHistory.querySelectorAll('.message-wrapper'));
    if (messages.length === 0) return;
    const conversationText = messages.map(wrapper => { /* ... */ }).join('\n\n---\n\n');
    navigator.clipboard.writeText(conversationText).then(() => { /* ... */ }).catch(err => { /* ... */ });
});