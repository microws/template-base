import { MicrowsAWSAccount, MicrowsAccount } from "@microws/cdk";
import * as cdk from "aws-cdk-lib";
import { IIpAddresses } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

interface MicrowsStackProps extends cdk.StackProps {
  name: string;
}
export class MicrowsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MicrowsStackProps) {
    super(scope, id, props);
    new MicrowsAccount(this, "DevSetup", {
      env: "dev",
      publicWebServers: true,
      account: this.account,
    });
    new MicrowsAccount(this, "ProdSetup", {
      env: "prod",
      publicWebServers: true,
      account: this.account,
    });
  }
}
x;
