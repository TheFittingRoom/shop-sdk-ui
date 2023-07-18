interface UIError {
  userMessage: string
  error: Error
}

function createUIError(message: string, error?: Error): UIError {
  return {
    userMessage: message,
    error,
  }
}

export { createUIError, UIError }
