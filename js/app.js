// Antigravity Reconcile - Client Logic

// 1. Application State
const STATE = {
  activeTab: "localFilesTab",
  activeMainTab: "tabReconcile", // tabReconcile or tabDropped
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
    autoAlertTelegram: false,
    droppedSheetUrl: ""
  },
  results: [],
  warnings: [],
  stats: {},
  history: [],
  
  // Table View States (Created & Missing separated)
  tableCreated: {
    search: "",
    diffFilter: "all",
    sortBy: "st",
    sortOrder: "asc",
    currentPage: 1,
    pageSize: 15
  },
  tableMissing: {
    search: "",
    sortBy: "st",
    sortOrder: "asc",
    currentPage: 1,
    pageSize: 15
  },
  
  // Dropped details state
  dropped: {
    rawUrl: "",
    data: [], // Array of row arrays/objects
    headers: [],
    dateColIndex: -1,
    weekColIndex: -1,
    monthColIndex: -1,
    storeColIndex: -1,
    filters: {
      fromDate: "",
      toDate: "",
      week: "",
      month: "",
      search: ""
    },
    table: {
      currentPage: 1,
      pageSize: 15,
      sortBy: "",
      sortOrder: "asc"
    }
  },
  
  // Chart Instances
  charts: {
    store: null,
    category: null,
    forecast: null
  }
};

