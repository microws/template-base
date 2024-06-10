import { MicrowsRouter } from "@microws/server";
import { websiteRouter } from "./website/index.js";

const baseRouter = MicrowsRouter();
baseRouter.get("/health", (req, res) => {
  res.json(true);
});
baseRouter.use((req, res, next) => {
  if (process.env.SERVER_TYPE == "Admin" || req.hostname.match(/^(dev)?admin.microws.io$/)) {
    // adminRouter(req, res, next);
  } else if (process.env.SERVER_TYPE == "Website" || req.hostname.match(/^(www.)?microws(.*).io$/)) {
    websiteRouter(req, res, next);
  } else {
    next();
  }
});

baseRouter.use((err: any, req, res, next) => {
  res.status(err?.httpCode || 500);
  res.json({
    code: err?.httpCode || 500,
    error: err?.message,
    retryable: err?.retryable,
  });
  //allow the devserver or the real server to handle the error as well
  next(err);
});

export default baseRouter;
