CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'learner', 'parent');
CREATE TYPE gender_type AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE term_number AS ENUM ('1', '2', '3', '4');
CREATE TYPE fee_status AS ENUM ('paid', 'pending', 'overdue', 'waived');
CREATE TYPE announcement_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE audit_status AS ENUM ('success', 'failure');
CREATE TYPE resource_type AS ENUM ('document', 'video', 'link', 'image', 'other');

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          user_role NOT NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  phone         VARCHAR(20),
  gender        gender_type,
  date_of_birth DATE,
  profile_photo TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE grades (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(50) NOT NULL UNIQUE,
  level      INTEGER NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE classes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(50) NOT NULL UNIQUE,
  grade_id   UUID NOT NULL REFERENCES grades(id) ON DELETE RESTRICT,
  room       VARCHAR(50),
  capacity   INTEGER DEFAULT 40,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subjects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  code        VARCHAR(20) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE class_subjects (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, subject_id)
);

CREATE TABLE learner_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  student_number  VARCHAR(50) NOT NULL UNIQUE,
  class_id        UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE teacher_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  employee_number VARCHAR(50) NOT NULL UNIQUE,
  qualification   VARCHAR(255),
  specialization  VARCHAR(255),
  join_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE parent_profiles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  occupation VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE parent_learners (
  parent_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  learner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship VARCHAR(50) NOT NULL DEFAULT 'guardian',
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (parent_id, learner_id)
);

CREATE TABLE attendance (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_subject_id UUID NOT NULL REFERENCES class_subjects(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  status           attendance_status NOT NULL DEFAULT 'present',
  note             TEXT,
  marked_by        UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (learner_id, class_subject_id, date)
);

CREATE TABLE assessment_types (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL UNIQUE,
  weight     NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE assessments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_subject_id   UUID NOT NULL REFERENCES class_subjects(id) ON DELETE CASCADE,
  assessment_type_id UUID NOT NULL REFERENCES assessment_types(id),
  term               term_number NOT NULL,
  title              VARCHAR(255) NOT NULL,
  total_marks        NUMERIC(6,2) NOT NULL DEFAULT 100,
  date               DATE,
  created_by         UUID NOT NULL REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE marks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id  UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  learner_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  marks_obtained NUMERIC(6,2) NOT NULL,
  comment        TEXT,
  entered_by     UUID NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id, learner_id)
);

CREATE TABLE messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject      VARCHAR(255),
  body         TEXT NOT NULL,
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE announcements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        VARCHAR(255) NOT NULL,
  body         TEXT NOT NULL,
  audience     user_role[] NOT NULL DEFAULT '{admin,teacher,learner,parent}',
  status       announcement_status NOT NULL DEFAULT 'draft',
  published_by UUID NOT NULL REFERENCES users(id),
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE announcement_views (
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (announcement_id, user_id)
);

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(255) NOT NULL,
  body       TEXT,
  type       VARCHAR(50),
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  link       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE fee_structures (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  grade_id    UUID REFERENCES grades(id),
  amount      NUMERIC(10,2) NOT NULL,
  year        INTEGER NOT NULL,
  term        term_number,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE fee_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fee_structure_id UUID NOT NULL REFERENCES fee_structures(id),
  amount_due       NUMERIC(10,2) NOT NULL,
  amount_paid      NUMERIC(10,2) NOT NULL DEFAULT 0,
  status           fee_status NOT NULL DEFAULT 'pending',
  due_date         DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (learner_id, fee_structure_id)
);

CREATE TABLE payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_account_id UUID NOT NULL REFERENCES fee_accounts(id),
  amount         NUMERIC(10,2) NOT NULL,
  payment_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  method         VARCHAR(50),
  reference      VARCHAR(255),
  recorded_by    UUID NOT NULL REFERENCES users(id),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE resources (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_subject_id UUID NOT NULL REFERENCES class_subjects(id) ON DELETE CASCADE,
  title            VARCHAR(255) NOT NULL,
  description      TEXT,
  type             resource_type NOT NULL DEFAULT 'document',
  url              TEXT NOT NULL,
  uploaded_by      UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  location    VARCHAR(255),
  start_date  TIMESTAMPTZ NOT NULL,
  end_date    TIMESTAMPTZ,
  audience    user_role[] NOT NULL DEFAULT '{admin,teacher,learner,parent}',
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE timetable_slots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_subject_id UUID NOT NULL REFERENCES class_subjects(id) ON DELETE CASCADE,
  day_of_week      SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  period_number    SMALLINT NOT NULL CHECK (period_number BETWEEN 1 AND 8),
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_subject_id, day_of_week, period_number)
);

CREATE TABLE audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name  VARCHAR(255),
  role       user_role,
  action     VARCHAR(255) NOT NULL,
  details    TEXT,
  ip_address VARCHAR(45),
  status     audit_status NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email            ON users(email);
CREATE INDEX idx_users_role             ON users(role);
CREATE INDEX idx_learner_profiles_class ON learner_profiles(class_id);
CREATE INDEX idx_class_subjects_teacher ON class_subjects(teacher_id);
CREATE INDEX idx_class_subjects_class   ON class_subjects(class_id);
CREATE INDEX idx_attendance_learner     ON attendance(learner_id);
CREATE INDEX idx_attendance_date        ON attendance(date);
CREATE INDEX idx_marks_learner          ON marks(learner_id);
CREATE INDEX idx_marks_assessment       ON marks(assessment_id);
CREATE INDEX idx_messages_recipient     ON messages(recipient_id);
CREATE INDEX idx_messages_sender        ON messages(sender_id);
CREATE INDEX idx_notifications_user     ON notifications(user_id);
CREATE INDEX idx_notifications_unread   ON notifications(user_id) WHERE is_read = FALSE;
CREATE INDEX idx_audit_logs_user        ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created     ON audit_logs(created_at DESC);
CREATE INDEX idx_payments_fee_account   ON payments(fee_account_id);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_classes_updated_at
  BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_learner_profiles_updated_at
  BEFORE UPDATE ON learner_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_teacher_profiles_updated_at
  BEFORE UPDATE ON teacher_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_parent_profiles_updated_at
  BEFORE UPDATE ON parent_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_assessments_updated_at
  BEFORE UPDATE ON assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_marks_updated_at
  BEFORE UPDATE ON marks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_fee_accounts_updated_at
  BEFORE UPDATE ON fee_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at();