// 2. DOM Elements
const DOM = {
  themeToggle: document.getElementById("themeToggle"),
  sunIcon: document.getElementById("sunIcon"),
  moonIcon: document.getElementById("moonIcon"),
  
  // Tabs Navigation
  tabBtnReconcile: document.getElementById("tabBtnReconcile"),
  tabBtnForecast: document.getElementById("tabBtnForecast"),
  tabBtnDropped: document.getElementById("tabBtnDropped"),
  tabReconcile: document.getElementById("tabReconcile"),
  tabForecast: document.getElementById("tabForecast"),
  tabDropped: document.getElementById("tabDropped"),
  
  // Tabs (legacy settings panel tabs)
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
  
  // Dropped details components
  droppedSheetUrl: document.getElementById("droppedSheetUrl"),
  btnConnectDropped: document.getElementById("btnConnectDropped"),
  droppedConfigRow: document.getElementById("droppedConfigRow"),
  droppedFiltersRow: document.getElementById("droppedFiltersRow"),
  droppedFilterFromDate: document.getElementById("droppedFilterFromDate"),
  droppedFilterToDate: document.getElementById("droppedFilterToDate"),
  droppedFilterWeek: document.getElementById("droppedFilterWeek"),
  droppedFilterMonth: document.getElementById("droppedFilterMonth"),
  searchDroppedTable: document.getElementById("searchDroppedTable"),
  btnResetDroppedFilters: document.getElementById("btnResetDroppedFilters"),
  droppedExportCsvBtn: document.getElementById("droppedExportCsvBtn"),
  droppedLoader: document.getElementById("droppedLoader"),
  droppedTableWrapper: document.getElementById("droppedTableWrapper"),
  droppedTableHead: document.getElementById("droppedTableHead"),
  droppedTableBody: document.getElementById("droppedTableBody"),
  droppedPagination: document.getElementById("droppedPagination"),
  droppedPaginationInfo: document.getElementById("droppedPaginationInfo"),
  droppedPrevPageBtn: document.getElementById("droppedPrevPageBtn"),
  droppedNextPageBtn: document.getElementById("droppedNextPageBtn"),
  settingsDroppedSheetUrl: document.getElementById("settingsDroppedSheetUrl"),
  
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
  
  // Interactive Table Elements (Separated)
  reconcileTableBodyCreated: document.getElementById("reconcileTableBodyCreated"),
  searchTableCreated: document.getElementById("searchTableCreated"),
  filterDiffCreated: document.getElementById("filterDiffCreated"),
  exportCsvBtnCreated: document.getElementById("exportCsvBtnCreated"),
  prevPageBtnCreated: document.getElementById("prevPageBtnCreated"),
  nextPageBtnCreated: document.getElementById("nextPageBtnCreated"),
  paginationInfoCreated: document.getElementById("paginationInfoCreated"),
  tableHeadersCreated: document.querySelectorAll("#reconcileTableCreated th"),

  reconcileTableBodyMissing: document.getElementById("reconcileTableBodyMissing"),
  searchTableMissing: document.getElementById("searchTableMissing"),
  exportCsvBtnMissing: document.getElementById("exportCsvBtnMissing"),
  prevPageBtnMissing: document.getElementById("prevPageBtnMissing"),
  nextPageBtnMissing: document.getElementById("nextPageBtnMissing"),
  paginationInfoMissing: document.getElementById("paginationInfoMissing"),
  tableHeadersMissing: document.querySelectorAll("#reconcileTableMissing th"),
  
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
  initDroppedDetails();
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
  
  // Interactive Table events (Created Table)
  if (DOM.searchTableCreated) {
    DOM.searchTableCreated.addEventListener("input", (e) => {
      STATE.tableCreated.search = e.target.value;
      STATE.tableCreated.currentPage = 1;
      updateCreatedTableView();
    });
  }
  
  if (DOM.filterDiffCreated) {
    DOM.filterDiffCreated.addEventListener("change", (e) => {
      STATE.tableCreated.diffFilter = e.target.value;
      STATE.tableCreated.currentPage = 1;
      updateCreatedTableView();
    });
  }

  if (DOM.exportCsvBtnCreated) {
    DOM.exportCsvBtnCreated.addEventListener("click", exportToCsvCreated);
  }

  if (DOM.prevPageBtnCreated) {
    DOM.prevPageBtnCreated.addEventListener("click", () => {
      if (STATE.tableCreated.currentPage > 1) {
        STATE.tableCreated.currentPage--;
        updateCreatedTableView();
      }
    });
  }

  if (DOM.nextPageBtnCreated) {
    DOM.nextPageBtnCreated.addEventListener("click", () => {
      const filtered = getFilteredCreatedData();
      const maxPage = Math.ceil(filtered.length / STATE.tableCreated.pageSize);
      if (STATE.tableCreated.currentPage < maxPage) {
        STATE.tableCreated.currentPage++;
        updateCreatedTableView();
      }
    });
  }

  if (DOM.tableHeadersCreated) {
    DOM.tableHeadersCreated.forEach(th => {
      th.addEventListener("click", () => {
        const field = th.getAttribute("data-sort");
        if (!field) return;
        
        if (STATE.tableCreated.sortBy === field) {
          STATE.tableCreated.sortOrder = STATE.tableCreated.sortOrder === "asc" ? "desc" : "asc";
        } else {
          STATE.tableCreated.sortBy = field;
          STATE.tableCreated.sortOrder = "asc";
        }
        
        DOM.tableHeadersCreated.forEach(h => {
          const icon = h.querySelector(".sort-icon");
          if (icon) icon.innerText = "↕";
        });
        const currentIcon = th.querySelector(".sort-icon");
        if (currentIcon) {
          currentIcon.innerText = STATE.tableCreated.sortOrder === "asc" ? "↑" : "↓";
        }
        
        updateCreatedTableView();
      });
    });
  }

  // Interactive Table events (Missing Table)
  if (DOM.searchTableMissing) {
    DOM.searchTableMissing.addEventListener("input", (e) => {
      STATE.tableMissing.search = e.target.value;
      STATE.tableMissing.currentPage = 1;
      updateMissingTableView();
    });
  }

  if (DOM.exportCsvBtnMissing) {
    DOM.exportCsvBtnMissing.addEventListener("click", exportToCsvMissing);
  }

  if (DOM.prevPageBtnMissing) {
    DOM.prevPageBtnMissing.addEventListener("click", () => {
      if (STATE.tableMissing.currentPage > 1) {
        STATE.tableMissing.currentPage--;
        updateMissingTableView();
      }
    });
  }

  if (DOM.nextPageBtnMissing) {
    DOM.nextPageBtnMissing.addEventListener("click", () => {
      const filtered = getFilteredMissingData();
      const maxPage = Math.ceil(filtered.length / STATE.tableMissing.pageSize);
      if (STATE.tableMissing.currentPage < maxPage) {
        STATE.tableMissing.currentPage++;
        updateMissingTableView();
      }
    });
  }

  if (DOM.tableHeadersMissing) {
    DOM.tableHeadersMissing.forEach(th => {
      th.addEventListener("click", () => {
        const field = th.getAttribute("data-sort");
        if (!field) return;
        
        if (STATE.tableMissing.sortBy === field) {
          STATE.tableMissing.sortOrder = STATE.tableMissing.sortOrder === "asc" ? "desc" : "asc";
        } else {
          STATE.tableMissing.sortBy = field;
          STATE.tableMissing.sortOrder = "asc";
        }
        
        DOM.tableHeadersMissing.forEach(h => {
          const icon = h.querySelector(".sort-icon");
          if (icon) icon.innerText = "↕";
        });
        const currentIcon = th.querySelector(".sort-icon");
        if (currentIcon) {
          currentIcon.innerText = STATE.tableMissing.sortOrder === "asc" ? "↑" : "↓";
        }
        
        updateMissingTableView();
      });
    });
  }
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
  
  // Main Tab Navigation
  if (DOM.tabBtnReconcile && DOM.tabBtnForecast && DOM.tabBtnDropped) {
    DOM.tabBtnReconcile.addEventListener("click", () => {
      DOM.tabBtnReconcile.classList.add("active");
      DOM.tabBtnForecast.classList.remove("active");
      DOM.tabBtnDropped.classList.remove("active");
      DOM.tabReconcile.style.display = "flex";
      DOM.tabForecast.style.display = "none";
      DOM.tabDropped.style.display = "none";
      STATE.activeMainTab = "tabReconcile";
    });
    DOM.tabBtnForecast.addEventListener("click", () => {
      DOM.tabBtnForecast.classList.add("active");
      DOM.tabBtnReconcile.classList.remove("active");
      DOM.tabBtnDropped.classList.remove("active");
      DOM.tabForecast.style.display = "flex";
      DOM.tabReconcile.style.display = "none";
      DOM.tabDropped.style.display = "none";
      STATE.activeMainTab = "tabForecast";
      renderForecastTab();
    });
    DOM.tabBtnDropped.addEventListener("click", () => {
      DOM.tabBtnDropped.classList.add("active");
      DOM.tabBtnReconcile.classList.remove("active");
      DOM.tabBtnForecast.classList.remove("active");
      DOM.tabDropped.style.display = "flex";
      DOM.tabReconcile.style.display = "none";
      DOM.tabForecast.style.display = "none";
      STATE.activeMainTab = "tabDropped";
      // Auto-load if url is set and data not loaded
      if (STATE.settings.droppedSheetUrl && STATE.dropped.data.length === 0) {
        fetchDroppedDetailsData(STATE.settings.droppedSheetUrl);
      }
    });
  }
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
    const historyUrl = `Ouput/history.json?_=${Date.now()}`;
    const resHistory = await fetch(historyUrl);
    
    if (resHistory.ok) {
      const history = await resHistory.json();
      if (history && history.length > 0) {
        STATE.history = history;
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
    const statusUrl = `Ouput/status.json?_=${Date.now()}`;
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
    
    const resultUrl = `Ouput/${filename}?_=${Date.now()}`;
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
      
      const diffType = row.length > 9 ? String(row[9] || "").trim() : (kfmQty === 0 ? "Chưa tạo phiếu KFM" : "Đã tạo phiếu KFM (Lệch số lượng)");
      
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
        diff,
        diffType
      });
      
      // Calculate warnings
      let catInfo = category || loaiHang || "Khác";
      catInfo = catInfo.trim();
      const lowerCat = catInfo.toLowerCase();
      if (lowerCat === "f" || lowerCat === "frozen") {
        catInfo = "Frozen";
      } else if (lowerCat === "m" || lowerCat === "meat") {
        catInfo = "Meat";
      } else if (catInfo.length > 0) {
        catInfo = catInfo.charAt(0).toUpperCase() + catInfo.slice(1).toLowerCase();
      }
      
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
  
  // Render Tables
  STATE.tableCreated.currentPage = 1;
  STATE.tableMissing.currentPage = 1;
  updateCreatedTableView();
  updateMissingTableView();
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

// 9. Table View Updates (Filter / Search / Sort) - Separated for 2 tables

// --- CREATED TABLE ---
function getFilteredCreatedData() {
  // Filter only items where kfmQty > 0
  let data = STATE.results.filter(r => r.kfmQty > 0);
  
  // Search
  if (STATE.tableCreated.search) {
    const query = STATE.tableCreated.search.toLowerCase();
    data = data.filter(r => 
      r.st.toLowerCase().includes(query) ||
      r.productCode.toLowerCase().includes(query) ||
      r.productName.toLowerCase().includes(query) ||
      (r.category && r.category.toLowerCase().includes(query))
    );
  }
  
  // Diff Filter
  if (STATE.tableCreated.diffFilter === "positive") {
    data = data.filter(r => r.diff > 0);
  } else if (STATE.tableCreated.diffFilter === "negative") {
    data = data.filter(r => r.diff < 0);
  }
  
  // Sorting
  const { sortBy, sortOrder } = STATE.tableCreated;
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

function updateCreatedTableView() {
  const filtered = getFilteredCreatedData();
  const totalItems = filtered.length;
  
  const { currentPage, pageSize } = STATE.tableCreated;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedData = filtered.slice(startIndex, endIndex);
  
  if (DOM.reconcileTableBodyCreated) {
    DOM.reconcileTableBodyCreated.innerHTML = "";
    if (paginatedData.length === 0) {
      DOM.reconcileTableBodyCreated.innerHTML = `
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
        DOM.reconcileTableBodyCreated.appendChild(tr);
      });
    }
  }
  
  if (DOM.paginationInfoCreated) {
    DOM.paginationInfoCreated.innerText = totalItems > 0 
      ? `Đang hiển thị ${startIndex + 1} - ${endIndex} của ${totalItems} kết quả`
      : `Đang hiển thị 0 - 0 của 0 kết quả`;
  }
  
  if (DOM.prevPageBtnCreated) DOM.prevPageBtnCreated.disabled = currentPage === 1;
  if (DOM.nextPageBtnCreated) DOM.nextPageBtnCreated.disabled = endIndex >= totalItems;
}

// --- MISSING TABLE ---
function getFilteredMissingData() {
  // Filter only items where kfmQty === 0
  let data = STATE.results.filter(r => r.kfmQty === 0);
  
  // Search
  if (STATE.tableMissing.search) {
    const query = STATE.tableMissing.search.toLowerCase();
    data = data.filter(r => 
      r.st.toLowerCase().includes(query) ||
      r.productCode.toLowerCase().includes(query) ||
      r.productName.toLowerCase().includes(query) ||
      (r.category && r.category.toLowerCase().includes(query))
    );
  }
  
  // Sorting
  const { sortBy, sortOrder } = STATE.tableMissing;
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

function updateMissingTableView() {
  const filtered = getFilteredMissingData();
  const totalItems = filtered.length;
  
  const { currentPage, pageSize } = STATE.tableMissing;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedData = filtered.slice(startIndex, endIndex);
  
  if (DOM.reconcileTableBodyMissing) {
    DOM.reconcileTableBodyMissing.innerHTML = "";
    if (paginatedData.length === 0) {
      DOM.reconcileTableBodyMissing.innerHTML = `
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
        DOM.reconcileTableBodyMissing.appendChild(tr);
      });
    }
  }
  
  if (DOM.paginationInfoMissing) {
    DOM.paginationInfoMissing.innerText = totalItems > 0 
      ? `Đang hiển thị ${startIndex + 1} - ${endIndex} của ${totalItems} kết quả`
      : `Đang hiển thị 0 - 0 của 0 kết quả`;
  }
  
  if (DOM.prevPageBtnMissing) DOM.prevPageBtnMissing.disabled = currentPage === 1;
  if (DOM.nextPageBtnMissing) DOM.nextPageBtnMissing.disabled = endIndex >= totalItems;
}

