import { MicrowsModule } from "@microws/web";
import { Route, Routes } from "react-router-dom";

const MarketingRoutes = MicrowsModule("website-marketing");
const AccountRoutes = MicrowsModule("website-account");
export function Example() {
  return (
    <Routes>
      <Route path="/example/*" element={<MarketingRoutes param={"example"} />} />
      <Route path="/account/*" element={<AccountRoutes exampleParam={"example2"} />} />
      <Route path="*" element={<>Good Stuff Here</>} />
    </Routes>
  );
}
