-- Store each Wordle guess per user per question (for validation and resume).
CREATE TABLE morning_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES morning_questions(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL,
  guess_word VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, question_id, attempt_number)
);
CREATE INDEX idx_morning_attempts_user_question ON morning_attempts(user_id, question_id);
