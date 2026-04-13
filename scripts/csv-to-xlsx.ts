import * as XLSX from "xlsx";
import * as fs from "fs";

const csvData = fs.readFileSync("/Users/simonkramer/Documents/qashivo/reconciliation_export.csv", "utf-8");
const wb = XLSX.read(csvData, { type: "string" });
const outPath = "/Users/simonkramer/Documents/qashivo/reconciliation_export.xlsx";
XLSX.writeFile(wb, outPath);
console.log(`✅ Saved ${outPath}`);
