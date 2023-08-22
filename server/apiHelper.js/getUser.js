
const pool = require("../dbPool");
const getUserFromDatabase = async (email) => {
  try {
    const result = await pool.query(`SELECT users.*, passwords.hashed_password
    FROM users
    JOIN passwords ON users.email = $1;`, [email]);
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching user from the database:', error);
    return null;
  }
}; 

module.exports = getUserFromDatabase;
