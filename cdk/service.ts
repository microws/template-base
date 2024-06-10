import * as cdk from "aws-cdk-lib";
import { Repository } from "aws-cdk-lib/aws-ecr";
import { Construct } from "constructs";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { MicrowsStatic } from "@microws/cdk";
import { HostedZone, IHostedZone } from "aws-cdk-lib/aws-route53";
import { Certificate, CertificateValidation } from "aws-cdk-lib/aws-certificatemanager";
import { CfnDomain, CfnRepository } from "aws-cdk-lib/aws-codeartifact";

interface ServiceStackProps extends cdk.StackProps {
  name: string;
  domain: string;
  devDomain?: string;
}
export class ServiceStack extends cdk.Stack {
  public readonly repository: Repository;
  public readonly bucket: Bucket;
  public readonly table: Table;
  public readonly evidently: cdk.aws_evidently.CfnProject;
  public readonly appConfig: {
    application: cdk.aws_appconfig.Application;
    environment: cdk.aws_appconfig.Environment;
    configuration: string;
  };

  public readonly bucketv2: Bucket;
  public readonly tablev2: Table;
  public readonly evidentlyv2: cdk.aws_evidently.CfnProject;
  public readonly appConfigv2: {
    application: cdk.aws_appconfig.Application;
    environment: cdk.aws_appconfig.Environment;
    configuration: string;
  };

  public readonly devHostedZone: IHostedZone;
  public readonly prodHostedZone: IHostedZone;
  public readonly devCertificate: Certificate;
  public readonly prodCertificate: Certificate;

  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);
    this.repository = new Repository(this, "Docker", {});
    let result = MicrowsStatic(this, {
      name: "Microws",
    });

    this.bucket = result.bucket;
    this.table = result.table;
    this.appConfig = result.appConfig;
    this.evidently = result.evidently;

    const devDomain = props.devDomain || props.domain;
    this.prodHostedZone = HostedZone.fromLookup(this, "PropsHostedZone", {
      domainName: props.domain,
    });
    this.devHostedZone = HostedZone.fromLookup(this, "DevHostedZone", {
      domainName: devDomain,
    });

    const artifactDomain = new CfnDomain(this, "Artifact Domain", {
      domainName: props.domain.replace(/[^a-zA-Z]/, ""),
    });
    const artifactRepository = new CfnRepository(this, "Artifact Repository", {
      domainName: artifactDomain.domainName,
      repositoryName: "npm",
    });
    artifactRepository.node.addDependency(artifactDomain);

    this.devCertificate = new Certificate(this, "DevRegionCertificate", {
      domainName: devDomain,
      validation: CertificateValidation.fromDns(this.devHostedZone),
      subjectAlternativeNames: [["www", devDomain].join("."), ["*", devDomain].join("."), devDomain],
    });
    this.prodCertificate = new Certificate(this, "ProdRegionCertificate", {
      domainName: props.domain,
      validation: CertificateValidation.fromDns(this.devHostedZone),
      subjectAlternativeNames: [["www", props.domain].join("."), ["*", props.domain].join("."), props.domain],
    });
  }
}
