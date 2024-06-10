import sharp from "sharp";
import { s3Client } from "@microws/aws";

//https://aws.amazon.com/blogs/networking-and-content-delivery/image-optimization-using-amazon-cloudfront-and-aws-lambda/

//Use Origin Failover to trigger the functon using a Lambda Function URL
//https://aws.amazon.com/blogs/compute/protecting-an-aws-lambda-function-url-with-amazon-cloudfront-and-lambdaedge/
export async function handler(event) {
  const pathParts: Array<string> = event.rawPath.split(/\//g);
  const size = parseInt(pathParts.pop());

  let sanityCheck = pathParts.shift();
  sanityCheck = pathParts.shift();
  if (sanityCheck !== "cached") {
    throw new Error("404");
  }
  const path = pathParts.join("/");

  let results = await s3Client.get({
    Bucket: process.env.MEDIA_IMAGES_BUCKET,
    Key: "processed/" + path.replace(/\.[^.]*$/, ".webp"),
  });
  let data = await sharp(await results.Body.transformToByteArray())
    .resize({ width: size })
    .toFormat("webp", {
      quality: 80,
    })
    .toBuffer();

  await s3Client.put({
    Bucket: process.env.MEDIA_IMAGES_BUCKET,
    Key: event.rawPath.replace(/^\//, ""),
    Body: data,
    ContentType: "image/webp",
    CacheControl: `public, max-age=${60 * 60 * 24 * 365}`,
  });

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": `public, max-age=${60 * 60 * 24 * 365}`,
    },
    body: data.toString("base64"),
    isBase64Encoded: true,
  };
}
