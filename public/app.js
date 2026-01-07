
async function handleFeedbackSubmit() {
    const message = els.feedbackMsg.value.trim();
    const contact = els.feedbackContact.value.trim();
    
    if (!message) {
        alert('請輸入您的意見內容');
        return;
    }
    
    els.feedbackSubmit.disabled = true;
    els.feedbackSubmit.innerHTML = '送出中...';
    
    try {
        const res = await fetch(`${API_BASE}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, contact })
        });
        
        const json = await res.json();
        if (json.ok) {
            alert('感謝您的回饋！');
            els.feedbackMsg.value = '';
            els.feedbackContact.value = '';
            els.feedbackModal.classList.add('hidden');
        } else {
            alert(json.error || '送出失敗');
        }
    } catch (e) {
        alert('連線錯誤，請稍後再試');
    } finally {
        els.feedbackSubmit.disabled = false;
        els.feedbackSubmit.innerHTML = '送出';
    }
}
