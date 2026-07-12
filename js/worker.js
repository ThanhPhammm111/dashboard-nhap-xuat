// Web Worker wrapping shared engine logic
importScripts("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js");
importScripts("engine.js");

self.onmessage = async function (e) {
    const { action, dataStFile, kfmFile, abaFile } = e.data;

    if (action === "reconcile") {
        try {
            // Step 1: Parse Data ST Mapping
            postMessage({ type: "progress", percent: 10, message: "Đang phân tích file danh mục DATA ST..." });
            const stData = parseFile(dataStFile.content, dataStFile.name);
            const stMapping = buildStMapping(stData);

            // Step 2: Parse KFM
            postMessage({ type: "progress", percent: 35, message: "Đang phân tích file xuất hàng KFM..." });
            const kfmData = parseFile(kfmFile.content, kfmFile.name);
            const { kfmDict, productNameMap } = processKfm(kfmData, stMapping);

            // Step 3: Parse ABA
            postMessage({ type: "progress", percent: 65, message: "Đang phân tích file giao hàng ABA..." });
            const abaData = parseFile(abaFile.content, abaFile.name);
            const { abaDict, productMetaMap } = processAba(abaData, productNameMap);

            // Step 4: Reconcile
            postMessage({ type: "progress", percent: 85, message: "Đang đối soát dữ liệu và tính chênh lệch..." });
            const reconciliation = performReconciliation(kfmDict, abaDict, productNameMap, productMetaMap);

            postMessage({ type: "progress", percent: 100, message: "Hoàn thành đối soát!" });
            postMessage({ 
                type: "success", 
                results: reconciliation.results, 
                warnings: reconciliation.warnings, 
                stats: reconciliation.stats 
            });
        } catch (error) {
            postMessage({ type: "error", error: error.message });
        }
    }
};
