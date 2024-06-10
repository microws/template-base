import * as jsxruntime from "react/jsx-runtime";
import * as react from "react";
import { createRoot } from "react-dom/client";
import * as reactrouterdomin from "react-router-dom";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import localizedFormat from "dayjs/plugin/localizedFormat.js";
dayjs.extend(relativeTime);
dayjs.extend(timezone);
dayjs.extend(utc);
dayjs.extend(customParseFormat);
dayjs.extend(localizedFormat);

const reactrouterdom = {
  BrowserRouter: reactrouterdomin.BrowserRouter,
  Outlet: reactrouterdomin.Outlet,
  NavLink: reactrouterdomin.NavLink,
  Link: reactrouterdomin.Link,
  Navigate: reactrouterdomin.Navigate,
  Route: reactrouterdomin.Route,
  Routes: reactrouterdomin.Routes,
  useNavigate: reactrouterdomin.useNavigate,
  useParams: reactrouterdomin.useParams,
  useSearchParams: reactrouterdomin.useSearchParams,
};
const reactdomclient = { createRoot };

export * as MicrowsWeb from "@microws/web";
export * as jotai from "jotai";
export * as SSE from "@microsoft/fetch-event-source";
export * as query from "@tanstack/react-query";
export { react, jsxruntime, reactdomclient, reactrouterdom };
export { dayjs };
