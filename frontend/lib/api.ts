const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface PersonalInfo {
  full_name: string;
  professional_title: string;
  email: string;
  phone: string;
  location: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  summary?: string;
}

export interface ExperienceItem {
  id?: string;
  company: string;
  position: string;
  location?: string;
  employment_type?: string;
  start_date: string;
  end_date?: string;
  is_current: boolean;
  description?: string;
  achievements: string[];
}

export interface EducationItem {
  id?: string;
  institution: string;
  degree: string;
  field_of_study?: string;
  start_date: string;
  end_date?: string;
  is_current: boolean;
  gpa?: string;
  description?: string;
}

export interface ProjectItem {
  id?: string;
  name: string;
  description: string;
  technologies: string[];
  project_url?: string;
  github_url?: string;
  achievements: string[];
}

export interface CertificationItem {
  id?: string;
  name: string;
  issuing_organization: string;
  issue_date: string;
  expiration_date?: string;
  credential_id?: string;
  credential_url?: string;
}

export interface CandidateProfile {
  id?: string;
  user_id?: string;
  personal_info: PersonalInfo;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: string[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
}

export interface ResumeContent {
  personal_info?: Partial<PersonalInfo>;
  summary: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: string[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
}

export interface ResumeData {
  id: string;
  user_id: string;
  title: string;
  version?: number;
  ats_score?: number | null;
  target_jd?: string | null;
  profile_snapshot: CandidateProfile;
  content: ResumeContent;
  created_at: string;
  updated_at: string;
}

export interface MissingKeyword {
  skill: string;
  count_in_jd: number;
  section: string;
}

export interface ATSRecommendation {
  id: string;
  title: string;
  description: string;
  action_type: string;
  target_text?: string;
  category?: string;
  impact?: string;
}

export interface ScoreBreakdown {
  keyword_match: number;
  skills_match: number;
  experience_match: number;
  education_match: number;
}

export interface KeywordStats {
  matched_keywords_count: number;
  total_jd_keywords_count: number;
}

export interface ATSScoreResult {
  overall_score: number;
  previous_score?: number | null;
  score_change?: number | null;
  score_tier: string;
  score_summary: string;
  keyword_stats: KeywordStats;
  breakdown: ScoreBreakdown;
  missing_keywords: MissingKeyword[];
  matching_skills: string[];
  recommendations: ATSRecommendation[];
}

export interface ResumeVersion {
  id: string;
  resume_id: string;
  version_number: number;
  title: string;
  change_summary: string;
  ats_score?: number | null;
  created_at: string;
}

export interface ResumeVersionDetail extends ResumeVersion {
  content: ResumeContent;
  target_jd?: string | null;
}

export interface VersionCompareResult {
  resume_id: string;
  base_version: {
    version_number: number;
    title: string;
    ats_score?: number | null;
    created_at: string;
  };
  compared_version: {
    version_number: number;
    title: string;
    ats_score?: number | null;
    created_at: string;
  };
  diff: {
    skills: {
      added: string[];
      removed: string[];
      unchanged: string[];
    };
    summary: {
      changed: boolean;
      base_text: string;
      compared_text: string;
    };
    experience: {
      base_roles_count: number;
      compared_roles_count: number;
      base_bullets_count: number;
      compared_bullets_count: number;
    };
    ats_score: {
      base_score?: number | null;
      compared_score?: number | null;
      score_diff?: number | null;
    };
  };
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("prepcv_token") : null;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = data?.detail || data?.message || "An unexpected error occurred.";
    throw new Error(errorMessage);
  }

  return data as T;
}

export async function fetchProfile(): Promise<CandidateProfile> {
  return apiRequest<CandidateProfile>("/api/profile");
}

export async function saveProfile(profile: CandidateProfile): Promise<CandidateProfile> {
  return apiRequest<CandidateProfile>("/api/profile", {
    method: "PUT",
    body: JSON.stringify(profile),
  });
}

export async function uploadCVFile(file: File, jobTitle: string = ""): Promise<CandidateProfile> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("job_title", jobTitle);

