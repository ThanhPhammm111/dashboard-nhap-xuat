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
  filterDate: document.getElementById("filterDate"),
  
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

  if (DOM.filterDate) {
    DOM.filterDate.addEventListener("change", (e) => {
      const selectedIndex = e.target.selectedIndex;
      if (selectedIndex < 0) return;
      const option = e.target.options[selectedIndex];
      const resultFile = option.value;
      const totalSt = parseInt(option.getAttribute("data-totalst")) || 0;
      
      // Update sidebar status card metadata based on the selected run from history
      document.getElementById("syncLastUpdated").innerText = option.getAttribute("data-lastupdated") || "N/A";
      document.getElementById("syncReconcileDate").innerText = option.getAttribute("data-kfmdate") || "N/A";
      document.getElementById("syncKfmFile").innerText = option.getAttribute("data-kfmfile") || "N/A";
      document.getElementById("syncAbaFile").innerText = option.getAttribute("data-abafile") || "N/A";
      
      loadSelectedResult(resultFile, totalSt);
    });
  }
  
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
  logToConsole("Đang kiểm tra lịch sử đối soát từ máy chủ...");
  
  // Try loading history.json
  try {
    const historyUrl = "Ouput/history.json";
    const resHistory = await fetch(historyUrl);
    
    if (resHistory.ok) {
      const history = await resHistory.json();
      if (history && history.length > 0) {
        logToConsole(`Đã tìm thấy lịch sử gồm ${history.length} phiên đối soát.`);
        
        // Populate DOM.filterDate dropdown
        if (DOM.filterDate) {
          DOM.filterDate.innerHTML = "";
          history.forEach(run => {
            const opt = document.createElement("option");
            opt.value = run.resultFile || `Result_${run.kfmDate.replace(/\//g, "")}.csv`;
            opt.text = `Ngày ${run.kfmDate}`;
            opt.setAttribute("data-lastupdated", run.lastUpdated || "");
            opt.setAttribute("data-kfmdate", run.kfmDate || "");
            opt.setAttribute("data-kfmfile", run.kfmFile || "");
            opt.setAttribute("data-abafile", run.abaFile || "");
            opt.setAttribute("data-totalst", run.participatingStores || "0");
            DOM.filterDate.appendChild(opt);
          });
          DOM.filterDate.style.display = "inline-block";
        }
        
        // Load the latest run (first item)
        const latestRun = history[0];
        document.getElementById("syncLastUpdated").innerText = latestRun.lastUpdated || "N/A";
        document.getElementById("syncReconcileDate").innerText = latestRun.kfmDate || "N/A";
        document.getElementById("syncKfmFile").innerText = latestRun.kfmFile || "N/A";
        document.getElementById("syncAbaFile").innerText = latestRun.abaFile || "N/A";
        
        const resultFile = latestRun.resultFile || `Result_${latestRun.kfmDate.replace(/\//g, "")}.csv`;
        loadSelectedResult(resultFile, latestRun.participatingStores || 0);
        return;
      }
    }
  } catch (histErr) {
    console.warn("Could not load history.json, falling back to status.json and Result.csv", histErr);
  }

  // Fallback if history.json is missing or empty
  if (DOM.filterDate) {
    DOM.filterDate.style.display = "none";
  }
  
  let participatingStores = 0;
  try {
    const statusUrl = "Ouput/status.json";
    const resStatus = await fetch(statusUrl);
    if (resStatus.ok) {
      const status = await resStatus.json();
      document.getElementById("syncLastUpdated").innerText = status.lastUpdated || "N/A";
      document.getElementById("syncReconcileDate").innerText = status.kfmDate || "N/A";
      document.getElementById("syncKfmFile").innerText = status.kfmFile || "N/A";
      document.getElementById("syncAbaFile").innerText = status.abaFile || "N/A";
      participatingStores = status.participatingStores || 0;
      logToConsole(`Đã nạp trạng thái đồng bộ: Đối soát ngày ${status.kfmDate}.`);
    }
  } catch (statusErr) {
    console.error("Could not load status.json", statusErr);
  }

  loadSelectedResult("Result.csv", participatingStores);
}

