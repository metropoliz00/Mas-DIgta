
import React, { useState, useEffect, useMemo } from 'react';
import { Users, FileText, Download, Upload, Loader2, Plus, Search, Edit, Trash2, X, Camera, Save, User as UserIcon, Check, Wand2, UserCog, Database, LogIn } from 'lucide-react';
import { api } from '../../services/api';
import { User } from '../../types';
import * as XLSX from 'xlsx';
import { exportToExcel } from '../../utils/adminHelpers';

interface DaftarPesertaTabProps {
    currentUser: User;
    onDataChange: () => void;
    mode?: 'siswa' | 'staff'; // Mode to filter user types
    onSwitchUser?: (user: User) => void; 
}

const DaftarPesertaTab = ({ currentUser, onDataChange, mode = 'siswa', onSwitchUser }: DaftarPesertaTabProps) => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('all'); 
    const [filterSchool, setFilterSchool] = useState('all');
    const [filterKelas, setFilterKelas] = useState('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Form data matches DB structure exactly
    const [formData, setFormData] = useState<{
        id: string; username: string; password: string; fullname: string; role: string; 
        school: string; kelas: string; kecamatan: string; gender: string; photo?: string; photo_url?: string 
    }>({ id: '', username: '', password: '', fullname: '', role: 'siswa', school: '', kelas: '', kecamatan: '', gender: 'L', photo: '', photo_url: '' });
    
    // Reload users when mode changes
    useEffect(() => { loadUsers(); }, [mode]);
    
    const loadUsers = async () => { 
        setLoading(true); 
        try { 
            const data = await api.getUsers(); 
            // Filter by mode immediately upon load
            const filteredData = data.filter(u => mode === 'siswa' ? u.role === 'siswa' : (u.role === 'admin' || u.role === 'Guru'));
            
            // Map data securely. API returns 'fullname', 'school', 'gender' directly from DB.
            const mappedData = filteredData.map(u => ({
                ...u,
                school: u.school || u.kelas_id || '', 
                fullname: u.fullname || u.nama_lengkap || '', 
                gender: u.gender || u.jenis_kelamin || 'L'
            }));
            setUsers(mappedData); 
        } catch(e) { console.error(e); } 
        finally { setLoading(false); } 
    };

    const handleDelete = async (username: string) => { 
        if(!confirm(`Yakin ingin menghapus user ${username} dari Database?`)) return; 
        setLoading(true); 
        try { 
            const res = await api.deleteUser(username); 
            if (res.success) {
                alert("User berhasil dihapus.");
                setUsers(prev => prev.filter(u => u.username !== username)); 
                onDataChange(); 
            } else {
                alert("Gagal menghapus user. User tidak ditemukan.");
            }
        } catch (e) { console.error(e); alert("Terjadi kesalahan saat menghapus user."); } 
        finally { setLoading(false); } 
    };
    
    const handleEdit = (user: any) => { 
        setFormData({ 
            id: user.id || '', 
            username: user.username, 
            password: user.password, 
            fullname: user.fullname, 
            role: user.role, 
            school: user.school || '', 
            kelas: user.kelas || '',   
            kecamatan: user.kecamatan || '', 
            gender: user.gender || 'L',
            photo: '', 
            photo_url: user.photo_url || ''
        }); 
        setIsModalOpen(true); 
    };

    // --- FITUR LOGIN SEBAGAI USER LAIN (IMPERSONATION) ---
    const handleLoginAs = (targetUser: any) => {
        const roleDisplay = targetUser.role === 'siswa' ? 'Siswa' : targetUser.role === 'Guru' ? 'Guru' : 'Admin';
        
        if(!confirm(`Masuk sebagai ${targetUser.fullname} (${roleDisplay})?\n\nSesi Admin Anda akan berakhir sementara.`)) return;

        // 1. Construct User Session Object (Strict mapping to types.ts User interface)
        const userSession: User = {
            id: targetUser.id,
            username: targetUser.username,
            password: targetUser.password,
            role: targetUser.role as any,
            // PENTING: Mapping nama field DB ke field Aplikasi
            nama_lengkap: targetUser.fullname, 
            kelas_id: targetUser.school, // App uses 'kelas_id' for School Name usually
            kelas: targetUser.kelas,
            kecamatan: targetUser.kecamatan,
            jenis_kelamin: targetUser.gender,
            photo_url: targetUser.photo_url,
            // Student specific fields needed for Exam Logic
            active_exam: targetUser.active_exam || '',
            session: targetUser.session || '',
            active_tp: targetUser.active_tp || '',
            exam_type: targetUser.exam_type || ''
        };

        // 2. Simpan ke Storage
        const sessionStr = JSON.stringify(userSession);
        localStorage.setItem('cbt_user', sessionStr);
        sessionStorage.setItem('cbt_user', sessionStr);
        
        // 3. Hapus state Admin sebelumnya untuk mencegah konflik
        localStorage.removeItem('cbt_admin_tab');

        // 4. Force Reload (Hard Redirect) 
        // Ini metode paling aman untuk berpindah Role secara total
        window.location.href = '/';
    };
    
    const handleAdd = () => { 
        // Generate temporary ID
        const tempId = (mode === 'siswa' ? 'SIS-' : 'ADM-') + Math.floor(Math.random() * 10000);
        setFormData({ 
            id: tempId, 
            username: '', 
            password: '', 
            fullname: '', 
            role: mode === 'siswa' ? 'siswa' : 'Guru', 
            school: currentUser.role === 'Guru' ? currentUser.kelas_id : '', 
            kelas: '', 
            kecamatan: currentUser.role === 'Guru' ? (currentUser.kecamatan || '') : '', 
            gender: 'L', 
            photo: '', 
            photo_url: '' 
        }); 
        setIsModalOpen(true); 
    };
    
    const handleSave = async (e: React.FormEvent) => { 
        e.preventDefault(); 
        setIsSaving(true); 
        try { 
            await api.saveUser(formData); 
            await loadUsers(); 
            setIsModalOpen(false); 
            onDataChange(); 
        } catch (e) { 
            console.error(e); 
            alert("Gagal menyimpan data."); 
        } finally { 
            setIsSaving(false); 
        } 
    };
    
    const uniqueSchools = useMemo<string[]>(() => { const schools = new Set(users.map(u => u.school).filter(Boolean)); return Array.from(schools).sort() as string[]; }, [users]);
    const uniqueClasses = useMemo<string[]>(() => { const classes = new Set(users.map(u => u.kelas).filter(Boolean)); return Array.from(classes).sort() as string[]; }, [users]);
    
    const filteredUsers = useMemo(() => { 
        let res = users; 
        if (filterRole !== 'all') res = res.filter(u => u.role === filterRole); 
        if (filterSchool !== 'all') res = res.filter(u => u.school === filterSchool); 
        if (filterKelas !== 'all') res = res.filter(u => u.kelas === filterKelas);
        if (searchTerm) { 
            const lower = searchTerm.toLowerCase(); 
            res = res.filter(u => 
                (u.username || '').toLowerCase().includes(lower) || 
                (u.fullname || '').toLowerCase().includes(lower) || 
                (u.school && u.school.toLowerCase().includes(lower)) || 
                (u.id && u.id.toLowerCase().includes(lower))
            ); 
        } 
        if (currentUser.role === 'Guru') res = res.filter(u => u.role === 'siswa' && (u.school || '').toLowerCase() === (currentUser.kelas_id || '').toLowerCase()); 
        return res; 
    }, [users, filterRole, filterSchool, filterKelas, searchTerm, currentUser]);
    
    // ... (Export logic unchanged) ...
    const handleExport = () => { 
        const dataToExport = filteredUsers.map((u) => {
            const row: any = {
                "ID": u.id,                 // 1
                "PhotoURL": u.photo_url,    // 2 
                "Username": u.username,     // 3
                "Password": u.password,     // 4
                "Nama Lengkap": u.fullname, // 5
                "Jenis Kelamin": u.gender,  // 6
                "Role": u.role,             // 7
            };
            // UNIFIED: Both modes export 'Kelas' to ensure data integrity
            row["Kelas"] = u.kelas; 
            row["Sekolah"] = u.school;      // 9
            row["Kecamatan"] = u.kecamatan; // 10
            return row;
        }); 
        exportToExcel(dataToExport, mode === 'siswa' ? "DB_Siswa_UI_Format" : "DB_Admin_UI_Format", "Sheet1"); 
    };
    
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => { 
        if (!e.target.files || e.target.files.length === 0) return; 
        setIsImporting(true); 
        const file = e.target.files[0]; 
        const reader = new FileReader(); 
        reader.onload = async (evt) => { 
            try { 
                const bstr = evt.target?.result; 
                const wb = XLSX.read(bstr, { type: 'binary' }); 
                const wsName = wb.SheetNames[0]; 
                const ws = wb.Sheets[wsName]; 
                
                const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }); 
                const parsedUsers = []; 
                
                for (let i = 1; i < data.length; i++) { 
                    const row: any = data[i]; 
                    if (!row[2]) continue; 
                    
                    parsedUsers.push({ 
                        id: String(row[0] || (mode === 'siswa' ? 'SIS-' : 'ADM-') + Math.floor(Math.random()*100000)),
                        photo_url: String(row[1] || ''), 
                        username: String(row[2]), 
                        password: String(row[3]), 
                        fullname: String(row[4]), 
                        gender: String(row[5] || 'L').toUpperCase(),
                        role: String(row[6] || (mode === 'siswa' ? 'siswa' : 'Guru')), 
                        kelas: String(row[7] || ''), // Unified column 7
                        school: String(row[8] || ''), 
                        kecamatan: String(row[9] || '') 
                    }); 
                } 
                
                if (parsedUsers.length > 0) { 
                    await api.importUsers(parsedUsers); 
                    alert(`Berhasil mengimpor ${parsedUsers.length} data ke database.`); 
                    await loadUsers(); 
                    onDataChange(); 
                } else { 
                    alert(`Data tidak ditemukan. Pastikan format Excel sesuai Template.`); 
                } 
            } catch (err) { 
                console.error(err); 
                alert("Gagal membaca file Excel."); 
            } finally { 
                setIsImporting(false); 
                if (e.target) e.target.value = ''; 
            } 
        }; 
        reader.readAsBinaryString(file); 
    };
    
    // ... (Template download and image change unchanged) ...
    const downloadTemplate = () => { 
        const rowData: any = { 
            "ID": "AUTO", 
            "PhotoURL": "", 
            "Username": "user01", 
            "Password": "123", 
            "Nama Lengkap": mode === 'siswa' ? "Nama Siswa" : "Nama Guru", 
            "Jenis Kelamin": "L",
            "Role": mode === 'siswa' ? "siswa" : "Guru", 
        };
        // UNIFIED TEMPLATE COLUMN
        rowData["Kelas"] = mode === 'siswa' ? "6" : "6"; // Default numeric for both
        rowData["Sekolah"] = "SDN CONTOH";
        rowData["Kecamatan"] = "KOTA";
        const ws = XLSX.utils.json_to_sheet([ rowData ]); 
        const wb = XLSX.utils.book_new(); 
        XLSX.utils.book_append_sheet(wb, ws, "Template_DB"); 
        XLSX.writeFile(wb, `Template_DB_${mode === 'siswa' ? 'Siswa' : 'Admin_Guru'}.xlsx`); 
    };
    
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 2 * 1024 * 1024) { alert("Max 2MB"); return; }
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const maxSize = 500;
                    let width = img.width; let height = img.height;
                    if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } } else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
                    canvas.width = Math.floor(width); canvas.height = Math.floor(height);
                    if (ctx) { ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); const dataUrl = canvas.toDataURL('image/jpeg', 0.9); setFormData(prev => ({ ...prev, photo: dataUrl })); }
                };
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    const title = mode === 'siswa' ? "Data Siswa" : "Data Admin dan Guru";
    const icon = mode === 'siswa' ? <Database size={24} className="text-indigo-600"/> : <UserCog size={24} className="text-indigo-600"/>;

    return (
        <div className="bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-6 fade-in space-y-6">
             {/* Header */}
             <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-slate-100 pb-6">
                 <div>
                     <h3 className="font-black text-2xl text-slate-800 flex items-center gap-2">{icon} {title}</h3>
                     <p className="text-slate-400 text-sm font-medium mt-1">Total {filteredUsers.length} data.</p>
                 </div>
                 <div className="flex flex-wrap gap-3">
                    <button onClick={handleExport} className="bg-white text-emerald-600 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-emerald-50 transition border-2 border-emerald-100 shadow-sm active:scale-95"><FileText size={16}/> Export</button>
                    {currentUser.role === 'admin' && (
                        <>
                        <button onClick={downloadTemplate} className="bg-white text-slate-500 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition border-2 border-slate-200 active:scale-95"><Download size={16}/> Template</button>
                        <label className={`cursor-pointer bg-emerald-50 text-emerald-600 border-2 border-emerald-100 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-emerald-100 transition active:scale-95 ${isImporting ? 'opacity-50 cursor-wait' : ''}`}>
                            {isImporting ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16}/>} Import
                            <input type="file" accept=".xlsx" className="hidden" onChange={handleFileUpload} disabled={isImporting} />
                        </label>
                        </>
                    )}
                    <button onClick={handleAdd} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 active:scale-95"><Plus size={16}/> Tambah</button>
                 </div>
             </div>
             
             {/* Filter Bar */}
             <div className="flex flex-col md:flex-row gap-4 bg-slate-50/50 p-1 rounded-2xl">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
                    <input type="text" placeholder="Cari ID, Username, Nama..." className="w-full pl-11 pr-4 py-3 border-2 border-slate-100 rounded-xl text-sm outline-none focus:border-indigo-500 bg-white font-bold text-slate-600 transition-colors" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                {currentUser.role === 'admin' && (
                    <>
                    <select className="p-3 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-500 outline-none focus:border-indigo-500 bg-white cursor-pointer hover:border-slate-300 appearance-none" value={filterSchool} onChange={e => setFilterSchool(e.target.value)}><option value="all">Semua Sekolah</option>{uniqueSchools.map(s => <option key={s} value={s}>{s}</option>)}</select>
                    {/* Unified Filter Kelas for both modes if necessary */}
                    <select className="p-3 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-500 outline-none focus:border-indigo-500 bg-white cursor-pointer hover:border-slate-300 appearance-none" value={filterKelas} onChange={e => setFilterKelas(e.target.value)}><option value="all">Semua Kelas</option>{uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}</select>
                    </>
                )}
             </div>

             {/* DATABASE TABLE STRUCTURE */}
             <div className="overflow-x-auto rounded-2xl border border-slate-100">
                 <table className="w-full text-xs text-left whitespace-nowrap">
                     <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider">
                         <tr>
                             <th className="p-4 border-r border-slate-200 min-w-[80px]">ID</th>
                             <th className="p-4 border-r border-slate-200 text-center w-16">Foto</th>
                             <th className="p-4 border-r border-slate-200">Username</th>
                             <th className="p-4 border-r border-slate-200">Password</th>
                             <th className="p-4 border-r border-slate-200 min-w-[200px]">Nama Lengkap</th>
                             <th className="p-4 border-r border-slate-200 text-center">L/P</th>
                             <th className="p-4 border-r border-slate-200">Role</th>
                             <th className="p-4 border-r border-slate-200 text-center">Kelas</th> {/* Unified Header */}
                             <th className="p-4 border-r border-slate-200">Sekolah</th>
                             <th className="p-4 border-r border-slate-200">Kecamatan</th>
                             <th className="p-4 text-center">Aksi</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 bg-white">
                         {loading ? (<tr><td colSpan={11} className="p-12 text-center text-slate-400"><Loader2 className="animate-spin inline mr-2"/> Sinkronisasi Database...</td></tr>) : filteredUsers.length === 0 ? (<tr><td colSpan={11} className="p-12 text-center text-slate-400 italic">Data tidak ditemukan.</td></tr>) : (filteredUsers.map((u, i) => (
                         <tr key={i} className="hover:bg-slate-50 transition group">
                             <td className="p-3 border-r border-slate-100 font-mono text-slate-400 font-bold">{u.id}</td>
                             <td className="p-3 border-r border-slate-100 text-center">
                                 <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center mx-auto text-slate-400">
                                    {u.photo_url ? <img src={u.photo_url} className="w-full h-full object-cover" /> : <UserIcon size={16} />}
                                </div>
                             </td>
                             <td className="p-3 border-r border-slate-100 font-mono text-indigo-600 font-bold">{u.username}</td>
                             <td className="p-3 border-r border-slate-100 font-mono text-slate-400">{u.password || '***'}</td>
                             <td className="p-3 border-r border-slate-100 font-bold text-slate-700">{u.fullname}</td>
                             <td className="p-3 border-r border-slate-100 text-center font-bold text-slate-500">{u.gender || 'L'}</td>
                             <td className="p-3 border-r border-slate-100">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${u.role === 'admin' ? 'bg-purple-50 text-purple-600 border-purple-100' : u.role === 'Guru' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                    {u.role}
                                </span>
                             </td>
                             <td className="p-3 border-r border-slate-100 text-center font-bold text-slate-600">
                                 {/* Display numeric class for both Student and Guru */}
                                 {u.kelas || '-'}
                             </td>
                             <td className="p-3 border-r border-slate-100 text-slate-600">{u.school || '-'}</td>
                             <td className="p-3 border-r border-slate-100 text-slate-500">{u.kecamatan || '-'}</td>
                             <td className="p-3 flex justify-center gap-2">
                                 {/* SUPER ADMIN LOGIN AS FEATURE (Works for both Students and Teachers lists) */}
                                 {currentUser.role === 'admin' && (
                                     <button 
                                        onClick={() => handleLoginAs(u)} 
                                        className="p-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 border border-indigo-100 transition shadow-sm"
                                        title="Masuk sebagai user ini"
                                     >
                                         <LogIn size={14}/>
                                     </button>
                                 )}
                                 <button onClick={() => handleEdit(u)} className="p-1.5 bg-amber-50 text-amber-600 rounded hover:bg-amber-100 border border-amber-100 transition"><Edit size={14}/></button>
                                 <button onClick={() => handleDelete(u.username)} className="p-1.5 bg-rose-50 text-rose-600 rounded hover:bg-rose-100 border border-rose-100 transition"><Trash2 size={14}/></button>
                             </td>
                         </tr>)))}
                     </tbody>
                 </table>
             </div>

             {isModalOpen && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm fade-in">
                     <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col border border-white/20 transform scale-100 transition-all">
                         <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20">
                             <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">{formData.id && !formData.id.startsWith('SIS') && !formData.id.startsWith('ADM') ? 'Edit Data Database' : 'Tambah Data Baru'}</h3>
                             <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition"><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
                         </div>
                         <div className="p-8 overflow-y-auto custom-scrollbar bg-slate-50/50">
                            <form onSubmit={handleSave} className="space-y-4">
                                <div className="flex items-center gap-6">
                                    <div className="relative group shrink-0">
                                        <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-lg bg-slate-200 flex items-center justify-center text-slate-400">
                                            {formData.photo ? <img src={formData.photo} className="w-full h-full object-cover" /> : formData.photo_url ? <img src={formData.photo_url} className="w-full h-full object-cover" /> : <UserIcon size={40} className="text-slate-300" />}
                                        </div>
                                        <label className="absolute bottom-0 right-0 bg-indigo-600 text-white p-1.5 rounded-full cursor-pointer hover:bg-indigo-700 shadow-md border-2 border-white"><Upload size={12}/><input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleImageChange} /></label>
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">ID (Otomatis/Manual)</label>
                                        <input required type="text" className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 font-mono" value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Username</label><input required type="text" className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} /></div>
                                    <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Password</label><input required type="text" className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} /></div>
                                </div>
                                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nama Lengkap</label><input required type="text" className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={formData.fullname} onChange={e => setFormData({...formData, fullname: e.target.value})} /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Role</label>
                                        <select className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} disabled={currentUser.role !== 'admin' || mode === 'siswa'}>
                                            {mode === 'siswa' ? <option value="siswa">Siswa</option> : <><option value="Guru">Guru</option><option value="admin">Admin Pusat</option></>}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Jenis Kelamin (L/P)</label>
                                        <select className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}><option value="L">L</option><option value="P">P</option></select>
                                    </div>
                                </div>
                                
                                {/* Unified Class Selector for BOTH Student and Staff */}
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                        {mode === 'siswa' ? 'Kelas Siswa' : 'Kelas Ampuan (Kosongkan jika semua kelas)'}
                                    </label>
                                    {/* Using Select for Staff as well to enforce numeric class format */}
                                    <select className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={formData.kelas} onChange={e => setFormData({...formData, kelas: e.target.value})}>
                                        <option value="">-- Pilih Kelas --</option>
                                        {/* Allow "All Classes" for Guru Mapel/Admin */}
                                        {mode !== 'siswa' && <option value="">Semua Kelas</option>}
                                        {[1,2,3,4,5,6].map(k => <option key={k} value={String(k)}>Kelas {k}</option>)}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sekolah</label><input required type="text" className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={formData.school} onChange={e => setFormData({...formData, school: e.target.value})} placeholder="Nama Sekolah" /></div>
                                    <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Kecamatan</label><input type="text" className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500" value={formData.kecamatan} onChange={e => setFormData({...formData, kecamatan: e.target.value})} placeholder="Kecamatan"/></div>
                                </div>
                                <div className="pt-4 flex gap-3">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3.5 border-2 border-slate-200 text-slate-500 rounded-xl font-bold hover:bg-slate-100 transition">Batal</button>
                                    <button type="submit" disabled={isSaving} className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex justify-center items-center gap-2">{isSaving ? <Loader2 size={20} className="animate-spin"/> : <Check size={20}/>} Simpan</button>
                                </div>
                            </form>
                         </div>
                     </div>
                 </div>
             )}
        </div>
    );
};

export default DaftarPesertaTab;
