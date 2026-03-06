
import React from 'react';
import * as XLSX from 'xlsx';

// DAFTAR MAPEL BAKU & KODE ID
export const DEFAULT_SUBJECTS_DB = [
    { id: "PAI", label: "Pendidikan Agama Islam" },
    { id: "PKN", label: "Pendidikan Pancasila" },
    { id: "BIN", label: "Bahasa Indonesia" }, 
    { id: "MTK", label: "Matematika" },
    { id: "IPAS", label: "IPAS" },
    { id: "SENI", label: "Seni" },
    { id: "PJOK", label: "PJOK" },
    { id: "BJW", label: "Bahasa Jawa" }, 
    { id: "ING", label: "Bahasa Inggris" } 
];

export const DEFAULT_EXAM_TYPES = [
    { id: "OSN", label: "OSN" },
    { id: "LCC", label: "Lomba Cerdas Cermat" },
    { id: "TKA", label: "TKA" },
    { id: "SUMATIF", label: "Sumatif" },
    { id: "LITERASI", label: "Lomba Literasi/Numerasi" }
];

export const DEFAULT_EXAM_SUBJECT_MAPPING = [
    { examTypeId: "OSN", subjectIds: ["IPAS", "MTK", "PAI"] }, // Example mapping
    { examTypeId: "LCC", subjectIds: ["UMUM"] },
    { examTypeId: "TKA", subjectIds: ["MTK", "BIN"] },
    { examTypeId: "SUMATIF", subjectIds: DEFAULT_SUBJECTS_DB.map(s => s.id) },
    { examTypeId: "LITERASI", subjectIds: ["LITERASI", "NUMERASI"] }
];

export const getSubjects = (config: Record<string, string>) => {
    if (config['SUBJECTS_DB']) {
        try {
            const parsed = JSON.parse(config['SUBJECTS_DB']);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {
            console.error("Failed to parse SUBJECTS_DB", e);
        }
    }
    return DEFAULT_SUBJECTS_DB;
};

export const getExamTypes = (config: Record<string, string>) => {
    if (config['EXAM_TYPES_DB']) {
        try {
            const parsed = JSON.parse(config['EXAM_TYPES_DB']);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {
            console.error("Failed to parse EXAM_TYPES_DB", e);
        }
    }
    return DEFAULT_EXAM_TYPES;
};

export const getExamSubjectMapping = (config: Record<string, string>) => {
    if (config['EXAM_SUBJECT_MAPPING_DB']) {
        try {
            const parsed = JSON.parse(config['EXAM_SUBJECT_MAPPING_DB']);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {
            console.error("Failed to parse EXAM_SUBJECT_MAPPING_DB", e);
        }
    }
    return DEFAULT_EXAM_SUBJECT_MAPPING;
};

export const SUBJECTS_DB = DEFAULT_SUBJECTS_DB; // Fallback for backward compatibility

// Helper to format duration string "HH:mm:ss" or "mm:ss" to text "X Jam Y Menit Z Detik"
export const formatDurationToText = (duration: string) => {
    if (!duration || duration === '-' || duration === 'undefined') return '-';
    try {
        const parts = duration.split(':').map(p => parseInt(p, 10) || 0);
        let h = 0, m = 0, s = 0;
        if (parts.length === 3) { [h, m, s] = parts; } 
        else if (parts.length === 2) { [m, s] = parts; } 
        else { return duration; }
        
        const textParts = [];
        if (h > 0) textParts.push(`${h}h`);
        if (m > 0) textParts.push(`${m}m`);
        if (s > 0) textParts.push(`${s}s`);
        
        return textParts.length > 0 ? textParts.join(' ') : '0s';
    } catch (e) { return duration; }
};

// Helper: Score Predicate Logic
export const getScorePredicate = (score: number) => {
    if (score >= 86) return "Istimewa";
    if (score >= 71) return "Baik";
    if (score >= 56) return "Memadai";
    return "Kurang";
};

// Helper: Predicate Badge Component
export const getPredicateBadge = (score: number) => {
    const p = getScorePredicate(score);
    let color = "";
    switch (p) {
        case "Istimewa": color = "bg-purple-100 text-purple-700 border-purple-200"; break;
        case "Baik": color = "bg-emerald-100 text-emerald-700 border-emerald-200"; break;
        case "Memadai": color = "bg-yellow-100 text-yellow-700 border-yellow-200"; break;
        default: color = "bg-rose-100 text-rose-700 border-rose-200"; break;
    }
    return <span className={`px-2 py-1 rounded text-xs font-bold border ${color}`}>{p}</span>;
};

// Generic Export Function
export const exportToExcel = (data: any[], fileName: string, sheetName: string = "Data") => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}.xlsx`);
};

// Custom SVG Donut Chart
export const SimpleDonutChart = ({ data, size = 160 }: { data: { value: number, color: string, label?: string }[], size?: number }) => {
    const total = data.reduce((a, b) => a + b.value, 0);
    let cumulative = 0;
    const center = size / 2;
    const radius = (size - 40) / 2;
    const circumference = 2 * Math.PI * radius;
    return (
        <div className="relative flex items-center justify-center">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
                {data.map((item, i) => {
                    const percentage = total > 0 ? item.value / total : 0;
                    const dashArray = percentage * circumference;
                    const offset = cumulative * circumference;
                    cumulative += percentage;
                    return (
                        <circle key={i} cx={center} cy={center} r={radius} fill="transparent" stroke={item.color} strokeWidth="24" strokeDasharray={`${dashArray} ${circumference}`} strokeDashoffset={-offset} className="transition-all duration-1000 ease-out" />
                    );
                })}
                {total === 0 && <circle cx={center} cy={center} r={radius} fill="transparent" stroke="#e2e8f0" strokeWidth="24" />}
            </svg>
            <div className="absolute flex flex-col items-center"><span className="text-2xl font-bold text-slate-700">{total}</span><span className="text-xs text-slate-400 font-bold uppercase">Total</span></div>
        </div>
    );
};

export const DashboardSkeleton = () => (
    <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-200 rounded-2xl"></div>)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-64 bg-slate-200 rounded-2xl"></div>
            <div className="h-64 bg-slate-200 rounded-2xl col-span-2"></div>
        </div>
    </div>
);