async function loadSelectedResult(filename, totalSt) {
  try {
    showProgress("Đang tải dữ liệu...", 20);
    logToConsole(`Đang tải dữ liệu kết quả đối soát [${filename}] từ máy chủ...`);
    
    const resultUrl = `Ouput/${filename}`;
    const resResult = await fetch(resultUrl);
    if (!resResult.ok) {
      logToConsole(`Không tìm thấy kết quả đối soát [${filename}] trên máy chủ.`, "error");
      hideProgress();
      return;
    }
    
    updateProgressBar(50, "Đang phân tích dữ liệu...");
    const csvText = await resResult.text();
    const rows = parseCsvText(csvText);
    
    if (rows.length < 2) {
      logToConsole("Không phát hiện chênh lệch (file kết quả trống hoặc khớp 100%).", "success");
      STATE.results = [];
      STATE.warnings = [];
      STATE.stats = {
        totalSt: totalSt || 0,
        mismatchedSt: 0,
        mismatchedStList: []
      };
      hideProgress();
      renderDashboard();
      return;
    }
    
    const results = [];
    const warningDict = {};
    const stLechSet = new Set();
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 9) continue;
      
      const key = String(row[0] || "").trim();
      const st = String(row[1] || "").trim().toUpperCase();
      let rawProductCode = String(row[2] || "").trim();
      let productCode = rawProductCode.replace(/^="|"$/g, ""); // strip =" and "
      
      const productName = String(row[3] || "").trim();
      const category = String(row[4] || "").trim();
      const loaiHang = String(row[5] || "").trim();
      const kfmQty = parseFloat(String(row[6] || "").replace(/,/g, "")) || 0;
      const abaQty = parseFloat(String(row[7] || "").replace(/,/g, "")) || 0;
      const diff = parseFloat(String(row[8] || "").replace(/,/g, "")) || 0;
      
      if (st) stLechSet.add(st);
      
      results.push({
        key,
        st,
        productCode,
        productName,
        category,
        loaiHang,
        kfmQty,
        abaQty,
        diff
      });
      
      // Calculate warnings
      const catInfo = category || loaiHang || "Khác";
      const wKey = `${st}|${catInfo}`;
      warningDict[wKey] = (warningDict[wKey] || 0) + diff;
    }
    
    const warnings = Object.keys(warningDict).map(wKey => {
      const [st, catInfo] = wKey.split("|");
      return {
        st,
        category: catInfo,
        diff: warningDict[wKey]
      };
    }).sort((a, b) => a.st.localeCompare(b.st));
    
    STATE.results = results;
    STATE.warnings = warnings;
    STATE.stats = {
      totalSt: totalSt || stLechSet.size,
      mismatchedSt: stLechSet.size,
      mismatchedStList: Array.from(stLechSet).sort()
    };
    
    hideProgress();
    logToConsole(`Đã nạp và hiển thị thành công báo cáo [${filename}].`, "success");
    renderDashboard();
  } catch (err) {
    hideProgress();
    logToConsole(`Lỗi khi tải kết quả: ${err.message}`, "error");
    console.error("Load results failed", err);
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
  
  // Calculate Meat and Frozen store mismatch count
  const meatStSet = new Set();
  const frozenStSet = new Set();
  
  STATE.warnings.forEach(w => {
    const cat = (w.category || "").toLowerCase();
    if (cat.includes("meat")) {
      meatStSet.add(w.st);
    } else if (cat.includes("frozen")) {
      frozenStSet.add(w.st);
    }
  });

  // Set KPIs
  DOM.kpiTotalSt.innerText = STATE.stats.totalSt || 0;
  const mismatchMeatEl = document.getElementById("kpiMismatchMeat");
  const mismatchFrozenEl = document.getElementById("kpiMismatchFrozen");
  if (mismatchMeatEl) mismatchMeatEl.innerText = meatStSet.size;
  if (mismatchFrozenEl) mismatchFrozenEl.innerText = frozenStSet.size;
  
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
    const meatList = [];
    const frozenList = [];
    const otherList = [];

    STATE.warnings.forEach(w => {
      const cat = (w.category || "").toLowerCase();
      if (cat.includes("meat")) {
        meatList.push(w);
      } else if (cat.includes("frozen")) {
        frozenList.push(w);
      } else {
        otherList.push(w);
      }
    });

    const appendSection = (title, icon, list, colorClass) => {
      if (list.length === 0) return;
      
      const secHeader = document.createElement("div");
      secHeader.style.fontWeight = "700";
      secHeader.style.fontSize = "0.9rem";
      secHeader.style.marginTop = "18px";
      secHeader.style.marginBottom = "10px";
      secHeader.style.paddingBottom = "6px";
      secHeader.style.borderBottom = "1px solid var(--border-color)";
      secHeader.style.color = colorClass;
      secHeader.style.display = "flex";
      secHeader.style.alignItems = "center";
      secHeader.style.gap = "6px";
      secHeader.innerHTML = `<span>${icon}</span> <span>${title} (${list.length} cảnh báo)</span>`;
      DOM.warningListUi.appendChild(secHeader);

      list.forEach(w => {
        const item = document.createElement("div");
        item.className = "warning-item-ui";
        item.innerHTML = `
          <div class="warning-item-desc">
            Chi nhánh <b>${w.st}</b> lệch nhóm hàng <b>${w.category}</b> (Khả năng chưa tạo phiếu)
          </div>
          <span class="warning-qty-badge" style="background: ${colorClass}15; color: ${colorClass}; border: 1px solid ${colorClass}30;">Lệch ${w.diff.toLocaleString()}</span>
        `;
        DOM.warningListUi.appendChild(item);
      });
    };

    appendSection("NHÓM HÀNG MEAT", "🥩", meatList, "var(--danger)");
    appendSection("NHÓM HÀNG FROZEN", "❄️", frozenList, "var(--primary)");
    appendSection("CÁC NHÓM KHÁC", "❓", otherList, "var(--text-secondary)");
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
  
  let msg = `🔔 *BÁO CÁO ĐỐI SOÁT XUẤT HÀNG*\n`;
  msg += `\n📊 Tổng siêu thị tham gia: *${STATE.stats.totalSt}*`;
  
  if (STATE.results.length === 0) {
    msg += `\n\n✅ *Tuyệt vời! 100% khớp số liệu.*`;
  } else {
    const meatWarnings = [];
    const frozenWarnings = [];
    const otherWarnings = [];
    
    const meatStSet = new Set();
    const frozenStSet = new Set();

    STATE.warnings.forEach(w => {
      const cat = (w.category || "").toLowerCase();
      const itemStr = `\n• *${w.st}*: *${w.diff.toLocaleString()}*`;
      
      if (cat.includes("meat")) {
        meatWarnings.push(itemStr);
        meatStSet.add(w.st);
      } else if (cat.includes("frozen")) {
        frozenWarnings.push(itemStr);
        frozenStSet.add(w.st);
      } else {
        otherWarnings.push(`\n• *${w.st}* (_${w.category}_): *${w.diff.toLocaleString()}*`);
      }
    });

    msg += `\n🥩 Lệch hàng MEAT: *${meatStSet.size} CH*`;
    msg += `\n❄️ Lệch hàng FROZEN: *${frozenStSet.size} CH*`;
    msg += `\n-------------------------------------------------`;

    if (meatWarnings.length > 0) {
      msg += `\n\n🥩 *SIÊU THỊ LỆCH MEAT:*`;
      const limit = 15;
      for (let i = 0; i < Math.Min(meatWarnings.length, limit); i++) {
        msg += meatWarnings[i];
      }
      if (meatWarnings.length > limit) {
        msg += `\n... và ${meatWarnings.length - limit} CH khác.`;
      }
    }

    if (frozenWarnings.length > 0) {
      msg += `\n\n❄️ *SIÊU THỊ LỆCH FROZEN:*`;
      const limit = 15;
      for (let i = 0; i < Math.Min(frozenWarnings.length, limit); i++) {
        msg += frozenWarnings[i];
      }
      if (frozenWarnings.length > limit) {
        msg += `\n... và ${frozenWarnings.length - limit} CH khác.`;
      }
    }

    if (otherWarnings.length > 0) {
      msg += `\n\n❓ *LỆCH NHÓM KHÁC:*`;
      const limit = 10;
      for (let i = 0; i < Math.Min(otherWarnings.length, limit); i++) {
        msg += otherWarnings[i];
      }
      if (otherWarnings.length > limit) {
        msg += `\n... và ${otherWarnings.length - limit} CH khác.`;
      }
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
