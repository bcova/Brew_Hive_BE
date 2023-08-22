const express = require("express");
const app = express();
const cors = require("cors");
const pool = require("./dbPool");

//Middleware//
// CORS is a security rule that lets websites talk safely with each other, preventing unauthorized access.
app.use(cors());
// express.json() helps a web server understand and use data sent by other websites in a common format.
app.use(express.json());

//ROUTERS//

//Requires the correct file for any incoming requests to '/user'
const usersRouter = require(".//routes/userRoute");
const postRouter = require(".//routes/postRoute");

//ROUTES//
//USER ROUTE//
// Uses the usersRouter so that any incoming requests to '/user' will be handled.
app.use("/user", usersRouter);
app.use("/post", postRouter);
app.use((error, req, res, next) => {
  console.error("SERVER ERROR: ", error);

  // Set a default status code for server errors
  let statusCode = 500;

  // Customize the response based on error types
  if (error.name === "UnauthorizedError") {
    statusCode = 401;
  }
  // Add more conditions to customize responses for different error types if needed

  res.status(statusCode).json({
    success: false,
    error: { name: error.name, message: error.message },
    data: null,
  });
});



//LISTENS ON PORT 5000
app.listen(5000, () => {
  console.log("Server has started on port 5000");
});
