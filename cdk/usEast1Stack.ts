import * as cdk from "aws-cdk-lib";
import { Certificate, CertificateValidation } from "aws-cdk-lib/aws-certificatemanager";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";

interface UsEast1StackProps extends cdk.StackProps {
  domain: string;
}
export class UsEast1Stack extends cdk.Stack {
  public readonly certificate: Certificate;
  constructor(scope: Construct, id: string, props: UsEast1StackProps) {
    super(scope, id, props);
    const route53HostedZone = HostedZone.fromLookup(this, "HostedZone", {
      domainName: props.domain,
    });
    this.certificate = new Certificate(this, "UsEastCert", {
      domainName: props.domain,
      validation: CertificateValidation.fromDns(route53HostedZone),
      subjectAlternativeNames: [["*", props.domain].join("."), ["*.dev", props.domain].join(".")],
    });
  }
}
