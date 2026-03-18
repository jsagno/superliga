-- Allow SUPER_USER role in app_user while keeping existing admin roles valid.
-- We keep SUPER_ADMIN for backward compatibility during transition.

ALTER TABLE public.app_user
DROP CONSTRAINT IF EXISTS app_user_role_check;

ALTER TABLE public.app_user
ADD CONSTRAINT app_user_role_check
CHECK (
  role = ANY (
    ARRAY[
      'PLAYER'::text,
      'ADMIN'::text,
      'SUPER_ADMIN'::text,
      'SUPER_USER'::text
    ]
  )
);
