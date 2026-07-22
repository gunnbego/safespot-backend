import type { Organisation, PhotoPurpose, SafetyReport, SafetyReportPhoto, Team, User } from "@prisma/client";
import { Role } from "@prisma/client";
import { isManagerRole } from "./access.js";

/**
 * The untouched frontend only understands MANAGER/MEMBER, so OWNER is
 * presented as MANAGER on the wire (owners get full manager behaviour).
 */
export const wireRole = (role: Role): Role => (role === Role.OWNER ? Role.MANAGER : role);

/**
 * Wire-format DTOs. The JSON field names intentionally keep the legacy
 * "organization" (z) spelling and the legacy `/api/audits` vocabulary so the
 * existing frontend keeps working unchanged.
 */

export interface UserDto {
  id: number;
  username: string;
  email: string | null;
  phone: string | null;
  role: Role;
  teamId: number | null;
  teamName: string | null;
  organizationId: number;
  organizationName: string | null;
}

export const mapUserDto = (
  user: User & { team?: Team | null; organisation?: Organisation | null },
): UserDto => ({
  id: user.id,
  username: user.username,
  email: user.email,
  phone: user.phone,
  role: wireRole(user.role),
  teamId: user.teamId,
  teamName: user.team?.name ?? null,
  organizationId: user.organisationId,
  organizationName: user.organisation?.name ?? null,
});

export interface TeamDto {
  id: number;
  name: string;
  memberCount: number;
  members: string[];
}

export const mapTeamDto = (team: Team & { users: Pick<User, "username">[] }): TeamDto => ({
  id: team.id,
  name: team.name,
  memberCount: team.users.length,
  members: team.users.map(u => u.username),
});

export interface OrganizationDto {
  id: number;
  name: string;
  slug: string;
  tier: string;
  subscriptionStatus: string;
  createdAt: Date;
}

export const mapOrganisationDto = (organisation: Organisation): OrganizationDto => ({
  id: organisation.id,
  name: organisation.name,
  slug: organisation.slug,
  tier: organisation.tier,
  subscriptionStatus: organisation.subscriptionStatus,
  createdAt: organisation.createdAt,
});

export interface AuditPhotoDto {
  id: number;
  fileName: string | null;
  contentType: string;
  sizeBytes: number;
  dataUrl: string | null;
  imageUrl: string | null;
  purpose: PhotoPurpose;
}

export const mapPhotoDto = (photo: SafetyReportPhoto): AuditPhotoDto => ({
  id: photo.id,
  fileName: photo.fileName,
  contentType: photo.contentType,
  sizeBytes: photo.sizeBytes,
  dataUrl: photo.data ? `data:${photo.contentType};base64,${Buffer.from(photo.data).toString("base64")}` : null,
  imageUrl: photo.blobPathname ? `/audits/${photo.reportId}/photos/${photo.id}` : null,
  purpose: photo.purpose,
});

export interface AuditDto {
  id: number;
  title: string;
  notes: string | null;
  category: string;
  severity: string;
  status: string;
  createdBy: string;
  submittedBy: string;
  createdAt: Date;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  resolutionComment: string | null;
  photoCount: number;
  photos: AuditPhotoDto[];
}

type ReportWithNames = SafetyReport & {
  createdBy: Pick<User, "username">;
  resolvedBy: Pick<User, "username"> | null;
};

/**
 * Members never see who submitted someone else's report — the legacy backend
 * anonymised the creator for MEMBER requesters.
 */
export const mapAuditDto = (
  report: ReportWithNames,
  requester: { username: string; role: Role },
  photos: SafetyReportPhoto[] | null,
  photoCount: number,
): AuditDto => {
  let createdBy = report.createdBy.username;
  if (!isManagerRole(requester.role) && requester.username !== createdBy) {
    createdBy = "anonymous";
  }
  return {
    id: report.id,
    title: report.title,
    notes: report.notes,
    category: report.category,
    severity: report.severity,
    status: report.status,
    createdBy,
    submittedBy: createdBy,
    createdAt: report.createdAt,
    resolvedBy: report.resolvedBy?.username ?? null,
    resolvedAt: report.resolvedAt,
    resolutionComment: report.resolutionComment,
    photoCount,
    photos: photos ? photos.map(mapPhotoDto) : [],
  };
};
