import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import demoSession from '../public/demo-session.jsonl?raw';
import { PromptQuantWidget } from './ui/widget.js';

const container = document.getElementById('app');
const loader = document.getElementById('initialLoader');

const widget = new PromptQuantWidget({
  showHeader: true,
  title: 'Prompt Quant Starmap',
  navigation: {
    position: 'bottom-center',
    showCounter: true,
    showTimeline: true
  },
  details: {
    position: 'right',
    width: 380,
    showMetrics: true,
    showFullText: true
  }
});

function showToast(message) {
  let toast = document.getElementById('pqv-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'pqv-toast';
    toast.className = 'pqv-toast';
    toast.setAttribute('role', 'alert');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 5200);
}

function hideLoader() {
  if (!loader || loader.classList.contains('hidden')) return;
  loader.classList.add('hidden');
  window.setTimeout(() => {
    loader.hidden = true;
  }, 450);
}

widget.on('ready', () => {
  window.setTimeout(hideLoader, 180);
});

widget.on('error', ({ error }) => {
  console.error(error);
  showToast(error?.message || 'Something went wrong while reading that session.');
  hideLoader();
});

widget.mount(container);

const actions = widget.getActionsElement();
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.jsonl,.json,application/json,text/plain';
fileInput.className = 'pqv-sr-only';

if (actions) {
  const helpButton = document.createElement('button');
  helpButton.type = 'button';
  helpButton.className = 'pqv-toolbar__btn';
  helpButton.textContent = 'Help';
  helpButton.setAttribute('aria-haspopup', 'dialog');
  helpButton.addEventListener('click', () => openHelp());

  const fileLabel = document.createElement('label');
  fileLabel.className = 'pqv-toolbar__btn';
  fileLabel.append(document.createTextNode('Load session'), fileInput);
  actions.append(helpButton, fileLabel);
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (!file) return;

  try {
    const text = await file.text();
    const sessionId = file.name.replace(/\.jsonl?$/i, '') || 'upload';
    const result = widget.loadSessionText(text, sessionId);
    if (result?.success) widget.setStatus('Loaded');
  } catch (err) {
    console.error(err);
    showToast('Could not read that file.');
    widget.setStatus('Error');
  }
});

function openHelp() {
  let dialog = document.getElementById('pqv-help');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'pqv-help';
    dialog.className = 'pqv-help';
    dialog.setAttribute('aria-labelledby', 'pqv-help-title');
    dialog.innerHTML = `
      <form method="dialog" class="pqv-help__card frost-glass">
        <header class="pqv-help__header">
          <h2 id="pqv-help-title">Controls</h2>
          <button type="submit" class="pqv-details__close" aria-label="Close help">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>
        <p>Load a <code>.jsonl</code> transcript, or inspect the built-in demo. Click a node to read the prompt. Drag to orbit, scroll to zoom, and right-drag to pan.</p>
        <ul class="pqv-help__keys">
          <li><span><kbd>Left</kbd> <kbd>Right</kbd></span> Previous and next prompt</li>
          <li><span><kbd>Home</kbd> <kbd>End</kbd></span> First and last prompt</li>
          <li><span><kbd>1</kbd>–<kbd>9</kbd></span> Jump to that prompt</li>
          <li><span><kbd>Esc</kbd></span> Close the details panel</li>
          <li><span><kbd>?</kbd></span> Open this help</li>
          <li><span><kbd>Ctrl</kbd> <kbd>O</kbd></span> Load a session file</li>
        </ul>
      </form>
    `;
    document.body.appendChild(dialog);
  }
  dialog.showModal();
}

document.addEventListener('keydown', (event) => {
  const typing = event.target.closest('input, textarea, select, [contenteditable="true"]');
  if (!typing && (event.key === '?' || (event.shiftKey && event.key === '/'))) {
    event.preventDefault();
    openHelp();
  }
  if ((event.key === 'o' || event.key === 'O') && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    fileInput.click();
  }
});

async function boot() {
  const params = new URLSearchParams(window.location.search);
  const sessionPath = params.get('session');

  try {
    if (sessionPath) {
      const result = await widget.loadSession(sessionPath);
      if (!result?.success) hideLoader();
      return;
    }

    const result = widget.loadSessionText(demoSession, 'demo');
    if (result?.success) widget.setStatus('Demo');
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Could not load the demo session.');
    widget.setStatus('Error');
    hideLoader();
  }
}

boot();
window.pqvWidget = widget;
