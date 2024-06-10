declare module "*.module.less" {
  const classes: { [key: string]: string };
  export default classes;
}
declare module "*.png" {
  const value: string;
  export default value;
}
declare module "*.mp4" {
  const value: string;
  export default value;
}
declare module "*.jpg" {
  const value: string;
  export default value;
}
declare module "*.jpeg" {
  const value: string;
  export default value;
}
declare module "*.webv" {
  const value: string;
  export default value;
}
declare module "*.svg" {
  const value: string;
  export default value;
}
declare global {
  interface Window {
    config: any;
  }
}
