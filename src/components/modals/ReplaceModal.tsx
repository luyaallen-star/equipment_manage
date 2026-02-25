import { RefreshCw } from "lucide-react";

interface ReplaceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    replaceTarget: {
        personnel_name: string;
        duplicate_tag: string | null;
        equipment_type: string | null;
        serial_number: string | null;
    } | null;
    replaceSerial: string;
    setReplaceSerial: (serial: string) => void;
}

export function ReplaceModal({
    isOpen,
    onClose,
    onSubmit,
    replaceTarget,
    replaceSerial,
    setReplaceSerial
}: ReplaceModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-96 overflow-hidden">
                <div className="px-6 py-4 bg-orange-50 border-b border-orange-100 flex justify-between items-center">
                    <h3 className="font-bold text-orange-800">장비 교체 불출</h3>
                    <button onClick={onClose} className="text-orange-400 hover:text-orange-600">
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={onSubmit} className="p-6 space-y-4">
                    <div className="text-sm text-gray-600 mb-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="font-semibold text-gray-900">
                            {replaceTarget?.personnel_name}
                            {replaceTarget?.duplicate_tag && ` (${replaceTarget.duplicate_tag})`}
                        </span> 님이 사용하시던
                        <br />
                        <span className="text-orange-700 font-medium">[{replaceTarget?.equipment_type}] {replaceTarget?.serial_number}</span>
                        <br />
                        장비를 창고로 반납하고, 동일 기종의 <strong>새로운 시리얼 번호</strong> 장비를 재할당합니다.
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            새로 불출할 시리얼 넘버 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={replaceSerial}
                            onChange={e => setReplaceSerial(e.target.value)}
                            required
                            autoFocus
                            placeholder="새 장비 S/N 입력"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-orange-500 outline-none"
                        />
                    </div>
                    <div className="pt-2 flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">취소</button>
                        <button type="submit" className="px-4 py-2 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 font-medium">교체 불출 완료</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
