// Antigravity Reconcile - Client Logic

// 1. Application State
const STATE = {
  activeTab: "localFilesTab",
  files: {
    dataSt: { name: "", content: null, loaded: false },
    kfm: { name: "", content: null, loaded: false },
    aba: { name: "", content: null, loaded: false }
  },
  sheets: {
    dataStUrl: "",
    kfmUrl: "",
    abaUrl: ""
  },
  settings: {
    telegramToken: "",
    telegramChatId: "",
    filterOutZeros: true,
    autoAlertTelegram: false
  },
  results: [],
  warnings: [],
  stats: {},
  
  // Table View States
  table: {
    search: "",
    diffFilter: "all",
    sortBy: "st",
    sortOrder: "asc", // 'asc' or 'desc'
    currentPage: 1,
    pageSize: 15
  },
  
  // Chart Instances
  charts: {
    store: null,
    category: null
  }
};

// 2. DOM Elements
const DOM = {
  themeToggle: document.getElementById("themeToggle"),
  sunIcon: document.getElementById("sunIcon"),
  moonIcon: document.getElementById("moonIcon"),
  
  // Tabs
  tabButtons: document.querySelectorAll(".tab-btn"),
  tabContents: document.querySelectorAll(".tab-content"),
  
  // Drag & Drops
  dropZoneSt: document.getElementById("dropZoneSt"),
  dropZoneKfm: document.getElementById("dropZoneKfm"),
  dropZoneAba: document.getElementById("dropZoneAba"),
  fileStInput: document.getElementById("fileStInput"),
  fileKfmInput: document.getElementById("fileKfmInput"),
  fileAbaInput: document.getElementById("fileAbaInput"),
  
  // File Badges & Names
  badgeSt: document.getElementById("badgeDataSt"),
  badgeKfm: document.getElementById("badgeKfm"),
  badgeAba: document.getElementById("badgeAba"),
  nameSt: document.getElementById("nameDataSt"),
  nameKfm: document.getElementById("nameKfm"),
  nameAba: document.getElementById("nameAba"),
  
  // Google Sheets inputs
  sheetStUrl: document.getElementById("sheetStUrl"),
  sheetKfmUrl: document.getElementById("sheetKfmUrl"),
  sheetAbaUrl: document.getElementById("sheetAbaUrl"),
  
  // Control actions
  runReconcileBtn: document.getElementById("runReconcileBtn"),
  logsConsole: document.getElementById("logsConsole"),
  emptyState: document.getElementById("emptyState"),
  resultsDashboard: document.getElementById("resultsDashboard"),
  
  // KPI Numbers
  kpiTotalSt: document.getElementById("kpiTotalSt"),
  kpiMismatchSt: document.getElementById("kpiMismatchSt"),
  kpiTotalDiff: document.getElementById("kpiTotalDiff"),
  kpiStatus: document.getElementById("kpiStatus"),
  
  // Warnings
  warningListUi: document.getElementById("warningListUi"),
  
  // Interactive Table Elements
  reconcileTableBody: document.getElementById("reconcileTableBody"),
  searchTable: document.getElementById("searchTable"),
  filterDiff: document.getElementById("filterDiff"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  paginationInfo: document.getElementById("paginationInfo"),
  tableHeaders: document.querySelectorAll("#reconcileTable th"),
  
  // Modals
  openSettingsBtn: document.getElementById("openSettingsBtn"),
  closeSettingsBtn: document.getElementById("closeSettingsBtn"),
  cancelSettingsBtn: document.getElementById("cancelSettingsBtn"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  settingsModal: document.getElementById("settingsModal"),
  
  // Progress Overlay
  progressOverlay: document.getElementById("progressOverlay"),
  progressBar: document.getElementById("progressBar"),
  progressStatus: document.getElementById("progressStatus"),
  progressTitle: document.getElementById("progressTitle"),
  
  // Telegram Inputs
  telegramToken: document.getElementById("telegramToken"),
  telegramChatId: document.getElementById("telegramChatId"),
  testTelegramBtn: document.getElementById("testTelegramBtn"),
  filterOutZeros: document.getElementById("filterOutZeros"),
  autoAlertTelegram: document.getElementById("autoAlertTelegram")
};

// 3. Worker and Fallback Logic
let reconcileWorker = null;
let useFallback = false;

function initWorker() {
  try {
    if (reconcileWorker) reconcileWorker.terminate();
    
    // Attempt worker creation
    reconcileWorker = new Worker("js/worker.js");
    useFallback = false;
    
    reconcileWorker.onmessage = handleWorkerMessage;
    logToConsole("Đã kích hoạt Web Worker (chế độ chạy nền tối ưu).");
  } catch (e) {
    console.warn("Could not create Web Worker (likely running from file://). Falling back to main-thread execution.", e);
    useFallback = true;
    logToConsole("Chạy chế độ dự phòng Main-Thread (do bảo mật trình duyệt chặn Worker trên file://).");
  }
}

function handleWorkerMessage(e) {
  const { type, percent, message, results, warnings, stats, error } = e.data;
  
  if (type === "progress") {
    updateProgressBar(percent, message);
  } else if (type === "success") {
    onReconcileSuccess(results, warnings, stats);
  } else if (type === "error") {
    onReconcileError(error);
  }
}

function onReconcileSuccess(results, warnings, stats) {
  hideProgress();
  logToConsole("Đối soát hoàn thành thành công!", "success");
  
  STATE.results = results;
  STATE.warnings = warnings;
  STATE.stats = stats;
  
  renderDashboard();
  
  if (STATE.settings.autoAlertTelegram && STATE.results.length > 0) {
    sendTelegramReport();
  }
}

function onReconcileError(error) {
  hideProgress();
  logToConsole(`LỖI ENGINE: ${error}`, "error");
  alert(`Đã xảy ra lỗi khi đối soát dữ liệu: ${error}`);
}

// Emulates Web Worker logic inside the main thread with timeouts to yield and render progress bar
function runReconcileMainThread(dataStFile, kfmFile, abaFile) {
  setTimeout(() => {
    try {
      updateProgressBar(10, "Đang phân tích file danh mục DATA ST...");
      setTimeout(() => {
        try {
          const stData = parseFile(dataStFile.content, dataStFile.name);
          const stMapping = buildStMapping(stData);

          updateProgressBar(35, "Đang phân tích file xuất hàng KFM (Lọc mã C)...");
          setTimeout(() => {
            try {
              const kfmData = parseFile(kfmFile.content, kfmFile.name);
              const { kfmDict, productNameMap } = processKfm(kfmData, stMapping);

              updateProgressBar(65, "Đang phân tích file giao hàng ABA...");
              setTimeout(() => {
                try {
                  const abaData = parseFile(abaFile.content, abaFile.name);
                  const { abaDict, productMetaMap } = processAba(abaData, productNameMap);

                  updateProgressBar(85, "Đang đối soát và tính chênh lệch...");
                  setTimeout(() => {
                    try {
                      const reconciliation = performReconciliation(kfmDict, abaDict, productNameMap, productMetaMap);
                      
                      updateProgressBar(100, "Hoàn thành!");
                      setTimeout(() => {
                        onReconcileSuccess(reconciliation.results, reconciliation.warnings, reconciliation.stats);
                      }, 100);
                    } catch (error) { onReconcileError(error.message); }
                  }, 100);
                } catch (error) { onReconcileError(error.message); }
              }, 100);
            } catch (error) { onReconcileError(error.message); }
          }, 100);
        } catch (error) { onReconcileError(error.message); }
      }, 100);
    } catch (error) { onReconcileError(error.message); }
  }, 100);
}

// 4. Initialize App
window.addEventListener("DOMContentLoaded", () => {
  loadCachedSettings();
  initWorker();
  setupEventListeners();
  checkReadyToRun();
  logToConsole("Hệ thống đã khởi động. Sẵn sàng nạp dữ liệu.");
  autoLoadRepoData(); // Tự động nạp dữ liệu từ máy chủ
});

// Setup All Event Listeners
function setupEventListeners() {
  // Theme Toggle
  DOM.themeToggle.addEventListener("click", toggleTheme);
  
  // Tab change
  DOM.tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      DOM.tabButtons.forEach(b => b.classList.remove("active"));
      DOM.tabContents.forEach(c => c.classList.remove("active"));
      
      btn.classList.add("active");
      const tabId = btn.getAttribute("data-tab");
      document.getElementById(tabId).classList.add("active");
      
      STATE.activeTab = tabId;
      checkReadyToRun();
    });
  });
  
  // Setup Drag & Drop zones
  if (DOM.dropZoneSt && DOM.fileStInput) setupDragAndDrop(DOM.dropZoneSt, DOM.fileStInput, "dataSt");
  if (DOM.dropZoneKfm && DOM.fileKfmInput) setupDragAndDrop(DOM.dropZoneKfm, DOM.fileKfmInput, "kfm");
  if (DOM.dropZoneAba && DOM.fileAbaInput) setupDragAndDrop(DOM.dropZoneAba, DOM.fileAbaInput, "aba");
  
  // Google Sheets inputs change
  if (DOM.sheetStUrl && DOM.sheetKfmUrl && DOM.sheetAbaUrl) {
    [DOM.sheetStUrl, DOM.sheetKfmUrl, DOM.sheetAbaUrl].forEach(input => {
      input.addEventListener("input", () => {
        STATE.sheets.dataStUrl = DOM.sheetStUrl.value.trim();
        STATE.sheets.kfmUrl = DOM.sheetKfmUrl.value.trim();
        STATE.sheets.abaUrl = DOM.sheetAbaUrl.value.trim();
        
        localStorage.setItem("sheets_config", JSON.stringify(STATE.sheets));
        checkReadyToRun();
      });
    });
  }
  
  // Run Reconcile Button
  if (DOM.runReconcileBtn) DOM.runReconcileBtn.addEventListener("click", runReconcile);
  
  // Interactive Table events
  DOM.searchTable.addEventListener("input", (e) => {
    STATE.table.search = e.target.value;
    STATE.table.currentPage = 1;
    updateTableView();
  });
  
  DOM.filterDiff.addEventListener("change", (e) => {
    STATE.table.diffFilter = e.target.value;
    STATE.table.currentPage = 1;
    updateTableView();
  });
  
  DOM.exportCsvBtn.addEventListener("click", exportToCsv);
  
  DOM.prevPageBtn.addEventListener("click", () => {
    if (STATE.table.currentPage > 1) {
      STATE.table.currentPage--;
      updateTableView();
    }
  });
  
  DOM.nextPageBtn.addEventListener("click", () => {
    const filtered = getFilteredData();
    const maxPage = Math.ceil(filtered.length / STATE.table.pageSize);
    if (STATE.table.currentPage < maxPage) {
      STATE.table.currentPage++;
      updateTableView();
    }
  });
  
  DOM.tableHeaders.forEach(th => {
    th.addEventListener("click", () => {
      const field = th.getAttribute("data-sort");
      if (!field) return;
      
      if (STATE.table.sortBy === field) {
        STATE.table.sortOrder = STATE.table.sortOrder === "asc" ? "desc" : "asc";
      } else {
        STATE.table.sortBy = field;
        STATE.table.sortOrder = "asc";
      }
      
      // Update sort icons
      DOM.tableHeaders.forEach(h => {
        const icon = h.querySelector(".sort-icon");
        if (icon) icon.innerText = "↕";
      });
      const currentIcon = th.querySelector(".sort-icon");
      if (currentIcon) {
        currentIcon.innerText = STATE.table.sortOrder === "asc" ? "↑" : "↓";
      }
      
      updateTableView();
    });
  });
  
  // Settings Modals Actions
  DOM.openSettingsBtn.addEventListener("click", () => DOM.settingsModal.classList.add("active"));
  [DOM.closeSettingsBtn, DOM.cancelSettingsBtn, DOM.settingsModal].forEach(el => {
    el.addEventListener("click", (e) => {
      if (e.target === el) DOM.settingsModal.classList.remove("active");
    });
  });
  
  DOM.saveSettingsBtn.addEventListener("click", saveSettings);
  
  // Test Telegram button
  DOM.testTelegramBtn.addEventListener("click", testTelegram);
}

