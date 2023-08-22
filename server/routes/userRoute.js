require("dotenv").config();
const pool = require("../dbPool");
const bcrypt = require("bcrypt");
const express = require("express");
const users = express.Router();
const jwt = require("jsonwebtoken");
const  getUserFromDatabase = require("../apiHelper.js/getUser");

//REGISTERS A USER AND HASHES THEIR PASSWORD.
users.post("/register", async (req, res, next) => {
  try {
    const { first_name, last_name, email, hashed_Password, username, city } =
      req.body;
    //GETS THE USER FROM THE DATABASE BY EMAIL
    const existingEmail = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );
    //GETS THE USER FROM THE DATABASE BY USERNAME
    const existingUsername = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [username]
    );

    //IF EMAIL AND USERNAME ALREADY EXIST RETURN 409 ERROR
    if (existingEmail.rows.length > 0 && existingUsername.rows.length > 0) {
      return res
        .status(409)
        .json({ success: false, error: "Username and Email already exist." });
      //IF EMAIL ALREADY EXIST RETURN 409 ERROR
    } else if (existingEmail.rows.length > 0) {
      return res
        .status(409)
        .json({ success: false, error: "Email already exists." });
      //IF USERNAME ALREADY EXIST RETURN 409 ERROR
    } else if (existingUsername.rows.length > 0) {
      return res
        .status(409)
        .json({ success: false, error: "Username already exists." });
    }
    //PASSWORD HASHED AND SAVED AS CONSTANT hashedPassword
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(hashed_Password, saltRounds);
    //INSERTS A NEW USER INTO THE DATABASE WITH THE PROVIDED DATA
    const newUser = await pool.query(
      "INSERT INTO users (first_name, last_name, email, username, city) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [first_name, last_name, email, username, city]
    );

    //GETS THE ID OF THE NEW USER FROM THE DATABASE
    const user_id = newUser.rows[0].id;
    const newPass = await pool.query(
      "INSERT INTO passwords (hashed_password, pass_id) VALUES ($1, $2)",
      [hashedPassword, user_id]
    );
    const token = jwt.sign(
      {
        id: user_id,
      },
      process.env.REACT_APP_ACCESS_TOKEN_SECRET,
      { expiresIn: "1h" }
      );

    res.send({ success: true, token,user_id });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, error: "Internal Server Error." });
  }
});

//LOGS IN A USER.
users.post("/login", async (req, res,next) => {

  const { email, password } = req.body;
  // Fetch user from the database using the provided email
  const user = await getUserFromDatabase(email);

  // IF USER IS NOT FOUND RETURN 404
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }
  //USES BCRYPT TO COMPARE PASSWORDS WITH THE ONE IN THE DATABASE
  const isMatch = await bcrypt.compare(
    password.toString(),
    user.hashed_password.toString()
  );
//IF PASSWORDS MATCH RETURN USER DATA
  if (isMatch) {
    const token = jwt.sign(
      {
        id: user.id,
        email:email
      },
      process.env.REACT_APP_ACCESS_TOKEN_SECRET,
      { expiresIn: "24h" }
    );
 
    return res.send({ isMatch,user,token });
  } else {
    return res.status(401).json({ error: "Invalid email or password." });
  }
});


//GETS A SINGLE USER FROM THE DATABASE BY EMAIL.
users.get("/:id", async (req, res) => {

  // const token = req.headers.authorization.split(' ')[1];
  // const decodedToken = jwt.verify(token, process.env.REACT_APP_ACCESS_TOKEN_SECRET);
  // const userId = decodedToken.id;

  // console.log({userId},{decodedToken});

  try {
    const { id } = req.params;
    const user = await pool.query(
      `
       SELECT * 
       FROM users
       WHERE users.email = $1
      `,
      [id]
    );
    //IF USER IS NOT FOUND RETURN 404 WITH ERROR MESSAGE 'User not found.'
    if (user.rows.length === 0) {
      return res.status(404).json({ error: "incorrect Email" });
    } else {
      //IF USER IS FOUND RETURN USER'S DATA.
      return res.status(200).json(user.rows[0]);
    }
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ error: "Internal Server Error." });
  }
});



module.exports = users;