// 10. File Exports (CSV Generate) - Separated

function exportToCsvCreated() {
  const filtered = getFilteredCreatedData();
  if (filtered.length === 0) return;
  
  const headers = ["Key (ST_Code)", "ST Code / Abbr", "Product Code", "Product Name", "Category", "Loai Hang", "KFM Qty (SL Chuyen)", "ABA Qty (SL Giao)", "Diff (Lech)", "Loai Chenh Lech"];
  
  const rows = filtered.map(r => [
    r.key,
    r.st,
    `="${r.productCode}"`, 
    r.productName,
    r.category,
    r.loaiHang,
    r.kfmQty,
    r.abaQty,
    r.diff,
    r.diffType
  ]);
  
  triggerCsvDownload(headers, rows, "Created_Mismatches");
}

function exportToCsvMissing() {
  const filtered = getFilteredMissingData();
  if (filtered.length === 0) return;
  
  const headers = ["Key (ST_Code)", "ST Code / Abbr", "Product Code", "Product Name", "Category", "Loai Hang", "KFM Qty (SL Chuyen)", "ABA Qty (SL Giao)", "Diff (Lech)", "Loai Chenh Lech"];
  
  const rows = filtered.map(r => [
    r.key,
    r.st,
    `="${r.productCode}"`, 
    r.productName,
    r.category,
    r.loaiHang,
    r.kfmQty,
    r.abaQty,
    r.diff,
    r.diffType
  ]);
  
  triggerCsvDownload(headers, rows, "Missing_Tickets");
}