// 5. Drag and Drop File Handlers
function setupDragAndDrop(dropZone, fileInput, fileKey) {
  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("click", (e) => e.stopPropagation());
  
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });
  
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0], fileKey);
    }
  });
  
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleFileSelected(e.target.files[0], fileKey);
    }
  });
}

function handleFileSelected(file, fileKey) {
  STATE.files[fileKey].name = file.name;
  
  logToConsole(`Đang nạp file cục bộ [${fileKey.toUpperCase()}]: ${file.name}...`);
  
  const reader = new FileReader();
  reader.onload = function(e) {
    STATE.files[fileKey].content = e.target.result; // ArrayBuffer
    STATE.files[fileKey].loaded = true;
    
    // Update badge & styles in UI
    const nameEl = document.getElementById(`name${fileKey.charAt(0).toUpperCase() + fileKey.slice(1)}`);
    const badgeEl = document.getElementById(`badge${fileKey.charAt(0).toUpperCase() + fileKey.slice(1)}`);
    
    nameEl.innerText = file.name;
    badgeEl.innerText = "Đã nạp";
    badgeEl.className = "status-badge loaded";
    
    logToConsole(`Nạp thành công [${fileKey.toUpperCase()}] (${(file.size / 1024).toFixed(1)} KB).`, "success");
    checkReadyToRun();
  };
  reader.readAsArrayBuffer(file);
}

