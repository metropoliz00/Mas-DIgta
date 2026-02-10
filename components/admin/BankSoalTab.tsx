
import React, { useState, useEffect, useMemo } from 'react';
import { FileQuestion, Download, Upload, Loader2, Plus, Edit, Trash2, X, Save, Image as ImageIcon, CheckCircle2, ChevronDown, ChevronUp, Target, Layout, Type } from 'lucide-react';
import { api } from '../../services/api';
import { QuestionRow, LearningObjective } from '../../types';
import * as XLSX from 'xlsx';
import { SUBJECTS_DB } from '../../utils/adminHelpers';

const BankSoalTab = () => {
    // Use SUBJECTS_DB for source of truth
    const [selectedSubject, setSelectedSubject] = useState(SUBJECTS_DB[0]?.label || '');
    const [questions, setQuestions] = useState<QuestionRow[]>([]);
    const [tps, setTps] = useState<LearningObjective[]>([]); // Store all TPs
    const [loadingData, setLoadingData] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [currentQ, setCurrentQ] = useState<QuestionRow | null>(null);
    const [importing, setImporting] = useState(false);
    
    // Filters
    const [filterKelas, setFilterKelas] = useState('all');
    const [filterTp, setFilterTp] = useState('all');

    useEffect(() => {
        const loadInitial = async () => {
            // Load TPs for linking
            const tpData = await api.getLearningObjectives();
            setTps(tpData);
        };
        loadInitial();
    }, []);

    useEffect(() => {
        if (!selectedSubject) return;
        const loadQ = async () => {
            setLoadingData(true);
            try {
                const data = await api.getRawQuestions(selectedSubject);
                setQuestions(data);
            } catch(e) { console.error(e); }
            finally { setLoadingData(false); }
        };
        loadQ();
    }, [selectedSubject]);

    // Reset TP filter when Subject or Class filter changes
    useEffect(() => {
        setFilterTp('all');
    }, [selectedSubject, filterKelas]);

    // Filtered & Sorted Questions List
    const filteredQuestions = useMemo(() => {
        let res = questions;
        
        // Filter Kelas
        if (filterKelas !== 'all') {
            res = res.filter(q => q.kelas === filterKelas);
        }

        // Filter TP
        if (filterTp !== 'all') {
            res = res.filter(q => q.tp_id === filterTp);
        }

        // Default ID Sort (Numeric aware for Q1, Q2, Q10)
        return [...res].sort((a, b) => {
            return a.id.localeCompare(b.id, undefined, { numeric: true });
        });
    }, [questions, filterKelas, filterTp]);

    // Available Classes derived from questions
    const uniqueClasses = useMemo(() => {
        const classes = new Set(questions.map(q => q.kelas).filter(Boolean));
        return Array.from(classes).sort();
    }, [questions]);

    // Available TPs for the selected Subject (Main Filter)
    const tpsForFilter = useMemo(() => {
        if (!selectedSubject) return [];
        let filtered = tps.filter(t => t.mapel === selectedSubject);
        if (filterKelas !== 'all') {
            filtered = filtered.filter(t => t.kelas === filterKelas);
        }
        return filtered;
    }, [tps, selectedSubject, filterKelas]);

    // Available TPs for the selected Subject (and selected Class in Modal)
    const availableTps = useMemo(() => {
        if (!currentQ || !selectedSubject) return [];
        let filtered = tps.filter(t => t.mapel === selectedSubject);
        if (currentQ.kelas) {
            filtered = filtered.filter(t => t.kelas === currentQ.kelas);
        }
        return filtered;
    }, [tps, selectedSubject, currentQ?.kelas]);

    const handleEdit = (q: QuestionRow) => {
        setCurrentQ(q);
        setModalOpen(true);
    };

    const handleAddNew = () => {
        setCurrentQ({
            id: `Q${questions.length + 1}`,
            text_soal: '',
            tipe_soal: 'PG',
            gambar: '',
            caption: '', // Init Caption
            opsi_a: '',
            opsi_b: '',
            opsi_c: '',
            opsi_d: '',
            kunci_jawaban: '',
            bobot: 10,
            kelas: '',
            tp_id: ''
        });
        setModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm(`Yakin ingin menghapus soal ID: ${id}?`)) {
            setLoadingData(true);
            await api.deleteQuestion(selectedSubject, id);
            const data = await api.getRawQuestions(selectedSubject);
            setQuestions(data);
            setLoadingData(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentQ) return;
        setLoadingData(true);
        const finalQ = { ...currentQ, kunci_jawaban: currentQ.kunci_jawaban.toUpperCase() };
        await api.saveQuestion(selectedSubject, finalQ);
        const data = await api.getRawQuestions(selectedSubject);
        setQuestions(data);
        setModalOpen(false);
        setLoadingData(false);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        setImporting(true);
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsName = wb.SheetNames[0];
                const ws = wb.Sheets[wsName];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
                
                const parsedQuestions: QuestionRow[] = [];
                for (let i = 1; i < data.length; i++) {
                    const row: any = data[i];
                    if (!row[0]) continue;
                    
                    parsedQuestions.push({
                        id: String(row[0]),
                        text_soal: String(row[1] || ""),
                        tipe_soal: (String(row[2] || "PG").toUpperCase() as any),
                        gambar: String(row[3] || ""),
                        opsi_a: String(row[4] || ""),
                        opsi_b: String(row[5] || ""),
                        opsi_c: String(row[6] || ""),
                        opsi_d: String(row[7] || ""),
                        kunci_jawaban: String(row[8] || "").toUpperCase(),
                        bobot: Number(row[9] || 10),
                        kelas: String(row[10] || ""),
                        tp_id: String(row[11] || ""),
                        caption: String(row[12] || "") // Column 13 for Caption
                    });
                }

                if (parsedQuestions.length > 0) {
                     await api.importQuestions(selectedSubject, parsedQuestions);
                     alert(`Berhasil mengimpor ${parsedQuestions.length} soal.`);
                     setLoadingData(true);
                     const freshData = await api.getRawQuestions(selectedSubject);
                     setQuestions(freshData);
                     setLoadingData(false);
                } else {
                    alert("Tidak ada data soal yang ditemukan dalam file.");
                }

            } catch (err) {
                console.error(err);
                alert("Gagal membaca file Excel.");
            } finally {
                setImporting(false);
                if (e.target) e.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    // --- GENERIC IMAGE UPLOAD LOGIC ---
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: keyof QuestionRow) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 2 * 1024 * 1024) { alert("Ukuran file terlalu besar. Maks 2MB"); return; }
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const maxSize = 800; 
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } } 
                    else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
                    
                    canvas.width = Math.floor(width); 
                    canvas.height = Math.floor(height);
                    
                    if (ctx) { 
                        ctx.fillStyle = "#FFFFFF"; 
                        ctx.fillRect(0, 0, canvas.width, canvas.height); 
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height); 
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.8); 
                        setCurrentQ(prev => prev ? ({ ...prev, [field]: dataUrl }) : null); 
                    }
                };
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    const isImage = (val: string) => val && (val.startsWith('data:image') || val.startsWith('http') || val.match(/\.(jpeg|jpg|gif|png)$/) != null);

    const renderOptionInput = (label: string, field: 'opsi_a' | 'opsi_b' | 'opsi_c' | 'opsi_d') => {
        if (!currentQ) return null;
        return (
            <div className="group bg-white p-2 border border-slate-200 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase group-focus-within:text-indigo-500 transition-colors">{label}</label>
                    <label className="cursor-pointer text-[10px] text-indigo-500 hover:text-indigo-700 font-bold flex items-center gap-1">
                        <Upload size={10}/> Img
                        <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => handleImageUpload(e, field)} />
                    </label>
                </div>
                <div className="flex gap-2">
                    {isImage(currentQ[field]) && (
                        <div className="relative w-8 h-8 bg-slate-50 border border-slate-100 rounded flex items-center justify-center overflow-hidden shrink-0">
                            <img src={currentQ[field]} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                    )}
                    <input 
                        type="text" 
                        className="w-full bg-transparent font-medium text-slate-700 outline-none text-xs" 
                        value={currentQ[field]} 
                        onChange={e => setCurrentQ({...currentQ, [field]: e.target.value})} 
                        placeholder={`Isi ${label}...`} 
                    />
                </div>
            </div>
        );
    };

    const downloadTemplate = () => {
        const rows = [
            { "ID Soal": "Q1", "Teks Soal": "Contoh Soal...", "Tipe Soal (PG/PGK/BS)": "PG", "Link Gambar": "", "Opsi A": "A", "Opsi B": "B", "Opsi C": "C", "Opsi D": "D", "Kunci Jawaban": "A", "Bobot": 10, "Kelas": "1", "ID TP": "TP-01", "Caption (Keterangan Gambar)": "Deskripsi gambar..." }
        ];
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "Template_Soal.xlsx");
    };

    return (
        <div className="space-y-6 fade-in max-w-full mx-auto">
             {/* Header Control */}
             <div className="bg-white p-6 rounded-[1.5rem] shadow-lg shadow-slate-200/50 border border-slate-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white p-3.5 rounded-2xl shadow-lg shadow-indigo-200"><FileQuestion size={28}/></div>
                    <div>
                        <h3 className="font-black text-xl text-slate-800">Bank Soal</h3>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Database:</span>
                            <select 
                                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-1 outline-none cursor-pointer"
                                value={selectedSubject}
                                onChange={e => setSelectedSubject(e.target.value)}
                            >
                                {SUBJECTS_DB.map(s => <option key={s.id} value={s.label}>{s.label}</option>)}
                            </select>
                            
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-0 sm:ml-2">Kelas:</span>
                            <select 
                                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-1 outline-none cursor-pointer"
                                value={filterKelas}
                                onChange={e => setFilterKelas(e.target.value)}
                            >
                                <option value="all">Semua</option>
                                {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>

                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-0 sm:ml-2">Filter TP:</span>
                            <select 
                                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-1 outline-none cursor-pointer max-w-[150px]"
                                value={filterTp}
                                onChange={e => setFilterTp(e.target.value)}
                            >
                                <option value="all">Semua TP</option>
                                {tpsForFilter.map(tp => (
                                    <option key={tp.id} value={tp.id}>
                                        {tp.id}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button onClick={downloadTemplate} className="bg-white text-slate-600 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition border-2 border-slate-200 active:scale-95">
                        <Download size={16}/> Template
                    </button>

                    <label className={`cursor-pointer px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 active:scale-95 ${importing ? 'opacity-50 cursor-wait' : ''}`}>
                        {importing ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16}/>}
                        {importing ? "Mengimpor..." : "Import Excel"}
                        <input type="file" accept=".xlsx" onChange={handleFileUpload} className="hidden" disabled={importing} />
                    </label>

                    <button onClick={handleAddNew} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 active:scale-95">
                        <Plus size={16}/> Tambah Soal
                    </button>
                </div>
             </div>

             {/* Question List */}
             <div className="space-y-4">
                {loadingData ? (
                     <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                        <div className="relative mb-4">
                            <div className="w-16 h-16 border-4 border-slate-100 rounded-full"></div>
                            <div className="w-16 h-16 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
                        </div>
                        <span className="text-sm font-bold text-slate-400 animate-pulse">Menyiapkan Data Soal...</span>
                    </div>
                ) : filteredQuestions.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 italic font-medium bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                        <FileQuestion size={48} className="mx-auto mb-4 opacity-20"/>
                        Belum ada soal di database mapel ini atau tidak cocok dengan filter.
                    </div>
                ) : (
                    filteredQuestions.map((q, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all group overflow-hidden">
                            <div className="p-5 flex items-start gap-4">
                                <div className="bg-slate-100 text-slate-500 font-mono font-bold text-xs p-2 rounded-lg min-w-[3rem] text-center border border-slate-200 h-fit">
                                    {q.id}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 pr-4">
                                            <div className="text-slate-800 font-medium text-sm leading-relaxed mb-2">{q.text_soal}</div>
                                            {isImage(q.gambar) && (
                                                <div className="mt-2 mb-3">
                                                    <img 
                                                        src={q.gambar} 
                                                        alt="Soal" 
                                                        className="h-24 w-auto object-contain rounded-lg border border-slate-200 bg-slate-50 shadow-sm"
                                                        loading="lazy" 
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <button onClick={() => handleEdit(q)} className="p-2 text-amber-500 bg-amber-50 hover:bg-amber-100 rounded-lg transition"><Edit size={16}/></button>
                                            <button onClick={() => handleDelete(q.id)} className="p-2 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-lg transition"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                    
                                    {/* Answer Options Display */}
                                    {(q.opsi_a || q.opsi_b || q.opsi_c || q.opsi_d) && (
                                        <div className="mt-2 mb-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-600">
                                                {q.opsi_a && (
                                                    <div className={`flex items-start gap-2 ${q.kunci_jawaban.includes('A') ? 'font-bold text-emerald-600 bg-emerald-50/50 rounded-lg px-1.5 -mx-1.5' : ''}`}>
                                                        <span className="font-bold opacity-70 w-3 shrink-0 mt-0.5">A.</span>
                                                        <div className="flex-1 break-words leading-snug">{isImage(q.opsi_a) ? <span className="italic flex items-center gap-1 text-[10px] text-indigo-500"><ImageIcon size={10}/> (Gambar)</span> : q.opsi_a}</div>
                                                        {q.kunci_jawaban.includes('A') && <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5"/>}
                                                    </div>
                                                )}
                                                {q.opsi_b && (
                                                    <div className={`flex items-start gap-2 ${q.kunci_jawaban.includes('B') ? 'font-bold text-emerald-600 bg-emerald-50/50 rounded-lg px-1.5 -mx-1.5' : ''}`}>
                                                        <span className="font-bold opacity-70 w-3 shrink-0 mt-0.5">B.</span>
                                                        <div className="flex-1 break-words leading-snug">{isImage(q.opsi_b) ? <span className="italic flex items-center gap-1 text-[10px] text-indigo-500"><ImageIcon size={10}/> (Gambar)</span> : q.opsi_b}</div>
                                                        {q.kunci_jawaban.includes('B') && <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5"/>}
                                                    </div>
                                                )}
                                                {q.opsi_c && (
                                                    <div className={`flex items-start gap-2 ${q.kunci_jawaban.includes('C') ? 'font-bold text-emerald-600 bg-emerald-50/50 rounded-lg px-1.5 -mx-1.5' : ''}`}>
                                                        <span className="font-bold opacity-70 w-3 shrink-0 mt-0.5">C.</span>
                                                        <div className="flex-1 break-words leading-snug">{isImage(q.opsi_c) ? <span className="italic flex items-center gap-1 text-[10px] text-indigo-500"><ImageIcon size={10}/> (Gambar)</span> : q.opsi_c}</div>
                                                        {q.kunci_jawaban.includes('C') && <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5"/>}
                                                    </div>
                                                )}
                                                {q.opsi_d && (
                                                    <div className={`flex items-start gap-2 ${q.kunci_jawaban.includes('D') ? 'font-bold text-emerald-600 bg-emerald-50/50 rounded-lg px-1.5 -mx-1.5' : ''}`}>
                                                        <span className="font-bold opacity-70 w-3 shrink-0 mt-0.5">D.</span>
                                                        <div className="flex-1 break-words leading-snug">{isImage(q.opsi_d) ? <span className="italic flex items-center gap-1 text-[10px] text-indigo-500"><ImageIcon size={10}/> (Gambar)</span> : q.opsi_d}</div>
                                                        {q.kunci_jawaban.includes('D') && <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5"/>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap items-center gap-3 mt-1">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${q.tipe_soal === 'PG' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>{q.tipe_soal}</span>
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">Bobot: {q.bobot}</span>
                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Kunci: {q.kunci_jawaban}</span>
                                        {q.kelas && <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Kelas: {q.kelas}</span>}
                                        {q.tp_id && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 flex items-center gap-1"><Target size={10}/> {q.tp_id}</span>}
                                        {q.gambar && <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><ImageIcon size={10}/> Gambar</span>}
                                        {q.caption && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 truncate max-w-[150px]">Ket: {q.caption}</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
             </div>
             
             {/* EDIT MODAL - FULL SQUARE BOX (Floating - Centered with Top Offset) */}
             {modalOpen && currentQ && (
                 <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-6 md:pt-10 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
                     <div className="bg-white w-full max-w-[95vw] lg:max-w-7xl h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-white/20 relative">
                        
                        {/* Header */}
                        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                            <div>
                                <h3 className="font-black text-2xl text-slate-800 flex items-center gap-3">
                                    <span className={`p-2 rounded-xl ${currentQ.id ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                        <Layout size={24}/>
                                    </span> 
                                    {currentQ.id ? 'Editor Soal' : 'Buat Soal Baru'}
                                </h3>
                                <p className="text-xs text-slate-400 font-bold ml-14 mt-1">
                                    Mapel: {selectedSubject}
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition border border-transparent hover:border-slate-200">Batal</button>
                                <button type="submit" form="qForm" disabled={loadingData} className="px-6 py-2.5 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2">
                                    {loadingData ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>} Simpan
                                </button>
                            </div>
                        </div>
                        
                        {/* Body - DENSE GRID LAYOUT (Scrollable) */}
                        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 md:p-8 custom-scrollbar">
                            <form id="qForm" onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6 content-start min-h-full pb-8">
                                
                                {/* LEFT COLUMN: METADATA & CONTENT (Span 5) */}
                                <div className="lg:col-span-5 flex flex-col gap-4">
                                    {/* Top Metadata Row */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">ID Soal</label>
                                            <input required type="text" className="w-full font-mono font-bold text-slate-700 text-sm outline-none bg-transparent" value={currentQ.id} onChange={e => setCurrentQ({...currentQ, id: e.target.value})} placeholder="Q1" />
                                        </div>
                                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Tipe</label>
                                            <select className="w-full font-bold text-slate-700 text-sm outline-none bg-transparent cursor-pointer" value={currentQ.tipe_soal} onChange={e => setCurrentQ({...currentQ, tipe_soal: e.target.value as any})}>
                                                <option value="PG">PG</option>
                                                <option value="PGK">PGK</option>
                                                <option value="BS">B/S</option>
                                            </select>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Kelas</label>
                                            <input type="text" className="w-full font-bold text-slate-700 text-sm outline-none bg-transparent" value={currentQ.kelas || ''} onChange={e => setCurrentQ({...currentQ, kelas: e.target.value})} placeholder="-" />
                                        </div>
                                    </div>

                                    {/* TP Selector */}
                                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Tujuan Pembelajaran (TP)</label>
                                        <select className="w-full font-bold text-slate-700 text-sm outline-none bg-transparent cursor-pointer truncate" value={currentQ.tp_id || ''} onChange={e => setCurrentQ({...currentQ, tp_id: e.target.value})}>
                                            <option value="">-- Pilih TP --</option>
                                            {availableTps.map(tp => (
                                                <option key={tp.id} value={tp.id}>{tp.id} - {tp.materi}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Question Text Area (Expanded) */}
                                    <div className="flex-1 bg-white p-4 rounded-xl border border-slate-200 flex flex-col min-h-[300px]">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Konten Soal</label>
                                        <textarea required className="flex-1 w-full bg-transparent outline-none resize-none font-medium text-slate-700 leading-relaxed text-sm" value={currentQ.text_soal} onChange={e => setCurrentQ({...currentQ, text_soal: e.target.value})} placeholder="Tulis pertanyaan disini..."></textarea>
                                    </div>

                                    {/* Image Input */}
                                    <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-100 rounded border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                                                {isImage(currentQ.gambar) ? <img src={currentQ.gambar} className="w-full h-full object-cover"/> : <ImageIcon size={18} className="text-slate-400"/>}
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase block">Gambar Soal</label>
                                                <input type="text" className="w-full bg-transparent text-xs font-medium outline-none text-slate-600 placeholder-slate-300" value={currentQ.gambar} onChange={e => setCurrentQ({...currentQ, gambar: e.target.value})} placeholder="Link URL..." />
                                            </div>
                                            <label className="p-2 bg-indigo-50 text-indigo-600 rounded-lg cursor-pointer hover:bg-indigo-100 transition"><Upload size={16}/><input type="file" className="hidden" onChange={(e) => handleImageUpload(e, 'gambar')} /></label>
                                        </div>
                                        {/* Added Caption Input */}
                                        <div className="border-t border-slate-100 pt-2">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase block flex items-center gap-1"><Type size={10}/> Keterangan Gambar (Muncul di bawah gambar)</label>
                                            <input type="text" className="w-full bg-slate-50 p-2 mt-1 rounded-lg text-xs font-medium outline-none text-slate-700 placeholder-slate-300 border border-transparent focus:border-indigo-200 focus:bg-white transition-all" value={currentQ.caption || ''} onChange={e => setCurrentQ({...currentQ, caption: e.target.value})} placeholder="Contoh: Perhatikan gambar di atas..." />
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT COLUMN: OPTIONS & ANSWERS (Span 7) */}
                                <div className="lg:col-span-7 flex flex-col gap-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Answer Options */}
                                        <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {renderOptionInput("Opsi A", 'opsi_a')}
                                            {renderOptionInput("Opsi B", 'opsi_b')}
                                            {renderOptionInput("Opsi C", 'opsi_c')}
                                            {currentQ.tipe_soal !== 'PGK' && renderOptionInput("Opsi D", 'opsi_d')}
                                        </div>
                                    </div>

                                    {/* Footer Controls (Key & Weight) */}
                                    <div className="mt-4 lg:mt-auto">
                                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200/50 mb-4">
                                            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                                <label className="text-[10px] font-bold text-emerald-600 uppercase block mb-1">Kunci Jawaban</label>
                                                <input required type="text" className="w-full bg-transparent font-mono font-black text-2xl text-emerald-700 outline-none placeholder-emerald-300" value={currentQ.kunci_jawaban} onChange={e => setCurrentQ({...currentQ, kunci_jawaban: e.target.value})} placeholder="A" />
                                                <p className="text-[9px] text-emerald-500 mt-1">PG: A | PGK: A,B | B/S: B,S,B (Urutan A,B,C..)</p>
                                            </div>
                                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                                <label className="text-[10px] font-bold text-indigo-500 uppercase block mb-1">Bobot Nilai</label>
                                                <input type="number" className="w-full bg-transparent font-black text-2xl text-indigo-700 outline-none placeholder-indigo-300" value={currentQ.bobot} onChange={e => setCurrentQ({...currentQ, bobot: Number(e.target.value)})} placeholder="10" />
                                            </div>
                                        </div>
                                        
                                        {/* BOTTOM ACTION BUTTONS */}
                                        <div className="flex gap-3">
                                            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 transition">
                                                Batal
                                            </button>
                                            <button type="submit" disabled={loadingData} className="flex-1 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-2 active:scale-95">
                                                {loadingData ? <Loader2 size={18} className="animate-spin"/> : <Save size={18}/>} Simpan Soal
                                            </button>
                                        </div>
                                    </div>
                                </div>

                            </form>
                        </div>
                     </div>
                 </div>
             )}
        </div>
    );
};

export default BankSoalTab;
