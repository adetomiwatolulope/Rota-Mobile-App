import { useLocalSearchParams } from "expo-router";
import { InviteAcceptScreen } from "@/features/invites/InviteAcceptScreen";

/** Invite opened as `rota://invite?token=...`. */
export default function Invite() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  return <InviteAcceptScreen token={token} />;
}
