import { Palette, X } from "lucide-react";

interface Cohort {
    id: number;
    name: string;
    color: string | null;
}

interface ColorModalProps {
    isOpen: boolean;
    onClose: () => void;
    cohorts: Cohort[];
    handleColorChange: (cohortId: number, color: string) => void;
}

export function ColorModal({
    isOpen,
    onClose,
    cohorts,
    handleColorChange
}: ColorModalProps) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[80vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                        <Palette className="w-5 h-5 text-indigo-500" />
                        기수별 색상 지정
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {cohorts.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">등록된 기수가 없습니다.</p>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-sm text-gray-500 mb-4">
                                우측의 컬러 피커를 클릭하여 각 기수의 고유 색상을 지정하세요. 지정된 색상은 대시보드의 기수 목록 캡슐에 반영됩니다.
                            </p>
                            {cohorts.map(cohort => {
                                const cColor = cohort.color || '#4b5563';
                                return (
                                    <div key={cohort.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                                        <span
                                            className="font-bold px-2.5 py-1.5 rounded-full text-sm shadow-sm border"
                                            style={{
                                                backgroundColor: `${cColor}15`,
                                                color: cColor,
                                                borderColor: `${cColor}30`
                                            }}
                                        >
                                            {cohort.name}
                                        </span>
                                        <div className="flex items-center gap-3">
                                            <div className="text-xs text-gray-400 font-mono uppercase w-16 text-right">
                                                {cColor}
                                            </div>
                                            <input
                                                type="color"
                                                value={cColor}
                                                onChange={(e) => handleColorChange(cohort.id, e.target.value)}
                                                className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                    >
                        완료
                    </button>
                </div>
            </div>
        </div>
    );
}
