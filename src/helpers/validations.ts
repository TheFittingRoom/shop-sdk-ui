export const validateEmail = (email: string): boolean => {
  if (/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/.test(email)) {
    return true
  }
  return false
}

export const validatePassword = (password: string): boolean => {
  if (password.match(/^.{7,}$/)) {
    return true
  }
  return false
}

// https://www.w3resource.com/javascript/form/email-validation.php
// https://www.w3resource.com/javascript/form/password-validation.php
