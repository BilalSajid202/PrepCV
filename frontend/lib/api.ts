const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface User {
  id: string;
  full_name: string;
  email: string;
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
  profile_snapshot: CandidateProfile;
  content: ResumeContent;
  created_at: string;
  updated_at: string;
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

export async function uploadCVFile(file: File): Promise<{ extracted_profile: CandidateProfile }> {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest<{ extracted_profile: CandidateProfile }>("/api/profile/upload-cv", {
    method: "POST",
    body: formData,
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
