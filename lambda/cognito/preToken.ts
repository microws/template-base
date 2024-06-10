import { dynamodb } from "@microws/aws";
import { PreTokenGenerationTriggerEvent } from "aws-lambda";

export async function handler(event: PreTokenGenerationTriggerEvent) {
  let { Item: social } = await dynamodb.get({
    Key: {
      PK: "SocialLink",
      SK: event.userName,
    },
  });

  let user: any = null;
  if (social?.userId) {
    let { Item } = await dynamodb.get({
      Key: {
        PK: social.userId,
        SK: "User",
      },
    });
    if (!Item?.PK) {
      throw new Error("Shouldn't be possible");
    }
    user = Item;
  }

  if (user?.type == "User") {
    event.response.claimsOverrideDetails = {
      claimsToAddOrOverride: {
        id: user.PK,
        name: user.name,
        email: user.email,
      },
      groupOverrideDetails: {
        groupsToOverride: event.request.groupConfiguration.groupsToOverride.concat(["User"]),
      },
    };
  } else {
    event.response.claimsOverrideDetails = {
      claimsToAddOrOverride: {
        id: user?.PK,
      },
      groupOverrideDetails: {
        groupsToOverride: ["Guest"],
      },
    };
  }

  return event;
}
