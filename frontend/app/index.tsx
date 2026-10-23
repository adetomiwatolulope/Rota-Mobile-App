import { Redirect } from "expo-router";
import { PageHead } from "@/components/PageHead";

export default function Index() {
  return (
    <>
      <PageHead noIndex path="/" />
      <Redirect href="/splash" />
    </>
  );
}