// 6. Config / Ready Verification
function checkReadyToRun() {
  let ready = false;
  if (STATE.activeTab === "localFilesTab") {
    ready = STATE.files.dataSt.loaded && STATE.files.kfm.loaded && STATE.files.aba.loaded;
  } else {
    ready = STATE.sheets.dataStUrl !== "" && STATE.sheets.kfmUrl !== "" && STATE.sheets.abaUrl !== "";
  }
  
  if (DOM.runReconcileBtn) DOM.runReconcileBtn.disabled = !ready;
}

async function autoLoadRepoData() {
  logToConsole("Đang kiểm tra dữ liệu đối soát mới nhất trên máy chủ...");
  
  // Load status metadata
  try {
    const statusUrl = "Ouput/status.json";
    const resStatus = await fetch(statusUrl);
    if (resStatus.ok) {
      const status = await resStatus.json();
      document.getElementById("syncLastUpdated").innerText = status.lastUpdated || "N/A";
      document.getElementById("syncReconcileDate").innerText = status.kfmDate || "N/A";
      document.getElementById("syncKfmFile").innerText = status.kfmFile || "N/A";
      document.getElementById("syncAbaFile").innerText = status.abaFile || "N/A";
      logToConsole(`Đã nạp trạng thái đồng bộ: Đối soát ngày ${status.kfmDate}.`);
    } else {
      document.getElementById("syncLastUpdated").innerText = "Chưa có dữ liệu";
      document.getElementById("syncReconcileDate").innerText = "Chưa có dữ liệu";
      document.getElementById("syncKfmFile").innerText = "Chưa có dữ liệu";
      document.getElementById("syncAbaFile").innerText = "Chưa có dữ liệu";
    }
  } catch (statusErr) {
    console.error("Could not load status.json", statusErr);
  }

  try {
    const dataStUrl = "Data/Data ST/DATA ST.xlsx";
    const kfmUrl = "Data/KFM/KFM.xlsx";
    const abaUrl = "Data/ABA/ABA.xlsx";
    
    // Check if files are accessible
    const [resSt, resKfm, resAba] = await Promise.all([
      fetch(dataStUrl),
      fetch(kfmUrl),
      fetch(abaUrl)
    ]);
    
    if (!resSt.ok || !resKfm.ok || !resAba.ok) {
      logToConsole("Không tìm thấy dữ liệu tự động sẵn có trên máy chủ. Bạn có thể kéo thả file để chạy đối soát thủ công.");
      return;
    }
    
    logToConsole("Tìm thấy dữ liệu tự động. Đang tải và phân tích...");
    
    const [bufSt, bufKfm, bufAba] = await Promise.all([
      resSt.arrayBuffer(),
      resKfm.arrayBuffer(),
      resAba.arrayBuffer()
    ]);
    
    STATE.files.dataSt = { name: "DATA ST.xlsx", content: bufSt, loaded: true };
    STATE.files.kfm = { name: "KFM.xlsx", content: bufKfm, loaded: true };
    STATE.files.aba = { name: "ABA.xlsx", content: bufAba, loaded: true };
    
    // Update badge & styles in UI
    ["dataSt", "kfm", "aba"].forEach(fileKey => {
      const nameEl = document.getElementById(`name${fileKey.charAt(0).toUpperCase() + fileKey.slice(1)}`);
      const badgeEl = document.getElementById(`badge${fileKey.charAt(0).toUpperCase() + fileKey.slice(1)}`);
      if (nameEl && badgeEl) {
        nameEl.innerText = fileKey === "dataSt" ? "DATA ST.xlsx" : (fileKey === "kfm" ? "KFM.xlsx" : "ABA.xlsx");
        badgeEl.innerText = "Tự động nạp";
        badgeEl.className = "status-badge loaded";
      }
    });
    
    logToConsole("Đã nạp tự động 3 file dữ liệu thành công. Đang chạy đối soát...");
    checkReadyToRun();
    
    // Run reconciliation automatically
    runReconcile();
  } catch (err) {
    logToConsole("Không thể tự động tải dữ liệu từ máy chủ. Bạn hãy kéo thả file thủ công.");
    console.error("Auto load failed", err);
  }
}

