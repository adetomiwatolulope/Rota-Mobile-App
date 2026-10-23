// React Native Web renders <View> / <Pressable> / <Text> as an <a> element when
// an `href` prop is supplied. React Native's own type definitions describe the
// native props only, so declare the web-only link props here. They are ignored
// by the native renderer, which is safe because these components are web-only.
import "react-native";

declare module "react-native" {
  interface PressableProps {
    href?: string;
    hrefAttrs?: {
      download?: boolean | string;
      rel?: string;
      target?: "blank" | "self" | "parent" | "top";
    };
  }
}
