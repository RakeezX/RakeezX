-- AI-authored. Catalog/status only; no passwords, verifier, personal rows or writes.
select current_user as manager,
 exists(select 1 from pg_roles where rolname='n88_backend') as backend_exists,
 exists(select 1 from pg_namespace where nspname='n88_private') as private_exists,
 current_setting('password_encryption') as password_encryption,
 current_setting('log_parameter_max_length_on_error') as error_parameters;
