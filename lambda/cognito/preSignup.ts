import { AutoCompleteFormatter, CreateDynamoDBUpdateParams, cognitoClient, dynamodb } from "@microws/aws";
import { PreSignUpTriggerEvent } from "aws-lambda";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { createGuidString } from "@microws/utils";
export async function handler(event: PreSignUpTriggerEvent) {
  if (event.triggerSource == "PreSignUp_AdminCreateUser") {
    return event;
  } else if (event.triggerSource == "PreSignUp_ExternalProvider") {
    let [providerName, providerUserId] = event.userName.split(/_/);
    const userId = createGuidString();
    await dynamodb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: CreateDynamoDBUpdateParams({
              Key: {
                PK: "SocialLink",
                SK: event.userName,
              },
              row: {
                TypePK: "SocialLink",
                TypeSK: new Date().toISOString(),
                GSI1PK: userId,
                GSI1SK: "SocialLink-" + new Date().toISOString(),

                userId: userId,
                userName: event.userName,
                id: event.request.userAttributes.sub,
                attributes: event.request.userAttributes,
                providerName: {
                  facebook: "Facebook",
                  google: "Google",
                  signinwithapple: "SignInWithApple",
                  amazon: "Amazon",
                }[providerName],
                providerUserId,
              },
            }),
          },
          {
            Put: {
              TableName: process.env.MAIN_TABLE,
              Item: {
                PK: userId,
                SK: "User",
                TypePK: "User",
                TypeSK: new Date().toISOString(),
                GSI1PK: userId,
                GSI1SK: "User-" + new Date().toISOString(),
                Auto1PK: "user-email",
                Auto1SK: AutoCompleteFormatter.keyword(event.request.userAttributes.email, true),
                Auto2PK: "user-name",
                Auto2SK: AutoCompleteFormatter.keyword(event.request.userAttributes.name, true),
                Auto3PK: "user-lastname",
                Auto3SK: AutoCompleteFormatter.keyword(
                  event.request.userAttributes.name?.split(/\s/).pop() +
                    " " +
                    event.request.userAttributes.name?.split(/\s/).slice(0, -1),
                  true,
                ),
                Auto4PK: "user-id",
                Auto4SK: AutoCompleteFormatter.short6Id(userId, true),

                auto: {
                  name: event.request.userAttributes.name,
                  email: event.request.userAttributes.email,
                  img: event.request.userAttributes.picture,
                },
                cognitoUserName: event.userName,
                cognitoId: event.request.userAttributes.sub,
                type: "Guest",
              },
              ConditionExpression: `attribute_not_exists(PK)`,
            },
          },
        ],
      }),
    );
    return event;
  }
  throw new Error("Cannot signup");
}