function triggerCsvDownload(headers, rows, filenameSuffix) {
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
  link.setAttribute("download", `Result_DoiSoat_${filenameSuffix}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  logToConsole(`Đã xuất file đối soát (${filenameSuffix}) ra CSV thành công.`, "success");
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
    const meatStSet = new Set();
    const frozenStSet = new Set();

    STATE.results.forEach(r => {
      const cat = (r.category || r.loaiHang || "Khác").toLowerCase();
      if (cat.includes("meat")) meatStSet.add(r.st);
      else if (cat.includes("frozen")) frozenStSet.add(r.st);
    });

    const totalDiff = STATE.results.reduce((sum, r) => sum + Math.abs(r.diff), 0);
    const mismatchedStCount = STATE.stats.mismatchedSt || 0;
    const mismatchedStList = STATE.stats.mismatchedStList || [];

    msg += `\n⚠️ *Siêu thị bị lệch: ${mismatchedStCount} CH* (Tổng lệch: *${totalDiff.toLocaleString()}*)\n`;
    msg += `\n🥩 Lệch hàng MEAT: *${meatStSet.size} CH*`;
    msg += `\n❄️ Lệch hàng FROZEN: *${frozenStSet.size} CH*`;
    msg += `\n-------------------------------------------------`;
    
    if (mismatchedStList.length > 0) {
      msg += `\n\n📋 *Danh sách ST lệch:* ${mismatchedStList.join(", ")}`;
      msg += `\n\n🔗 *Chi tiết đối soát xem tại Dashboard:*`;
      msg += `\nhttps://thanhphammm111.github.io/dashboard-nhap-xuat/`;
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
    if (DOM.settingsDroppedSheetUrl) DOM.settingsDroppedSheetUrl.value = STATE.settings.droppedSheetUrl || "";
    if (DOM.droppedSheetUrl) DOM.droppedSheetUrl.value = STATE.settings.droppedSheetUrl || "";
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
  if (DOM.settingsDroppedSheetUrl) {
    STATE.settings.droppedSheetUrl = DOM.settingsDroppedSheetUrl.value.trim();
    if (DOM.droppedSheetUrl) DOM.droppedSheetUrl.value = STATE.settings.droppedSheetUrl;
  }
  
  localStorage.setItem("reconcile_settings", JSON.stringify(STATE.settings));
  DOM.settingsModal.classList.remove("active");
  logToConsole("Đã cập nhật cấu hình hệ thống.", "success");
  
  if (STATE.settings.droppedSheetUrl && STATE.dropped.data.length === 0) {
    fetchDroppedDetailsData(STATE.settings.droppedSheetUrl);
  }
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
  if (STATE.activeMainTab === "tabForecast") {
    renderForecastTab();
  }
}

// 14. Dropped Details Tab Features
function initDroppedDetails() {
  if (DOM.btnConnectDropped && DOM.droppedSheetUrl) {
    DOM.btnConnectDropped.addEventListener("click", () => {
      const url = DOM.droppedSheetUrl.value.trim();
      if (!url) {
        alert("Vui lòng dán liên kết Google Sheet trước.");
        return;
      }
      STATE.settings.droppedSheetUrl = url;
      if (DOM.settingsDroppedSheetUrl) DOM.settingsDroppedSheetUrl.value = url;
      localStorage.setItem("reconcile_settings", JSON.stringify(STATE.settings));
      fetchDroppedDetailsData(url);
    });
  }

  // Filters listeners
  if (DOM.droppedFilterFromDate) {
    DOM.droppedFilterFromDate.addEventListener("change", () => {
      STATE.dropped.filters.fromDate = DOM.droppedFilterFromDate.value;
      STATE.dropped.filters.week = "";
      STATE.dropped.filters.month = "";
      if (DOM.droppedFilterWeek) DOM.droppedFilterWeek.value = "";
      if (DOM.droppedFilterMonth) DOM.droppedFilterMonth.value = "";
      STATE.dropped.table.currentPage = 1;
      applyDroppedFilters();
    });
  }
  if (DOM.droppedFilterToDate) {
    DOM.droppedFilterToDate.addEventListener("change", () => {
      STATE.dropped.filters.toDate = DOM.droppedFilterToDate.value;
      STATE.dropped.filters.week = "";
      STATE.dropped.filters.month = "";
      if (DOM.droppedFilterWeek) DOM.droppedFilterWeek.value = "";
      if (DOM.droppedFilterMonth) DOM.droppedFilterMonth.value = "";
      STATE.dropped.table.currentPage = 1;
      applyDroppedFilters();
    });
  }
  if (DOM.droppedFilterWeek) {
    DOM.droppedFilterWeek.addEventListener("change", (e) => {
      STATE.dropped.filters.week = e.target.value;
      STATE.dropped.filters.fromDate = "";
      STATE.dropped.filters.toDate = "";
      STATE.dropped.filters.month = "";
      if (DOM.droppedFilterFromDate) DOM.droppedFilterFromDate.value = "";
      if (DOM.droppedFilterToDate) DOM.droppedFilterToDate.value = "";
      if (DOM.droppedFilterMonth) DOM.droppedFilterMonth.value = "";
      STATE.dropped.table.currentPage = 1;
      applyDroppedFilters();
    });
  }
  if (DOM.droppedFilterMonth) {
    DOM.droppedFilterMonth.addEventListener("change", (e) => {
      STATE.dropped.filters.month = e.target.value;
      STATE.dropped.filters.fromDate = "";
      STATE.dropped.filters.toDate = "";
      STATE.dropped.filters.week = "";
      if (DOM.droppedFilterFromDate) DOM.droppedFilterFromDate.value = "";
      if (DOM.droppedFilterToDate) DOM.droppedFilterToDate.value = "";
      if (DOM.droppedFilterWeek) DOM.droppedFilterWeek.value = "";
      STATE.dropped.table.currentPage = 1;
      applyDroppedFilters();
    });
  }
  if (DOM.searchDroppedTable) {
    DOM.searchDroppedTable.addEventListener("input", (e) => {
      STATE.dropped.filters.search = e.target.value;
      STATE.dropped.table.currentPage = 1;
      applyDroppedFilters();
    });
  }
  if (DOM.btnResetDroppedFilters) {
    DOM.btnResetDroppedFilters.addEventListener("click", () => {
      STATE.dropped.filters.fromDate = "";
      STATE.dropped.filters.toDate = "";
      STATE.dropped.filters.week = "";
      STATE.dropped.filters.month = "";
      STATE.dropped.filters.search = "";
      
      if (DOM.droppedFilterFromDate) DOM.droppedFilterFromDate.value = "";
      if (DOM.droppedFilterToDate) DOM.droppedFilterToDate.value = "";
      if (DOM.droppedFilterWeek) DOM.droppedFilterWeek.value = "";
      if (DOM.droppedFilterMonth) DOM.droppedFilterMonth.value = "";
      if (DOM.searchDroppedTable) DOM.searchDroppedTable.value = "";
      
      STATE.dropped.table.currentPage = 1;
      applyDroppedFilters();
    });
  }
  if (DOM.droppedExportCsvBtn) {
    DOM.droppedExportCsvBtn.addEventListener("click", exportDroppedDetailsToCsv);
  }

  // Pagination buttons
  if (DOM.droppedPrevPageBtn) {
    DOM.droppedPrevPageBtn.addEventListener("click", () => {
      if (STATE.dropped.table.currentPage > 1) {
        STATE.dropped.table.currentPage--;
        renderDroppedTable();
      }
    });
  }
  if (DOM.droppedNextPageBtn) {
    DOM.droppedNextPageBtn.addEventListener("click", () => {
      const maxPage = Math.ceil(STATE.dropped.filteredData.length / STATE.dropped.table.pageSize);
      if (STATE.dropped.table.currentPage < maxPage) {
        STATE.dropped.table.currentPage++;
        renderDroppedTable();
      }
    });
  }
}

async function fetchDroppedDetailsData(url) {
  if (!url) return;
  
  if (DOM.droppedLoader) DOM.droppedLoader.style.display = "block";
  if (DOM.droppedTableWrapper) DOM.droppedTableWrapper.style.display = "none";
  if (DOM.droppedPagination) DOM.droppedPagination.style.display = "none";
  if (DOM.droppedFiltersRow) DOM.droppedFiltersRow.style.display = "none";
  if (DOM.droppedExportCsvBtn) DOM.droppedExportCsvBtn.disabled = true;

  try {
    logToConsole("Đang tải dữ liệu Chi Tiết Rớt Hàng từ Google Sheets...");
    
    const csvUrl = convertSheetsUrlToCsv(url, "1774727011");
    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`Lỗi kết nối HTTP: ${response.status}`);
    }
    
    const text = await response.text();
    const rows = parseCsvText(text);
    
    if (rows.length === 0) {
      throw new Error("Không có dữ liệu hoặc lỗi cấu trúc sheet.");
    }
    
    STATE.dropped.headers = rows[0];
    STATE.dropped.data = rows.slice(1).filter(r => r.some(cell => String(cell).trim() !== ""));
    
    STATE.dropped.dateColIndex = findDateColumnIndex(STATE.dropped.headers);
    
    buildWeekAndMonthFilters();
    populateDroppedFiltersDropdowns();
    
    // Reset table sort
    STATE.dropped.table.sortBy = "";
    STATE.dropped.table.currentPage = 1;
    
    applyDroppedFilters();
    
    if (DOM.droppedFiltersRow) DOM.droppedFiltersRow.style.display = "flex";
    if (DOM.droppedExportCsvBtn) DOM.droppedExportCsvBtn.disabled = false;
    if (DOM.droppedConfigRow) DOM.droppedConfigRow.style.borderStyle = "solid";
    
    logToConsole(`Đã tải thành công ${STATE.dropped.data.length} dòng dữ liệu rớt hàng.`, "success");
  } catch (err) {
    console.error("Fetch dropped details failed", err);
    logToConsole(`Lỗi khi tải dữ liệu rớt hàng: ${err.message}`, "error");
    alert(`Lỗi tải dữ liệu rớt hàng: ${err.message}\nVui lòng chắc chắn rằng liên kết Google Sheet chính xác và đã được cấu hình chia sẻ công khai "Anyone with link can view".`);
  } finally {
    if (DOM.droppedLoader) DOM.droppedLoader.style.display = "none";
  }
}

