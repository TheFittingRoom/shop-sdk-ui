const createError = (name: string, message: string) => {
  const error = new Error(message);
  error.name = name;
  return error;
};

export const AvatarNotCreatedError = createError('AvatarNotCreatedError', 'Avatar not created');
export const UserNotLoggedInError = createError('UserNotLoggedInError', 'user not logged in');
export const NoColorwaySizeAssetsFoundError = createError('NoColorwaySizeAssetsFoundError', 'no colorway size assets found');
export const NoFramesFoundError = createError('NoFramesFoundError', 'no frames found');
export const NoStylesFoundError = createError('NoStylesFoundError', 'no styles found');
export const UserNotFoundError = createError('UserNotFoundError', 'user not found');
export const ServerUnavailableError = createError('ServerUnavailableError', 'Server is unavailable or not running');
export const TimeoutError = createError('TimeoutError', 'Virtual Try On has timed out');