// 7. Execution Engine / Trigger Reconciliation
async function runReconcile() {
  showProgress("Chuẩn bị đối soát...", 0);
  
  const dataStFile = { name: STATE.files.dataSt.name || "DATA ST.xlsx", content: STATE.files.dataSt.content };
  const kfmFile = { name: STATE.files.kfm.name || "KFM.xlsx", content: STATE.files.kfm.content };
  const abaFile = { name: STATE.files.aba.name || "ABA.xlsx", content: STATE.files.aba.content };

  if (STATE.activeTab === "googleSheetsTab") {
    try {
      updateProgressBar(5, "Đang tải dữ liệu từ Google Sheet DATA ST...");
      dataStFile.content = await fetchSheetCsv(STATE.sheets.dataStUrl);
      dataStFile.name = "DATA ST.csv";
      
      updateProgressBar(20, "Đang tải dữ liệu từ Google Sheet KFM...");
      kfmFile.content = await fetchSheetCsv(STATE.sheets.kfmUrl);
      kfmFile.name = "KFM.csv";
      
      updateProgressBar(45, "Đang tải dữ liệu từ Google Sheet ABA...");
      abaFile.content = await fetchSheetCsv(STATE.sheets.abaUrl);
      abaFile.name = "ABA.csv";
    } catch (err) {
      hideProgress();
      logToConsole(`LỖI Google Sheets: ${err.message}`, "error");
      alert(`Lỗi tải dữ liệu Google Sheets: ${err.message}\nHãy chắc chắn rằng trang tính đã được thiết kế chia sẻ công khai "Anyone with link can view".`);
      return;
    }
  }

  // Choose Web Worker vs Fallback
  if (useFallback) {
    runReconcileMainThread(dataStFile, kfmFile, abaFile);
  } else {
    reconcileWorker.postMessage({
      action: "reconcile",
      dataStFile,
      kfmFile,
      abaFile
    });
  }
}

