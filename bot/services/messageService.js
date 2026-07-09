module.exports = {
  async cleanup(message, reply) {
    // Delete user's command
    await message.delete().catch(() => {});

    // Delete bot reply after 90 seconds
    setTimeout(() => {
      reply.delete().catch(() => {});
    }, 90000);
  },
};
