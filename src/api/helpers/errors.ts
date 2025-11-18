export class AvatarNotCreatedError extends Error {
  constructor() {
    super('Avatar not created')
    this.name = 'AvatarNotCreatedError'
  }
}

export class UserNotLoggedInError extends Error {
  constructor() {
    super('user not logged in')
    this.name = 'UserNotLoggedInError'
  }
}

export class UserNotFoundError extends Error {
  constructor(userId?: string) {
    super(`user not found${userId ? `: ${userId}` : ''}`)
    this.name = 'UserNotFoundError'
  }
}

export class NoColorwaySizeAssetsFoundError extends Error {
  constructor() {
    super('no colorway size assets found')
    this.name = 'NoColorwaySizeAssetsFoundError'
  }
}

export class NoFramesFoundError extends Error {
  constructor() {
    super('no frames found')
    this.name = 'NoFramesFoundError'
  }
}

export class RecommendedAvailableSizesError extends Error {
  recommended_size: string
  available_sizes: string[]

  constructor(recommended_size: string, available_sizes: string[]) {
    super('recommended available sizes error')
    this.name = 'RecommendedAvailableSizesError'
    this.recommended_size = recommended_size
    this.available_sizes = available_sizes
  }
}

export class NoStylesFoundError extends Error {
  constructor() {
    super('no styles found')
    this.name = 'NoStylesFoundError'
  }
}

export class ServerUnavailableError extends Error {
  constructor(message: string = 'Server is unavailable or not running') {
    super(message)
    this.name = 'ServerUnavailableError'
  }
}