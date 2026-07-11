-- Supabase RLS file for Edutrack — PART 2
-- Run this AFTER supabase-rls.sql. Covers every table not addressed in
-- that file. Idempotent: safe to re-run.
--
-- This also FIXES three tables (resources, announcements, fee_accounts)
-- that had RLS enabled + forced in the original file but no policy was
-- ever written for them — meaning nobody but the Supabase service role
-- could read or write them at all. Not a data leak (the opposite: total
-- lockout), but broken, and fixed below.

-- ===================== ENABLE RLS ON REMAINING TABLES =====================
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;                 ALTER TABLE grades FORCE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;                ALTER TABLE classes FORCE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;               ALTER TABLE subjects FORCE ROW LEVEL SECURITY;
ALTER TABLE class_subjects ENABLE ROW LEVEL SECURITY;         ALTER TABLE class_subjects FORCE ROW LEVEL SECURITY;
ALTER TABLE learner_profiles ENABLE ROW LEVEL SECURITY;       ALTER TABLE learner_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE teacher_profiles ENABLE ROW LEVEL SECURITY;       ALTER TABLE teacher_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE parent_profiles ENABLE ROW LEVEL SECURITY;        ALTER TABLE parent_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE parent_learners ENABLE ROW LEVEL SECURITY;        ALTER TABLE parent_learners FORCE ROW LEVEL SECURITY;
ALTER TABLE assessment_types ENABLE ROW LEVEL SECURITY;       ALTER TABLE assessment_types FORCE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;            ALTER TABLE assessments FORCE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;         ALTER TABLE academic_years FORCE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;           ALTER TABLE achievements FORCE ROW LEVEL SECURITY;
ALTER TABLE learner_achievements ENABLE ROW LEVEL SECURITY;   ALTER TABLE learner_achievements FORCE ROW LEVEL SECURITY;
ALTER TABLE teacher_feedback ENABLE ROW LEVEL SECURITY;       ALTER TABLE teacher_feedback FORCE ROW LEVEL SECURITY;
ALTER TABLE report_cards ENABLE ROW LEVEL SECURITY;           ALTER TABLE report_cards FORCE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;     ALTER TABLE expense_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;               ALTER TABLE expenses FORCE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;              ALTER TABLE donations FORCE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;        ALTER TABLE support_tickets FORCE ROW LEVEL SECURITY;
ALTER TABLE event_rsvp ENABLE ROW LEVEL SECURITY;             ALTER TABLE event_rsvp FORCE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;  ALTER TABLE password_reset_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;          ALTER TABLE user_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;                 ALTER TABLE events FORCE ROW LEVEL SECURITY;
ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;        ALTER TABLE timetable_slots FORCE ROW LEVEL SECURITY;
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;         ALTER TABLE fee_structures FORCE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;               ALTER TABLE payments FORCE ROW LEVEL SECURITY;
ALTER TABLE announcement_views ENABLE ROW LEVEL SECURITY;     ALTER TABLE announcement_views FORCE ROW LEVEL SECURITY;

-- ===================== GRADES / CLASSES / SUBJECTS =====================
DROP POLICY IF EXISTS "School members can view own grades" ON grades;
CREATE POLICY "School members can view own grades" ON grades
  FOR SELECT USING (school_id = current_setting('app.current_school_id', true)::uuid);
DROP POLICY IF EXISTS "Admins manage own school grades" ON grades;
CREATE POLICY "Admins manage own school grades" ON grades
  FOR ALL USING (current_setting('app.current_user_role', true) = 'admin' AND school_id = current_setting('app.current_school_id', true)::uuid);

DROP POLICY IF EXISTS "School members can view own classes" ON classes;
CREATE POLICY "School members can view own classes" ON classes
  FOR SELECT USING (school_id = current_setting('app.current_school_id', true)::uuid);
DROP POLICY IF EXISTS "Admins manage own school classes" ON classes;
CREATE POLICY "Admins manage own school classes" ON classes
  FOR ALL USING (current_setting('app.current_user_role', true) = 'admin' AND school_id = current_setting('app.current_school_id', true)::uuid);

DROP POLICY IF EXISTS "School members can view own subjects" ON subjects;
CREATE POLICY "School members can view own subjects" ON subjects
  FOR SELECT USING (school_id = current_setting('app.current_school_id', true)::uuid);
DROP POLICY IF EXISTS "Admins manage own school subjects" ON subjects;
CREATE POLICY "Admins manage own school subjects" ON subjects
  FOR ALL USING (current_setting('app.current_user_role', true) = 'admin' AND school_id = current_setting('app.current_school_id', true)::uuid);

