chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'CROP_IMAGE') {
        cropImage(request.imageDataUrl, request.rect).then(sendResponse);
        return true; 
    }
});

function cropImage(imageDataUrl, rect) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;

            
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;

            ctx.drawImage(
                img,
                rect.x * dpr,
                rect.y * dpr,
                rect.width * dpr,
                rect.height * dpr,
                0, 0,
                canvas.width,
                canvas.height
            );
            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.src = imageDataUrl;
    });
}