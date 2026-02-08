import React, { useState, useEffect, useRef } from 'react';
import { Clock, Check, ChevronLeft, ChevronRight, LayoutGrid, Flag, Monitor, LogOut, Loader2, AlertTriangle, X, ShieldAlert, RotateCcw, ZoomIn, ZoomOut, Maximize, Move, HelpCircle } from 'lucide-react';
import { QuestionWithOptions, UserAnswerValue, Exam } from '../types';
import { api } from '../services/api';

interface StudentExamProps {
  exam: Exam;
  questions: QuestionWithOptions[];
  userFullName: string;
  username: string; 
  userPhoto?: string;
  startTime: number; 
  onFinish: (answers: Record<string, UserAnswerValue>, questionCount: number, questionIds: string[], isTimeout?: boolean) => Promise<void> | void;
  onExit: () => void;
}

// Utility to shuffle array (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

const ImageViewer = ({ src, onClose }: { src: string; onClose: () => void }) => {
    // ... (Keep existing logic, just refresh styling) ...
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const lastTouchDistance = useRef<number | null>(null);

    const handleZoomIn = () => setScale(s => Math.min(s + 0.5, 5));
    const handleZoomOut = () => setScale(s => Math.max(s - 0.5, 1));
    const handleReset = () => { setScale(1); setPosition({ x: 0, y: 0 }); };

    // Mouse events
    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale > 1) { setIsDragging(true); setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y }); }
    };
    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && scale > 1) { e.preventDefault(); setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); }
    };
    const handleMouseUp = () => setIsDragging(false);

    // Touch events (simplified)
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1 && scale > 1) {
            setIsDragging(true);
            setDragStart({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y });
        }
    };
    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 1 && isDragging && scale > 1) {
            setPosition({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 flex flex-col justify-center items-center backdrop-blur-md animate-in fade-in duration-200">
            <div className="absolute top-4 right-4 z-50">
                <button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition"><X size={24} /></button>
            </div>
            <div className="w-full h-full flex items-center justify-center overflow-hidden cursor-move touch-none" 
                 onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                 onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={() => setIsDragging(false)}>
                <img src={src} className="max-w-full max-h-full object-contain transition-transform duration-100 ease-out select-none" style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }} draggable={false} />
            </div>
            <div className="absolute bottom-8 flex gap-4 bg-black/50 p-2 rounded-2xl backdrop-blur-md border border-white/10">
                <button onClick={handleZoomOut} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl" disabled={scale<=1}><ZoomOut size={20}/></button>
                <button onClick={handleReset} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl"><RotateCcw size={20}/></button>
                <button onClick={handleZoomIn} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl" disabled={scale>=5}><ZoomIn size={20}/></button>
            </div>
        </div>
    );
};

