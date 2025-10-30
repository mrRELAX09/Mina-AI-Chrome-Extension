let selectionOverlay = null;
let isCtrlListenerActive = false;
let currentCtrlCaptureSetting = true; 

function addCtrlListener() {
    if (!isCtrlListenerActive) {
        document.addEventListener('keydown', handleCtrlKeyDown);
        isCtrlListenerActive = true;
        console.log("Mina Ctrl listener ADDED");
    }
}

function removeCtrlListener() {
    if (isCtrlListenerActive) {
        document.removeEventListener('keydown', handleCtrlKeyDown);
        isCtrlListenerActive = false;
        console.log("Mina Ctrl listener REMOVED");
    }
}

function handleCtrlKeyDown(event) {
    if (event.key === 'Control' && !event.shiftKey && !event.altKey && !event.metaKey && !document.getElementById('Mina-selection-overlay')) {
        if (currentCtrlCaptureSetting) {
             console.log("Ctrl pressed and enabled, creating overlay.");
             createSelectionOverlay();
        } else {
             console.log("Ctrl pressed but feature is disabled.");
        }
    }
}

function updateCtrlSetting(isEnabled) {
    currentCtrlCaptureSetting = isEnabled;
    if (isEnabled) {
        addCtrlListener();
    } else {
        removeCtrlListener();
    }
     console.log("Mina Ctrl setting updated:", currentCtrlCaptureSetting);
}



function createSelectionOverlay() {
    if (document.getElementById('Mina-selection-overlay')) return;

    selectionOverlay = document.createElement('div');
    selectionOverlay.id = 'Mina-selection-overlay';
    Object.assign(selectionOverlay.style, {
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.4)', zIndex: '2147483647', cursor: 'crosshair'
    });
    selectionOverlay.addEventListener('mousedown', startSelection);
    document.body.appendChild(selectionOverlay);
    document.addEventListener('keydown', handleEscapeOverlay, { once: true });
}

function removeSelectionOverlay() {
    document.removeEventListener('keydown', handleEscapeOverlay);
    if (selectionOverlay && selectionOverlay.parentNode) {
        selectionOverlay.removeEventListener('mousedown', startSelection);
        selectionOverlay.parentNode.removeChild(selectionOverlay);
    }
    selectionOverlay = null;
}

function startSelection(e) {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;

    const selectionBox = document.createElement('div');
    selectionBox.id = 'Mina-selection-box';
    Object.assign(selectionBox.style, {
        position: 'fixed', border: '2px dashed #00bfff', backgroundColor: 'rgba(0, 191, 255, 0.2)',
        left: `${startX}px`, top: `${startY}px`, width: '0px', height: '0px',
        zIndex: '2147483647'
    });
    document.body.appendChild(selectionBox);

    const duringSelectionHandler = (eMove) => {
        const width = eMove.clientX - startX;
        const height = eMove.clientY - startY;
        selectionBox.style.width = `${Math.abs(width)}px`;
        selectionBox.style.height = `${Math.abs(height)}px`;
        selectionBox.style.left = `${width > 0 ? startX : eMove.clientX}px`;
        selectionBox.style.top = `${height > 0 ? startY : eMove.clientY}px`;
    };

    const endSelectionHandler = () => {
        window.removeEventListener('mousemove', duringSelectionHandler);
        
        
        const box = document.getElementById('Mina-selection-box');
        if (box) {
            const rect = box.getBoundingClientRect();
             if (box.parentNode) {
                box.parentNode.removeChild(box);
            }
            if (rect.width > 10 && rect.height > 10) {
                chrome.runtime.sendMessage({
                    type: 'SELECTION_COMPLETE',
                    rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
                });
            }
        }
        removeSelectionOverlay();
    };

    window.addEventListener('mousemove', duringSelectionHandler);
    window.addEventListener('mouseup', endSelectionHandler, { once: true });
}

function handleEscapeOverlay(e) {
    if (e.key === 'Escape') {
         console.log("ESC pressed, removing overlay.");
        const box = document.getElementById('Mina-selection-box');
        if (box && box.parentNode) {
            box.parentNode.removeChild(box);
        }
        removeSelectionOverlay();
    }
}


chrome.storage.local.get({ ctrlCaptureEnabled: true }, (result) => {
    updateCtrlSetting(result.ctrlCaptureEnabled);
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.ctrlCaptureEnabled) {
        const newValue = changes.ctrlCaptureEnabled.newValue;
        updateCtrlSetting(newValue);
    }
});



chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_MAIN_CONTENT') {
        const mainContent = findMainContent();
        
        
        const contentToSend = mainContent || document.body.innerText;
        
        if (contentToSend) {
            sendResponse({ content: contentToSend });
        } else {
            
            sendResponse({ content: null });
        }
        return true; 
    }
});


function findMainContent() {
    
    const selectors = ['main', 'article', '[role="main"]', '#main-content', '#content', '.post-body', '.article-content'];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        
        if (element) {
            return getCleanText(element);
        }
    }

    
    
    let bestCandidate = null;
    let maxScore = 0;

    document.querySelectorAll('div, section').forEach(element => {
        
        if (element.offsetParent === null || element.clientHeight < 100) return;
        
        
        const role = element.getAttribute('role') || '';
        const id = element.id.toLowerCase();
        const className = element.className.toLowerCase();
        
        if (role.includes('nav') || role.includes('menu') || role.includes('banner') || role.includes('footer') ||
            id.includes('nav') || id.includes('menu') || id.includes('header') || id.includes('footer') || id.includes('sidebar') ||
            className.includes('nav') || className.includes('menu') || className.includes('header') || className.includes('footer') || className.includes('sidebar')) {
            return;
        }

        
        const paragraphs = element.querySelectorAll('p').length;
        
        const textLength = element.innerText.length;

        const score = paragraphs * 10 + (textLength / 100);

        if (score > 100 && score > maxScore) {
             
             let parent = element.parentElement;
             let isClean = true;
             for (let i = 0; i < 3; i++) { 
                 if (!parent || parent.tagName === 'BODY') break;
                 const parentId = parent.id.toLowerCase();
                 const parentClass = parent.className.toLowerCase();
                 if (parentId.includes('sidebar') || parentClass.includes('sidebar') || 
                     parentId.includes('nav') || parentClass.includes('nav')) {
                     isClean = false;
                     break;
                 }
                 parent = parent.parentElement;
             }
            
             if (isClean) {
                maxScore = score;
                bestCandidate = element;
             }
        }
    });

    if (bestCandidate) {
        return getCleanText(bestCandidate);
    }
    
    
    return null; 
}


function getCleanText(element) {
    
    const clone = element.cloneNode(true);
    
    
    clone.querySelectorAll('nav, aside, footer, header, script, style, [role="navigation"], [role="complementary"]').forEach(el => {
        el.remove();
    });
    
    return clone.innerText;
}
