// Asset module declarations for the Expo app.
//
// Metro bundles stylesheets and images and hands back a module; TypeScript needs
// to be told the shape. The generated design-token CSS is imported as a side
// effect, and image assets resolve to the numeric asset id that React Native's
// <Image source={...}> accepts.
declare module "*.css";

declare module "*.png" {
  const asset: number;
  export default asset;
}