// Converts a shareable Google Sheets link into a downloadable CSV export URL
function convertSheetsUrlToCsv(url) {
  if (!url) return "";
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return url;
  const id = match[1];
  
  const gidMatch = url.match(/gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

async function fetchSheetCsv(sheetUrl) {
  const csvUrl = convertSheetsUrlToCsv(sheetUrl);
  const response = await fetch(csvUrl);
  if (!response.ok) throw new Error(`Không thể lấy dữ liệu từ Google Sheet (HTTP ${response.status})`);
  return await response.text();
}

// 8. Visual Updates (Dashboard Render & Chart.js drawing)
function renderDashboard() {
  DOM.emptyState.style.display = "none";
  DOM.resultsDashboard.style.display = "flex";
  
  // Set KPIs
  DOM.kpiTotalSt.innerText = STATE.stats.totalSt || 0;
  DOM.kpiMismatchSt.innerText = STATE.stats.mismatchedSt || 0;
  
  // Compute total qty diff
  let totalDiff = 0;
  STATE.results.forEach(r => totalDiff += Math.abs(r.diff));
  DOM.kpiTotalDiff.innerText = totalDiff.toLocaleString();
  
  // Status check
  if (STATE.results.length === 0) {
    DOM.kpiStatus.innerText = "KHỚP 100%";
    DOM.kpiStatus.style.color = "var(--success)";
  } else {
    DOM.kpiStatus.innerText = "CÓ CHÊNH LỆCH";
    DOM.kpiStatus.style.color = "var(--danger)";
  }
  
  // Render Warnings Alerts
  DOM.warningListUi.innerHTML = "";
  if (STATE.warnings.length === 0) {
    DOM.warningListUi.innerHTML = `
      <div style="text-align: center; color: var(--success); font-weight: 600; padding: 20px;">
        ✨ TUYỆT VỜI! Số liệu khớp hoàn toàn, không phát hiện thiếu phiếu.
      </div>
    `;
  } else {
    STATE.warnings.forEach(w => {
      const item = document.createElement("div");
      item.className = "warning-item-ui";
      item.innerHTML = `
        <div class="warning-item-desc">
          Chi nhánh <b>${w.st}</b> lệch nhóm hàng <b>${w.category}</b> (Khả năng chưa tạo phiếu)
        </div>
        <span class="warning-qty-badge">Lệch ${w.diff.toLocaleString()}</span>
      `;
      DOM.warningListUi.appendChild(item);
    });
  }
  
  // Draw charts
  drawStoreChart();
  drawCategoryChart();
  
  // Render Table
  STATE.table.currentPage = 1;
  updateTableView();
}

function drawStoreChart() {
  // Aggregate top mismatched stores
  const storeMap = {};
  STATE.results.forEach(r => {
    storeMap[r.st] = (storeMap[r.st] || 0) + Math.abs(r.diff);
  });
  
  const sortedStores = Object.keys(storeMap)
    .map(key => ({ st: key, val: storeMap[key] }))
    .sort((a, b) => b.val - a.val)
    .slice(0, 10);
    
  const labels = sortedStores.map(x => x.st);
  const values = sortedStores.map(x => x.val);
  
  if (STATE.charts.store) STATE.charts.store.destroy();
  
  const ctx = document.getElementById("storeChart").getContext("2d");
  const isLight = document.body.classList.contains("light-mode");
  const textColor = isLight ? "#0f172a" : "#f8fafc";
  
  STATE.charts.store = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Lượng lệch tuyệt đối",
        data: values,
        backgroundColor: "rgba(59, 130, 246, 0.7)",
        borderColor: "#3b82f6",
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isLight ? "#fff" : "#1e293b",
          titleColor: textColor,
          bodyColor: textColor,
          borderColor: "rgba(255, 255, 255, 0.1)",
          borderWidth: 1
        }
      },
      scales: {
        y: {
          grid: { color: isLight ? "#e2e8f0" : "rgba(255, 255, 255, 0.05)" },
          ticks: { color: textColor }
        },
        x: {
          grid: { display: false },
          ticks: { color: textColor }
        }
      }
    }
  });
}

