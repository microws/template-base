import sharp from "sharp";
import { s3Client } from "@microws/aws";
import { S3ObjectCreatedNotificationEvent } from "aws-lambda";

//https://aws.amazon.com/blogs/networking-and-content-delivery/image-optimization-using-amazon-cloudfront-and-aws-lambda/

//Use Origin Failover to trigger the functon using a Lambda Function URL
//https://aws.amazon.com/blogs/compute/protecting-an-aws-lambda-function-url-with-amazon-cloudfront-and-lambdaedge/
export async function handler(event: S3ObjectCreatedNotificationEvent) {
  let details = event.detail;

  //just some sanity checks
  if (details.bucket.name != process.env.MEDIA_IMAGES_BUCKET) {
    throw new Error("Invalid Bucket");
  }
  const pathParts: Array<string> = details.object.key.split(/\//g);
  let junk = pathParts.shift();
  if (junk !== "ingest") {
    throw new Error("Invalid Location");
  }
  //end sanity checks

  const path = pathParts.join("/");
  let results = await s3Client.get({
    Bucket: process.env.MEDIA_IMAGES_BUCKET,
    Key: "ingest/" + path,
  });
  let data = await sharp(await results.Body.transformToByteArray())
    .toFormat("webp", {
      lossless: true,
    })
    .toBuffer();

  await s3Client.put({
    Bucket: process.env.MEDIA_IMAGES_BUCKET,
    Key: "processed/" + path.replace(/\.[^\.]*$/, "") + ".webp",
    Body: data,
    ContentType: "image/webp",
  });
}
