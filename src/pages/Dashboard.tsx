import { useEffect, useState, useRef } from "react";
import { getDB } from "../lib/db";
import { Download, Upload, FileText } from "lucide-react";
import { downloadExcel, saveExcelWithDialog } from "../lib/excelUtils";
import * as XLSX from "xlsx";
import { useGlobalData } from "../contexts/GlobalDataContext";

interface DashboardStats {
    totalEquipment: number;
    inStock: number;
    checkedOut: number;
    damaged: number;
}

interface CohortSummary {
    cohortName: string;
    equipmentType: string;
    count: number;
    cohortColor: string | null;
}

interface EquipmentTypeStat {
    type: string;
    total: number;
}

export default function Dashboard() {
    const [stats, setStats] = useState<DashboardStats>({ totalEquipment: 0, inStock: 0, checkedOut: 0, damaged: 0 });
    const [typeStats, setTypeStats] = useState<EquipmentTypeStat[]>([]);
    const [cohortSummaries, setCohortSummaries] = useState<CohortSummary[]>([]);
    const { cohorts } = useGlobalData();

    useEffect(() => {
        async function loadData() {
            try {
                const db = await getDB();

                // Fetch overall stats
                const result: any[] = await db.select(`
          SELECT 
            COUNT(*) as totalEquipment,
            SUM(CASE WHEN status = 'IN_STOCK' THEN 1 ELSE 0 END) as inStock,
            SUM(CASE WHEN status = 'CHECKED_OUT' THEN 1 ELSE 0 END) as checkedOut,
            SUM(CASE WHEN status = 'DAMAGED' THEN 1 ELSE 0 END) as damaged
          FROM equipment
        `);

                if (result && result.length > 0) {
                    setStats({
                        totalEquipment: result[0].totalEquipment || 0,
                        inStock: result[0].inStock || 0,
                        checkedOut: result[0].checkedOut || 0,
                        damaged: result[0].damaged || 0
                    });
                }

                // Fetch equipment type breakdowns
                const typeResult: any[] = await db.select(`
                    SELECT type, COUNT(*) as total
                    FROM equipment
                    GROUP BY type
                    ORDER BY type ASC
                `);
                setTypeStats(typeResult);

                // Fetch cohort-specific stats using cached cohorts to generate names and colors
                const groupResult: any[] = await db.select(`
          SELECT c.id as cohortId, e.type as equipmentType, COUNT(e.id) as count
          FROM checkouts ck
          JOIN personnel p ON ck.personnel_id = p.id
          JOIN cohorts c ON p.cohort_id = c.id
          JOIN equipment e ON ck.equipment_id = e.id
          WHERE ck.return_date IS NULL
          GROUP BY c.id, e.type
          ORDER BY c.sort_order ASC
        `);

                const formattedGroupResult = groupResult.map(row => {
                    const matchedCohort = cohorts.find(c => c.id === row.cohortId);
                    return {
                        cohortName: matchedCohort ? matchedCohort.name : "알 수 없는 기수",
                        equipmentType: row.equipmentType,
                        count: row.count,
                        cohortColor: matchedCohort ? matchedCohort.color : null
                    };
                });

                setCohortSummaries(formattedGroupResult);

            } catch (error) {
                console.error("Failed to load dashboard data:", error);
            }
        }

        loadData();
    }, []);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImportExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Get data as array of arrays to handle flexible structure
                const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (rawData.length < 2) {
                    alert("가져올 데이터가 없습니다.");
                    return;
                }

                // Detect headers. Assuming row 0 is headers.
                const headers = rawData[0].map(h => String(h).trim().replace(/\s+/g, ''));
                const cohortIdx = headers.findIndex(h => h.includes("기수"));
                const nameIdx = headers.findIndex(h => h.includes("이름") || h.includes("성명"));
                const typeIdx = headers.findIndex(h => h.includes("장비종류") || h.includes("종류") || h.includes("장비명"));
                const serialIdx = headers.findIndex(h => h.includes("시리얼") || h.includes("S/N") || h.includes("serial"));
                const dateIdx = headers.findIndex(h => h.includes("불출일") || h.includes("날짜") || h.includes("date"));
                const remarkIdx = headers.findIndex(h => h.includes("특이사항") || h.includes("비고") || h.includes("메모"));

                if (cohortIdx === -1 || nameIdx === -1) {
                    alert("엑셀 데이터에 최소 '기수'와 '이름' 관련 열(Header)이 필요합니다.");
                    return;
                }

                const db = await getDB();
                let successCount = 0;

                // Process rows
                for (let i = 1; i < rawData.length; i++) {
                    const row = rawData[i];
                    if (!row || row.length === 0 || !row[nameIdx]) continue; // Skip empty rows

                    const cohortName = String(row[cohortIdx]).trim();
                    const personNameFull = String(row[nameIdx]).trim();
                    const equipmentType = typeIdx !== -1 && row[typeIdx] ? String(row[typeIdx]).trim() : null;
                    const serialNum = serialIdx !== -1 && row[serialIdx] ? String(row[serialIdx]).trim() : null;
                    const cDate = dateIdx !== -1 && row[dateIdx] ? String(row[dateIdx]).trim() : new Date().toISOString().split('T')[0];
                    const remark = remarkIdx !== -1 && row[remarkIdx] ? String(row[remarkIdx]).trim() : null;

                    if (!cohortName || !personNameFull) continue;

                    // 1. Cohort
                    await db.execute("INSERT OR IGNORE INTO cohorts (name) VALUES ($1)", [cohortName]);
                    const cohortRes: any[] = await db.select("SELECT id FROM cohorts WHERE name = $1", [cohortName]);
                    const cohortId = cohortRes[0].id;

                    // Parse name and tag. E.g "홍길동 (A)" or "홍길동(A)"
                    let pName = personNameFull;
                    let pTag = null;
                    const match = personNameFull.match(/^(.*?)\s*\((.*?)\)$/);
                    if (match) {
                        pName = match[1].trim();
                        pTag = match[2].trim();
                    }

                    // 2. Personnel
                    let pQuery = "SELECT id FROM personnel WHERE cohort_id = $1 AND name = $2";
                    let pParams: any[] = [cohortId, pName];
                    if (pTag) {
                        pQuery += " AND duplicate_tag = $3";
                        pParams.push(pTag);
                    } else {
                        pQuery += " AND duplicate_tag IS NULL";
                    }

                    let personRes: any[] = await db.select(pQuery, pParams);
                    let personId;

                    if (personRes.length === 0) {
                        const insertRes = await db.execute(
                            "INSERT INTO personnel (cohort_id, name, duplicate_tag) VALUES ($1, $2, $3)",
                            [cohortId, pName, pTag]
                        );
                        personId = insertRes.lastInsertId;
                    } else {
                        personId = personRes[0].id;
                    }

                    // 3. Equipment & Checkout
                    if (equipmentType && serialNum) {
                        let equipRes: any[] = await db.select("SELECT id, status FROM equipment WHERE serial_number = $1", [serialNum]);
                        let equipId;

                        if (equipRes.length === 0) {
                            const eRes = await db.execute("INSERT INTO equipment (type, serial_number, status) VALUES ($1, $2, 'CHECKED_OUT')", [equipmentType, serialNum]);
                            equipId = eRes.lastInsertId;
                        } else {
                            equipId = equipRes[0].id;
                            if (equipRes[0].status !== 'CHECKED_OUT') {
                                await db.execute("UPDATE equipment SET status = 'CHECKED_OUT', type = $1 WHERE id = $2", [equipmentType, equipId]);
                            }
                        }

                        // Check if checkout already exists to avoid duplicates
                        const ckRes: any[] = await db.select(
                            "SELECT id FROM checkouts WHERE personnel_id = $1 AND equipment_id = $2 AND return_date IS NULL",
                            [personId, equipId]
                        );

                        if (ckRes.length === 0) {
                            await db.execute(
                                "INSERT INTO checkouts (personnel_id, equipment_id, checkout_date, remarks) VALUES ($1, $2, $3, $4)",
                                [personId, equipId, cDate, remark]
                            );
                        }
                    }
                    successCount++;
                }

                alert(`성공적으로 ${successCount}건의 데이터를 처리했습니다.`);

                // Reload dashboard data
                const newStatsResult: any[] = await db.select(`
                  SELECT 
                    COUNT(*) as totalEquipment,
                    SUM(CASE WHEN status = 'IN_STOCK' THEN 1 ELSE 0 END) as inStock,
                    SUM(CASE WHEN status = 'CHECKED_OUT' THEN 1 ELSE 0 END) as checkedOut,
                    SUM(CASE WHEN status = 'DAMAGED' THEN 1 ELSE 0 END) as damaged
                  FROM equipment
                `);

                if (newStatsResult && newStatsResult.length > 0) {
                    setStats({
                        totalEquipment: newStatsResult[0].totalEquipment || 0,
                        inStock: newStatsResult[0].inStock || 0,
                        checkedOut: newStatsResult[0].checkedOut || 0,
                        damaged: newStatsResult[0].damaged || 0
                    });
                }

                const newGroupResult: any[] = await db.select(`
                  SELECT c.name as cohortName, e.type as equipmentType, COUNT(e.id) as count
                  FROM checkouts ck
                  JOIN personnel p ON ck.personnel_id = p.id
                  JOIN cohorts c ON p.cohort_id = c.id
                  JOIN equipment e ON ck.equipment_id = e.id
                  WHERE ck.return_date IS NULL
                  GROUP BY c.id, e.type
                  ORDER BY c.name
                `);
                setCohortSummaries(newGroupResult);

            } catch (err) {
                console.error("Excel import failed:", err);
                alert("엑셀 파일을 처리하는 중 오류가 발생했습니다. 데이터 구조를 확인해주세요.");
            } finally {
                // Reset file input
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            }
        };

        reader.readAsArrayBuffer(file);
    };

    const handleDownloadTemplate = async () => {
        const templateData = [
            {
                "기수": "1기",
                "이름": "홍길동",
                "장비종류": "노트북",
                "시리얼넘버": "SN123456",
                "불출일": "2024-01-01",
                "특이사항": "신규 지급"
            }
        ];
        await saveExcelWithDialog(templateData, "Template", "template");
    };

    const handleExportExcel = () => {
        if (cohortSummaries.length === 0) {
            alert("출력할 데이터가 없습니다.");
            return;
        }

        const exportData = cohortSummaries.map(item => ({
            "기수명": item.cohortName,
            "장비 종류": item.equipmentType,
            "불출 대수": item.count
        }));
        downloadExcel(exportData, "불출현황", "장비_불출현황_요약");
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 tracking-tight">대시보드 요약</h2>
                <div className="flex gap-2">
                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleImportExcel}
                    />
                    <button
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                    >
                        <FileText className="w-4 h-4" />
                        템플릿 다운로드
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                    >
                        <Upload className="w-4 h-4" />
                        엑셀로 가져오기
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                    >
                        <Download className="w-4 h-4" />
                        불출현황 내보내기
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard title="총 운용 장비" value={stats.totalEquipment} color="bg-blue-50 text-blue-700" />
                <StatCard title="창고 보관 (재고)" value={stats.inStock} color="bg-emerald-50 text-emerald-700" />
                <StatCard title="불출 중" value={stats.checkedOut} color="bg-amber-50 text-amber-700" />
                <StatCard title="손상 장비" value={stats.damaged} color="bg-red-50 text-red-700" />
            </div>

            {/* Equipment Type Breakdown */}
            {typeStats.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mt-8 flex flex-wrap items-center gap-4">
                    <span className="text-sm font-semibold text-gray-500 border-r border-gray-200 xl:min-w-fit pr-4">장비별 운용 대수</span>
                    <div className="flex flex-wrap gap-x-6 gap-y-3">
                        {typeStats.map(ts => (
                            <div key={ts.type} className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-700">{ts.type}</span>
                                <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full">{ts.total}대</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Cohort Summary Pivot Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-8">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-800">기수별 장비 불출 현황</h3>
                    <span className="text-xs text-gray-500 font-medium bg-white px-2.5 py-1 rounded border border-gray-200">
                        {cohortSummaries.length === 0 ? '0건' : `총 ${cohortSummaries.reduce((acc, row) => acc + row.count, 0)}대 불출 중`}
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider">
                                <th className="px-6 py-3 font-semibold text-gray-700 bg-gray-50 sticky left-0 z-10 border-r border-gray-200 min-w-[120px]">기수명</th>
                                {Array.from(new Set(cohortSummaries.map(s => s.equipmentType))).sort().map(type => (
                                    <th key={type} className="px-4 py-3 font-medium text-center min-w-[100px]">{type}</th>
                                ))}
                                <th className="px-6 py-3 font-semibold text-blue-600 text-center bg-blue-50/30 border-l border-gray-200 min-w-[100px]">총합</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {cohortSummaries.length === 0 ? (
                                <tr>
                                    <td colSpan={100} className="px-6 py-12 text-center text-gray-500">
                                        현재 불출된 장비 기록이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                Object.entries(
                                    cohortSummaries.reduce((acc, row) => {
                                        if (!acc[row.cohortName]) acc[row.cohortName] = { color: row.cohortColor, counts: {} };
                                        acc[row.cohortName].counts[row.equipmentType] = row.count;
                                        return acc;
                                    }, {} as Record<string, { color: string | null, counts: Record<string, number> }>)
                                ).map(([cohortName, data]) => {
                                    const equipmentCounts = data.counts;
                                    const cColor = data.color || '#4b5563';
                                    const total = Object.values(equipmentCounts).reduce((sum, count) => sum + count, 0);
                                    return (
                                        <tr key={cohortName} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-3.5 bg-white group-hover:bg-gray-50/50 sticky left-0 z-10 border-r border-gray-100 shadow-[1px_0_0_0_rgba(243,244,246,1)]">
                                                <span
                                                    className="font-bold px-2.5 py-1.5 rounded-full text-sm shadow-sm border inline-block min-w-16 text-center"
                                                    style={{
                                                        backgroundColor: data.color ? `${cColor}15` : '#f3f4f6',
                                                        color: data.color ? cColor : '#374151',
                                                        borderColor: data.color ? `${cColor}30` : '#d1d5db'
                                                    }}
                                                >
                                                    {cohortName}
                                                </span>
                                            </td>
                                            {Array.from(new Set(cohortSummaries.map(s => s.equipmentType))).sort().map(type => (
                                                <td key={type} className={`px-4 py-3.5 text-center ${equipmentCounts[type] ? 'text-gray-900 font-medium' : 'text-gray-300'}`}>
                                                    {equipmentCounts[type] ? `${equipmentCounts[type]}대` : '-'}
                                                </td>
                                            ))}
                                            <td className="px-6 py-3.5 text-center font-bold text-blue-600 bg-blue-50/10 border-l border-gray-100">
                                                {total}대
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                        {/* Summary Footer */}
                        {cohortSummaries.length > 0 && (
                            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                <tr>
                                    <td className="px-6 py-4 font-bold text-gray-900 sticky left-0 z-10 bg-gray-50 border-r border-gray-200">전체 합계</td>
                                    {Array.from(new Set(cohortSummaries.map(s => s.equipmentType))).sort().map(type => {
                                        const totalForType = cohortSummaries.filter(s => s.equipmentType === type).reduce((acc, row) => acc + row.count, 0);
                                        return (
                                            <td key={type} className="px-4 py-4 text-center font-bold text-gray-700">
                                                {totalForType}대
                                            </td>
                                        );
                                    })}
                                    <td className="px-6 py-4 text-center font-black text-blue-700 bg-blue-50/50 border-l border-gray-200">
                                        {cohortSummaries.reduce((acc, row) => acc + row.count, 0)}대
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, color }: { title: string, value: number, color: string }) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-center items-center">
            <h3 className="text-gray-500 font-medium text-sm mb-2">{title}</h3>
            <div className={`text-4xl font-bold px-4 py-2 rounded-lg ${color}`}>
                {value}
            </div>
        </div>
    );
}
