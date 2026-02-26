import React, { useEffect } from "react";
import { X, AlertCircle } from "lucide-react";

interface BatchReturnModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    selectedCount: number;
}

export function BatchReturnModal({
    isOpen,
    onClose,
    onSubmit,
    selectedCount
}: BatchReturnModalProps) {
    // Handle Escape key to close
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-emerald-50/50">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-emerald-600" />
                        일괄 반납 확인
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6">
                    <div className="bg-emerald-50 rounded-lg p-4 mb-4 border border-emerald-100">
                        <p className="text-emerald-800 text-sm">
                            선택하신 <strong>{selectedCount}명</strong>의 장비를 일괄 반납 처리하시겠습니까?
                        </p>
                        <ul className="text-emerald-700 text-xs mt-2 space-y-1 list-disc list-inside">
                            <li>현재 불출 중인 장비만 반납 처리됩니다.</li>
                            <li>손상 상태인 장비는 제외됩니다.</li>
                            <li>반납된 장비는 <strong>'점검 필요'</strong> 상태로 변경됩니다.</li>
                        </ul>
                    </div>
                </div>
                <div className="bg-gray-50 flex justify-end gap-2 p-4 border-t border-gray-100">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        취소
                    </button>
                    <button onClick={onSubmit} className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors shadow-sm">
                        일괄 반납 처리
                    </button>
                </div>
            </div>
        </div>
    );
}