DROP POLICY IF EXISTS "School members can view own class_subjects" ON class_subjects;
CREATE POLICY "School members can view own class_subjects" ON class_subjects
  FOR SELECT USING (EXISTS (SELECT 1 FROM classes c WHERE c.id = class_subjects.class_id AND c.school_id = current_setting('app.current_school_id', true)::uuid));
DROP POLICY IF EXISTS "Admins manage own school class_subjects" ON class_subjects;
CREATE POLICY "Admins manage own school class_subjects" ON class_subjects
  FOR ALL USING (current_setting('app.current_user_role', true) = 'admin' AND EXISTS (SELECT 1 FROM classes c WHERE c.id = class_subjects.class_id AND c.school_id = current_setting('app.current_school_id', true)::uuid));

-- ===================== PROFILES =====================
DROP POLICY IF EXISTS "Learner can view own profile row" ON learner_profiles;
CREATE POLICY "Learner can view own profile row" ON learner_profiles
  FOR SELECT USING (user_id = current_setting('app.current_user_id', true)::uuid);
DROP POLICY IF EXISTS "Teachers can view own school learner profiles" ON learner_profiles;
CREATE POLICY "Teachers can view own school learner profiles" ON learner_profiles
  FOR SELECT USING (EXISTS (SELECT 1 FROM class_subjects cs WHERE cs.class_id = learner_profiles.class_id AND cs.teacher_id = current_setting('app.current_user_id', true)::uuid));
DROP POLICY IF EXISTS "Admins manage own school learner profiles" ON learner_profiles;
CREATE POLICY "Admins manage own school learner profiles" ON learner_profiles
  FOR ALL USING (current_setting('app.current_user_role', true) = 'admin' AND EXISTS (SELECT 1 FROM users u WHERE u.id = learner_profiles.user_id AND u.school_id = current_setting('app.current_school_id', true)::uuid));

DROP POLICY IF EXISTS "Teacher can view own profile row" ON teacher_profiles;
CREATE POLICY "Teacher can view own profile row" ON teacher_profiles
  FOR SELECT USING (user_id = current_setting('app.current_user_id', true)::uuid);
DROP POLICY IF EXISTS "Admins manage own school teacher profiles" ON teacher_profiles;
CREATE POLICY "Admins manage own school teacher profiles" ON teacher_profiles
  FOR ALL USING (current_setting('app.current_user_role', true) = 'admin' AND EXISTS (SELECT 1 FROM users u WHERE u.id = teacher_profiles.user_id AND u.school_id = current_setting('app.current_school_id', true)::uuid));

DROP POLICY IF EXISTS "Parent manages own profile row" ON parent_profiles;
CREATE POLICY "Parent manages own profile row" ON parent_profiles
  FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);

DROP POLICY IF EXISTS "Parent or learner can view own link" ON parent_learners;
CREATE POLICY "Parent or learner can view own link" ON parent_learners
  FOR SELECT USING (parent_id = current_setting('app.current_user_id', true)::uuid OR learner_id = current_setting('app.current_user_id', true)::uuid);
DROP POLICY IF EXISTS "Admins manage own school parent links" ON parent_learners;
CREATE POLICY "Admins manage own school parent links" ON parent_learners
  FOR ALL USING (current_setting('app.current_user_role', true) = 'admin' AND EXISTS (SELECT 1 FROM users u WHERE u.id = parent_learners.learner_id AND u.school_id = current_setting('app.current_school_id', true)::uuid));

-- ===================== ASSESSMENTS =====================
-- assessment_types is shared reference data (not school-specific in the
-- current schema) — readable by anyone logged in, writable only via the
-- service role.
DROP POLICY IF EXISTS "Authenticated users can view assessment types" ON assessment_types;
CREATE POLICY "Authenticated users can view assessment types" ON assessment_types
  FOR SELECT USING (current_setting('app.current_user_id', true) IS NOT NULL);

DROP POLICY IF EXISTS "View assessments for own class or school" ON assessments;
CREATE POLICY "View assessments for own class or school" ON assessments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM class_subjects cs JOIN learner_profiles lp ON lp.class_id = cs.class_id WHERE cs.id = assessments.class_subject_id AND lp.user_id = current_setting('app.current_user_id', true)::uuid)
    OR EXISTS (SELECT 1 FROM class_subjects cs WHERE cs.id = assessments.class_subject_id AND cs.teacher_id = current_setting('app.current_user_id', true)::uuid)
    OR (current_setting('app.current_user_role', true) = 'admin' AND EXISTS (SELECT 1 FROM class_subjects cs JOIN classes c ON c.id = cs.class_id WHERE cs.id = assessments.class_subject_id AND c.school_id = current_setting('app.current_school_id', true)::uuid))
  );