function findDateColumnIndex(headers) {
  const keywords = ["ngày", "ngay", "date", "thời gian", "thoi gian"];
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i]).toLowerCase();
    for (const kw of keywords) {
      if (h.includes(kw)) {
        return i;
      }
    }
  }
  
  // Dynamic fallback check
  for (let col = 0; col < headers.length; col++) {
    for (let row = 0; row < Math.min(STATE.dropped.data.length, 5); row++) {
      const cell = STATE.dropped.data[row][col];
      if (parseDateString(cell)) {
        return col;
      }
    }
  }
  return -1;
}

function parseDateString(str) {
  if (!str) return null;
  str = String(str).trim();
  
  // DD/MM/YYYY or DD-MM-YYYY
  let m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) {
    return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
  }
  
  // YYYY-MM-DD
  m = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) {
    return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  }
  
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}

function getWeekRangeDisplay(year, weekNo) {
  const jan1 = new Date(year, 0, 1);
  const daysOffset = (jan1.getDay() || 7) - 1;
  const firstMonday = new Date(year, 0, 1 + (daysOffset <= 3 ? -daysOffset : 7 - daysOffset));
  
  const monday = new Date(firstMonday.getTime() + (weekNo - 1) * 7 * 24 * 60 * 60 * 1000);
  const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
  
  const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `Tuần ${String(weekNo).padStart(2, '0')} (${fmt(monday)} - ${fmt(sunday)})`;
}

