import { EventBridgeEvent } from "aws-lambda";
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
        newImage: {
          PK: string;
          SK: string;
          GSI1PK: string;
          GSI1SK: string;
          id: string;
          status: "paid" | "pending";
        };
      };
    }
  >,
) {
  let invoice = event.detail.data.newImage;
  console.log(invoice);
}
