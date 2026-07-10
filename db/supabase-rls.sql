-- Supabase RLS starter file for Edutrack
-- Run this in your Supabase SQL editor after migrating the schema.

-- Step 1: Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Step 2: Create policies for authenticated users
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (id = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY "Admins can manage any user" ON users
  FOR ALL USING (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY "Messages recipient or sender" ON messages
  FOR ALL USING (
    recipient_id = current_setting('app.current_user_id', true)::uuid
    OR sender_id = current_setting('app.current_user_id', true)::uuid
    OR current_setting('app.current_user_role', true) = 'admin'
  );

CREATE POLICY "Notifications for owner" ON notifications
  FOR ALL USING (
    user_id = current_setting('app.current_user_id', true)::uuid
    OR current_setting('app.current_user_role', true) = 'admin'
  );

CREATE POLICY "Attendance for learner or teacher" ON attendance
  FOR SELECT USING (
    learner_id = current_setting('app.current_user_id', true)::uuid
    OR EXISTS (
      SELECT 1 FROM class_subjects cs
      WHERE cs.id = attendance.class_subject_id
      AND cs.teacher_id = current_setting('app.current_user_id', true)::uuid
    )
    OR current_setting('app.current_user_role', true) = 'admin'
  );

CREATE POLICY "Marks for learner, teacher, or admin" ON marks
  FOR SELECT USING (
    learner_id = current_setting('app.current_user_id', true)::uuid
    OR EXISTS (
      SELECT 1 FROM assessments a
      JOIN class_subjects cs ON cs.id = a.class_subject_id
      WHERE a.id = marks.assessment_id
      AND cs.teacher_id = current_setting('app.current_user_id', true)::uuid
    )
    OR current_setting('app.current_user_role', true) = 'admin'
  );

CREATE POLICY "Audit logs for admin only" ON audit_logs
  FOR SELECT USING (current_setting('app.current_user_role', true) = 'admin');

-- Step 3: Allow authenticated inserts for user-specific events
CREATE POLICY "Insert notifications for own user" ON notifications
  FOR INSERT WITH CHECK (
    user_id = current_setting('app.current_user_id', true)::uuid
    OR current_setting('app.current_user_role', true) = 'admin'
  );

CREATE POLICY "Insert attendance by teacher" ON attendance
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM class_subjects cs
      WHERE cs.id = attendance.class_subject_id
      AND cs.teacher_id = current_setting('app.current_user_id', true)::uuid
    )
    OR current_setting('app.current_user_role', true) = 'admin'
  );

CREATE POLICY "Insert marks by teacher" ON marks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM assessments a
      JOIN class_subjects cs ON cs.id = a.class_subject_id
      WHERE a.id = marks.assessment_id
      AND cs.teacher_id = current_setting('app.current_user_id', true)::uuid
    )
    OR current_setting('app.current_user_role', true) = 'admin'
  );

-- Step 4: Use this file as a starter; review and extend policies for all tables.
-- Recommendation: create Supabase policies for classes, learners, parents, fees, resources, announcements, and any other sensitive tables.