function drawCategoryChart() {
  const catMap = {};
  STATE.results.forEach(r => {
    const cat = r.category || r.loaiHang || "Khác";
    catMap[cat] = (catMap[cat] || 0) + Math.abs(r.diff);
  });
  
  const labels = Object.keys(catMap);
  const values = Object.values(catMap);
  
  if (STATE.charts.category) STATE.charts.category.destroy();
  
  if (labels.length === 0) return;
  
  const ctx = document.getElementById("categoryChart").getContext("2d");
  const isLight = document.body.classList.contains("light-mode");
  
  STATE.charts.category = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: [
          "#3b82f6", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6",
          "#ec4899", "#14b8a6", "#06b6d4", "#a855f7", "#64748b"
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { color: isLight ? "#0f172a" : "#f8fafc" }
        }
      }
    }
  });
}

// 9. Table View Updates (Filter / Search / Sort)
function getFilteredData() {
  let data = [...STATE.results];
  
  // Search
  if (STATE.table.search) {
    const query = STATE.table.search.toLowerCase();
    data = data.filter(r => 
      r.st.toLowerCase().includes(query) ||
      r.productCode.toLowerCase().includes(query) ||
      r.productName.toLowerCase().includes(query) ||
      (r.category && r.category.toLowerCase().includes(query))
    );
  }
  
  // Diff Filter
  if (STATE.table.diffFilter === "positive") {
    data = data.filter(r => r.diff > 0);
  } else if (STATE.table.diffFilter === "negative") {
    data = data.filter(r => r.diff < 0);
  }
  
  // Sorting
  const { sortBy, sortOrder } = STATE.table;
  data.sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];
    
    if (typeof valA === "string") {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
      return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else {
      return sortOrder === "asc" ? valA - valB : valB - valA;
    }
  });
  
  return data;
}

