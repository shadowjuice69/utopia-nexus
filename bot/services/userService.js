const database = require("./database");

module.exports = {
  async getOrCreateUser(user) {
    const db = database.getDb();

    const existingUser = db.data.users.find(
      (u) => u.id === user.id
    );

    if (existingUser) {
      return existingUser;
    }

    const newUser = {
      id: user.id,
      username: user.username,
      createdAt: new Date().toISOString(),
    };

    db.data.users.push(newUser);
    await db.write();

    return newUser;
  },
};
