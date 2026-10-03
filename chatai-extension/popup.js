const API_BASE = 'http://localhost:4000/api/personal-agent';

const agentNameEl = document.getElementById('agent-name');
const messagesContainer = document.getElementById('messages-container');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const btnSummarize = document.getElementById('btn-summarize');
const btnTasks = document.getElementById('btn-tasks');
const btnExplain = document.getElementById('btn-explain');

let currentAgentName = 'Aria';

// 1. Fetch Assistant Profile on load
async function fetchProfile() {
  try {
    const res = await fetch(`${API_BASE}`);
    const data = await res.json();
    if (data.success && data.profile) {
      currentAgentName = data.profile.name || 'Aria';
      if (agentNameEl) agentNameEl.innerText = currentAgentName;
    }
  } catch (err) {
    console.warn('Could not fetch assistant profile:', err);
  }
}

// 2. Append Message to UI
function appendMessage(role, text, authorName = currentAgentName) {
  const msgEl = document.createElement('div');
  msgEl.className = `msg ${role}`;

  const textEl = document.createElement('div');
  textEl.innerText = text;
  msgEl.appendChild(textEl);

  const metaEl = document.createElement('div');
  metaEl.className = 'meta';
  metaEl.innerText = `${role === 'user' ? 'You' : authorName} • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  msgEl.appendChild(metaEl);

  messagesContainer.appendChild(msgEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 3. Send Free-form Chat Message
async function sendMessage(text) {
  if (!text || !text.trim()) return;
  const prompt = text.trim();
  appendMessage('user', prompt);
  chatInput.value = '';
  sendBtn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: prompt })
    });
    const data = await res.json();
    if (data.success && data.message) {
      appendMessage('assistant', data.message.content, data.agentName || currentAgentName);
    } else {
      appendMessage('assistant', data.error || 'Sorry, I ran into an error processing your message.');
    }
  } catch (err) {
    appendMessage('assistant', `Connection error: ${err.message}. Is Chatbolt running locally on port 4000?`);
  } finally {
    sendBtn.disabled = false;
  }
}

// 4. Quick Actions on Current Browser Tab
async function handleQuickAction(action) {
  sendBtn.disabled = true;
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const activeTab = tabs[0];
    const pageUrl = activeTab?.url || '';
    const pageTitle = activeTab?.title || '';

    let userPromptText = '';
    if (action === 'summarize_page') userPromptText = `Summarize page: ${pageTitle}`;
    else if (action === 'extract_tasks') userPromptText = `Extract tasks from: ${pageTitle}`;
    else userPromptText = `Explain page: ${pageTitle}`;

    appendMessage('user', userPromptText);

    // Try executing script to grab page text
    chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => document.body.innerText.slice(0, 4000)
    }, async (results) => {
      const pageContent = results && results[0] ? results[0].result : '';

      try {
        const res = await fetch(`${API_BASE}/extension/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            pageUrl,
            pageTitle,
            pageContent
          })
        });
        const data = await res.json();
        if (data.success && data.response) {
          appendMessage('assistant', data.response, data.agentName || currentAgentName);
        } else {
          appendMessage('assistant', data.error || 'Failed to analyze page content.');
        }
      } catch (err) {
        appendMessage('assistant', `Error connecting to Chatbolt API: ${err.message}`);
      } finally {
        sendBtn.disabled = false;
      }
    });
  });
}

// Event Listeners
if (sendBtn) {
  sendBtn.addEventListener('click', () => sendMessage(chatInput.value));
}
if (chatInput) {
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage(chatInput.value);
  });
}
if (btnSummarize) {
  btnSummarize.addEventListener('click', () => handleQuickAction('summarize_page'));
}
if (btnTasks) {
  btnTasks.addEventListener('click', () => handleQuickAction('extract_tasks'));
}
if (btnExplain) {
  btnExplain.addEventListener('click', () => handleQuickAction('explain_selection'));
}

fetchProfile();
