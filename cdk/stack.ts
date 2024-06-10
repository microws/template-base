import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  CreateParameterStore,
  MicrowsService,
  MicrowsDynamoDBTable,
  MicrowsLambdaLayer,
  MicrowsLambdaFunction,
  MicrowsEventBridgeLambda,
} from "@microws/cdk";
import {
  AccountRecovery,
  CfnUserPoolGroup,
  ClientAttributes,
  Mfa,
  OAuthScope,
  UserPool,
  UserPoolDomain,
} from "aws-cdk-lib/aws-cognito";
import { Bucket } from "aws-cdk-lib/aws-s3";

import {
  AllowedMethods,
  CacheCookieBehavior,
  CachePolicy,
  CacheQueryStringBehavior,
  Distribution,
  Function,
  FunctionCode,
  FunctionEventType,
  HttpVersion,
  OriginRequestPolicy,
  SSLMethod,
  SecurityPolicyProtocol,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { FunctionUrlOrigin, HttpOrigin, OriginGroup, S3Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { ContainerImage, LogDrivers } from "aws-cdk-lib/aws-ecs";
import { ListenerCondition } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Effect, Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { Architecture, FunctionUrlAuthType } from "aws-cdk-lib/aws-lambda";
import { EventBus } from "aws-cdk-lib/aws-events";
import { ARecord, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { ServiceStack } from "./service.js";

interface ControllerStackProps extends cdk.StackProps {
  stage: "prod" | "dev";
  adminRecordName: string;
  authRecordName: string;
  recordName: string;
  name: string;
  certificate: Certificate;
  dockerBuildSha256: string;
  serviceStack: ServiceStack;
}

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ControllerStackProps) {
    super(scope, id, props);
    const { addParameter, ecsSecrets, attachSecureParameter, environmentVariables } = CreateParameterStore(
      this,
      `/${props.name}/${props.stage}/`,
    );
    attachSecureParameter("SECRET_ENV");

    addParameter("APP_CONFIG", props.serviceStack.appConfig.configuration);
    addParameter("STATIC_BUCKET", props.serviceStack.bucket.bucketName);

    const mediaBucket = new Bucket(this, "Media Bucket", {
      eventBridgeEnabled: true,
    });
    addParameter("MEDIA_IMAGES_BUCKET", mediaBucket.bucketName);

    const amazonEventBus = EventBus.fromEventBusName(this, "AWSEventBus", "default");
    const microwsEventBus = EventBus.fromEventBusName(this, "MicrowsEventBus", "Microws" + props.stage);

    const hostedZone = props.stage == "dev" ? props.serviceStack.devHostedZone : props.serviceStack.prodHostedZone;
    const loadBalancerSecret = new Secret(this, "LoadBalancerSecret", {
      generateSecretString: {},
    });

    const mainTable = MicrowsDynamoDBTable(this, "Main", {
      autoIndexes: 5,
      gsiIndexes: 3,
      headerIndex: true,
      projIndexes: 2,
      eventBus: microwsEventBus,
      environment: {
        stage: props.stage,
        domain: "Ordering",
        service: "Main",
      },
    });
    addParameter("MAIN_TABLE", mainTable.tableName);

    const baseLayer = MicrowsLambdaLayer(this, "BaseLayer", {
      entry: "baseLayer.ts",
    });
    const imageLayer = MicrowsLambdaLayer(this, "ImageLayer", {
      entry: "imageLayer.ts",
    });

    const preSignUp = MicrowsLambdaFunction(this, "PreSignup", {
      layers: [baseLayer],
      entry: "cognito/preSignup.ts",
      environment: environmentVariables("lambda", ["MAIN_TABLE"]),
    });
    mainTable.grantReadWriteData(preSignUp);

    const preTokenGeneration = MicrowsLambdaFunction(this, "PreTokenGeneration", {
      layers: [baseLayer],
      entry: "cognito/preToken.ts",
      environment: environmentVariables("lambda", ["MAIN_TABLE"]),
    });
    mainTable.grantReadData(preTokenGeneration);

    const userPool = new UserPool(this, props.stage.toUpperCase() + "Users", {
      accountRecovery: AccountRecovery.NONE,
      mfa: Mfa.OFF,

      passwordPolicy: {
        minLength: 12,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: false,
        requireSymbols: false,
        tempPasswordValidity: cdk.Duration.days(1),
      },
      selfSignUpEnabled: false,
      signInCaseSensitive: false,
      deletionProtection: true,
      standardAttributes: {},
      lambdaTriggers: {
        preSignUp,
        preTokenGeneration,
      },
    });
    new CfnUserPoolGroup(this, "UserGroup", {
      groupName: "User",
      userPoolId: userPool.userPoolId,
    });
    new CfnUserPoolGroup(this, "GuestGroup", {
      groupName: "Guest",
      userPoolId: userPool.userPoolId,
    });
    new CfnUserPoolGroup(this, "AdminGroup", {
      groupName: "Admin",
      userPoolId: userPool.userPoolId,
    });
    preSignUp.role!.attachInlinePolicy(
      new Policy(this, "userpool-policy", {
        statements: [
          new PolicyStatement({
            actions: ["cognito-idp:AdminLinkProviderForUser"],
            resources: [userPool.userPoolArn],
          }),
        ],
      }),
    );

    userPool.addClient("WebClient", {
      userPoolClientName: "WebClient",
      generateSecret: false,
      preventUserExistenceErrors: true,
      authFlows: {
        userSrp: true,
        adminUserPassword: true,
        userPassword: true,
        custom: true,
      },
      accessTokenValidity: cdk.Duration.hours(2),
      idTokenValidity: cdk.Duration.hours(2),
      refreshTokenValidity: cdk.Duration.days(365),
      writeAttributes: new ClientAttributes().withStandardAttributes({
        email: true,
        givenName: true,
        middleName: true,
        familyName: true,
        phoneNumber: true,
        locale: true,
        profilePicture: true,
        fullname: true,
      }),
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [OAuthScope.OPENID, OAuthScope.PHONE, OAuthScope.EMAIL, OAuthScope.PROFILE],
        callbackUrls: [
          `https://${props.serviceStack.prodHostedZone.zoneName}/login`,
          `https://${props.serviceStack.devHostedZone.zoneName}/login`,
          "http://localhost:3000/login",
        ],
        logoutUrls: [
          `https://${props.serviceStack.prodHostedZone.zoneName}/`,
          `https://${props.serviceStack.devHostedZone.zoneName}/`,
          "http://localhost:3000/",
        ],
      },
    });
    MicrowsEventBridgeLambda(this, "ExampleEventBridge", {
      layers: [baseLayer],
      entry: "exampleLambda.ts",
      eventbridge: {
        eventBus: microwsEventBus,
        pattern: {
          detailType: ["MicrowsCDC"],
          source: ["Ordering:Main"],
          detail: {
            metadata: {
              event: ["CDCInvoice"],
              status: ["MODIFY"],
            },
            data: {
              oldImage: {
                GSI1PK: [
                  {
                    "anything-but": "Invoice-Paid",
                  },
                ],
              },
              newImage: {
                GSI1PK: ["Invoice-Paid"],
              },
            },
          },
        },
      },
      environment: {
        NODE_ENV: props.stage,
      },
    });

    const resizeImages = MicrowsLambdaFunction(this, "CloudFrontImageResize", {
      layers: [baseLayer, imageLayer],
      entry: "staticResize.ts",
      environment: environmentVariables("lambda", ["MEDIA_IMAGES_BUCKET"]),
      architecture: Architecture.ARM_64,
      memorySize: 1536,
      timeout: cdk.Duration.minutes(5),
    });
    mediaBucket.grantReadWrite(resizeImages);

    const processImages = MicrowsEventBridgeLambda(this, "ProcessImages", {
      eventbridge: {
        eventBus: amazonEventBus,
        pattern: {
          source: ["aws.s3"],
          detailType: ["Object Created"],
          detail: {
            bucket: {
              name: [mediaBucket.bucketName],
            },
            object: {
              key: [{ prefix: "ingest/" }],
            },
          },
        },
      },
      layers: [baseLayer, imageLayer],
      entry: "processImages.ts",
      environment: environmentVariables("lambda", ["MEDIA_IMAGES_BUCKET"]),
      architecture: Architecture.ARM_64,
      memorySize: 1536,
      timeout: cdk.Duration.minutes(5),
    });
    mediaBucket.grantReadWrite(processImages);

    const resizeImagesFunctionURL = resizeImages.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
    });
    const cfFunction = new Function(this, "Function", {
      code: FunctionCode.fromInline(`function handler(event) {
        console.log(event);
        var standardSizes = [
          //always in doubles, in case we want DPI
          75, 150, 300, 600, 1200, 2400,
          //doubles starting at 100
          100, 200, 400, 800, 1600, 3200,
        ].sort((a, b) => a - b);
        var format = "webp";
        var size = 150;
        if(event.request.querystring && event.request.querystring.width && event.request.querystring.width.value) {
          var requestedSize = parseInt(event.request.querystring.width.value);
          size = standardSizes.find((standardSize) => {
            return standardSize >= requestedSize;
          });
        }
        event.request.uri = [
          event.request.uri.replace(/^\\/static\\/media\\//, "/cached/"),
          encodeURIComponent(size)
        ].join("/");
        console.log(event.request.uri);
        return event.request;
      }`),
    });

    const queryStringCachePolicy = new CachePolicy(this, "QueryStringCachePolicy", {
      // cachePolicyName: "QueryStringCachingOptimized",
      comment: "Caching policy when including query string",
      defaultTtl: cdk.Duration.days(1),
      minTtl: cdk.Duration.seconds(1),
      maxTtl: cdk.Duration.days(365),
      cookieBehavior: CacheCookieBehavior.none(),
      headerBehavior: CacheCookieBehavior.none(),
      queryStringBehavior: CacheQueryStringBehavior.all(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });
    const distribution = new Distribution(this, `CloudFront`, {
      defaultBehavior: {
        origin: new HttpOrigin("base." + hostedZone.zoneName, {
          customHeaders: {
            "x-security-token": loadBalancerSecret.secretValue.unsafeUnwrap(),
          },
        }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_DISABLED,
        allowedMethods: AllowedMethods.ALLOW_ALL,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
      },
      comment: `${props.stage}Website`,
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      sslSupportMethod: SSLMethod.SNI,
      domainNames: [
        props.stage == "prod" ? hostedZone.zoneName : null,
        [props.recordName, hostedZone.zoneName].join("."),
      ].filter(Boolean),
      certificate: props.certificate,
      httpVersion: HttpVersion.HTTP2_AND_3,
      additionalBehaviors: {
        "/static/media/*": {
          origin: new OriginGroup({
            primaryOrigin: new S3Origin(mediaBucket),
            fallbackOrigin: new FunctionUrlOrigin(resizeImagesFunctionURL, {
              originShieldEnabled: true,
            }),
            fallbackStatusCodes: [404, 403],
          }),
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: queryStringCachePolicy,

          functionAssociations: [
            {
              eventType: FunctionEventType.VIEWER_REQUEST,
              function: cfFunction,
            },
          ],
        },
        "/static/*": {
          origin: new S3Origin(props.serviceStack.bucket),
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        },
      },
    });
    const mainRecord = new ARecord(this, "WWWDomainARecord", {
      zone: hostedZone,
      recordName: props.recordName,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });
    if (props.stage == "prod") {
      new ARecord(this, "RootDomainARecord", {
        zone: hostedZone,
        target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      });
    }
    const adminDistribution = new Distribution(this, `AdminCloudFront`, {
      defaultBehavior: {
        origin: new HttpOrigin("base." + hostedZone.zoneName, {
          customHeaders: {
            "x-admin-security-token": loadBalancerSecret.secretValue.unsafeUnwrap(),
          },
        }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_DISABLED,
        allowedMethods: AllowedMethods.ALLOW_ALL,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
      },
      comment: `${props.stage}Admin`,
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      sslSupportMethod: SSLMethod.SNI,
      domainNames: [[props.adminRecordName, hostedZone.zoneName].join(".")],
      certificate: props.certificate,
      httpVersion: HttpVersion.HTTP2_AND_3,
      additionalBehaviors: {
        "/static/media/*": {
          origin: new OriginGroup({
            primaryOrigin: new S3Origin(mediaBucket),
            fallbackOrigin: new FunctionUrlOrigin(resizeImagesFunctionURL, {
              originShieldEnabled: true,
            }),
            fallbackStatusCodes: [404, 403],
          }),
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: queryStringCachePolicy,

          functionAssociations: [
            {
              eventType: FunctionEventType.VIEWER_REQUEST,
              function: cfFunction,
            },
          ],
        },
        "/static/*": {
          origin: new S3Origin(props.serviceStack.bucket),
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        },
      },
    });
    new cdk.aws_route53.ARecord(this, "AdminDomain", {
      zone: hostedZone,
      recordName: props.adminRecordName,
      target: RecordTarget.fromAlias(new CloudFrontTarget(adminDistribution)),
    });

    if (props.dockerBuildSha256) {
      const { fargateTaskDefinition } = MicrowsService(this, {
        name: "Base",
        env: props.stage,
        image: ContainerImage.fromEcrRepository(props.serviceStack.repository, props.dockerBuildSha256),
        priority: 50000,
        patterns: [
          ListenerCondition.hostHeaders(
            [
              [props.recordName, hostedZone.zoneName].join("."),
              props.stage == "prod" ? hostedZone.zoneName : null,
              [props.adminRecordName, hostedZone.zoneName].join("."),
            ].filter(Boolean),
          ),
          ListenerCondition.pathPatterns(["*"]),
        ],
        secrets: ecsSecrets(["SECRET_ENV"]),
        environmentVariables: {
          ...environmentVariables("ecs", ["MAIN_TABLE", "MEDIA_IMAGES_BUCKET", "APP_CONFIG", "STATIC_BUCKET"]),
          NODE_ENV: props.stage,
        },
      });
      mainTable.grantReadWriteData(fargateTaskDefinition.taskRole);

      fargateTaskDefinition.addContainer("AppConfigAgent", {
        image: ContainerImage.fromRegistry("public.ecr.aws/aws-appconfig/aws-appconfig-agent:2.x"),
        logging: LogDrivers.awsLogs({
          streamPrefix: "website",
          logRetention: RetentionDays.ONE_MONTH,
        }),
        portMappings: [
          {
            containerPort: 2772,
          },
        ],
        environment: {
          POLL_INTERVAL: "5",
          EVIDENTLY_CONFIGURATIONS: props.serviceStack.appConfig.configuration,
          PREFETCH_LIST: props.serviceStack.appConfig.configuration,
        },
      });
      props.serviceStack.appConfig.environment.grantReadConfig(fargateTaskDefinition.taskRole);
      fargateTaskDefinition.taskRole.addToPrincipalPolicy(
        new PolicyStatement({
          actions: ["evidently:PutProjectEvents"],
          effect: Effect.ALLOW,
          resources: [props.serviceStack.evidently.attrArn],
        }),
      );
    }

    const domain = new UserPoolDomain(this, "Domain", {
      userPool,
      customDomain: {
        domainName: [props.authRecordName, hostedZone.zoneName].join("."),
        certificate: props.certificate,
      },
    });
    domain.node.addDependency(mainRecord);

    new cdk.aws_route53.CnameRecord(this, "AuthDomain", {
      zone: hostedZone,
      recordName: props.authRecordName,
      domainName: domain.cloudFrontDomainName,
    });
  }
}
