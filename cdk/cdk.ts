#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { CdkStack } from "./stack.js";

import { MicrowsStack } from "./account.js";
import { ServiceStack } from "./service.js";
import { UsEast1Stack } from "./usEast1Stack.js";
const app = new cdk.App();

/*Need one of these per account*/
new MicrowsStack(app, "EnvironmentSetup", {
  env: {
    account: process.env.npm_package_config_awsAccount,
    region: process.env.npm_package_config_awsRegion,
  },
  name: process.env.npm_package_config_service,
});

//For certificates and other things that must be in us-east-1.
const east1Stack = new UsEast1Stack(app, "East1Stack", {
  env: {
    region: "us-east-1",
    account: process.env.npm_package_config_awsAccount,
  },
  domain: process.env.npm_package_config_domain,
  crossRegionReferences: true,
});

/*Need one of these per service, can be in Service repos as well as in the base*/
const serviceStack = new ServiceStack(app, process.env.npm_package_config_service, {
  env: {
    account: process.env.npm_package_config_awsAccount,
    region: process.env.npm_package_config_awsRegion,
  },
  name: process.env.npm_package_config_service,
  domain: process.env.npm_package_config_domain,
});

/*This is the Dev Service*/
new CdkStack(app, process.env.npm_package_config_service + "Dev", {
  crossRegionReferences: true,
  env: {
    account: process.env.npm_package_config_awsAccount,
    region: process.env.npm_package_config_awsRegion,
  },
  serviceStack,
  certificate: east1Stack.certificate,

  stage: "dev",
  recordName: "dev",
  adminRecordName: "admin.dev",
  authRecordName: "auth.dev",
  name: process.env.npm_package_config_service,

  dockerBuildSha256: null, //ex sha256:132131adf123  "[@TODO, put the hash of the build that should be deployed";,
});

/*This is the Prod Service*/
new CdkStack(app, process.env.npm_package_config_service + "Prod", {
  crossRegionReferences: true,
  env: {
    account: process.env.npm_package_config_awsAccount,
    region: process.env.npm_package_config_awsRegion,
  },
  serviceStack,
  certificate: east1Stack.certificate,

  stage: "prod",
  recordName: "www",
  adminRecordName: "admin",
  authRecordName: "auth",
  name: process.env.npm_package_config_service,
  dockerBuildSha256: null, //ex sha256:132131adf123  "[@TODO, put the hash of the build that should be deployed";,
});
