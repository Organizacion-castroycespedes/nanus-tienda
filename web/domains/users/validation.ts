export interface UserValidationErrors {
  email?: string;
  password?: string;
  nombres?: string;
  apellidos?: string;
  documentoTipo?: string;
  documentoNumero?: string;
  telefono?: string;
  direccion?: string;
  emailPersonal?: string;
  cargoNombre?: string;
  cargoDescripcion?: string;
  funcionesDescripcion?: string;
  tenantId?: string;
  tenantBranchId?: string;
  roleId?: string;
  general?: string;
}

export interface UserFormInput {
  email: string;
  password?: string;
  nombres: string;
  apellidos: string;
  documentoTipo: string;
  documentoNumero: string;
  telefono?: string;
  direccion?: string;
  emailPersonal?: string;
  cargoNombre: string;
  cargoDescripcion?: string;
  funcionesDescripcion?: string;
  tenantId?: string;
  tenantBranchId: string;
  roleId: string;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
const PHONE_REGEX = /^[0-9+()\s-]+$/;
const DOC_NUM_REGEX = /^[a-zA-Z0-9-]+$/;

/**
 * Strips script tags, HTML tags and malicious characters
 */
export function sanitizeXss(value: string): string {
  if (!value) return "";
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/["'<>\\;]/g, (char) => {
      switch (char) {
        case "<":
          return "";
        case ">":
          return "";
        case "\\":
          return "";
        default:
          return char;
      }
    })
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sanitizes document numbers: removes spaces and unwanted symbols
 */
export function sanitizeDocumentNumber(value: string): string {
  if (!value) return "";
  return value.trim().replace(/[^a-zA-Z0-9-]/g, "").toUpperCase();
}

/**
 * Sanitizes email address: trims and lowercases
 */
export function sanitizeEmail(value: string): string {
  if (!value) return "";
  return value.trim().toLowerCase();
}

/**
 * Validates step 0: Credenciales
 */
export function validateStepCredentials(
  form: Pick<UserFormInput, "email" | "password">,
  mode: "create" | "edit"
): { isValid: boolean; error?: string } {
  const email = sanitizeEmail(form.email);
  if (!email) {
    return { isValid: false, error: "El correo electrónico es obligatorio." };
  }
  if (email.length > 150) {
    return { isValid: false, error: "El correo electrónico no puede superar los 150 caracteres." };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { isValid: false, error: "El formato del correo electrónico no es válido." };
  }

  if (mode === "create") {
    if (!form.password || form.password.length < 8) {
      return { isValid: false, error: "La contraseña debe tener al menos 8 caracteres." };
    }
    if (form.password.length > 72) {
      return { isValid: false, error: "La contraseña no puede superar los 72 caracteres." };
    }
  } else if (form.password && form.password.length > 0) {
    if (form.password.length < 8) {
      return { isValid: false, error: "La contraseña debe tener al menos 8 caracteres." };
    }
    if (form.password.length > 72) {
      return { isValid: false, error: "La contraseña no puede superar los 72 caracteres." };
    }
  }

  return { isValid: true };
}

/**
 * Validates step 1: Persona
 */
export function validateStepPersona(
  form: Pick<
    UserFormInput,
    | "nombres"
    | "apellidos"
    | "documentoTipo"
    | "documentoNumero"
    | "telefono"
    | "direccion"
    | "emailPersonal"
  >
): { isValid: boolean; error?: string } {
  const nombres = sanitizeXss(form.nombres);
  if (!nombres) {
    return { isValid: false, error: "Los nombres son obligatorios." };
  }
  if (nombres.length < 2 || nombres.length > 80) {
    return { isValid: false, error: "Los nombres deben tener entre 2 y 80 caracteres." };
  }
  if (!NAME_REGEX.test(nombres)) {
    return { isValid: false, error: "Los nombres contienen caracteres no válidos." };
  }

  const apellidos = sanitizeXss(form.apellidos);
  if (!apellidos) {
    return { isValid: false, error: "Los apellidos son obligatorios." };
  }
  if (apellidos.length < 2 || apellidos.length > 80) {
    return { isValid: false, error: "Los apellidos deben tener entre 2 y 80 caracteres." };
  }
  if (!NAME_REGEX.test(apellidos)) {
    return { isValid: false, error: "Los apellidos contienen caracteres no válidos." };
  }

  const docTipo = form.documentoTipo.trim();
  if (!docTipo) {
    return { isValid: false, error: "Debes seleccionar un tipo de documento." };
  }

  const docNum = sanitizeDocumentNumber(form.documentoNumero);
  if (!docNum) {
    return { isValid: false, error: "El número de documento es obligatorio." };
  }
  if (docNum.length < 4 || docNum.length > 20) {
    return { isValid: false, error: "El documento debe tener entre 4 y 20 caracteres alfanuméricos." };
  }
  if (!DOC_NUM_REGEX.test(docNum)) {
    return { isValid: false, error: "El documento solo puede contener números, letras y guiones." };
  }

  if (form.telefono) {
    const tel = form.telefono.trim();
    if (tel.length > 0) {
      if (tel.length < 7 || tel.length > 20 || !PHONE_REGEX.test(tel)) {
        return { isValid: false, error: "El teléfono debe contener entre 7 y 20 dígitos numéricos válidos." };
      }
    }
  }

  if (form.direccion) {
    const dir = sanitizeXss(form.direccion);
    if (dir.length > 150) {
      return { isValid: false, error: "La dirección no puede superar los 150 caracteres." };
    }
  }

  if (form.emailPersonal) {
    const emailP = sanitizeEmail(form.emailPersonal);
    if (emailP.length > 0) {
      if (emailP.length > 150 || !EMAIL_REGEX.test(emailP)) {
        return { isValid: false, error: "El correo personal no tiene un formato válido." };
      }
    }
  }

  return { isValid: true };
}

/**
 * Validates step 2: Cargo y funciones
 */
export function validateStepCargo(
  form: Pick<UserFormInput, "cargoNombre" | "cargoDescripcion" | "funcionesDescripcion">
): { isValid: boolean; error?: string } {
  const cargo = sanitizeXss(form.cargoNombre);
  if (!cargo) {
    return { isValid: false, error: "El nombre del cargo es obligatorio." };
  }
  if (cargo.length < 2 || cargo.length > 100) {
    return { isValid: false, error: "El nombre del cargo debe tener entre 2 y 100 caracteres." };
  }

  if (form.cargoDescripcion) {
    const desc = sanitizeXss(form.cargoDescripcion);
    if (desc.length > 300) {
      return { isValid: false, error: "La descripción del cargo no puede superar los 300 caracteres." };
    }
  }

  if (form.funcionesDescripcion) {
    const func = sanitizeXss(form.funcionesDescripcion);
    if (func.length > 500) {
      return { isValid: false, error: "Las funciones no pueden superar los 500 caracteres." };
    }
  }

  return { isValid: true };
}

/**
 * Validates step 3: Organización
 */
export function validateStepOrganization(
  form: Pick<UserFormInput, "tenantId" | "tenantBranchId">,
  isSuperAdmin: boolean
): { isValid: boolean; error?: string } {
  if (isSuperAdmin && (!form.tenantId || !form.tenantId.trim())) {
    return { isValid: false, error: "Debes seleccionar una empresa (tenant)." };
  }
  if (!form.tenantBranchId || !form.tenantBranchId.trim()) {
    return { isValid: false, error: "Debes seleccionar una sucursal principal." };
  }
  return { isValid: true };
}

/**
 * Validates step 4: Rol
 */
export function validateStepRole(
  form: Pick<UserFormInput, "roleId">
): { isValid: boolean; error?: string } {
  if (!form.roleId || !form.roleId.trim()) {
    return { isValid: false, error: "Debes asignar un rol al usuario." };
  }
  return { isValid: true };
}
