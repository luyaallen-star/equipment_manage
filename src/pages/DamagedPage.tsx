import { useEffect, useState } from "react";
import { getDB } from "../lib/db";
import { AlertTriangle, ImageIcon, X } from "lucide-react";

interface DamageReport {
    id: number;
    report_date: string;
    description: string;
    image_path: string | null;
    equipment_type: string;
    serial_number: string;
}

export default function DamagedPage() {
    const [reports, setReports] = useState<DamageReport[]>([]);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [selectedReport, setSelectedReport] = useState<DamageReport | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [typeColors, setTypeColors] = useState<Record<string, string>>({});
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    useEffect(() => {
        loadReports();
    }, []);
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (zoomedImage) setZoomedImage(null);
                else setSelectedReport(null);
            }
        };
        if (selectedReport || zoomedImage) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedReport, zoomedImage]);

    async function loadReports() {
        try {
            setFetchError(null);
            const db = await getDB();

            // Load equipment colors
            const colorsResult: any[] = await db.select("SELECT type, color FROM equipment_colors");
            const colorMap: Record<string, string> = {};
            colorsResult.forEach(row => {
                colorMap[row.type] = row.color;
            });
            setTypeColors(colorMap);

            const result: any[] = await db.select(`
                SELECT 
                  d.id, 
                  d.report_date, 
                  IFNULL(d.description, '') as description, 
                  IFNULL(d.image_path, '') as image_path,
                  e.type as equipment_type, 
                  e.serial_number
                FROM damage_reports d
                JOIN equipment e ON d.equipment_id = e.id
                ORDER BY d.report_date DESC, d.id DESC
            `);
            setReports(result);

            // Refresh selected report if modal is open
            if (selectedReport) {
                const updated = result.find(r => r.id === selectedReport.id);
                if (updated) setSelectedReport(updated);
            }
        } catch (error: any) {
            console.error("Failed to load damage reports:", error);
            setFetchError(error.message || String(error));
        }
    }

    // Helper to decode image paths stored as JSON array string, or fallback to single string
    const getStoredImages = (report: DamageReport): string[] => {
        if (!report.image_path) return [];
        try {
            const parsed = JSON.parse(report.image_path);
            return Array.isArray(parsed) ? parsed : [report.image_path];
        } catch {
            return [report.image_path]; // Old format fallback
        }
    };

    const handleImageUpload = async (reportId: number, fileList: FileList) => {
        const reportToUpdate = reports.find(r => r.id === reportId);
        if (!reportToUpdate) return;

        const currentImages = getStoredImages(reportToUpdate);
        if (currentImages.length >= 10) return alert("최대 10장까지만 첨부할 수 있습니다.");

        const filesToProcess = Array.from(fileList).slice(0, 10 - currentImages.length);

        try {
            const newBase64s = await Promise.all(filesToProcess.map(file => {
                return new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target?.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }));

            const combinedImages = [...currentImages, ...newBase64s];
            const jsonString = JSON.stringify(combinedImages);

            const db = await getDB();
            await db.execute("UPDATE damage_reports SET image_path = $1 WHERE id = $2", [jsonString, reportId]);
            loadReports();
        } catch (error) {
            console.error(error);
            alert("이미지 저장에 실패했습니다.");
        }
    };

    const removeImage = async (reportId: number, imageIndex: number) => {
        if (!confirm("첨부된 사진을 삭제하시겠습니까?")) return;
        const reportToUpdate = reports.find(r => r.id === reportId);
        if (!reportToUpdate) return;

        const currentImages = getStoredImages(reportToUpdate);
        currentImages.splice(imageIndex, 1);
        const jsonString = currentImages.length > 0 ? JSON.stringify(currentImages) : null;

        try {
            const db = await getDB();
            await db.execute("UPDATE damage_reports SET image_path = $1 WHERE id = $2", [jsonString, reportId]);
            loadReports();
        } catch (error) {
            console.error(error);
            alert("이미지 삭제에 실패했습니다.");
        }
    };

    const filteredReports = reports.filter(r =>
        String(r.serial_number || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 flex flex-col h-full relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-2 shrink-0">
                    <AlertTriangle className="w-7 h-7 text-red-500" />
                    손상 장비 목록 및 보고서
                </h2>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                        type="text"
                        placeholder="시리얼 넘버 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={loadReports}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 shrink-0"
                    >
                        새로고침
                    </button>
                </div>
            </div>

            {fetchError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                    <p className="font-bold mb-1">데이터베이스 오류 발생:</p>
                    <p className="font-mono text-sm">{fetchError}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 flex-1 overflow-auto bg-gray-50/50 p-3 rounded-xl border border-gray-100 content-start">
                {filteredReports.length === 0 ? (
                    <div className="col-span-full h-40 flex items-center justify-center text-gray-500">
                        {searchQuery ? "검색 결과가 없습니다." : "손상 보고된 장비가 없습니다."}
                    </div>
                ) : (
                    filteredReports.map(report => {
                        const images = getStoredImages(report);
                        const cardColor = typeColors[report.equipment_type] || '#fca5a5'; // Default red if no color

                        return (
                            <div
                                key={report.id}
                                onClick={() => setSelectedReport(report)}
                                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col overflow-hidden h-[160px] group"
                                style={{ border: `1px solid ${cardColor}40`, borderTopWidth: '4px', borderTopColor: cardColor }}
                            >
                                <div className="px-3 py-2 border-b" style={{ borderColor: `${cardColor}20`, backgroundColor: `${cardColor}08` }}>
                                    <div className="flex justify-between items-start mb-0.5">
                                        <h3 className="font-bold font-mono text-gray-900 truncate text-sm">{report.serial_number}</h3>
                                        <span className="text-[10px] text-gray-500 shrink-0 bg-white px-1.5 py-0.5 rounded-full border border-gray-100 shadow-sm leading-none">
                                            {report.report_date}
                                        </span>
                                    </div>
                                    <span className="text-xs font-semibold" style={{ color: cardColor }}>{report.equipment_type}</span>
                                </div>

                                <div className="p-3 flex-1 flex flex-col gap-1.5">
                                    <p className="text-[13px] leading-tight text-gray-600 line-clamp-2 flex-1">
                                        {report.description || <span className="text-gray-400 italic">사유 미입력</span>}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1.5 rounded-md w-fit mt-auto group-hover:bg-blue-100 transition-colors leading-none">
                                        <ImageIcon className="w-3.5 h-3.5" />
                                        사진 {images.length}장
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Modal Window for Detailed View & Multi-image Upload */}
            {selectedReport && (
                <div
                    className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 lg:p-12"
                    onClick={() => setSelectedReport(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg" style={{ backgroundColor: `${typeColors[selectedReport.equipment_type] || '#ef4444'}20`, color: typeColors[selectedReport.equipment_type] || '#ef4444' }}>
                                    <AlertTriangle className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 text-lg leading-tight">{selectedReport.equipment_type} 손상 보고서</h3>
                                    <span className="text-sm text-gray-500 font-mono">S/N: {selectedReport.serial_number}</span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedReport(null)} className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition-colors shadow-sm">
                                닫기
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-gray-50/30">
                            {/* Left: Info */}
                            <div className="w-full md:w-1/3 p-6 border-r border-gray-100 flex flex-col gap-4 overflow-y-auto shrink-0 bg-white">
                                <div>
                                    <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">보고일자</span>
                                    <div className="px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-gray-800 text-sm">
                                        {selectedReport.report_date}
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">손상 상세 사유</span>
                                    <div className="min-h-[100px] px-4 py-3 bg-red-50/30 border border-red-100 rounded-lg text-gray-800 text-sm whitespace-pre-wrap leading-relaxed shadow-inner">
                                        {selectedReport.description || "사유가 작성되지 않았습니다."}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Images */}
                            <div className="flex-1 p-6 flex flex-col overflow-y-auto w-full">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                        <ImageIcon className="w-4 h-4 text-blue-500" />
                                        현장 첨부 사진 ({getStoredImages(selectedReport).length}/10)
                                    </span>
                                    {getStoredImages(selectedReport).length < 10 && (
                                        <label className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium cursor-pointer transition-colors shadow-sm flex items-center gap-2">
                                            <span>+ 사진 추가</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                className="hidden"
                                                onChange={(e) => {
                                                    if (e.target.files && e.target.files.length > 0) {
                                                        handleImageUpload(selectedReport.id, e.target.files);
                                                    }
                                                }}
                                            />
                                        </label>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                                    {getStoredImages(selectedReport).map((imgBase64, idx) => (
                                        <div key={idx} onClick={() => setZoomedImage(imgBase64)} className="relative group bg-white p-2 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-zoom-in">
                                            <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-gray-100">
                                                <img src={imgBase64} alt={`Damage ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeImage(selectedReport.id, idx); }}
                                                className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xl font-bold font-mono pb-1"
                                                title="사진 삭제"
                                            >
                                                &times;
                                            </button>
                                            <div className="mt-2 text-center text-xs font-medium text-gray-500 bg-gray-50 py-1 rounded-md">사진 {idx + 1}</div>
                                        </div>
                                    ))}

                                    {getStoredImages(selectedReport).length === 0 && (
                                        <div className="col-span-full h-64 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
                                            <ImageIcon className="w-8 h-8 mb-3 opacity-50" />
                                            <p className="font-medium text-sm">등록된 파손 사진이 없습니다.</p>
                                            <p className="text-xs mt-1">상단의 '+ 사진 추가' 버튼을 눌러 최대 10장까지 업로드하세요.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Fullscreen Image Overlay */}
            {zoomedImage && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                    onClick={() => setZoomedImage(null)}
                >
                    <button
                        className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors bg-black/20 hover:bg-black/40 p-2 rounded-full"
                        onClick={() => setZoomedImage(null)}
                    >
                        <X className="w-8 h-8" />
                    </button>
                    <img
                        src={zoomedImage}
                        alt="Zoomed Detail"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl ring-1 ring-white/10"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
