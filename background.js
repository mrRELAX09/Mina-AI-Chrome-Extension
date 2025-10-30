const MODELS = {
  pro: 'gemini-2.5-pro',
  flash: 'gemini-2.5-flash'
};
let abortController = null;

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ selectedModel: 'flash', theme: 'light' });
    chrome.contextMenus.create({ id: "Mina_main", title: chrome.i18n.getMessage("contextMenuMain"), contexts: ["selection"] });
    chrome.contextMenus.create({ id: "summarize", title: chrome.i18n.getMessage("contextMenuSummarize"), parentId: "Mina_main", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "rewrite", title: chrome.i18n.getMessage("contextMenuRewrite"), parentId: "Mina_main", contexts: ["selection"] });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
    setTimeout(() => {
        chrome.runtime.sendMessage({ type: 'NEW_TASK', action: info.menuItemId, text: info.selectionText });
    }, 100);
});

async function cropImage(imageDataUrl, rect) {
    if (!(await chrome.offscreen.hasDocument())) {
        await chrome.offscreen.createDocument({
            url: 'cropper.html',
            reasons: [chrome.offscreen.Reason.DOM_PARSER],
            justification: 'Image cropping requires a canvas.',
        });
    }
    const croppedUrl = await chrome.runtime.sendMessage({ type: 'CROP_IMAGE', imageDataUrl, rect });
    await chrome.offscreen.closeDocument();
    return croppedUrl;
}

async function handleScreenCapture(tab, rect) {
    await chrome.sidePanel.open({ tabId: tab.id });
    const imageDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 90 });
    const finalImageDataUrl = await cropImage(imageDataUrl, rect);
    chrome.runtime.sendMessage({ type: 'NEW_TASK', action: 'analyze_screen', imageDataUrl: finalImageDataUrl });
}



async function getPageContentAndSummarize(tabId) {
    try {
        
        chrome.tabs.sendMessage(tabId, { type: 'GET_MAIN_CONTENT' }, (response) => {
            if (chrome.runtime.lastError) {
                
                console.error("Sayfa içeriği alınamadı (scripting hatası):", chrome.runtime.lastError.message);
                chrome.runtime.sendMessage({ type: 'AI_ERROR', error: `${chrome.i18n.getMessage("errorGetPageContent")} (${chrome.runtime.lastError.message})` });
            } else if (response && response.content) {
                
                runAiTask('summarize_page', response.content);
            } else {
                
                console.error("Sayfa içeriği alınamadı (içerik boş).");
                chrome.runtime.sendMessage({ type: 'AI_ERROR', error: chrome.i18n.getMessage("errorGetPageContent") });
            }
        });
    } catch (error) {
        console.error("Sayfa içeriği istenirken hata:", error);
        chrome.runtime.sendMessage({ type: 'AI_ERROR', error: error.message });
    }
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'RUN_AI') {
        
        runAiTask(message.action, message.data, message.imageDataUrl);
        return true;
    }
    if (message.type === 'SELECTION_COMPLETE') {
        handleScreenCapture(sender.tab, message.rect);
        return true;
    }
    if (message.type === 'SUMMARIZE_CURRENT_PAGE') {
        (async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.id) {
                
                getPageContentAndSummarize(tab.id);
            } else {
                chrome.runtime.sendMessage({ type: 'AI_ERROR', error: chrome.i18n.getMessage("errorNoActiveTab") });
            }
        })();
        return true;
    }
    if (message.type === 'STOP_GENERATING') {
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
        return true;
    }
});



