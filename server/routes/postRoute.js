require("dotenv").config();
const pool = require("../dbPool");
const bcrypt = require("bcrypt");
const express = require("express");
const post = express.Router();
const jwt = require("jsonwebtoken");
const getUserFromDatabase = require("../apiHelper.js/getUser");

post.post("/newPost", async (req, res, next) => {
  try {
    const { user_id, postBody } = req.body;
    const newPost = await pool.query(
      "INSERT INTO posts (user_id, content) VALUES ($1, $2) RETURNING *",
      [user_id, postBody]
    );
    res.send({ Posted: true });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while creating the post." });
  }
});

post.get("/allPosts/:id", async (req, res, next) => {
  const token = req.headers.authorization.split(" ")[1];
  const { id } = req.params;
  try {
    const decodedToken = jwt.verify(
      token,
      process.env.REACT_APP_ACCESS_TOKEN_SECRET
    );
    const user_id = decodedToken.id;
    if (user_id == id) {
      const allPostsResult = await pool.query(
        ` 
      SELECT
      posts.*,
      users.username,
      CASE
        WHEN age(NOW(), posts.created_at) < interval '1 minute' THEN 'Just now'
        WHEN age(NOW(), posts.created_at) < interval '1 hour' THEN concat_ws(' ', EXTRACT(MINUTE FROM age(NOW(), posts.created_at))::INT, 'minutes ago')
        WHEN age(NOW(), posts.created_at) < interval '1 day' THEN concat_ws(' ', EXTRACT(HOUR FROM age(NOW(), posts.created_at))::INT, 'hours ago')
        WHEN age(NOW(), posts.created_at) < interval '1 month' THEN concat_ws(' ', EXTRACT(DAY FROM age(NOW(), posts.created_at))::INT, 'days ago')
        ELSE to_char(posts.created_at, 'Mon DD, YYYY')
      END AS timeAgo
    FROM posts
    INNER JOIN users ON posts.user_id = users.id
    WHERE users.id = $1
    ORDER BY posts.created_at DESC
    `,
        [id]
      );
      const allPosts = allPostsResult.rows;
      res.json(allPosts);
    } else {
      res.status(401).json({ error: "Unauthorized user." });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred." });
  }
});

post.post("/:postId/like", async (req, res, next) => {
  const postId = req.params.postId;
  const user_id = req.headers.user_id;

  try {
    // Check if the user has already liked the post
    const existingLike = await pool.query(
      "SELECT id FROM likes WHERE post_id = $1 AND user_id = $2",
      [postId, user_id]
    );

    if (existingLike.rows.length > 0) {
      // User has already liked the post, so remove the like
      await pool.query("DELETE FROM likes WHERE id = $1", [
        existingLike.rows[0].id,
      ]);

      // Decrement the like_count in the posts table
      await pool.query(
        "UPDATE posts SET like_count = like_count - 1 WHERE id = $1",
        [postId]
      );

      res.status(200).json({ message: "Post unliked successfully" });
    } else {
      // User hasn't liked the post, so add a new like
      await pool.query("INSERT INTO likes (post_id, user_id) VALUES ($1, $2)", [
        postId,
        user_id,
      ]);

      // Increment the like_count in the posts table
      await pool.query(
        "UPDATE posts SET like_count = like_count + 1 WHERE id = $1",
        [postId]
      );

      res.status(200).json({ message: "Post liked successfully" });
    }
  } catch (error) {
    console.error("Error updating like:", error);
    res
      .status(500)
      .json({ error: "An error occurred while updating the like" });
  }
});

post.get("/:user_id/likes", async (req, res, next) => {
  const user_id = req.params.user_id; // Use params instead of headers for the user_id
  try {
    const allLikes = await pool.query(
      `SELECT post_id FROM likes WHERE user_id = $1`,
      [user_id]
    );
    const likedPostIds = allLikes.rows.map((like) => like.post_id);
    res.json(likedPostIds);
  } catch (error) {
    console.error("Error fetching liked post IDs:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching liked post IDs." });
  }
});

post.get("/posts", async (req, res, next) => {
  try {
    const postsWithLikes = await pool.query(`
      SELECT p.*, COALESCE(l.like_count, 0) as like_count
      FROM posts p
      LEFT JOIN (
        SELECT post_id, COUNT(*) as like_count
        FROM likes
        GROUP BY post_id
      ) l ON p.id = l.post_id
    `);
    res.json(postsWithLikes.rows);
  } catch (error) {
    console.error("Error fetching posts with like counts:", error);
    res.status(500).json({ error: "An error occurred while fetching posts." });
  }
});

