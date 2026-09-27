export function initSignaturePad(canvasId, clearBtnId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    
    // Set white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    function draw(e) {
        if (!isDrawing) return;
        
        // Prevent scrolling on touch
        if (e.type.includes('touch')) e.preventDefault();
        
        const rect = canvas.getBoundingClientRect();
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        const x = (clientX - rect.left) * (rect.width ? canvas.width / rect.width : 1);
        const y = (clientY - rect.top) * (rect.height ? canvas.height / rect.height : 1);
        
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        [lastX, lastY] = [x, y];
    }
    
    function startPosition(e) {
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        lastX = (clientX - rect.left) * (rect.width ? canvas.width / rect.width : 1);
        lastY = (clientY - rect.top) * (rect.height ? canvas.height / rect.height : 1);
        draw(e);
    }
    
    function endPosition() {
        isDrawing = false;
        ctx.beginPath();
    }
    
    canvas.addEventListener('mousedown', startPosition);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endPosition);
    canvas.addEventListener('mouseout', endPosition);
    
    canvas.addEventListener('touchstart', startPosition, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', endPosition);
    
    const clearBtn = document.getElementById(clearBtnId);
    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        });
    }
    
    return {
        getDataUrl: () => canvas.toDataURL('image/png'),
        isEmpty: () => {
            const blank = document.createElement('canvas');
            blank.width = canvas.width;
            blank.height = canvas.height;
            const bCtx = blank.getContext('2d');
            bCtx.fillStyle = "#ffffff";
            bCtx.fillRect(0, 0, blank.width, blank.height);
            return canvas.toDataURL() === blank.toDataURL();
        }
    };
}
