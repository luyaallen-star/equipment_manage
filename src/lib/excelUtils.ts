import * as XLSX from "xlsx";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

/**
 * Reusable utility to generate and download Excel files across pages.
 * @param data Array of objects representing rows.
 * @param sheetName Name of the generated sheet.
 * @param fileName The output filename (e.g., "data.xlsx").
 */
export const downloadExcel = (data: any[], sheetName: string, fileName: string) => {
    if (!data || data.length === 0) {
        alert("출력할 데이터가 없습니다.");
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Ensure filename ends with .xlsx
    const cleanFileName = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
    XLSX.writeFile(workbook, cleanFileName);
};

/**
 * Generates an Excel file and opens a native "Save As" dialog in Tauri.
 * @param data Array of objects representing rows.
 * @param sheetName Name of the generated sheet.
 * @param defaultFileName Default filename suggested in the dialog.
 */
export const saveExcelWithDialog = async (data: any[], sheetName: string, defaultFileName: string) => {
    if (!data || data.length === 0) {
        alert("출력할 데이터가 없습니다.");
        return;
    }

    try {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

        // Generate Excel file as Uint8Array
        const excelBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });

        // Open save dialog
        const filePath = await save({
            title: "저장 위치 선택",
            defaultPath: defaultFileName.endsWith(".xlsx") ? defaultFileName : `${defaultFileName}.xlsx`,
            filters: [
                {
                    name: "Excel",
                    extensions: ["xlsx"]
                }
            ]
        });

        if (filePath) {
            await writeFile(filePath, new Uint8Array(excelBuffer));
            console.log(`File saved to: ${filePath}`);
        }
    } catch (error) {
        console.error("Failed to save excel file:", error);
        alert("파일 저장 중 오류가 발생했습니다.");
    }
};
