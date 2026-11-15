export type Difficulty = "EASY" | "MEDIUM" | "HARD";
export type QuestionStatus = "PUBLISHED" | "DRAFT" | "ARCHIVED";
export type ContentType = "text" | "code" | "image";

export interface MCQOption {
  id: string;
  type: ContentType;
  text?: string;
  code?: string;
  codeLanguage?: string;
  imageUrl?: string;
  isCorrect: boolean;
  explanation?: string;
}

export interface MCQQuestion {
  id: string;
  title: string;
  slug?: string;
  category: string;
  difficulty: Difficulty;
  tags: string[];
  questionType: ContentType;
  statement: string;
  codeSnippet?: string;
  codeLanguage?: string;
  imageUrl?: string;
  options: MCQOption[];
  explanation?: string;
  points: number;
  status: QuestionStatus;
  version?: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MCQQuestionSummary {
  id: string;
  slug?: string;
  title: string;
  category: string;
  difficulty: Difficulty;
  tags: string[];
  questionType: ContentType;
  statement: string;
  codeSnippet?: string;
  imageUrl?: string;
  optionsCount: number;
  correctOptionsCount: number;
  points: number;
  status: QuestionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MCQFormData {
  title: string;
  slug: string;
  category: string;
  difficulty: Difficulty;
  tags: string[];
  questionType: ContentType;
  statement: string;
  codeSnippet: string;
  codeLanguage: string;
  imageUrl: string;
  options: MCQOption[];
  explanation: string;
  points: number;
  status: QuestionStatus;
}

export const EMPTY_MCQ_FORM: MCQFormData = {
  title: "",
  slug: "",
  category: "DSA",
  difficulty: "EASY",
  tags: [],
  questionType: "text",
  statement: "",
  codeSnippet: "",
  codeLanguage: "python",
  imageUrl: "",
  options: [
    {
      id: "opt-1",
      type: "text",
      text: "",
      code: "",
      codeLanguage: "python",
      imageUrl: "",
      isCorrect: true,
      explanation: "",
    },
    {
      id: "opt-2",
      type: "text",
      text: "",
      code: "",
      codeLanguage: "python",
      imageUrl: "",
      isCorrect: false,
      explanation: "",
    },
    {
      id: "opt-3",
      type: "text",
      text: "",
      code: "",
      codeLanguage: "python",
      imageUrl: "",
      isCorrect: false,
      explanation: "",
    },
    {
      id: "opt-4",
      type: "text",
      text: "",
      code: "",
      codeLanguage: "python",
      imageUrl: "",
      isCorrect: false,
      explanation: "",
    },
  ],
  explanation: "",
  points: 1,
  status: "PUBLISHED",
};
