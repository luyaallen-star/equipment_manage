import { useEffect, useState } from "react";
import { getDB } from "../lib/db";
import { Download, CheckCircle, Package } from "lucide-react";
import { saveExcelWithDialog } from "../lib/excelUtils";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useDebounce } from "../hooks/useDebounce";

interface InventoryItem {
    id: number;
    type: string;
    serial_number: string;
    status: string;
    remarks?: string;
}

export default function InventoryPage() {
    const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        loadInventory();
    }, []);

    async function loadInventory() {
        try {
            const db = await getDB();
            const result: InventoryItem[] = await db.select(`
                SELECT 
                    e.id, 
                    e.type, 
                    e.serial_number, 
                    e.status,
                    last_ck.remarks
                FROM equipment e
                LEFT JOIN (
                    SELECT equipment_id, remarks
                    FROM checkouts c1
                    WHERE id = (SELECT MAX(id) FROM checkouts c2 WHERE c2.equipment_id = c1.equipment_id)
                ) last_ck ON e.id = last_ck.equipment_id
                WHERE e.status = 'IN_STOCK'
                ORDER BY e.type ASC, e.id DESC
            `);
            setInventoryList(result);
        } catch (error) {
            console.error("Failed to load inventory:", error);
        }
    }

    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    const handleExportExcel = async () => {
        if (inventoryList.length === 0) {
            alert("출력할 데이터가 없습니다.");
            return;
        }

        const exportData = inventoryList.map((item, idx) => ({
            "연번": idx + 1,
            "장비 종류": item.type,
            "시리얼 넘버": item.serial_number,
            "상태": "창고보관(재고)"
        }));

        await saveExcelWithDialog(exportData, "창고 재고", "창고_재고_현황");
    };

    const filteredList = inventoryList.filter(item => {
        if (!debouncedSearchQuery.trim()) return true;
        const query = debouncedSearchQuery.toLowerCase().trim();
        const searchableText = [
            item.serial_number,
            item.type,
            item.remarks
        ].filter(Boolean).map(s => String(s).toLowerCase()).join(" ");

        return query.split(/\s+/).every(term => searchableText.includes(term));
    });

    // Compute sums by equipment type
    const typeCounts = inventoryList.reduce((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="space-y-6 flex flex-col h-full">
            <div className="flex flex-col sm:flex-row justify-between items-start lg:items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                    창고 보유 장비 대장 (가용 재고)
                </h2>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <input
                        type="text"
                        placeholder="종류, 시리얼, 메모 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-full md:w-56 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                    />
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm whitespace-nowrap"
                    >
                        <Download className="w-4 h-4" />
                        재고 리스트 내보내기
                    </button>
                </div>
            </div>

            {/* Inventory Type Summary Stats */}
            {inventoryList.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-3">
                        <Package className="w-4 h-4 text-gray-500" />
                        보유 장비 통계
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(typeCounts).sort(([a], [b]) => a.localeCompare(b)).map(([type, count]) => (
                            <div key={type} className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden shrink-0">
                                <div className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium border-r border-gray-200">
                                    {type}
                                </div>
                                <div className="px-3 py-1.5 text-emerald-700 font-bold text-sm bg-emerald-50/50">
                                    {count}대
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-emerald-100 flex-1 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-emerald-50 bg-emerald-50/30 flex justify-between items-center">
                    <h3 className="font-semibold text-emerald-900">
                        즉시 불출 가능한 장비 현황 (총 {filteredList.length}대 검색됨)
                    </h3>
                </div>

                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm border-b border-gray-200">
                            <tr className="text-gray-500 uppercase tracking-wider">
                                <th className="px-6 py-3 font-medium w-24">NO</th>
                                <th className="px-6 py-3 font-medium w-36">장비 종류</th>
                                <th className="px-6 py-3 font-medium w-48">시리얼 넘버</th>
                                <th className="px-6 py-3 font-medium">현재 상태</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {filteredList.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        {searchQuery ? "검색 결과가 없습니다." : "창고에 남아있는 장비가 없습니다."}
                                    </td>
                                </tr>
                            ) : (
                                filteredList.map((equip) => {
                                    // Use absolute index from the main list so Sequence NO doesn't reset
                                    const filterIndex = inventoryList.findIndex(e => e.id === equip.id) + 1;

                                    return (
                                        <tr key={equip.id} className="hover:bg-emerald-50/30 transition-colors">
                                            <td className="px-6 py-4 text-gray-500 font-mono text-xs">{filterIndex}</td>
                                            <td className="px-6 py-4 font-medium text-gray-900">{equip.type}</td>
                                            <td className="px-6 py-4 text-gray-600 font-mono text-xs">{equip.serial_number}</td>
                                            <td className="px-6 py-4">
                                                <StatusBadge status="IN_STOCK" label="창고 보관중" />
                                                {equip.remarks && (
                                                    <div className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 p-2 rounded-md break-words max-w-sm">
                                                        <span className="font-semibold mr-1">이전 메모:</span>{equip.remarks}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
