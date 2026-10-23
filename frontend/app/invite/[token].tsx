import { useLocalSearchParams } from "expo-router";
import { InviteAcceptScreen } from "@/features/invites/InviteAcceptScreen";

/** Invite opened as `rota://invite/<token>` (the link the API sends). [FR-006] */
export default function InviteByToken() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  return <InviteAcceptScreen token={token} />;
}