post.delete("/:postId", async (req, res) => {
  const { postId } = req.params;
  const user_id = Number(req.headers.user_id);
  const token = req.headers.authorization.split(" ")[1];
  const decodedToken = jwt.verify(
    token,
    process.env.REACT_APP_ACCESS_TOKEN_SECRET
  );
  const userID = Number(decodedToken.id);
  console.log({ user_id }, { userID });
  console.log(user_id === userID);
  try {
    if (user_id === userID) {
      console.log("User is authorized. Deleting post...");
      await pool.query("DELETE FROM comments WHERE post_id = $1", [postId]);
      await pool.query("DELETE FROM posts WHERE id = $1", [postId]);

      // Delete associated likes
      await pool.query("DELETE FROM likes WHERE post_id = $1", [postId]);

      res.status(200).json({ message: "Post deleted successfully" });
    } else {
      console.log("User is unauthorized. Not deleting post.");
      res.status(401).json({ message: "Unauthorized user" });
    }
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred while deleting the post" });
  }
});

post.put("/edit-post/:postId", async (req, res) => {
  const postId = req.params.postId;
  const editedPostBody = req.body.editedPostBody; // Use correct variable name here


  try {
    // Update the post content in the database
    await pool.query("UPDATE posts SET content = $1 WHERE id = $2", [
      editedPostBody,
      postId,
    ]);
    res.status(200).json({ message: "Post content updated successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred while updating post content" });
  }
});

post.put("/edit-comment/:commentId", async (req, res) => {
  const commentId = req.params.commentId;
  const editedCommentBody = req.body.editedCommentBody; // Use correct variable name here
console.log({commentId}, {editedCommentBody});

  try {
    // Update the post content in the database
    await pool.query("UPDATE comments SET content = $1 WHERE id = $2", [
      editedCommentBody,
      commentId,
    ]);
    res.status(200).json({ message: " Comment content updated successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred while updating post content" });
  }
});

post.delete("/delete-comment/:commentID", async (req, res) => {
  const { commentID } = req.params;
  const user_id = Number(req.headers.user_id);
  const token = req.headers.authorization.split(" ")[1];
  const decodedToken = jwt.verify(
    token,
    process.env.REACT_APP_ACCESS_TOKEN_SECRET
    );
    const userID = Number(decodedToken.id);
  try {
    if (user_id === userID) {
      console.log("User is authorized. Deleting Comment...");
      await pool.query("DELETE FROM comments WHERE id = $1", [commentID]);
  

      // Delete associated likes
  
      res.status(200).json({ message: "Comment deleted successfully" });
    } else {
      console.log("User is unauthorized. Not deleting Comment.");
      res.status(401).json({ message: "Unauthorized user" });
    }
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred while deleting the Comment" });
  }
});


post.post("/:postId/comment", async (req, res) => {
  const { postId } = req.params;
  const user_id = req.headers.user_id;
  // const token = req.headers.authorization.split(' ')[1];
  // const decodedToken = jwt.verify(token, process.env.REACT_APP_ACCESS_TOKEN_SECRET);
  // const userID = Number(decodedToken.id); // You need to have authentication implemented
  const commentContent = req.body.commentContent;
  console.log({ commentContent });
  try {
    // Insert the new comment into the database
    await pool.query(
      "INSERT INTO comments (post_id, user_id, content) VALUES ($1, $2, $3)",
      [postId, user_id, commentContent]
    );
    res.status(201).json({ message: "Comment posted successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred while posting the comment" });
  }
});

post.get("/:postId/comments", async (req, res) => {
  const { postId } = req.params;

  try {
    const comments = await pool.query(
      `SELECT *, 
      CASE
        WHEN age(NOW(), comments.created_at) < interval '1 minute' THEN 'Just now'
        WHEN age(NOW(), comments.created_at) < interval '1 hour' THEN concat_ws(' ', EXTRACT(MINUTE FROM age(NOW(), comments.created_at))::INT, 'minutes ago')
        WHEN age(NOW(), comments.created_at) < interval '1 day' THEN concat_ws(' ', EXTRACT(HOUR FROM age(NOW(), comments.created_at))::INT, 'hours ago')
        WHEN age(NOW(), comments.created_at) < interval '1 month' THEN concat_ws(' ', EXTRACT(DAY FROM age(NOW(), comments.created_at))::INT, 'days ago')
        ELSE to_char(comments.created_at, 'Mon DD, YYYY')
      END AS timeAgo 
      FROM comments 
      WHERE post_id = $1 
      ORDER BY comments.created_at DESC`,
      [postId]
    );
    res.status(200).json(comments.rows);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching comments" });
  }
});

module.exports = post;