function buildWeekAndMonthFilters() {
  const dateCol = STATE.dropped.dateColIndex;
  if (dateCol === -1) {
    STATE.dropped.weeks = [];
    STATE.dropped.months = [];
    return;
  }

  const weeksMap = new Map();
  const monthsMap = new Map();

  STATE.dropped.data.forEach(row => {
    const val = row[dateCol];
    const date = parseDateString(val);
    if (date) {
      const y = date.getFullYear();
      const m = date.getMonth();
      const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
      monthsMap.set(monthKey, { year: y, month: m + 1 });
      
      const wk = getWeekNumber(date);
      const weekKey = `${wk.year}-${String(wk.week).padStart(2, '0')}`;
      weeksMap.set(weekKey, wk);
    }
  });

  STATE.dropped.weeks = Array.from(weeksMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(entry => ({
      key: entry[0],
      display: getWeekRangeDisplay(entry[1].year, entry[1].week)
    }));

  STATE.dropped.months = Array.from(monthsMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(entry => ({
      key: entry[0],
      display: `Tháng ${entry[1].month}/${entry[1].year}`
    }));
}

function populateDroppedFiltersDropdowns() {
  if (DOM.droppedFilterWeek) {
    DOM.droppedFilterWeek.innerHTML = '<option value="">Lọc theo tuần...</option>';
    STATE.dropped.weeks.forEach(wk => {
      const opt = document.createElement("option");
      opt.value = wk.key;
      opt.text = wk.display;
      DOM.droppedFilterWeek.appendChild(opt);
    });
  }

  if (DOM.droppedFilterMonth) {
    DOM.droppedFilterMonth.innerHTML = '<option value="">Lọc theo tháng...</option>';
    STATE.dropped.months.forEach(mo => {
      const opt = document.createElement("option");
      opt.value = mo.key;
      opt.text = mo.display;
      DOM.droppedFilterMonth.appendChild(opt);
    });
  }
}

function applyDroppedFilters() {
  const { fromDate, toDate, week, month, search } = STATE.dropped.filters;
  const dateCol = STATE.dropped.dateColIndex;
  
  let filtered = [...STATE.dropped.data];

  // 1. Date Range
  if (dateCol !== -1 && (fromDate || toDate)) {
    const start = fromDate ? new Date(fromDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    const end = toDate ? new Date(toDate) : null;
    if (end) end.setHours(23, 59, 59, 999);
    
    filtered = filtered.filter(row => {
      const date = parseDateString(row[dateCol]);
      if (!date) return false;
      if (start && date < start) return false;
      if (end && date > end) return false;
      return true;
    });
  }

  // 2. Week
  if (dateCol !== -1 && week) {
    const [wYear, wWeek] = week.split("-").map(Number);
    filtered = filtered.filter(row => {
      const date = parseDateString(row[dateCol]);
      if (!date) return false;
      const wk = getWeekNumber(date);
      return wk.year === wYear && wk.week === wWeek;
    });
  }

  // 3. Month
  if (dateCol !== -1 && month) {
    const [mYear, mMonth] = month.split("-").map(Number);
    filtered = filtered.filter(row => {
      const date = parseDateString(row[dateCol]);
      if (!date) return false;
      return date.getFullYear() === mYear && (date.getMonth() + 1) === mMonth;
    });
  }

  // 4. Search
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(row => {
      return row.some(cell => String(cell).toLowerCase().includes(q));
    });
  }

  // 5. Sort
  const { sortBy, sortOrder } = STATE.dropped.table;
  if (sortBy !== "") {
    const colIndex = STATE.dropped.headers.indexOf(sortBy);
    if (colIndex !== -1) {
      const isAsc = sortOrder === "asc";
      
      let numericCount = 0;
      let nonBlankCount = 0;
      for (let i = 0; i < Math.min(filtered.length, 50); i++) {
        const val = String(filtered[i][colIndex]).trim().replace(/,/g, "");
        if (val) {
          nonBlankCount++;
          if (!isNaN(Number(val))) {
            numericCount++;
          }
        }
      }
      const isNumeric = nonBlankCount > 0 && (numericCount / nonBlankCount > 0.8);
      
      filtered.sort((a, b) => {
        let valA = String(a[colIndex] || "").trim();
        let valB = String(b[colIndex] || "").trim();
        
        if (isNumeric) {
          const numA = parseFloat(valA.replace(/,/g, "")) || 0;
          const numB = parseFloat(valB.replace(/,/g, "")) || 0;
          return isAsc ? numA - numB : numB - numA;
        } else {
          if (colIndex === dateCol) {
            const dateA = parseDateString(valA) || new Date(0);
            const dateB = parseDateString(valB) || new Date(0);
            return isAsc ? dateA - dateB : dateB - dateA;
          }
          return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
      });
    }
  }

  STATE.dropped.filteredData = filtered;
  renderDroppedTable();
}

function setDroppedSort(columnName) {
  const currentSort = STATE.dropped.table.sortBy;
  const currentOrder = STATE.dropped.table.sortOrder;
  
  if (currentSort === columnName) {
    STATE.dropped.table.sortOrder = currentOrder === "asc" ? "desc" : "asc";
  } else {
    STATE.dropped.table.sortBy = columnName;
    STATE.dropped.table.sortOrder = "asc";
  }
  
  applyDroppedFilters();
}

function renderDroppedTable() {
  const headers = STATE.dropped.headers;
  const filtered = STATE.dropped.filteredData;
  const { currentPage, pageSize, sortBy, sortOrder } = STATE.dropped.table;

  // Header Render
  if (DOM.droppedTableHead) {
    DOM.droppedTableHead.innerHTML = "";
    const tr = document.createElement("tr");
    
    headers.forEach(h => {
      const th = document.createElement("th");
      th.style.cursor = "pointer";
      th.style.userSelect = "none";
      
      let suffix = " ↕";
      if (sortBy === h) {
        suffix = sortOrder === "asc" ? " ▲" : " ▼";
        th.style.color = "var(--primary)";
      }
      
      th.innerText = h + suffix;
      th.addEventListener("click", () => setDroppedSort(h));
      tr.appendChild(th);
    });
    DOM.droppedTableHead.appendChild(tr);
  }

  // Body Render
  if (DOM.droppedTableBody) {
    DOM.droppedTableBody.innerHTML = "";
    
    if (filtered.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = headers.length || 1;
      td.style.textAlign = "center";
      td.style.padding = "30px";
      td.style.color = "var(--text-muted)";
      td.innerText = "Không tìm thấy kết quả nào phù hợp.";
      tr.appendChild(td);
      DOM.droppedTableBody.appendChild(tr);
    } else {
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, filtered.length);
      const pageData = filtered.slice(startIndex, endIndex);
      
      const colAlignments = headers.map((_, colIndex) => {
        let numericCount = 0;
        let nonBlankCount = 0;
        for (let i = 0; i < Math.min(filtered.length, 30); i++) {
          const val = String(filtered[i][colIndex]).trim().replace(/,/g, "");
          if (val) {
            nonBlankCount++;
            if (!isNaN(Number(val))) numericCount++;
          }
        }
        return (nonBlankCount > 0 && numericCount / nonBlankCount > 0.8) ? "right" : "left";
      });

      pageData.forEach(row => {
        const tr = document.createElement("tr");
        headers.forEach((_, colIndex) => {
          const td = document.createElement("td");
          const val = row[colIndex] !== undefined ? String(row[colIndex]).trim() : "";
          
          if (colAlignments[colIndex] === "right") {
            td.style.textAlign = "right";
            const num = Number(val.replace(/,/g, ""));
            if (!isNaN(num)) {
              td.innerText = num.toLocaleString();
            } else {
              td.innerText = val;
            }
          } else {
            td.style.textAlign = "left";
            td.innerText = val;
          }
          
          tr.appendChild(td);
        });
        DOM.droppedTableBody.appendChild(tr);
      });
      
      if (DOM.droppedPaginationInfo) {
        DOM.droppedPaginationInfo.innerText = `Đang hiển thị ${startIndex + 1} - ${endIndex} của ${filtered.length} kết quả`;
      }
    }
  }

  // Update Pagination Controls
  if (DOM.droppedPagination) {
    if (filtered.length > 0) {
      DOM.droppedPagination.style.display = "flex";
      if (DOM.droppedPrevPageBtn) DOM.droppedPrevPageBtn.disabled = currentPage === 1;
      if (DOM.droppedNextPageBtn) {
        const maxPage = Math.ceil(filtered.length / pageSize);
        DOM.droppedNextPageBtn.disabled = currentPage >= maxPage;
      }
    } else {
      DOM.droppedPagination.style.display = "none";
    }
  }

  if (DOM.droppedTableWrapper) {
    DOM.droppedTableWrapper.style.display = "block";
  }
}

function exportDroppedDetailsToCsv() {
  const filtered = STATE.dropped.filteredData;
  if (filtered.length === 0) return;
  
  const headers = STATE.dropped.headers;
  
  let csvContent = "\ufeff"; 
  csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\r\n";
  
  filtered.forEach(row => {
    csvContent += row.map(cell => {
      const cellStr = String(cell !== null && cell !== undefined ? cell : "");
      return `"${cellStr.replace(/"/g, '""')}"`;
    }).join(",") + "\r\n";
  });
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `ChiTietRotHang_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  logToConsole("Đã xuất danh sách chi tiết rớt hàng ra CSV thành công.", "success");
}

function parseDaFromHtml(htmlText) {
  const startMarker = "const DA = [";
  const endMarker = "];";
  
  const startIdx = htmlText.indexOf(startMarker);
  if (startIdx === -1) {
    throw new Error("Không tìm thấy dữ liệu 'const DA = [' trong báo cáo Đông Mát.");
  }
  
  const endIdx = htmlText.indexOf(endMarker, startIdx);
  if (endIdx === -1) {
    throw new Error("Dữ liệu báo cáo Đông Mát không đúng định dạng (thiếu '];').");
  }
  
  const arrayText = htmlText.substring(startIdx + startMarker.length, endIdx).trim();
  
  try {
    return new Function(`return [${arrayText}]`)();
  } catch (e) {
    console.warn("Lỗi khi parse khối DA, chuyển sang parse từng dòng:", e);
    const lines = arrayText.split("\n");
    const results = [];
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      if (line.endsWith(",")) line = line.slice(0, -1);
      try {
        const obj = new Function(`return ${line}`)();
        if (obj) results.push(obj);
      } catch (err) {}
    }
    return results;
  }
}

async function renderForecastTab() {
  // Show loading state
  document.getElementById("kpiAvgActual").innerText = "Đang tải...";
  document.getElementById("kpiAvgBooking").innerText = "Dự báo (FC): Đang tải...";
  document.getElementById("kpiMaxActual").innerText = "Đang tải...";
  document.getElementById("kpiMaxActualDate").innerText = "Ngày: Đang tải...";
  document.getElementById("kpiMinActual").innerText = "Đang tải...";
  document.getElementById("kpiMinActualDate").innerText = "Ngày: Đang tải...";
  document.getElementById("kpiExceededDays").innerText = "Đang tải...";

  try {
    const htmlUrl = `../Report nhap.xuat/Output/Nhập.Xuất Đông Mát.html?_=${Date.now()}`;
    const res = await fetch(htmlUrl);
    if (!res.ok) {
      throw new Error(`Không thể tải file báo cáo: ${res.statusText}`);
    }
    const htmlText = await res.text();
    const historyData = parseDaFromHtml(htmlText);

    if (!historyData || historyData.length === 0) {
      throw new Error("Không thể trích xuất dữ liệu so sánh sản lượng từ báo cáo.");
    }

    // Filter out totals and off days
    const validHistory = historyData.filter(day => !day.off && !day.wkTotal && !day.mTotal && day.w);

    if (validHistory.length === 0) {
      throw new Error("Không tìm thấy dữ liệu hợp lệ trong lịch sử.");
    }

    // Calculate statistics
    let totalFc = 0;
    let totalAba = 0;
    let maxAba = -1;
    let maxAbaDate = "";
    let minAba = Infinity;
    let minAbaDate = "";
    let exceededDaysCount = 0;

    validHistory.forEach(day => {
      const fcVal = day.fc || 0;
      const actualTx = day.tx || 0;
      const bookingTon = day.bkTon || 0;
      totalFc += fcVal;
      totalAba += actualTx;

      // Check Max Actual
      if (actualTx > maxAba) {
        maxAba = actualTx;
        maxAbaDate = day.d;
      }
      // Check Min Actual
      if (actualTx < minAba) {
        minAba = actualTx;
        minAbaDate = day.d;
      }

      // Check if difference actual vs booking theo tồn >= 10%
      if (bookingTon === 0) {
        if (actualTx > 0) {
          exceededDaysCount++;
        }
      } else {
        const diffPct = (Math.abs(actualTx - bookingTon) / bookingTon) * 100;
        if (diffPct >= 10) {
          exceededDaysCount++;
        }
      }
    });

    const count = validHistory.length;
    const avgFc = Math.round(totalFc / count);
    const avgAba = Math.round(totalAba / count);

    // Helper formatter
    const fmt = (num) => String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    // Update KPI displays
    document.getElementById("kpiAvgActual").innerText = fmt(avgAba);
    document.getElementById("kpiAvgBooking").innerText = `Dự báo (FC): ${fmt(avgFc)}`;
    document.getElementById("kpiMaxActual").innerText = fmt(maxAba);
    document.getElementById("kpiMaxActualDate").innerText = `Ngày: ${maxAbaDate}`;
    document.getElementById("kpiMinActual").innerText = fmt(minAba);
    document.getElementById("kpiMinActualDate").innerText = `Ngày: ${minAbaDate}`;
    document.getElementById("kpiExceededDays").innerText = `${exceededDaysCount} ngày`;

    // Prepare Chart.js Data (FC vs Actual)
    const labels = validHistory.map(day => day.d);
    const fcData = validHistory.map(day => day.fc || 0);
    const actualData = validHistory.map(day => day.tx || 0);

    // Background colors array for Actual Shipped dataset (highlight red if actual vs bkTon >= 10%)
    const actualBarColors = validHistory.map(day => {
      const bookingTon = day.bkTon || 0;
      const actualTx = day.tx || 0;
      let exceeded = false;
      if (bookingTon === 0) {
        exceeded = actualTx > 0;
      } else {
        exceeded = ((Math.abs(actualTx - bookingTon) / bookingTon) * 100) >= 10;
      }
      return exceeded ? "#ef4444" : "#8b5cf6";
    });

    // Render or update chart
    const ctx = document.getElementById("forecastChart").getContext("2d");
    
    if (STATE.charts.forecast) {
      STATE.charts.forecast.destroy();
    }

    // Detect theme
    const isLight = document.body.classList.contains("light-mode");
    const isDark = !isLight;
    const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
    const textColor = isDark ? "#94a3b8" : "#64748b";

    STATE.charts.forecast = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Dự báo (FC)",
            data: fcData,
            backgroundColor: "#3b82f6", // Blue
            borderRadius: 4,
            maxBarThickness: 40
          },
          {
            label: "Thực xuất",
            data: actualData,
            backgroundColor: actualBarColors,
            borderRadius: 4,
            maxBarThickness: 40
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: textColor,
              font: {
                family: "'Outfit', sans-serif",
                weight: "600"
              }
            }
          },
          y: {
            grid: {
              color: gridColor
            },
            ticks: {
              color: textColor,
              font: {
                family: "'Outfit', sans-serif"
              },
              callback: function(value) {
                return fmt(value);
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: isDark ? "#1e293b" : "#ffffff",
            titleColor: isDark ? "#ffffff" : "#0f172a",
            bodyColor: isDark ? "#cbd5e1" : "#334155",
            borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            titleFont: {
              family: "'Outfit', sans-serif",
              size: 14,
              weight: "700"
            },
            bodyFont: {
              family: "'Outfit', sans-serif"
            },
            callbacks: {
              label: function(context) {
                const val = context.raw;
                return ` ${context.dataset.label}: ${fmt(val)}`;
              },
              footer: function(tooltipItems) {
                const dataIndex = tooltipItems[0].dataIndex;
                const day = validHistory[dataIndex];
                const fcVal = day.fc || 0;
                const bkTonVal = day.bkTon || 0;
                const txVal = day.tx || 0;
                
                const diffFc = txVal - fcVal;
                let pctFc = 0;
                if (fcVal > 0) pctFc = (diffFc / fcVal) * 100;
                
                const diffBk = txVal - bkTonVal;
                let pctBk = 0;
                if (bkTonVal > 0) pctBk = (diffBk / bkTonVal) * 100;
                
                return [
                  `Chênh lệch vs FC: ${diffFc >= 0 ? '+' : ''}${fmt(diffFc)} (${pctFc >= 0 ? '+' : ''}${pctFc.toFixed(1)}%)`,
                  `Chênh lệch vs Bk Tồn: ${diffBk >= 0 ? '+' : ''}${fmt(diffBk)} (${pctBk >= 0 ? '+' : ''}${pctBk.toFixed(1)}%)`
                ];
              }
            },
            footerFont: {
              family: "'Outfit', sans-serif",
              size: 11,
              weight: "600"
            },
            footerColor: isDark ? "#94a3b8" : "#64748b"
          }
        }
      }
    });

  } catch (err) {
    console.error("Lỗi khi render biểu đồ so sánh sản lượng:", err);
    logToConsole(`Lỗi tải biểu đồ so sánh sản lượng: ${err.message}`, "error");
    
    // Display error state on KPIs
    document.getElementById("kpiAvgActual").innerText = "Lỗi";
    document.getElementById("kpiAvgBooking").innerText = "Dự báo (FC): Lỗi";
    document.getElementById("kpiMaxActual").innerText = "Lỗi";
    document.getElementById("kpiMaxActualDate").innerText = "Không thể tải dữ liệu";
    document.getElementById("kpiMinActual").innerText = "Lỗi";
    document.getElementById("kpiMinActualDate").innerText = "Vui lòng kiểm tra file báo cáo";
    document.getElementById("kpiExceededDays").innerText = "-- ngày";
  }
}
