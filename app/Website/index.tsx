import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import "./all.less";
import { AmplifyConfigure, Hub, MicrowsAppWrapper, MicrowsModule, microwsRender } from "@microws/web";
import { Example } from "./components/exampleFile.tsx";

Hub.listen("auth", async ({ payload }) => {
  switch (payload.event) {
    case "signInWithRedirect":
      break;
    case "signInWithRedirect_failure":
    case "customOAuthState":
      try {
        if (typeof payload.data == "string") {
          globalThis.cognitoState = JSON.parse(payload.data);
        } else {
          globalThis.cognitoState = payload.data;
        }
      } catch (e) {}
      break;
  }
});
AmplifyConfigure({
  Auth: {
    Cognito: {
      userPoolId: window.config.userPoolId,
      userPoolClientId: window.config.userPoolClientId,
      identityPoolId: null,
      loginWith: {
        oauth: {
          domain: window.config.cognitoDomain,
          scopes: ["openid", "profile", "email"],
          redirectSignIn: [globalThis.location.origin + "/login"],
          redirectSignOut: [globalThis.location.origin + "/"],
          responseType: "code",
        },
      },
      allowGuestAccess: false,
    },
  },
});

microwsRender(
  <MicrowsAppWrapper config={globalThis.config}>
    <Router future={{ v7_startTransition: true }}>
      <Example />
    </Router>
  </MicrowsAppWrapper>,
);
