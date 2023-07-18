export const validateEmail = (email: string): boolean => {
  if (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
    return true
  }
  return false
}

export const validatePassword = (password: string): boolean => {
  if (password.match(/^[A-Za-z]\w{7,14}$/)) {
    return true
  }
  return false
}

// https://www.w3resource.com/javascript/form/email-validation.php
// https://www.w3resource.com/javascript/form/password-validation.php
