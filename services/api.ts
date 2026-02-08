
import { User, Exam, QuestionWithOptions, QuestionRow, SchoolSchedule, LearningObjective } from '../types';

// The Apps Script Web App URL provided
const GAS_EXEC_URL = "https://script.google.com/macros/s/AKfycbzrl3RrsrwdzMfKpzC-iXUqF2jNlY-dcpQo5VKJbixVQN2LDsnwlA330zo5sBlVa9JAPw/exec";

// Check if running inside GAS iframe
const isEmbedded = typeof window !== 'undefined' && window.google && window.google.script;

// Helper to format Google Drive URLs to direct image links
const formatGoogleDriveUrl = (url?: string): string | undefined => {
    if (!url) return undefined;
    if (typeof url !== 'string') return url;
    try {
        if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
            const match = url.match(/[-\w]{25,}/);
            if (match) {
                return `https://drive.google.com/thumbnail?id=${match[0]}&sz=w1000`;
            }
        }
    } catch (e) { 
        return url; 
    }
    return url;
};

// Helper to call backend functions with RETRY Logic
const callBackend = async (fnName: string, ...args: any[]) => {
  if (isEmbedded) {
    return new Promise((resolve, reject) => {
      window.google!.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        [fnName](...args);
    });
  }

  if (GAS_EXEC_URL) {
      let attempt = 0;
      const maxAttempts = 3;
      
      while (attempt < maxAttempts) {
          try {
              const url = `${GAS_EXEC_URL}?t=${new Date().getTime()}`;
              
              const response = await fetch(url, {
                  redirect: "follow", 
                  method: 'POST',
                  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                  body: JSON.stringify({ action: fnName, args: args })
              });
              
              if (!response.ok) throw new Error(`Server Error (${response.status})`);
              
              const text = await response.text();
              try {
                  return JSON.parse(text);
              } catch (e) {
                  throw new Error("Invalid response from server");
              }

          } catch (error) {
              attempt++;
              if (attempt === maxAttempts) throw error;
              await new Promise(r => setTimeout(r, 1000 * attempt));
          }
      }
  }
  throw new Error("No backend connection available");
};

