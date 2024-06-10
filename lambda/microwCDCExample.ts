import { Context, EventBridgeEvent } from "aws-lambda";
import { ISODateTime } from "@microws/types";
export async function handler(
  event: EventBridgeEvent<
    "MicrowsCDC",
    {
      metadata: {
        event: string;
        environment: "dev" | "prod";
        date: ISODateTime;
        origId: string;
        id: string;
      };
      data: {
        newImage: any;
      };
    }
  >,
  context: Context,
) {
  let order = event.detail.data.newImage;

  console.log(order);
}
