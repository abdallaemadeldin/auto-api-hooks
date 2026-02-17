/**
 * Custom error classes for auto-api-hooks.
 */

export class AutoApiHooksError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AutoApiHooksError'
  }
}

export class ParseError extends AutoApiHooksError {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

export class GeneratorError extends AutoApiHooksError {
  constructor(message: string) {
    super(message)
    this.name = 'GeneratorError'
  }
}

export class FileWriteError extends AutoApiHooksError {
  constructor(message: string) {
    super(message)
    this.name = 'FileWriteError'
  }
}

export class ValidationError extends AutoApiHooksError {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
