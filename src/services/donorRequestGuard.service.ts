export const getPendingCooldownHours = (expiresAtMs?: number) => {
  if (!expiresAtMs) return 24;
  const diffMs = expiresAtMs - Date.now();
  return diffMs > 0 ? Math.ceil(diffMs / (1000 * 60 * 60)) : 24;
};

export const isSelfDonorTarget = (userUid: string | undefined, donorId: string) => {
  return Boolean(userUid) && donorId === userUid;
};

export const filterSelfTargets = <T extends { id: string }>(targets: T[], userUid?: string) => {
  if (!userUid) return targets;
  return targets.filter((target) => target.id !== userUid);
};