DROP POLICY IF EXISTS "Teachers manage own assessments" ON assessments;
CREATE POLICY "Teachers manage own assessments" ON assessments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM class_subjects cs WHERE cs.id = assessments.class_subject_id AND cs.teacher_id = current_setting('app.current_user_id', true)::uuid)
    OR (current_setting('app.current_user_role', true) = 'admin' AND EXISTS (SELECT 1 FROM class_subjects cs JOIN classes c ON c.id = cs.class_id WHERE cs.id = assessments.class_subject_id AND c.school_id = current_setting('app.current_school_id', true)::uuid))
  );

-- ===================== ACADEMIC YEARS =====================
DROP POLICY IF EXISTS "School members can view own academic years" ON academic_years;
CREATE POLICY "School members can view own academic years" ON academic_years
  FOR SELECT USING (school_id = current_setting('app.current_school_id', true)::uuid);
DROP POLICY IF EXISTS "Admins manage own school academic years" ON academic_years;
CREATE POLICY "Admins manage own school academic years" ON academic_years
  FOR ALL USING (current_setting('app.current_user_role', true) = 'admin' AND school_id = current_setting('app.current_school_id', true)::uuid);

-- ===================== ACHIEVEMENTS =====================
-- Global badge catalog, not school-specific — readable by anyone logged in.
DROP POLICY IF EXISTS "Authenticated users can view achievements" ON achievements;
CREATE POLICY "Authenticated users can view achievements" ON achievements
  FOR SELECT USING (current_setting('app.current_user_id', true) IS NOT NULL);

DROP POLICY IF EXISTS "Learner can view own achievements" ON learner_achievements;
CREATE POLICY "Learner can view own achievements" ON learner_achievements
  FOR SELECT USING (learner_id = current_setting('app.current_user_id', true)::uuid);
DROP POLICY IF EXISTS "Admins manage own school learner achievements" ON learner_achievements;
CREATE POLICY "Admins manage own school learner achievements" ON learner_achievements
  FOR ALL USING (current_setting('app.current_user_role', true) = 'admin' AND EXISTS (SELECT 1 FROM users u WHERE u.id = learner_achievements.learner_id AND u.school_id = current_setting('app.current_school_id', true)::uuid));

-- ===================== TEACHER FEEDBACK / REPORT CARDS =====================
DROP POLICY IF EXISTS "Learner or teacher can view own feedback" ON teacher_feedback;
CREATE POLICY "Learner or teacher can view own feedback" ON teacher_feedback
  FOR SELECT USING (learner_id = current_setting('app.current_user_id', true)::uuid OR teacher_id = current_setting('app.current_user_id', true)::uuid);
DROP POLICY IF EXISTS "Teachers manage own feedback" ON teacher_feedback;
CREATE POLICY "Teachers manage own feedback" ON teacher_feedback
  FOR ALL USING (
    teacher_id = current_setting('app.current_user_id', true)::uuid
    OR (current_setting('app.current_user_role', true) = 'admin' AND EXISTS (SELECT 1 FROM users u WHERE u.id = teacher_feedback.learner_id AND u.school_id = current_setting('app.current_school_id', true)::uuid))
  );

DROP POLICY IF EXISTS "Learner can view own report cards" ON report_cards;
CREATE POLICY "Learner can view own report cards" ON report_cards
  FOR SELECT USING (learner_id = current_setting('app.current_user_id', true)::uuid);
DROP POLICY IF EXISTS "Admins manage own school report cards" ON report_cards;
CREATE POLICY "Admins manage own school report cards" ON report_cards
  FOR ALL USING (current_setting('app.current_user_role', true) = 'admin' AND EXISTS (SELECT 1 FROM users u WHERE u.id = report_cards.learner_id AND u.school_id = current_setting('app.current_school_id', true)::uuid));

-- ===================== FINANCE: EXPENSES / DONATIONS =====================
DROP POLICY IF EXISTS "Admins manage own school expense categories" ON expense_categories;
CREATE POLICY "Admins manage own school expense categories" ON expense_categories
  FOR ALL USING (current_setting('app.current_user_role', true) = 'admin' AND school_id = current_setting('app.current_school_id', true)::uuid);