const StudentExam: React.FC<StudentExamProps> = ({ exam, questions, userFullName, username, userPhoto, startTime, onFinish, onExit }) => {
  const [examQuestions, setExamQuestions] = useState<QuestionWithOptions[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, UserAnswerValue>>({});
  const [doubtful, setDoubtful] = useState<Record<string, boolean>>({});
  
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmFinish, setShowConfirmFinish] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const [violationCount, setViolationCount] = useState(0);

  const storageKey = `cbt_answers_${username}_${exam.id}`;

  // Initialize Questions
  useEffect(() => {
    if (questions.length > 0) {
        const questionsWithShuffledOptions = questions.map(q => ({ ...q, options: shuffleArray(q.options) }));
        let fullyShuffled = shuffleArray(questionsWithShuffledOptions);
        if (exam.max_questions && exam.max_questions > 0) {
            fullyShuffled = fullyShuffled.slice(0, exam.max_questions);
        }
        setExamQuestions(fullyShuffled);
        
        // Load Saved State
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.answers) setAnswers(parsed.answers);
                if (parsed.doubtful) setDoubtful(parsed.doubtful);
            }
        } catch(e) { console.error("Failed load saved", e); }
    }
  }, [questions, storageKey, exam.max_questions]);

  // Auto Save
  useEffect(() => {
      if (Object.keys(answers).length > 0) {
          localStorage.setItem(storageKey, JSON.stringify({ answers, doubtful }));
      }
  }, [answers, doubtful, storageKey]);

  // Timer
  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      const totalSeconds = exam.durasi * 60;
      const remaining = Math.max(0, totalSeconds - elapsedSeconds);
      setTimeLeft(remaining);
      if (remaining <= 0) {
          executeFinish(true);
      }
    };
    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);
    return () => clearInterval(intervalId);
  }, [startTime, exam.durasi]);

  const executeFinish = async (isTimeout = false) => {
    setShowConfirmFinish(false);
    setIsSubmitting(true);
    try {
        const qIds = examQuestions.map(q => q.id);
        await onFinish(answers, examQuestions.length, qIds, isTimeout);
    } catch (error) {
        console.error("Error submitting", error);
        setIsSubmitting(false);
        alert("Gagal kirim jawaban. Periksa koneksi.");
    }
  };

  // Anti-Cheat (Visibility API)
  useEffect(() => {
    const handleVisibilityChange = () => { 
        if (document.hidden) {
             setViolationCount(prev => prev + 1);
             setIsLocked(false);
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const resumeExam = async () => {
      if (violationCount >= 3) { alert("Terlalu banyak pelanggaran. Ujian dihentikan."); onExit(); return; }
      try {
          const el = document.documentElement;
          if (el.requestFullscreen) await el.requestFullscreen();
      } catch(e) {}
      setIsLocked(true);
  };

  const handleAnswer = (val: any, type: string, subId?: string) => {
      const qId = examQuestions[currentIdx].id;
      setAnswers(prev => {
          if (type === 'PG') return { ...prev, [qId]: val };
          if (type === 'PGK') {
              const currentArr = (prev[qId] as string[]) || [];
              if (currentArr.includes(val)) return { ...prev, [qId]: currentArr.filter(x => x !== val) };
              return { ...prev, [qId]: [...currentArr, val] };
          }
          if (type === 'BS' && subId) {
             const currentObj = (prev[qId] as Record<string, boolean>) || {};
             return { ...prev, [qId]: { ...currentObj, [subId]: val } };
          }
          return prev;
      });
  };

  const formatTime = (s: number) => {
      const h = Math.floor(s / 3600).toString().padStart(2, '0');
      const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
      const sec = (s % 60).toString().padStart(2, '0');
      return `${h}:${m}:${sec}`;
  };

  if (examQuestions.length === 0) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>;

  const currentQ = examQuestions[currentIdx];
  const isLast = currentIdx === examQuestions.length - 1;
  const progress = Math.round((Object.keys(answers).length / examQuestions.length) * 100);

  return (
    <div className={`flex flex-col h-screen bg-slate-100 font-sans overflow-hidden select-none ${!isLocked ? 'blur-sm pointer-events-none' : ''}`}>
      {zoomedImage && <ImageViewer src={zoomedImage} onClose={() => setZoomedImage(null)} />}
      
      {/* VIOLATION OVERLAY */}
      {!isLocked && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 pointer-events-auto">
              <div className="bg-white p-8 rounded-2xl max-w-md w-full text-center shadow-2xl">
                  <ShieldAlert size={64} className="text-rose-500 mx-auto mb-4"/>
                  <h2 className="text-2xl font-black text-slate-800">Pelanggaran Terdeteksi!</h2>
                  <p className="text-slate-500 mt-2 mb-6">Anda meninggalkan layar ujian. Ini tercatat sebagai pelanggaran ({violationCount}/3).</p>
                  <button onClick={resumeExam} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition">Kembali ke Ujian</button>
              </div>
          </div>
      )}

      {/* HEADER */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 shrink-0 z-20 shadow-sm relative">
          <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-indigo-200 shadow-md">
                  <Monitor size={20}/>
              </div>
              <div className="hidden md:block">
                  <h1 className="font-bold text-slate-800 text-sm">{exam.nama_ujian}</h1>
                  <div className="h-1.5 w-32 bg-slate-100 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                  </div>
              </div>
          </div>

          <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono font-bold text-lg border ${timeLeft < 300 ? 'bg-rose-50 border-rose-200 text-rose-600 animate-pulse' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                  <Clock size={18}/> {formatTime(timeLeft)}
              </div>
              <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg border border-slate-200 transition">
                  <LayoutGrid size={20}/>
              </button>
          </div>
      </header>

      {/* MAIN CONTENT - SPLIT LAYOUT */}
      <div className="flex-1 flex overflow-hidden relative">
          <main className="flex-1 overflow-y-auto bg-slate-100 p-4 md:p-6 pb-24">
              <div className="max-w-4xl mx-auto w-full">
                  {/* Question Card */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[60vh] flex flex-col">
                      {/* Question Toolbar */}
                      <div className="h-14 border-b border-slate-100 flex items-center justify-between px-4 bg-slate-50/50">
                          <div className="flex items-center gap-2">
                              <span className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-md shadow-sm">No. {currentIdx + 1}</span>
                              <span className="text-xs font-bold text-slate-400">/ {examQuestions.length}</span>
                          </div>
                          <div className="flex items-center gap-1">
                              <button onClick={() => setFontSize('sm')} className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold transition ${fontSize==='sm'?'bg-white shadow text-indigo-600':'text-slate-400'}`}>A-</button>
                              <button onClick={() => setFontSize('md')} className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold transition ${fontSize==='md'?'bg-white shadow text-indigo-600':'text-slate-400'}`}>A</button>
                              <button onClick={() => setFontSize('lg')} className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold transition ${fontSize==='lg'?'bg-white shadow text-indigo-600':'text-slate-400'}`}>A+</button>
                          </div>
                      </div>

                      <div className="p-6 md:p-8 flex-1">
                           <div className={`prose max-w-none text-slate-800 leading-relaxed ${fontSize==='lg'?'text-xl':fontSize==='sm'?'text-sm':'text-base'}`}>
                                {/* Image Display */}
                                {currentQ.gambar && (
                                    <div className="mb-6 rounded-xl border-2 border-slate-100 p-2 bg-slate-50 w-fit max-w-full mx-auto relative group">
                                        <img src={currentQ.gambar} className="max-h-[350px] object-contain rounded-lg cursor-zoom-in" onClick={() => setZoomedImage(currentQ.gambar!)} />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none">
                                            <span className="bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1"><Maximize size={12}/> Perbesar</span>
                                        </div>
                                    </div>
                                )}
                                {/* Question Text */}
                                <div className="mb-8 whitespace-pre-wrap font-medium">{currentQ.text_soal}</div>
                                
                                {/* Options */}
                                <div className="space-y-3">
                                    {currentQ.tipe_soal === 'PG' && currentQ.options.map((opt, i) => {
                                        const isSel = answers[currentQ.id] === opt.id;
                                        return (
                                            <div key={opt.id} onClick={() => handleAnswer(opt.id, 'PG')} 
                                                 className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 group ${isSel ? 'border-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-200' : 'border-slate-200 hover:border-indigo-200 hover:bg-slate-50'}`}>
                                                <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center font-bold text-sm transition-colors ${isSel ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>
                                                    {String.fromCharCode(65 + i)}
                                                </div>
                                                <div className="pt-1 flex-1 font-medium text-slate-700">
                                                    {opt.text_jawaban.startsWith('http') ? <img src={opt.text_jawaban} className="h-24 rounded border border-slate-200" /> : opt.text_jawaban}
                                                </div>
                                                {isSel && <Check className="text-indigo-600 mt-1" size={20} />}
                                            </div>
                                        )
                                    })}
                                    
                                    {currentQ.tipe_soal === 'PGK' && currentQ.options.map((opt) => {
                                        const curr = (answers[currentQ.id] as string[]) || [];
                                        const isSel = curr.includes(opt.id);
                                        return (
                                            <div key={opt.id} onClick={() => handleAnswer(opt.id, 'PGK')} 
                                                 className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${isSel ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-slate-200 hover:border-indigo-200'}`}>
                                                <div className={`w-6 h-6 shrink-0 rounded border-2 flex items-center justify-center mt-1 transition-colors ${isSel ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'}`}>
                                                    {isSel && <Check size={14} strokeWidth={3} />}
                                                </div>
                                                <div className="flex-1 font-medium text-slate-700">{opt.text_jawaban}</div>
                                            </div>
                                        )
                                    })}

                                    {currentQ.tipe_soal === 'BS' && (
                                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                                            {currentQ.options.map((opt, i) => {
                                                const val = (answers[currentQ.id] as Record<string, boolean>)?.[opt.id];
                                                return (
                                                    <div key={opt.id} className={`p-4 flex flex-col sm:flex-row items-center gap-4 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                                        <div className="flex-1 font-medium text-sm text-slate-800 text-center sm:text-left">{opt.text_jawaban}</div>
                                                        <div className="flex gap-2 shrink-0">
                                                            <button onClick={() => handleAnswer(true, 'BS', opt.id)} className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${val === true ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}>BENAR</button>
                                                            <button onClick={() => handleAnswer(false, 'BS', opt.id)} className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${val === false ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50'}`}>SALAH</button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                           </div>
                      </div>
                  </div>
              </div>
          </main>
      </div>

      {/* FOOTER NAV */}
      <footer className="h-20 bg-white border-t border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0 z-30 fixed bottom-0 w-full lg:w-auto lg:static">
          <button onClick={() => setCurrentIdx(p => Math.max(0, p - 1))} disabled={currentIdx === 0} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition flex items-center gap-2 border border-slate-200">
              <ChevronLeft size={18}/> Prev
          </button>
          
          <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition select-none ${doubtful[currentQ.id] ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:text-amber-500'}`}>
              <input type="checkbox" className="hidden" checked={!!doubtful[currentQ.id]} onChange={() => setDoubtful(p => ({...p, [currentQ.id]: !p[currentQ.id]}))} />
              <Flag size={20} className={doubtful[currentQ.id] ? "fill-amber-600" : ""} />
              <span className="font-bold text-sm hidden sm:inline">Ragu-ragu</span>
          </label>

          {isLast ? (
              <button onClick={() => setShowConfirmFinish(true)} className="px-6 py-2.5 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition flex items-center gap-2">
                  Selesai <Check size={18}/>
              </button>
          ) : (
              <button onClick={() => setCurrentIdx(p => Math.min(examQuestions.length - 1, p + 1))} className="px-5 py-2.5 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition flex items-center gap-2">
                  Next <ChevronRight size={18}/>
              </button>
          )}
      </footer>

      {/* SIDEBAR NAVIGATION */}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={() => setIsSidebarOpen(false)} />}
      <div className={`fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Navigasi Soal</h3>
              <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-5 gap-3">
                  {examQuestions.map((q, i) => {
                      const isAns = answers[q.id];
                      const isDbt = doubtful[q.id];
                      const isAct = currentIdx === i;
                      
                      let bg = "bg-white border-slate-200 text-slate-600";
                      if (isAct) bg = "bg-indigo-600 border-indigo-600 text-white ring-2 ring-indigo-200";
                      else if (isDbt) bg = "bg-amber-100 border-amber-300 text-amber-700";
                      else if (isAns) bg = "bg-slate-800 border-slate-800 text-white";

                      return (
                          <button key={q.id} onClick={() => { setCurrentIdx(i); setIsSidebarOpen(false); }} className={`aspect-square rounded-lg border font-bold text-sm transition-all hover:scale-105 ${bg}`}>
                              {i + 1}
                          </button>
                      )
                  })}
              </div>
          </div>
          <div className="p-4 bg-slate-50 text-xs font-medium text-slate-500 space-y-2 border-t border-slate-100">
              <div className="flex items-center gap-2"><span className="w-3 h-3 bg-indigo-600 rounded"></span> Sedang Dikerjakan</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 bg-slate-800 rounded"></span> Sudah Dijawab</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 bg-amber-100 border border-amber-300 rounded"></span> Ragu-ragu</div>
          </div>
      </div>

      {/* CONFIRM FINISH MODAL */}
      {showConfirmFinish && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm fade-in">
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <HelpCircle size={32}/>
                  </div>
                  <h3 className="font-black text-xl text-slate-800 mb-2">Kirim Jawaban?</h3>
                  <p className="text-slate-500 text-sm mb-6">Pastikan seluruh soal telah terjawab. Anda tidak dapat mengubah jawaban setelah ini.</p>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm mb-6">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="block text-slate-400 text-xs font-bold uppercase">Terjawab</span>
                          <span className="block text-xl font-black text-slate-800">{Object.keys(answers).length}</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="block text-slate-400 text-xs font-bold uppercase">Sisa</span>
                          <span className="block text-xl font-black text-slate-800">{examQuestions.length - Object.keys(answers).length}</span>
                      </div>
                  </div>

                  <div className="flex gap-3">
                      <button onClick={() => setShowConfirmFinish(false)} className="flex-1 py-3 font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Cek Lagi</button>
                      <button onClick={() => executeFinish(false)} className="flex-1 py-3 font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200">Ya, Kirim</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default StudentExam;