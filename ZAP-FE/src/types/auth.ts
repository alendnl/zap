export interface Student {
  id: string;
  name: string;
  studentId: string;
  collegeName: string;
  email: string;
  createdAt: string;
}

export interface SignUpData {
  name: string;
  studentId: string;
  collegeName: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  student: Student;
}