export const api = {
  login: async (username: string, password?: string): Promise<User | null> => {
    const result: any = await callBackend('login', username, password);
    if (result && result.success && result.user) {
        return {
            id: result.user.username,
            username: result.user.username,
            role: result.user.role,
            nama_lengkap: result.user.fullname,
            jenis_kelamin: result.user.gender, 
            kelas: result.user.kelas, // Added missing class mapping
            kelas_id: result.user.school, // 'School' -> Legacy 'kelas_id'
            kecamatan: result.user.kecamatan, 
            active_exam: result.user.active_exam, 
            session: result.user.session,
            photo_url: formatGoogleDriveUrl(result.user.photo_url),
            active_tp: result.user.active_tp || '', // Added Active TP
            exam_type: result.user.exam_type || '' // Added Exam Type
        };
    }
    return null;
  },

  startExam: async (username: string, fullname: string, subject: string): Promise<any> => {
      return await callBackend('startExam', username, fullname, subject);
  },

  checkStatus: async (username: string): Promise<string> => {
      const res: any = await callBackend('checkUserStatus', username);
      return res.status;
  },

  getExams: async (): Promise<Exam[]> => {
    const response: any = await callBackend('getSubjectList');
    let subjects: string[] = [];
    let duration = 60;
    let maxQuestions = 0;

    if (Array.isArray(response)) {
        subjects = response;
    } else if (response && response.subjects) {
        subjects = response.subjects;
        duration = response.duration || 60;
        maxQuestions = response.maxQuestions || 0;
    }

    if (subjects.length > 0) {
        return subjects.map((s) => ({
            id: s,
            nama_ujian: s,
            waktu_mulai: new Date().toISOString(),
            durasi: Number(duration),
            token_akses: 'TOKEN', 
            is_active: true,
            max_questions: Number(maxQuestions)
        }));
    }
    return [];
  },

  getServerToken: async (): Promise<string> => {
      return await callBackend('getTokenFromConfig') as string;
  },

  saveToken: async (newToken: string): Promise<{success: boolean}> => {
      return await callBackend('saveConfig', 'TOKEN', newToken);
  },
  
  saveDuration: async (minutes: number): Promise<{success: boolean}> => {
      return await callBackend('saveConfig', 'DURATION', minutes);
  },

  saveMaxQuestions: async (amount: number): Promise<{success: boolean}> => {
      return await callBackend('saveConfig', 'MAX_QUESTIONS', amount);
  },

  saveKKTP: async (value: number): Promise<{success: boolean}> => {
      return await callBackend('saveConfig', 'KKTP', value);
  },

  // NEW METHODS FOR CONFIG TAB
  getAppConfig: async (): Promise<Record<string, string>> => {
      return await callBackend('getAppConfig');
  },

  saveBatchConfig: async (config: Record<string, string>): Promise<{success: boolean}> => {
      return await callBackend('saveBatchConfig', config);
  },

  // --- NEW: USER SPECIFIC CONFIG ---
  getUserConfig: async (username: string): Promise<Record<string, any>> => {
      return await callBackend('getUserConfig', username);
  },

  saveUserConfig: async (username: string, config: Record<string, any>): Promise<{success: boolean}> => {
      return await callBackend('saveUserConfig', username, config);
  },

  getQuestions: async (subject: string): Promise<QuestionWithOptions[]> => {
    const data: any = await callBackend('getQuestionsFromSheet', subject);
    if (!Array.isArray(data)) return [];

    return data.map((q: any, i: number) => ({
        id: q.id || `Q${i+1}`,
        exam_id: subject,
        text_soal: q.text || "Pertanyaan tanpa teks",
        tipe_soal: q.type || 'PG',
        bobot_nilai: 10,
        gambar: q.image || undefined,
        kelas: q.kelas || undefined, 
        tp_id: q.tp_id || undefined, 
        options: Array.isArray(q.options) ? q.options.map((o: any, idx: number) => ({
            id: o.id || `opt-${i}-${idx}`,
            question_id: q.id || `Q${i+1}`,
            text_jawaban: o.text_jawaban || o.text || "", 
            is_correct: false 
        })) : []
    }));
  },

  getRawQuestions: async (subject: string): Promise<QuestionRow[]> => {
      const result = await callBackend('getRawQuestions', subject);
      return Array.isArray(result) ? result : [];
  },
  
  saveQuestion: async (subject: string, data: QuestionRow): Promise<{success: boolean, message: string}> => {
      return await callBackend('saveQuestion', subject, data);
  },

  importQuestions: async (subject: string, data: QuestionRow[]): Promise<{success: boolean, message: string}> => {
      return await callBackend('importQuestions', subject, data);
  },

  deleteQuestion: async (subject: string, id: string): Promise<{success: boolean, message: string}> => {
      return await callBackend('deleteQuestion', subject, id);
  },

  getUsers: async (): Promise<any[]> => {
      const users: any = await callBackend('getUsers');
      if (Array.isArray(users)) {
          return users.map((u: any) => ({
              ...u,
              kelas_id: u.school, // Map School to legacy ID for frontend compatibility
              photo_url: formatGoogleDriveUrl(u.photo_url),
              active_tp: u.active_tp || '',
              exam_type: u.exam_type || ''
          }));
      }
      return [];
  },

  saveUser: async (userData: any): Promise<{success: boolean, message: string}> => {
      return await callBackend('saveUser', userData);
  },

  deleteUser: async (userId: string): Promise<{success: boolean, message: string}> => {
      return await callBackend('deleteUser', userId);
  },

  importUsers: async (users: any[]): Promise<{success: boolean, message: string}> => {
      return await callBackend('importUsers', users);
  },

  normalizeDatabaseRoles: async (): Promise<{success: boolean, updated: number}> => {
      return await callBackend('normalizeAllUserRoles');
  },

  // --- LEARNING OBJECTIVES CRUD ---
  getLearningObjectives: async (): Promise<LearningObjective[]> => {
      const result = await callBackend('getLearningObjectives');
      return Array.isArray(result) ? result : [];
  },

  saveLearningObjective: async (data: LearningObjective): Promise<{success: boolean}> => {
      return await callBackend('saveLearningObjective', data);
  },

  deleteLearningObjective: async (id: string): Promise<{success: boolean}> => {
      return await callBackend('deleteLearningObjective', id);
  },

  importLearningObjectives: async (data: LearningObjective[]): Promise<{success: boolean}> => {
      return await callBackend('importLearningObjectives', data);
  },

  // UPDATED: Added examType as 5th argument
  assignTestGroup: async (usernames: string[], examId: string, session: string, tpId: string = '', examType: string = ''): Promise<{success: boolean}> => {
      return await callBackend('assignTestGroup', usernames, examId, session, tpId, examType);
  },

  updateUserSessions: async (updates: {username: string, session: string}[]): Promise<{success: boolean}> => {
      return await callBackend('updateUserSessions', updates);
  },

  resetLogin: async (username: string): Promise<{success: boolean}> => {
      return await callBackend('resetLogin', username);
  },
  
  getSchoolSchedules: async (): Promise<SchoolSchedule[]> => {
      return await callBackend('getSchoolSchedules');
  },

  saveSchoolSchedules: async (schedules: SchoolSchedule[]): Promise<{success: boolean}> => {
      return await callBackend('saveSchoolSchedules', schedules);
  },

  getRecap: async (): Promise<any[]> => {
      const res = await callBackend('getRecapData');
      return Array.isArray(res) ? res : [];
  },

  getAnalysis: async (subject: string): Promise<any> => {
      return await callBackend('getAnalysisData', subject);
  },

  submitExam: async (payload: { user: User, subject: string, answers: any, startTime: number, displayedQuestionCount?: number, questionIds?: string[] }) => {
      const scoreInfo = { total: 0, answered: Object.keys(payload.answers).length };
      return await callBackend(
          'submitAnswers', 
          payload.user.username, 
          payload.user.nama_lengkap, 
          payload.user.kelas_id, 
          payload.subject, 
          payload.answers, 
          scoreInfo, 
          payload.startTime, 
          payload.displayedQuestionCount || 0, 
          payload.questionIds || [] 
      );
  },
  
  getDashboardData: async () => {
      const data: any = await callBackend('getDashboardData');
      if (data && Array.isArray(data.allUsers)) {
          data.allUsers = data.allUsers.map((u: any) => ({
              ...u,
              kelas_id: u.school,
              photo_url: formatGoogleDriveUrl(u.photo_url)
          }));
      }
      return data;
  },

  // Survey Methods (Restored for Admin Access)
  getSurveyQuestions: async (surveyType: string): Promise<QuestionWithOptions[]> => {
      const data: any = await callBackend('getQuestionsFromSheet', surveyType);
      if (!Array.isArray(data)) return [];

      return data.map((q: any, i: number) => ({
        id: q.id || `Q${i+1}`,
        exam_id: surveyType,
        text_soal: q.text || "Pertanyaan",
        tipe_soal: q.type || 'PG',
        bobot_nilai: 0,
        gambar: q.image || undefined,
        kelas: q.kelas || undefined, 
        tp_id: q.tp_id || undefined, 
        options: Array.isArray(q.options) ? q.options.map((o: any, idx: number) => ({
            id: o.id || `opt-${i}-${idx}`,
            question_id: q.id || `Q${i+1}`,
            text_jawaban: o.text_jawaban || o.text || "", 
            is_correct: false 
        })) : []
      }));
  },

  submitSurvey: async (payload: { user: User, surveyType: string, answers: any, startTime: number }) => {
      return await callBackend(
          'submitSurvey', 
          payload.user.username, 
          payload.user.nama_lengkap, 
          payload.user.kelas_id, 
          payload.surveyType, 
          payload.answers, 
          payload.startTime 
      );
  },

  getSurveyRecap: async (surveyType: string): Promise<any[]> => {
      const res = await callBackend('getSurveyRecapData', surveyType);
      return Array.isArray(res) ? res : [];
  }
};