  return apiRequest<CandidateProfile>("/api/profile/upload-cv", {
    method: "POST",
    body: formData,
  });
}

export async function formatProfileWithAI(profile: CandidateProfile, jobTitle: string): Promise<CandidateProfile> {
  return apiRequest<CandidateProfile>("/api/profile/format-with-ai", {
    method: "POST",
    body: JSON.stringify({ profile, job_title: jobTitle }),
  });
}

export async function generateResume(targetRole: string = "", customInstructions: string = ""): Promise<ResumeData> {
  return apiRequest<ResumeData>("/api/resumes/generate", {
    method: "POST",
    body: JSON.stringify({
      target_role: targetRole,
      custom_instructions: customInstructions,
    }),
  });
}

export async function listUserResumes(): Promise<ResumeData[]> {
  return apiRequest<ResumeData[]>("/api/resumes");
}

export async function fetchResumeById(id: string): Promise<ResumeData> {
  return apiRequest<ResumeData>(`/api/resumes/${id}`);
}

export async function updateResumeContent(id: string, title: string, content: ResumeContent): Promise<ResumeData> {
  return apiRequest<ResumeData>(`/api/resumes/${id}`, {
    method: "PUT",
    body: JSON.stringify({ title, content }),
  });
}

export async function aiImproveBullet(section: string, text: string, instruction: string): Promise<{ improved_text: string; explanation?: string }> {
  return apiRequest<{ improved_text: string; explanation?: string }>("/api/resumes/ai-improve", {
    method: "POST",
    body: JSON.stringify({ section, text, instruction }),
  });
}

export async function fetchResumeHtml(id: string): Promise<string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("prepcv_token") : null;
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const url = `${API_BASE_URL}/api/resumes/${id}/html`;
  const response = await fetch(url, { headers, credentials: "include" });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    let detail = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.detail) detail = parsed.detail;
    } catch {}
    console.warn(`[PrepCV] Fetch resume HTML status ${response.status}:`, detail);
    throw new Error(`Failed to fetch resume HTML (${response.status}): ${detail || response.statusText}`);
  }
  return response.text();
}

