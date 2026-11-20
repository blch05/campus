export interface AppError {
  code: string;
  message: string;
}

interface RawSupabaseError {
  code?: string;
  status?: number;
  message?: string;
  details?: string;
}

export function parseAppError(err: unknown): AppError {
  const raw = (err ?? {}) as RawSupabaseError;
  const rawCode = String(raw.code ?? '');
  const rawMsg = String(raw.message ?? '').trim();
  const lower = rawMsg.toLowerCase();

  // Rate limit (HTTP 429 / Supabase Auth)
  if (raw.status === 429 || rawCode === 'over_request_rate_limit' || lower.includes('rate limit')) {
    return {
      code: 'AUTH_RATE_LIMIT',
      message: 'Demasiados intentos en poco tiempo. Esperá un momento antes de volver a intentar.',
    };
  }

  // Errores comunes de Supabase Auth
  if (rawCode === 'invalid_credentials' || lower.includes('invalid login credentials')) {
    return {
      code: 'AUTH_INVALID_CREDENTIALS',
      message: 'Correo o contraseña incorrectos.',
    };
  }
  if (rawCode === 'user_already_exists' || lower.includes('user already registered')) {
    return {
      code: 'AUTH_DUPLICATE_EMAIL',
      message: 'Ese correo ya está registrado. Iniciá sesión con tu contraseña.',
    };
  }
  if (rawCode === 'email_not_confirmed' || lower.includes('email not confirmed')) {
    return {
      code: 'AUTH_EMAIL_NOT_CONFIRMED',
      message: 'Tu correo todavía no fue confirmado. Revisá tu bandeja de entrada.',
    };
  }
  if (rawCode === 'weak_password' || lower.includes('password should be at least')) {
    return {
      code: 'AUTH_WEAK_PASSWORD',
      message: 'La contraseña debe tener al menos 6 caracteres.',
    };
  }

  // Errores estándar de PostgreSQL (SQLSTATE)
  if (rawCode === '23505') {
    if (lower.includes('email')) {
      return { code: 'DB_23505_EMAIL', message: 'Ya existe un registro con ese correo electrónico.' };
    }
    if (lower.includes('github_username')) {
      return { code: 'DB_23505_GITHUB', message: 'Ya existe un usuario con ese nombre de GitHub.' };
    }
    return { code: 'DB_23505', message: 'Ya existe un registro duplicado con esos datos.' };
  }
  if (rawCode === '23503') {
    return { code: 'DB_23503', message: 'Referencia inválida: el registro relacionado no existe.' };
  }
  if (rawCode === '23514') {
    return {
      code: 'DB_23514',
      message: 'Uno de los valores no cumple las reglas de validación de la base de datos.',
    };
  }
  if (rawCode === '22P02') {
    return { code: 'DB_22P02', message: 'Formato de dato inválido.' };
  }
  if (rawCode === '42501') {
    return {
      code: 'DB_42501',
      message: 'No tenés permisos suficientes para realizar esta operación.',
    };
  }
  if (rawCode === 'P0001') {
    return {
      code: 'DB_P0001',
      message: rawMsg || 'Error de validación en la base de datos.',
    };
  }

  // Error de red / sin conexión
  if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return {
      code: 'NET_UNREACHABLE',
      message: 'No se pudo conectar con el servidor. Verificá tu conexión a internet.',
    };
  }

  return {
    code: rawCode ? `ERR_${rawCode.toUpperCase()}` : 'ERR_UNKNOWN',
    message: rawMsg || 'Ocurrió un error inesperado.',
  };
}

export function formatAppError(err: AppError): string {
  return `[${err.code}] ${err.message}`;
}
