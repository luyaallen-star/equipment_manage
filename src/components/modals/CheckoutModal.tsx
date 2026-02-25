import { XCircle } from "lucide-react";

interface CheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    checkoutTargetName: string;
    checkoutTypeMode: 'select' | 'custom';
    setCheckoutTypeMode: (mode: 'select' | 'custom') => void;
    checkoutType: string;
    setCheckoutType: (type: string) => void;
    equipmentTypes: string[];
    checkoutSerial: string;
    setCheckoutSerial: (serial: string) => void;
}

export function CheckoutModal({
    isOpen,
    onClose,
    onSubmit,
    checkoutTargetName,
    checkoutTypeMode,
    setCheckoutTypeMode,
    checkoutType,
    setCheckoutType,
    equipmentTypes,
    checkoutSerial,
    setCheckoutSerial
}: CheckoutModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-96 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">새 장비 불출</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={onSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">불출 대상</label>
                        <div className="p-2 bg-gray-50 rounded text-sm text-gray-600">
                            {checkoutTargetName}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            장비 종류 <span className="text-red-500">*</span>
                        </label>
                        {checkoutTypeMode === 'select' ? (
                            <div className="flex flex-col gap-2">
                                <select
                                    value={checkoutType}
                                    onChange={(e) => {
                                        if (e.target.value === '__custom__') {
                                            setCheckoutTypeMode('custom');
                                            setCheckoutType("");
                                        } else {
                                            setCheckoutType(e.target.value);
                                        }
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 outline-none bg-white"
                                >
                                    {equipmentTypes.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                    <option value="__custom__">+ 직접 입력 (새 장비)</option>
                                </select>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={checkoutType}
                                    onChange={e => setCheckoutType(e.target.value)}
                                    required autoFocus
                                    placeholder="예: 소총, 무전기"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 outline-none"
                                />
                                {equipmentTypes.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => { setCheckoutTypeMode('select'); setCheckoutType(equipmentTypes[0]); }}
                                        className="text-xs text-blue-600 whitespace-nowrap hover:underline"
                                    >
                                        목록 선택
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            시리얼 넘버 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={checkoutSerial}
                            onChange={e => setCheckoutSerial(e.target.value)}
                            required
                            placeholder="S/N"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 outline-none"
                        />
                    </div>
                    <div className="pt-2 flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">취소</button>
                        <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">불출 완료</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