export async function fetchPreviewHtml(content: ResumeContent): Promise<string> {
  const data = await apiRequest<{ html: string }>("/api/resumes/render-preview", {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  return data.html;
}

export async function downloadResumeDocx(id: string, filename: string = "Resume.docx"): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("prepcv_token") : null;
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const url = `${API_BASE_URL}/api/resumes/${id}/docx`;
  const response = await fetch(url, { headers, credentials: "include" });
  if (!response.ok) {
    throw new Error(`Failed to download Word document (${response.status})`);
  }
  const blob = await response.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = filename.endsWith(".docx") ? filename : `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

export async function scoreResumeAts(
  resumeId: string,
  jobDescription: string,
  content?: ResumeContent
): Promise<ATSScoreResult> {
  return apiRequest<ATSScoreResult>(`/api/resumes/${resumeId}/ats-score`, {
    method: "POST",
    body: JSON.stringify({
      job_description: jobDescription,
      content: content || null,
    }),
  });
}

export async function scoreDirectContentAts(
  jobDescription: string,
  content: ResumeContent
): Promise<ATSScoreResult> {
  return apiRequest<ATSScoreResult>("/api/resumes/ats-score-direct", {
    method: "POST",
    body: JSON.stringify({
      job_description: jobDescription,
      content,
    }),
  });
}

export async function fetchResumeVersions(resumeId: string): Promise<ResumeVersion[]> {
  return apiRequest<ResumeVersion[]>(`/api/resumes/${resumeId}/versions`);
}

export async function fetchResumeVersionDetail(
  resumeId: string,
  versionId: string
): Promise<ResumeVersionDetail> {
  return apiRequest<ResumeVersionDetail>(`/api/resumes/${resumeId}/versions/${versionId}`);
}

export async function createResumeVersion(
  resumeId: string,
  content: ResumeContent,
  title?: string,
  changeSummary?: string,
  atsScore?: number
): Promise<ResumeVersion> {
  return apiRequest<ResumeVersion>(`/api/resumes/${resumeId}/versions`, {
    method: "POST",
    body: JSON.stringify({
      title,
      content,
      change_summary: changeSummary || "Manual version save",
      ats_score: atsScore,
    }),
  });
}

export async function restoreResumeVersion(
  resumeId: string,
  versionId: string
): Promise<ResumeData> {
  return apiRequest<ResumeData>(`/api/resumes/${resumeId}/versions/${versionId}/restore`, {
    method: "POST",
  });
}

export async function compareResumeVersions(
  resumeId: string,
  baseVersionId: string,
  comparedVersionId: string
): Promise<VersionCompareResult> {
  return apiRequest<VersionCompareResult>(
    `/api/resumes/${resumeId}/compare?base_version_id=${encodeURIComponent(baseVersionId)}&compared_version_id=${encodeURIComponent(comparedVersionId)}`
  );
}

// Step 8, 11, 12: Interview Prep & Feedback Types & Methods

export interface InterviewQuestion {
  id: string;
  category: "Behavioral" | "Technical" | "Role-Specific" | string;
  question: string;
  difficulty?: "Easy" | "Medium" | "Hard" | string;
  focus_area?: string;
  source?: string;
}

export interface InterviewSession {
  id: string;
  user_id: string;
  resume_id?: string | null;
  company_name: string;
  company_url: string;
  job_title: string;
  jd_text: string;
  company_insights: Record<string, any>;
  generated_questions: InterviewQuestion[];
  created_at: string;
  updated_at: string;
}

export interface InterviewFeedbackItem {
  id: string;
  session_id?: string | null;
  user_id: string;
  actual_questions_text: string;
  anonymized_questions_text: string;
  extracted_questions: string[];
  company_tag: string;
  role_tag: string;
  industry_tag: string;
  created_at: string;
}

export async function generateInterviewQuestions(params: {
  company_name: string;
  job_title: string;
  company_url?: string;
  jd_text?: string;
  resume_id?: string;
}): Promise<InterviewSession> {
  return apiRequest<InterviewSession>("/api/interview/generate", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function listInterviewSessions(): Promise<InterviewSession[]> {
  return apiRequest<InterviewSession[]>("/api/interview/sessions");
}

export async function fetchInterviewSession(sessionId: string): Promise<InterviewSession> {
  return apiRequest<InterviewSession>(`/api/interview/sessions/${sessionId}`);
}

export async function submitInterviewFeedback(params: {
  session_id?: string;
  actual_questions_text: string;
  company_name?: string;
  job_title?: string;
  industry?: string;
}): Promise<InterviewFeedbackItem> {
  return apiRequest<InterviewFeedbackItem>("/api/interview/feedback", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function listUserFeedback(): Promise<InterviewFeedbackItem[]> {
  return apiRequest<InterviewFeedbackItem[]>("/api/interview/feedback");
}

// ─── Admin API Types & Functions ────────────────────────────────────────────

export interface FeatureUsageStat {
  feature_id: string;
  feature_key: string;
  feature_name: string;
  enabled_users_count: number;
}

export interface RecentUserAdmin {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AIUsageLogEntry {
  id: string;
  user_id?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  feature: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  response_time_ms: number;
  status: string;
  api_key_hint: string;
  error_message?: string | null;
  created_at: string;
}

export interface AIFeatureUsageBreakdown {
  feature: string;
  feature_name: string;
  total_calls: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  avg_response_time_ms: number;
}

export interface AIUserUsageStat {
  user_id: string;
  full_name: string;
  email: string;
  total_calls: number;
  total_tokens: number;
  last_used_at?: string | null;
}

export interface AIModelUsageStat {
  model: string;
  total_calls: number;
  total_tokens: number;
}

export interface AIUsageStats {
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  avg_response_time_ms: number;
  active_keys_count: number;
  total_keys_count: number;
  feature_breakdown: AIFeatureUsageBreakdown[];
  top_users: AIUserUsageStat[];
  model_breakdown: AIModelUsageStat[];
  recent_logs: AIUsageLogEntry[];
}

export interface AdminDashboardStats {
  total_users: number;
  active_users: number;
  suspended_users: number;
  admin_users: number;
  total_resumes: number;
  total_interview_sessions: number;
  total_interview_feedbacks: number;
  total_features: number;
  feature_usage: FeatureUsageStat[];
  recent_users: RecentUserAdmin[];
  ai_usage?: AIUsageStats;
}

export interface UserFeatureInfo {
  feature_id: string;
  feature_key: string;
  feature_name: string;
  is_enabled: boolean;
  granted_at: string;
}

export interface UserActivityStats {
  resumes_count: number;
  interview_sessions_count: number;
  interview_feedbacks_count: number;
}

export interface UserAdminResponse {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  features: UserFeatureInfo[];
  activity: UserActivityStats;
}

export interface UserAdminListResponse {
  users: UserAdminResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface FeatureResponse {
  id: string;
  key: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  assigned_users_count: number;
}

// ─── Admin Dashboard ────────────────────────────────────────────────────────

export async function fetchAdminDashboard(): Promise<AdminDashboardStats> {
  return apiRequest<AdminDashboardStats>("/api/admin/dashboard");
}

export async function fetchAdminAIUsage(): Promise<AIUsageStats> {
  return apiRequest<AIUsageStats>("/api/admin/ai-usage");
}

// ─── Admin User Management ──────────────────────────────────────────────────

export async function fetchAdminUsers(
  search?: string,
  page: number = 1,
  limit: number = 20
): Promise<UserAdminListResponse> {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  params.set("page", String(page));
  params.set("limit", String(limit));
  return apiRequest<UserAdminListResponse>(`/api/admin/users?${params.toString()}`);
}

export async function fetchAdminUserDetail(userId: string): Promise<UserAdminResponse> {
  return apiRequest<UserAdminResponse>(`/api/admin/users/${userId}`);
}

export async function updateUserRole(userId: string, role: string): Promise<UserAdminResponse> {
  return apiRequest<UserAdminResponse>(`/api/admin/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function updateUserStatus(userId: string, isActive: boolean): Promise<UserAdminResponse> {
  return apiRequest<UserAdminResponse>(`/api/admin/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: isActive }),
  });
}

export async function fetchUserFeatures(userId: string): Promise<UserFeatureInfo[]> {
  return apiRequest<UserFeatureInfo[]>(`/api/admin/users/${userId}/features`);
}

export async function toggleUserFeature(
  userId: string,
  featureId: string,
  isEnabled: boolean
): Promise<UserFeatureInfo> {
  return apiRequest<UserFeatureInfo>(`/api/admin/users/${userId}/features`, {
    method: "PUT",
    body: JSON.stringify({ feature_id: featureId, is_enabled: isEnabled }),
  });
}

// ─── Admin Feature Management ───────────────────────────────────────────────

export async function fetchFeatures(): Promise<FeatureResponse[]> {
  return apiRequest<FeatureResponse[]>("/api/admin/features");
}

export async function createFeature(data: {
  key: string;
  name: string;
  description?: string;
}): Promise<FeatureResponse> {
  return apiRequest<FeatureResponse>("/api/admin/features", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateFeature(
  featureId: string,
  data: { name?: string; description?: string; is_active?: boolean }
): Promise<FeatureResponse> {
  return apiRequest<FeatureResponse>(`/api/admin/features/${featureId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteFeature(featureId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/admin/features/${featureId}`, {
    method: "DELETE",
  });
}

export async function bulkAssignFeature(
  featureId: string,
  userIds: string[],
  isEnabled: boolean
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/api/admin/features/${featureId}/bulk-assign`, {
    method: "POST",
    body: JSON.stringify({ user_ids: userIds, is_enabled: isEnabled }),
  });
}

// ─── Current User Features ──────────────────────────────────────────────────

export async function fetchMyFeatures(): Promise<string[]> {
  return apiRequest<string[]>("/api/admin/my-features");
}
