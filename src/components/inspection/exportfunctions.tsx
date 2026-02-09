import type { Fleet } from '@/types/vifForm.types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Add type declaration for autoTable
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
        lastAutoTable?: {
            finalY: number;
        };
    }
}

// Helper function to convert data to CSV
export const convertToCSV = (fleetData: Fleet[]): string => {
    const rows: string[] = [];

    // Headers
    const headers = [
        'Fleet Number',
        'Vehicle Reg',
        'Vehicle VIN',
        'Vehicle Make',
        'Vehicle Model',
        'Transmission Type',
        'Ownership Status',
        'Current Driver',
        'Current KM',
        'Service Plan Status',
        'Last Service Date',
        'Last Service KM'
    ];
    rows.push(headers.join(','));

    // Fleet data
    fleetData.forEach(fleet => {
        const row = [
            fleet.fleetNumber || '',
            fleet.vehicleReg || '',
            fleet.vehicleVin || '',
            fleet.vehicleMake || '',
            fleet.vehicleModel || '',
            fleet.transmitionType || '',
            fleet.ownershipStatus || '',
            fleet.currentDriver || '',
            fleet.currentkm?.toString() || '0',
            fleet.servicePlanStatus ? 'Active' : 'Inactive',
            fleet.lastServicedate || '',
            fleet.lastServicekm?.toString() || '0'
        ];

        const escapedRow = row.map(value => {
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        });

        rows.push(escapedRow.join(','));
    });

    return rows.join('\n');
};

// Helper function to download CSV
export const downloadCSV = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Helper function to generate PDF
export const generatePDF = (fleetData: Fleet[]) => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 15);

    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.text(`Fleet Management Report`, 14, 22);

    let startY = 30;

    if (fleetData.length === 0) {
        doc.setFontSize(10);
        doc.setTextColor(120);
        doc.text('No fleet vehicles found', 20, startY);
        return doc;
    }

    // Prepare table data
    const tableData = fleetData.map(fleet => [
        fleet.fleetNumber || '-',
        fleet.vehicleReg || '-',
        fleet.vehicleMake || '-',
        fleet.vehicleModel || '-',
        fleet.currentDriver || '-',
        fleet.currentkm?.toString() || '0',
        fleet.servicePlanStatus ? 'Active' : 'Inactive',
        fleet.lastServicedate || '-'
    ]);

    // Add table
    autoTable(doc, {
        startY: startY,
        head: [['Fleet No', 'Reg', 'Make', 'Model', 'Driver', 'Current KM', 'Service Plan', 'Last Service']],
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: [66, 66, 66],
            textColor: 255,
            fontStyle: 'bold'
        },
        styles: {
            fontSize: 8,
            cellPadding: 2
        },
        margin: { left: 14, right: 14 }
    });

    return doc;
};