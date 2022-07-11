module.exports = async (ctx, next) => {
  const { id: currentUserId } = ctx.state.user;
  // If you are using MongoDB do not parse the id to an int!
  const userToUpdate = Number.parseInt(ctx.params.id, 10);
  if (currentUserId !== userToUpdate) {
    return ctx.unauthorized('Unable to edit this user ID');
  }
  return next();
};