DROP POLICY IF EXISTS "Admins manage own school expenses" ON expenses;
CREATE POLICY "Admins manage own school expenses" ON expenses
  FOR ALL USING (current_setting('app.current_user_role', true) = 'admin' AND EXISTS (SELECT 1 FROM expense_categories ec WHERE ec.id = expenses.category_id AND ec.school_id = current_setting('app.current_school_id', true)::uuid));

-- KNOWN GAP: `donations` has no school_id column, so this is global to
-- every admin across every school for now. Recommend adding school_id
-- to donations if per-school isolation matters for this data.
DROP POLICY IF EXISTS "Admins manage donations" ON donations;
CREATE POLICY "Admins manage donations" ON donations
  FOR ALL USING (current_setting('app.current_user_role', true) = 'admin');

-- ===================== SUPPORT TICKETS / EVENT RSVP =====================
DROP POLICY IF EXISTS "Users manage own support tickets" ON support_tickets;
CREATE POLICY "Users manage own support tickets" ON support_tickets
  FOR ALL USING (
    raised_by = current_setting('app.current_user_id', true)::uuid
    OR assigned_to = current_setting('app.current_user_id', true)::uuid
    OR (current_setting('app.current_user_role', true) = 'admin' AND EXISTS (SELECT 1 FROM users u WHERE u.id = support_tickets.raised_by AND u.school_id = current_setting('app.current_school_id', true)::uuid))
  );

DROP POLICY IF EXISTS "Users manage own rsvp" ON event_rsvp;
CREATE POLICY "Users manage own rsvp" ON event_rsvp
  FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);

-- ===================== AUTH INTERNALS =====================
-- password_reset_tokens and user_sessions intentionally get NO policies.
-- Your backend manages these directly over a trusted DB connection, not
-- through the anon/authenticated API roles — RLS forced with zero
-- policies means those roles get zero access, which is correct here.

-- ===================== EVENTS / TIMETABLE =====================
-- KNOWN GAP: `events` has no school_id column either. Recommend adding
-- one (ALTER TABLE events ADD COLUMN school_id ...) and then scoping
-- this policy the same way classes/grades are scoped above. Until then,
-- events are visible platform-wide to anyone matching the audience role.
DROP POLICY IF EXISTS "Authenticated users can view events" ON events;
CREATE POLICY "Authenticated users can view events" ON events
  FOR SELECT USING (current_setting('app.current_user_role', true)::user_role = ANY(audience));
DROP POLICY IF EXISTS "Admins manage events" ON events;
CREATE POLICY "Admins manage events" ON events
  FOR ALL USING (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS "School members can view own timetable" ON timetable_slots;
CREATE POLICY "School members can view own timetable" ON timetable_slots
  FOR SELECT USING (EXISTS (SELECT 1 FROM class_subjects cs JOIN classes c ON c.id = cs.class_id WHERE cs.id = timetable_slots.class_subject_id AND c.school_id = current_setting('app.current_school_id', true)::uuid));
DROP POLICY IF EXISTS "Admins manage own school timetable" ON timetable_slots;
CREATE POLICY "Admins manage own school timetable" ON timetable_slots
  FOR ALL USING (current_setting('app.current_user_role', true) = 'admin' AND EXISTS (SELECT 1 FROM class_subjects cs JOIN classes c ON c.id = cs.class_id WHERE cs.id = timetable_slots.class_subject_id AND c.school_id = current_setting('app.current_school_id', true)::uuid));

-- ===================== FEE STRUCTURES / FEE ACCOUNTS / PAYMENTS =====================
-- (fee_accounts fixes the "RLS forced, no policy" bug from the original file)
DROP POLICY IF EXISTS "School members can view own fee structures" ON fee_structures;
CREATE POLICY "School members can view own fee structures" ON fee_structures
  FOR SELECT USING (school_id = current_setting('app.current_school_id', true)::uuid);
DROP POLICY IF EXISTS "Admins manage own school fee structures" ON fee_structures;
CREATE POLICY "Admins manage own school fee structures" ON fee_structures
  FOR ALL USING (current_setting('app.current_user_role', true) = 'admin' AND school_id = current_setting('app.current_school_id', true)::uuid);

DROP POLICY IF EXISTS "Fee accounts for learner, parent, or admin" ON fee_accounts;
CREATE POLICY "Fee accounts for learner, parent, or admin" ON fee_accounts
  FOR SELECT USING (
    learner_id = current_setting('app.current_user_id', true)::uuid
    OR EXISTS (SELECT 1 FROM parent_learners pl WHERE pl.learner_id = fee_accounts.learner_id AND pl.parent_id = current_setting('app.current_user_id', true)::uuid)
    OR (current_setting('app.current_user_role', true) = 'admin' AND EXISTS (SELECT 1 FROM users u WHERE u.id = fee_accounts.learner_id AND u.school_id = current_setting('app.current_school_id', true)::uuid))
  );
DROP POLICY IF EXISTS "Admins manage own school fee accounts" ON fee_accounts;
CREATE POLICY "Admins manage own school fee accounts" ON fee_accounts
  FOR ALL USING (current_setting('app.current_user_role', true) = 'admin' AND EXISTS (SELECT 1 FROM users u WHERE u.id = fee_accounts.learner_id AND u.school_id = current_setting('app.current_school_id', true)::uuid));

DROP POLICY IF EXISTS "Payments for learner, parent, or admin" ON payments;
CREATE POLICY "Payments for learner, parent, or admin" ON payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM fee_accounts fa WHERE fa.id = payments.fee_account_id AND (fa.learner_id = current_setting('app.current_user_id', true)::uuid OR EXISTS (SELECT 1 FROM parent_learners pl WHERE pl.learner_id = fa.learner_id AND pl.parent_id = current_setting('app.current_user_id', true)::uuid)))
    OR (current_setting('app.current_user_role', true) = 'admin' AND EXISTS (SELECT 1 FROM fee_accounts fa JOIN users u ON u.id = fa.learner_id WHERE fa.id = payments.fee_account_id AND u.school_id = current_setting('app.current_school_id', true)::uuid))
  );
