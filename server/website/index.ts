import { static as expressStatic, NextFunction, Request, Response } from "express";
import { MicrowsRouter, flagRouter, handleHtmlRequest, parseAuthentication, requireGroup } from "@microws/server";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";

const USER_POOL_ID = "[@TODO PROD_USER_POOL_ID_HERE]";
const USER_POOL_CLIENT_ID = "[@TODO PROD_USER_POOL_CLIENT_ID_HERE]";

let parseAuthenticationMiddleware = parseAuthentication(USER_POOL_ID, USER_POOL_CLIENT_ID);

export const websiteRouter = MicrowsRouter();
websiteRouter.use(parseAuthenticationMiddleware);
websiteRouter.use(async (req: Request, res: Response, next: NextFunction) => {
  res.locals.evidentlyConfig = {
    id: res.locals.user?.id || "guest",
    group: "",
    type: process.env.NODE_ENV == "dev" ? "trunk" : "release",
    context: {},
  };
  next();
});
websiteRouter.use(bodyParser.json({ limit: "2mb" }));
websiteRouter.use(bodyParser.urlencoded({ extended: true }));
websiteRouter.use("/.well-known/", expressStatic(fileURLToPath(new URL("./.well-known/", import.meta.url))));

websiteRouter.use("/api/flag/", flagRouter);

const apiRouter = MicrowsRouter();
websiteRouter.use("/api", apiRouter);

websiteRouter.use(
  handleHtmlRequest({
    app: "Website",
    staticBucket: process.env.STATIC_BUCKET,
    webConfig: (locals) => {
      return {
        environment: process.env.NODE_ENV,
        userPoolId: USER_POOL_ID,
        userPoolClientId: USER_POOL_CLIENT_ID,
        cognitoDomain: "[@todo auth domain here ex: auth.microws.io]",
      };
    },
  }),
);
