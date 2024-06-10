import { GetParametersCommand, SSMClient } from "@aws-sdk/client-ssm";

export async function initLambda() {
  const ssmClient = new SSMClient({});
  let secretVariables = Object.entries(process.env)
    .filter(([name, value]) => {
      return value.startsWith("secretstring:/");
    })
    .map(([name, path]) => {
      return {
        name,
        path: path.replace("secretstring:/", "/"),
      };
    });

  const environmentVariables = [];
  if (secretVariables.length) {
    let { Parameters } = await ssmClient.send(
      new GetParametersCommand({
        Names: secretVariables.map((v) => v.path),
        WithDecryption: true,
      }),
    );
    Parameters.forEach((param) => {
      let v = secretVariables.find((v) => v.path == param.Name);
      environmentVariables.push(`${v.name}=${JSON.stringify(param.Value)}`);
    });
  }
  console.log(environmentVariables.join(" "));
}

await initLambda();
