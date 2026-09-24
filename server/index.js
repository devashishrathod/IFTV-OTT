require("dotenv").config();
const os = require("os");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const fileUpload = require("express-fileupload");

const { mongoDb } = require("./database/mongoDb");
const { errorHandler, cleanupTempFiles } = require("./middlewares");
const { throwError } = require("./utils");
const { UPLOAD_LIMITS } = require("./constants");
const allRoutes = require("./routes");

const app = express();
const port = process.env.PORT || 8500;

app.use(cors());
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: os.tmpdir(),
    limits: { fileSize: UPLOAD_LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024 },
    abortOnLimit: true,
    limitHandler: (req, res) => res.setHeader("Content-Type", "application/json"),
    responseOnLimit: JSON.stringify({
      success: false,
      message: `File too large. Max ${UPLOAD_LIMITS.MAX_FILE_SIZE_MB} MB allowed; use the direct video upload for bigger files.`,
      error: {},
    }),
  }),
);
app.use(cleanupTempFiles);
app.use(express.json());
app.use(morgan("dev"));
app.use("/iftv-ott/", allRoutes);
app.get("/", async (req, res) => {
  res.send("Welcome to IFTV-OTT Server🚀");
});
app.use((req, res, next) => {
  throwError(404, "Invalid API");
});
app.use(errorHandler);

mongoDb();
const server = app.listen(port, () =>
  console.log(`✅ IFTV-OTT Server running on http://localhost:${port}`),
);
// Node's default (5 min) kills slow multipart video uploads.
server.requestTimeout = UPLOAD_LIMITS.REQUEST_TIMEOUT_MS;
