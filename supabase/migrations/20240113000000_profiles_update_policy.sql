CREATE POLICY "profiles_own_update" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

COMMENT ON POLICY "profiles_own_update" ON profiles IS
  'Users can update their own profile row, including username changes validated by the app.';
