/** BunnyCDN object key for a member ID photo. */
export function buildMemberPhotoStoragePath(
  communityId: string,
  contentType = 'image/jpeg',
  now = Date.now(),
): string {
  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const safeId =
    String(communityId || 'member')
      .replace(/[^A-Za-z0-9_-]/g, '')
      .slice(0, 64) || 'member';
  return `member-photos/${safeId}-${now}.${ext}`;
}
