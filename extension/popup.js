// ─── SportTrace Extension — Popup Logic ─────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const scanBtn = document.getElementById('scanBtn');
  const scanSection = document.getElementById('scanSection');
  const scanningSection = document.getElementById('scanningSection');
  const resultsSection = document.getElementById('resultsSection');
  const progressFill = document.getElementById('progressFill');
  const statusBadge = document.getElementById('statusBadge');
  const pageUrl = document.getElementById('pageUrl');
  const mediaCount = document.getElementById('mediaCount');
  const watermarkCount = document.getElementById('watermarkCount');
  const enforcementCount = document.getElementById('enforcementCount');
  const detectionsList = document.getElementById('detectionsList');
  const noWatermarks = document.getElementById('noWatermarks');

  // Show current page URL
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    pageUrl.textContent = tab.url || '—';
  }

  // Check for cached results
  const cached = await chrome.storage.local.get('lastScan');
  if (cached.lastScan && tab && cached.lastScan.pageUrl === tab.url) {
    const age = Date.now() - cached.lastScan.timestamp;
    if (age < 5 * 60 * 1000) {
      // Show cached results if less than 5 minutes old
      showResults(cached.lastScan);
    }
  }

  // Scan button click
  scanBtn.addEventListener('click', async () => {
    if (!tab || !tab.id) return;

    // Switch to scanning state
    scanSection.classList.add('hidden');
    scanningSection.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    statusBadge.textContent = 'SCANNING';
    statusBadge.className = 'header-badge scanning';

    // Animate progress
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress = Math.min(progress + 3, 85);
      progressFill.style.width = progress + '%';
    }, 100);

    try {
      // Inject and run the content script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });

      // Wait for results from background (via storage)
      let attempts = 0;
      const maxAttempts = 50; // 10 seconds max

      const pollResults = () => {
        return new Promise((resolve) => {
          const poll = setInterval(async () => {
            attempts++;
            const data = await chrome.storage.local.get('lastScan');
            if (
              data.lastScan &&
              data.lastScan.pageUrl === tab.url &&
              Date.now() - data.lastScan.timestamp < 15000
            ) {
              clearInterval(poll);
              resolve(data.lastScan);
            } else if (attempts >= maxAttempts) {
              clearInterval(poll);
              resolve(null);
            }
          }, 200);
        });
      };

      const results = await pollResults();

      clearInterval(progressInterval);
      progressFill.style.width = '100%';

      setTimeout(() => {
        scanningSection.classList.add('hidden');
        if (results) {
          showResults(results);
        } else {
          // No results — show empty state
          showResults({
            totalMedia: 0,
            watermarksFound: 0,
            results: [],
          });
        }
      }, 400);
    } catch (err) {
      clearInterval(progressInterval);
      scanningSection.classList.add('hidden');
      scanSection.classList.remove('hidden');
      statusBadge.textContent = 'ERROR';
      statusBadge.className = 'header-badge alert';
      console.error('Scan failed:', err);
    }
  });

  function showResults(data) {
    resultsSection.classList.remove('hidden');
    scanSection.classList.add('hidden');
    scanningSection.classList.add('hidden');

    const total = data.totalMedia || 0;
    const wm = data.watermarksFound || 0;
    const enf = data.results ? data.results.filter((r) => r.enforcement).length : 0;

    mediaCount.textContent = total;
    watermarkCount.textContent = wm;
    enforcementCount.textContent = enf;

    // Update status badge
    if (wm > 0) {
      statusBadge.textContent = 'PIRACY DETECTED';
      statusBadge.className = 'header-badge alert';
    } else {
      statusBadge.textContent = 'CLEAN';
      statusBadge.className = 'header-badge clean';
    }

    // Clear and populate detections list
    detectionsList.innerHTML = '';

    if (data.results && data.results.length > 0) {
      noWatermarks.classList.add('hidden');

      data.results.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'detection-card' + (item.token ? '' : ' no-watermark');

        let statusHtml = '';
        if (item.error) {
          statusHtml = '<span class="detection-status error">CORS BLOCKED</span>';
        } else if (item.token) {
          statusHtml = '<span class="detection-status found">⚠ WATERMARK FOUND</span>';
        } else {
          statusHtml = '<span class="detection-status clean">CLEAN</span>';
        }

        let detailsHtml = `
          <div class="detail-row">
            <span class="detail-label">Source</span>
            <span class="detail-value">${escapeHtml(item.src || '—')}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Size</span>
            <span class="detail-value">${item.width}×${item.height}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Confidence</span>
            <span class="detail-value">${(item.confidence * 100).toFixed(1)}%</span>
          </div>
        `;

        if (item.token) {
          detailsHtml += `
            <div class="detail-row">
              <span class="detail-label">Token</span>
              <span class="detail-value token">${item.token}</span>
            </div>
          `;
        }

        if (item.assetMatch) {
          detailsHtml += `
            <div class="detail-row">
              <span class="detail-label">Registered Owner</span>
              <span class="detail-value asset-match">${escapeHtml(item.assetMatch.owner)} — ${escapeHtml(item.assetMatch.name)}</span>
            </div>
          `;
        }

        if (item.enforcement) {
          detailsHtml += `
            <div class="detail-row">
              <span class="detail-label">Enforcement</span>
              <span class="detail-value enforcement">DMCA PENDING #${item.enforcement.id.slice(0, 8)}</span>
            </div>
          `;
        }

        card.innerHTML = `
          <div class="detection-header">
            <div class="detection-type">
              <span class="detection-type-badge ${item.type}">${item.type.toUpperCase()}</span>
            </div>
            ${statusHtml}
          </div>
          <div class="detection-details">${detailsHtml}</div>
        `;

        detectionsList.appendChild(card);
      });
    } else {
      noWatermarks.classList.remove('hidden');
    }

    // Show re-scan option
    const rescanDiv = document.createElement('div');
    rescanDiv.style.cssText = 'text-align:center; margin-top:12px;';
    rescanDiv.innerHTML = `<button id="rescanBtn" style="
      background: transparent;
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      padding: 8px 16px;
      border-radius: 8px;
      font-family: inherit;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    ">Scan Again</button>`;
    detectionsList.appendChild(rescanDiv);

    document.getElementById('rescanBtn')?.addEventListener('click', () => {
      resultsSection.classList.add('hidden');
      scanSection.classList.remove('hidden');
      statusBadge.textContent = 'READY';
      statusBadge.className = 'header-badge';
      progressFill.style.width = '0%';
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});
