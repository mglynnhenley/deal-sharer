-- Fix ON CONFLICT to match the partial unique index on funds.domain
-- Both functions need: ON CONFLICT (domain) WHERE domain IS NOT NULL

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _domain text;
  _fund_id uuid;
  _is_personal boolean;
BEGIN
  _domain := split_part(NEW.email, '@', 2);

  SELECT EXISTS(SELECT 1 FROM personal_domains WHERE domain = _domain)
    INTO _is_personal;

  IF _is_personal THEN
    INSERT INTO funds (is_personal) VALUES (true) RETURNING id INTO _fund_id;
  ELSE
    INSERT INTO funds (domain) VALUES (_domain)
      ON CONFLICT (domain) WHERE domain IS NOT NULL DO NOTHING;
    SELECT id INTO _fund_id FROM funds WHERE domain = _domain;
  END IF;

  INSERT INTO profiles (id, fund_id, email_domain)
    VALUES (NEW.id, _fund_id, _domain);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION get_my_fund_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _fund_id uuid;
  _domain text;
  _is_personal boolean;
  _email text;
BEGIN
  -- Fast path: profile already exists
  SELECT fund_id INTO _fund_id FROM profiles WHERE id = auth.uid();
  IF found THEN
    RETURN _fund_id;
  END IF;

  -- Profile missing — create it
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  IF _email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  _domain := split_part(_email, '@', 2);

  SELECT EXISTS(SELECT 1 FROM personal_domains WHERE domain = _domain)
    INTO _is_personal;

  IF _is_personal THEN
    INSERT INTO funds (is_personal) VALUES (true) RETURNING id INTO _fund_id;
  ELSE
    INSERT INTO funds (domain) VALUES (_domain)
      ON CONFLICT (domain) WHERE domain IS NOT NULL DO NOTHING;
    SELECT id INTO _fund_id FROM funds WHERE domain = _domain;
  END IF;

  INSERT INTO profiles (id, fund_id, email_domain)
    VALUES (auth.uid(), _fund_id, _domain);

  RETURN _fund_id;
END;
$$;
