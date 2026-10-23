/**
 * api/team.ts — Typed calls for the Phase 2 team features. Every call takes the
 * access token from secure storage. The API is the authority; these functions
 * only move data.
 */
import type {
  BusinessSummary,
  CreateBusinessInput,
  InvitePreview,
  InviteSummary,
  MemberSummary,
  Role,
} from "@rota/shared";
import { apiDelete, apiGet, apiPatch, apiPost, type ApiResult } from "./client";
import { getAccessToken } from "@/lib/secureStore";

async function token(): Promise<string | undefined> {
  return (await getAccessToken()) ?? undefined;
}

export async function createBusiness(
  input: CreateBusinessInput,
): Promise<ApiResult<BusinessSummary>> {
  return apiPost<BusinessSummary>("/businesses", input, await token());
}

export async function listBusinesses(): Promise<ApiResult<{ businesses: BusinessSummary[] }>> {
  return apiGet<{ businesses: BusinessSummary[] }>("/businesses", await token());
}

export async function getBusiness(
  businessId: string,
): Promise<ApiResult<BusinessSummary & { locations: { id: string; name: string }[] }>> {
  return apiGet(`/businesses/${businessId}`, await token());
}

export async function listMembers(
  businessId: string,
): Promise<ApiResult<{ members: MemberSummary[] }>> {
  return apiGet<{ members: MemberSummary[] }>(
    `/businesses/${businessId}/members`,
    await token(),
  );
}

export async function listInvites(
  businessId: string,
): Promise<ApiResult<{ invites: InviteSummary[] }>> {
  return apiGet<{ invites: InviteSummary[] }>(
    `/businesses/${businessId}/invites`,
    await token(),
  );
}

export async function inviteMember(
  businessId: string,
  input: { email: string; role: Role; positionIds?: string[] },
): Promise<ApiResult<{ invite: InviteSummary; code: string; link: string }>> {
  return apiPost(
    `/businesses/${businessId}/invites`,
    { positionIds: [], ...input },
    await token(),
  );
}

export async function resendInvite(
  inviteId: string,
): Promise<ApiResult<{ invite: InviteSummary; code: string; link: string }>> {
  return apiPost(`/invites/${inviteId}/resend`, {}, await token());
}

export async function revokeInvite(inviteId: string): Promise<ApiResult<{ revoked: true }>> {
  return apiDelete(`/invites/${inviteId}`, await token());
}

export async function changeMemberRole(
  membershipId: string,
  role: "MANAGER" | "STAFF",
): Promise<ApiResult<{ updated: true }>> {
  return apiPatch(`/members/${membershipId}`, { role }, await token());
}

export async function removeMember(
  membershipId: string,
): Promise<ApiResult<{ removed: true }>> {
  return apiDelete(`/members/${membershipId}`, await token());
}

export async function previewInvite(tokenValue: string): Promise<ApiResult<InvitePreview>> {
  return apiGet<InvitePreview>(
    `/invites/preview?token=${encodeURIComponent(tokenValue)}`,
    await token(),
  );
}

export async function acceptInvite(input: {
  token: string;
  code: string;
}): Promise<ApiResult<{ businessId: string; role: Role }>> {
  return apiPost("/invites/accept", input, await token());
}
