import { XCircle } from "lucide-react";

interface RemarkModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    remarkText: string;
    setRemarkText: (text: string) => void;
}

export function RemarkModal({
    isOpen,
    onClose,
    onSubmit,
    remarkText,
    setRemarkText
}: RemarkModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-96 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">특이사항 메모</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={onSubmit} className="p-6 space-y-4">
                    <textarea
                        value={remarkText}
                        onChange={e => setRemarkText(e.target.value)}
                        autoFocus
                        rows={4}
                        placeholder="장비 파손 우려, 대여 연장 등 특이사항..."
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:border-blue-500 outline-none resize-none"
                    />
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">내용을 모두 지우면 메모가 삭제됩니다.</span>
                        <div className="flex gap-2">
                            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">취소</button>
                            <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">저장</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
