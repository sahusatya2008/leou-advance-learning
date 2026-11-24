import type { QuestionType, QuestionDifficulty, SqlDialect } from "@/generated/prisma/enums";

export const QUESTION_TYPES: QuestionType[] = ["MCQ", "SHORT", "LONG", "CODING", "SQL", "ORAL", "UPLOAD"];
export const DIFFICULTIES: QuestionDifficulty[] = ["EASY", "MEDIUM", "HARD"];
export const DIALECTS: SqlDialect[] = ["MySQL", "PostgreSQL", "SQLite"];
export const CODING_LANGUAGES = ["python", "java", "cpp", "c", "rust", "node"] as const;
export const COMPARISON_MODES = ["EXACT_ORDER", "UNORDERED"];
export const SQL_DIALECT_LABELS: Record<SqlDialect, string> = {
  PostgreSQL: "PostgreSQL",
  MySQL: "MySQL",
  SQLite: "SQLite",
};