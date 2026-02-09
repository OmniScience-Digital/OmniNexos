import type { PrintMenuProps } from "@/types/vifForm.types";
import { Download, FileArchive, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "../ui/button";



export const PrintMenu: React.FC<PrintMenuProps> = ({
    isOpen,
    onClose,
    onDownloadCSV,
    onDownloadPDF,
    position
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            ref={menuRef}
            className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-2 w-48"
            style={{
                top: position.top,
                left: position.left,
            }}
        >
            <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-700">Download As</span>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="h-6 w-6 p-0 hover:bg-gray-100 cursor-pointer"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <button
                onClick={() => {
                    onDownloadCSV();
                    onClose();
                }}
                className="w-full flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
                <Download className="h-4 w-4 mr-3 text-green-600" />
                <span>Download CSV</span>
            </button>

            <button
                onClick={() => {
                    onDownloadPDF();
                    onClose();
                }}
                className="w-full flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
                <FileArchive className="h-4 w-4 mr-3 text-red-600" />
                <span>Download PDF</span>
            </button>
        </div>
    );
};