DROP POLICY IF EXISTS "Admins manage own school payments" ON payments;
CREATE POLICY "Admins manage own school payments" ON payments
  FOR ALL USING (current_setting('app.current_user_role', true) = 'admin' AND EXISTS (SELECT 1 FROM fee_accounts fa JOIN users u ON u.id = fa.learner_id WHERE fa.id = payments.fee_account_id AND u.school_id = current_setting('app.current_school_id', true)::uuid));

-- ===================== RESOURCES (fixes missing-policy bug) =====================
DROP POLICY IF EXISTS "View resources for own class" ON resources;
CREATE POLICY "View resources for own class" ON resources
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM class_subjects cs JOIN learner_profiles lp ON lp.class_id = cs.class_id WHERE cs.id = resources.class_subject_id AND lp.user_id = current_setting('app.current_user_id', true)::uuid)
    OR EXISTS (SELECT 1 FROM class_subjects cs WHERE cs.id = resources.class_subject_id AND cs.teacher_id = current_setting('app.current_user_id', true)::uuid)
    OR (current_setting('app.current_user_role', true) = 'admin' AND EXISTS (SELECT 1 FROM class_subjects cs JOIN classes c ON c.id = cs.class_id WHERE cs.id = resources.class_subject_id AND c.school_id = current_setting('app.current_school_id', true)::uuid))
  );
DROP POLICY IF EXISTS "Teachers manage own resources" ON resources;
CREATE POLICY "Teachers manage own resources" ON resources
  FOR ALL USING (
    EXISTS (SELECT 1 FROM class_subjects cs WHERE cs.id = resources.class_subject_id AND cs.teacher_id = current_setting('app.current_user_id', true)::uuid)
    OR (current_setting('app.current_user_role', true) = 'admin' AND EXISTS (SELECT 1 FROM class_subjects cs JOIN classes c ON c.id = cs.class_id WHERE cs.id = resources.class_subject_id AND c.school_id = current_setting('app.current_school_id', true)::uuid))
  );

-- ===================== ANNOUNCEMENTS (fixes missing-policy bug) =====================
-- KNOWN GAP: announcements also has no school_id column — same
-- follow-up recommendation as `events` above.
DROP POLICY IF EXISTS "View announcements for own role" ON announcements;
CREATE POLICY "View announcements for own role" ON announcements
  FOR SELECT USING (status = 'published' AND current_setting('app.current_user_role', true)::user_role = ANY(audience));
DROP POLICY IF EXISTS "Admins manage announcements" ON announcements;
CREATE POLICY "Admins manage announcements" ON announcements
  FOR ALL USING (current_setting('app.current_user_role', true) = 'admin');

DROP POLICY IF EXISTS "Users manage own announcement views" ON announcement_views;
CREATE POLICY "Users manage own announcement views" ON announcement_views
  FOR ALL USING (user_id = current_setting('app.current_user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);