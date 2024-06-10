import express from "express";
import "express-async-errors";
import baseRouter from "./server/index.js";

const app = express();
app.use("/", baseRouter);
const server = app.listen(3000, "0.0.0.0", () => {
  console.log("Listening on port 3000!");
});

process.on("SIGTERM", function () {
  console.log("got close signal");
  server.close();
});