function updateTableView() {
  const filtered = getFilteredData();
  const totalItems = filtered.length;
  
  const { currentPage, pageSize } = STATE.table;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedData = filtered.slice(startIndex, endIndex);
  
  DOM.reconcileTableBody.innerHTML = "";
  if (paginatedData.length === 0) {
    DOM.reconcileTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 40px 0;">
          Không tìm thấy chênh lệch nào khớp với bộ lọc.
        </td>
      </tr>
    `;
  } else {
    paginatedData.forEach(row => {
      const tr = document.createElement("tr");
      
      const diffClass = row.diff > 0 ? "cell-diff positive" : "cell-diff negative";
      const diffPrefix = row.diff > 0 ? "+" : "";
      
      tr.innerHTML = `
        <td><b>${row.st}</b></td>
        <td><code>${row.productCode}</code></td>
        <td>${row.productName}</td>
        <td><span style="color: var(--text-secondary); font-size: 0.8rem;">${row.category || row.loaiHang || "Khác"}</span></td>
        <td style="text-align: right;">${row.kfmQty.toLocaleString()}</td>
        <td style="text-align: right;">${row.abaQty.toLocaleString()}</td>
        <td style="text-align: right;" class="${diffClass}">${diffPrefix}${row.diff.toLocaleString()}</td>
      `;
      DOM.reconcileTableBody.appendChild(tr);
    });
  }
  
  DOM.paginationInfo.innerText = totalItems > 0 
    ? `Đang hiển thị ${startIndex + 1} - ${endIndex} của ${totalItems} kết quả`
    : `Đang hiển thị 0 - 0 của 0 kết quả`;
    
  DOM.prevPageBtn.disabled = currentPage === 1;
  DOM.nextPageBtn.disabled = endIndex >= totalItems;
}

// 10. File Exports (CSV Generate)
function exportToCsv() {
  if (STATE.results.length === 0) return;
  
  const headers = ["Key (ST_Code)", "ST Code / Abbr", "Product Code", "Product Name", "Category", "Loai Hang", "KFM Qty (SL Chuyen)", "ABA Qty (SL Giao)", "Diff (Lech)"];
  
  const rows = STATE.results.map(r => [
    r.key,
    r.st,
    `="${r.productCode}"`, 
    r.productName,
    r.category,
    r.loaiHang,
    r.kfmQty,
    r.abaQty,
    r.diff
  ]);
  
  let csvContent = "\ufeff"; 
  csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\r\n";
  
  rows.forEach(row => {
    csvContent += row.map(cell => {
      const cellStr = String(cell !== null && cell !== undefined ? cell : "");
      return `"${cellStr.replace(/"/g, '""')}"`;
    }).join(",") + "\r\n";
  });
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0,10);
  
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `Result_DoiSoat_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  logToConsole("Đã xuất file đối soát ra CSV thành công.", "success");
}

// 11. Alert Integrations (Telegram Messaging)
async function sendTelegramReport() {
  const { telegramToken, telegramChatId } = STATE.settings;
  if (!telegramToken || !telegramChatId) {
    logToConsole("Cảnh báo: Chưa cấu hình Telegram Bot Token hoặc Chat ID.", "error");
    return;
  }
  
  logToConsole("Đang gửi báo cáo qua Telegram Bot...");
  
  let msg = `📊 *BÁO CÁO ĐỐI SOÁT XUẤT HÀNG*\n`;
  msg += `\n🏢 Tổng siêu thị tham gia: *${STATE.stats.totalSt}*`;
  msg += `\n🚨 Siêu thị thiếu phiếu: *${STATE.stats.mismatchedSt}*`;
  
  if (STATE.results.length === 0) {
    msg += `\n\n✅ *Tuyệt vời! 100% khớp số liệu.*`;
  } else {
    msg += `\n\n⚠️ *CHI TIẾT CẢNH BÁO LỆCH PHIẾU:*`;
    
    const displayWarnings = STATE.warnings.slice(0, 30);
    displayWarnings.forEach(w => {
      msg += `\n❌ ST *${w.st}* lệch hàng _${w.category}_ (Lệch: *${w.diff.toLocaleString()}*)`;
    });
    
    if (STATE.warnings.length > 30) {
      msg += `\n... và ${STATE.warnings.length - 30} siêu thị khác. Xem chi tiết trên dashboard.`;
    }
  }
  
  try {
    const success = await triggerTelegramApi(telegramToken, telegramChatId, msg);
    if (success) {
      logToConsole("Đã gửi báo cáo Telegram thành công!", "success");
    }
  } catch (err) {
    logToConsole(`Gửi Telegram thất bại: ${err.message}`, "error");
  }
}

async function triggerTelegramApi(token, chatId, message) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "Markdown"
    })
  });
  
  const data = await response.json();
  if (!data.ok) throw new Error(data.description || "Lỗi không xác định");
  return true;
}

async function testTelegram() {
  const token = DOM.telegramToken.value.trim();
  const chatId = DOM.telegramChatId.value.trim();
  
  if (!token || !chatId) {
    alert("Vui lòng nhập đầy đủ Token và Chat ID trước khi test.");
    return;
  }
  
  DOM.testTelegramBtn.disabled = true;
  DOM.testTelegramBtn.innerText = "Đang gửi...";
  
  try {
    await triggerTelegramApi(token, chatId, "🔔 *Tin nhắn thử nghiệm* từ Hệ Thống Đối Soát Antigravity. Kết nối hoạt động tốt!");
    alert("Gửi tin nhắn test thành công! Hãy kiểm tra ứng dụng Telegram của bạn.");
  } catch (err) {
    alert(`Gửi test thất bại: ${err.message}`);
  } finally {
    DOM.testTelegramBtn.disabled = false;
    DOM.testTelegramBtn.innerText = "Test Telegram";
  }
}

// 12. Local Settings Cache
function loadCachedSettings() {
  const cachedSettings = localStorage.getItem("reconcile_settings");
  if (cachedSettings) {
    STATE.settings = JSON.parse(cachedSettings);
    
    if (DOM.telegramToken) DOM.telegramToken.value = STATE.settings.telegramToken || "";
    if (DOM.telegramChatId) DOM.telegramChatId.value = STATE.settings.telegramChatId || "";
    if (DOM.filterOutZeros) DOM.filterOutZeros.checked = STATE.settings.filterOutZeros !== false;
    if (DOM.autoAlertTelegram) DOM.autoAlertTelegram.checked = STATE.settings.autoAlertTelegram === true;
  }
  
  const cachedSheets = localStorage.getItem("sheets_config");
  if (cachedSheets && DOM.sheetStUrl && DOM.sheetKfmUrl && DOM.sheetAbaUrl) {
    STATE.sheets = JSON.parse(cachedSheets);
    
    DOM.sheetStUrl.value = STATE.sheets.dataStUrl || "";
    DOM.sheetKfmUrl.value = STATE.sheets.kfmUrl || "";
    DOM.sheetAbaUrl.value = STATE.sheets.abaUrl || "";
  }
  
  const lightMode = localStorage.getItem("light_mode") === "true";
  if (lightMode && DOM.sunIcon && DOM.moonIcon) {
    document.body.classList.add("light-mode");
    DOM.sunIcon.style.display = "block";
    DOM.moonIcon.style.display = "none";
  }
}

function saveSettings() {
  STATE.settings.telegramToken = DOM.telegramToken.value.trim();
  STATE.settings.telegramChatId = DOM.telegramChatId.value.trim();
  STATE.settings.filterOutZeros = DOM.filterOutZeros.checked;
  STATE.settings.autoAlertTelegram = DOM.autoAlertTelegram.checked;
  
  localStorage.setItem("reconcile_settings", JSON.stringify(STATE.settings));
  DOM.settingsModal.classList.remove("active");
  logToConsole("Đã cập nhật cấu hình hệ thống.", "success");
}

// 13. Progress indicators
function showProgress(title, percent) {
  DOM.progressTitle.innerText = title;
  DOM.progressBar.style.width = `${percent}%`;
  DOM.progressStatus.innerText = "";
  DOM.progressOverlay.style.display = "flex";
}

function updateProgressBar(percent, statusMessage) {
  DOM.progressBar.style.width = `${percent}%`;
  DOM.progressStatus.innerText = statusMessage;
  logToConsole(statusMessage);
}

function hideProgress() {
  DOM.progressOverlay.style.display = "none";
}

function logToConsole(text, type = "info") {
  const p = document.createElement("p");
  const time = new Date().toLocaleTimeString();
  p.innerText = `[${time}] ${text}`;
  
  if (type === "error") p.style.color = "var(--danger)";
  if (type === "success") p.style.color = "var(--success)";
  
  DOM.logsConsole.appendChild(p);
  DOM.logsConsole.scrollTop = DOM.logsConsole.scrollHeight;
}

function toggleTheme() {
  const isLight = document.body.classList.toggle("light-mode");
  localStorage.setItem("light_mode", isLight);
  
  if (isLight) {
    DOM.sunIcon.style.display = "block";
    DOM.moonIcon.style.display = "none";
  } else {
    DOM.sunIcon.style.display = "none";
    DOM.moonIcon.style.display = "block";
  }
  
  if (STATE.results.length > 0) {
    drawStoreChart();
    drawCategoryChart();
  }
}
