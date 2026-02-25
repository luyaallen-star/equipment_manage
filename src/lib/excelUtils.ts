import * as XLSX from "xlsx";

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