async function runAiTask(action, data, imageDataUrl = null) {
    const { apiKey } = await chrome.storage.local.get('apiKey');

    if (!apiKey) {
        chrome.runtime.sendMessage({ type: 'AI_ERROR', error: "API anahtarı bulunamadı" });
        chrome.runtime.sendMessage({ type: 'AI_STREAM_END' });
        return;
    }

    if (abortController) {
        abortController.abort();
    }
    abortController = new AbortController();
    const signal = abortController.signal;

    const { selectedModel } = await chrome.storage.local.get({ selectedModel: 'flash' });
    let modelName = MODELS[selectedModel];
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${modelName}:streamGenerateContent?key=${apiKey}&alt=sse`;
    
    const parts = []; 
    let contents = [];  

    if (imageDataUrl) {
        
        const finalPrompt = chrome.i18n.getMessage("promptAnalyzeImage");
        parts.push({ text: finalPrompt });
        parts.push({ inline_data: { mime_type: 'image/jpeg', data: imageDataUrl.split(',')[1] } });
        contents = [{ parts: parts }];

    } else if (action === 'chat' && Array.isArray(data)) {
        
        
        contents = data.map(message => ({
            role: message.role,
            parts: [{ text: message.text }]
        }));
        
        const prefix = chrome.i18n.getMessage("promptChatPrefix") || "";
        if (prefix && contents.length > 0) {
            const lastContent = contents[contents.length - 1];
            if (lastContent.role === 'user') {
                lastContent.parts[0].text = prefix + lastContent.parts[0].text;
            }
        }

    } else if (typeof data === 'string' || data instanceof String) {
        
        
        let text = data;
        let finalPrompt;

        switch (action) {
            case 'summarize_page':
                finalPrompt = chrome.i18n.getMessage("promptSummarizePage", [text]);
                break;
            case 'summarize':
                finalPrompt = chrome.i18n.getMessage("promptSummarizeSelection", [text]);
                break;
            case 'rewrite':
                finalPrompt = chrome.i18n.getMessage("promptRewriteSelection", [text]);
                break;
            case 'chat': 
            default:
                const prefix = chrome.i18n.getMessage("promptChatPrefix") || "";
                finalPrompt = prefix + text;
                break;
        }
        parts.push({ text: finalPrompt });
        contents = [{ parts: parts }]; 
        
    } else {
        
        console.error("runAiTask çağrıldı ancak veri (data) yok veya formatı yanlış.");
        chrome.runtime.sendMessage({ type: 'AI_ERROR', error: "İşlenecek veri bulunamadı." });
        chrome.runtime.sendMessage({ type: 'AI_STREAM_END' });
        return;
    }
    
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            
            body: JSON.stringify({ contents: contents }),
            signal: signal
        });

        if (!response.ok) {
            let errorDetails = `API Hatası (HTTP ${response.status})`;
            try {
                const errorJson = await response.json();
                if (errorJson.error && errorJson.error.message) {
                    errorDetails = errorJson.error.message;
                }
            } catch (e) {
                errorDetails = await response.text();
            }
            throw new Error(errorDetails);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.substring(6);
                    try {
                        const parsed = JSON.parse(jsonStr);

                        
                        if (parsed.promptFeedback && parsed.promptFeedback.blockReason) {
                            throw new Error(`İstek güvenlik nedeniyle engellendi: ${parsed.promptFeedback.blockReason}`);
                        }

                        const candidate = parsed.candidates?.[0];
                        if (candidate) {
                            const contentPart = candidate.content?.parts?.[0];
                            const responseText = contentPart?.text;

                            if (responseText) {
                                chrome.runtime.sendMessage({ type: 'AI_CHUNK', chunk: responseText });
                            }

                            
                            if (candidate.finishReason && candidate.finishReason !== "STOP") {
                                console.warn("AI Stream durduruldu, sebep:", candidate.finishReason);
                                
                                
                            }
                        }
                    } catch (error) { 
                        
                         if (!error.message.includes("JSON parse error")) {
                             
                             throw error;
                         }
                    }
                }
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Yapay zeka akışı kullanıcı tarafından durduruldu.');
        } else {
            console.error("API Akış Hatası:", error);
            chrome.runtime.sendMessage({ type: 'AI_ERROR', error: error.message });
        }
    } finally {
        chrome.runtime.sendMessage({ type: 'AI_STREAM_END' });
        abortController = null;
    }
}
